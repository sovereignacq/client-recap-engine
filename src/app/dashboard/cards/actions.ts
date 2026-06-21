"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  identifyCard,
  estimateCardValue,
  gradeCard,
  type CardCategory,
  type GradeResult,
} from "@/lib/ai/client";
import { lookupPokemonCard } from "@/lib/pokemon";
import { getRole, isStaff } from "@/lib/roles";

const BUCKET = "card-images";

const VALID_CATEGORIES: ReadonlyArray<CardCategory> = ["sports", "tcg", "other"];
const VALID_INTENTS = ["grade", "sell"] as const;
const VALID_STATUSES = [
  "received",
  "identifying",
  "identified",
  "grading",
  "graded",
  "sold",
  "returned",
] as const;

type Identification = {
  category: CardCategory | "";
  sportOrGame: string;
  playerOrCharacter: string;
  cardYear: string;
  manufacturer: string;
  setName: string;
  cardNumber: string;
  variant: string;
  confidence: number;
  notes: string;
};

export type IdentifyReference = {
  label: string;
  marketPriceCents: number | null;
  imageUrl: string | null;
  url: string | null;
};

export type IdentifyState =
  | {
      ok: true;
      identification: Identification;
      model: string | null;
      recognitionError: string | null;
      reference: IdentifyReference | null;
    }
  | { ok: false; error: string };

async function downloadImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
): Promise<{ base64: string; mimeType: string } | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const buffer = Buffer.from(await data.arrayBuffer());
  return { base64: buffer.toString("base64"), mimeType: data.type || "image/jpeg" };
}

/**
 * Identify a card from images ALREADY uploaded to storage by the browser.
 * We only receive the storage paths here (tiny payload), download the bytes
 * server-side, and run recognition. This avoids routing multi-MB photos
 * through the Server Action / serverless request-body size limits.
 */
export async function identifyByPathsAction(input: {
  frontPath: string;
  backPath: string | null;
  hint: string | null;
}): Promise<IdentifyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (!input.frontPath) {
    return { ok: false, error: "Missing front photo." };
  }

  const empty: Identification = {
    category: "",
    sportOrGame: "",
    playerOrCharacter: "",
    cardYear: "",
    manufacturer: "",
    setName: "",
    cardNumber: "",
    variant: "",
    confidence: 0,
    notes: "",
  };

  const front = await downloadImage(supabase, input.frontPath);
  if (!front) {
    return { ok: true, model: null, recognitionError: "Could not read the uploaded front photo.", identification: empty, reference: null };
  }
  const back = input.backPath ? await downloadImage(supabase, input.backPath) : null;

  const images = [front, ...(back ? [back] : [])];

  try {
    const r = await identifyCard({ images, hint: input.hint });
    const ident: Identification = {
      category: r.category,
      sportOrGame: r.sportOrGame,
      playerOrCharacter: r.playerOrCharacter,
      cardYear: r.cardYear,
      manufacturer: r.manufacturer,
      setName: r.setName,
      cardNumber: r.cardNumber,
      variant: r.variant,
      confidence: r.confidence,
      notes: r.notes,
    };

    // Cross-reference Pokémon cards against the Pokémon TCG database to confirm
    // the read and pull a real market price. Best-effort; failures are ignored.
    let reference: IdentifyReference | null = null;
    if (/pok[eé]mon/i.test(r.sportOrGame) && r.playerOrCharacter) {
      const match = await lookupPokemonCard({
        name: r.playerOrCharacter,
        number: r.cardNumber || null,
        setName: r.setName || null,
      });
      if (match) {
        // Trust the database over the vision read for these canonical fields.
        ident.playerOrCharacter = match.name || ident.playerOrCharacter;
        ident.setName = match.setName || ident.setName;
        ident.cardNumber = match.number || ident.cardNumber;
        if (!ident.variant && match.rarity) ident.variant = match.rarity;
        ident.confidence = Math.max(ident.confidence, 0.9);
        reference = {
          label: `Matched in Pokémon TCG database — ${match.name} · ${match.setName} ${match.number}${match.rarity ? ` · ${match.rarity}` : ""}`,
          marketPriceCents: match.marketPriceCents,
          imageUrl: match.imageUrl,
          url: match.url,
        };
      }
    }

    return {
      ok: true,
      model: r.model,
      recognitionError: null,
      identification: ident,
      reference,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Identification failed.";
    return { ok: true, model: null, recognitionError: msg, identification: empty, reference: null };
  }
}

export type GradeState =
  | { ok: true; grade: GradeResult }
  | { ok: false; error: string };

/**
 * Grade a card from its stored photos (front + optional back). Downloads the
 * images server-side and runs the strict grading pass.
 */
export async function gradeByPathsAction(input: {
  frontPath: string;
  backPath: string | null;
}): Promise<GradeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!input.frontPath) return { ok: false, error: "A front photo is required to grade." };

  const front = await downloadImage(supabase, input.frontPath);
  if (!front) return { ok: false, error: "Could not read the front photo." };
  const back = input.backPath ? await downloadImage(supabase, input.backPath) : null;

  try {
    const grade = await gradeCard({ images: [front, ...(back ? [back] : [])] });
    return { ok: true, grade };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Grading failed.";
    return { ok: false, error: msg };
  }
}

export type EstimateState =
  | {
      ok: true;
      lowCents: number;
      highCents: number;
      confidence: number;
      rationale: string;
      model: string;
    }
  | { ok: false; error: string };

/**
 * Ballpark FMV — only meaningful once the operator has confirmed the
 * identification, so we require at least the core identifying fields. The
 * result is a labeled estimate the operator approves; it is never written
 * to the card automatically.
 */
export async function estimateFmvAction(
  formData: FormData,
): Promise<EstimateState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const playerOrCharacter = String(formData.get("player_or_character") ?? "").trim();
  const setName = String(formData.get("set_name") ?? "").trim();
  if (!playerOrCharacter && !setName) {
    return {
      ok: false,
      error: "Confirm the card's identification first (player/character or set).",
    };
  }

  const categoryRaw = String(formData.get("category") ?? "").trim();
  const category = (VALID_CATEGORIES.includes(categoryRaw as CardCategory)
    ? categoryRaw
    : "") as CardCategory | "";

  // If we already have a real cross-referenced market price (e.g. from the
  // Pokémon TCG database), anchor the estimate to it instead of guessing. This
  // keeps the estimate stable and consistent with the matched market value.
  const refCents = Number(String(formData.get("reference_cents") ?? ""));
  if (Number.isFinite(refCents) && refCents > 0) {
    return {
      ok: true,
      lowCents: Math.round(refCents * 0.85),
      highCents: Math.round(refCents * 1.15),
      confidence: 0.9,
      rationale: "Anchored to the matched market price for this card.",
      model: "market",
    };
  }

  try {
    const r = await estimateCardValue({
      category,
      sportOrGame: String(formData.get("sport_or_game") ?? "").trim(),
      playerOrCharacter,
      cardYear: String(formData.get("card_year") ?? "").trim(),
      manufacturer: String(formData.get("manufacturer") ?? "").trim(),
      setName,
      cardNumber: String(formData.get("card_number") ?? "").trim(),
      variant: String(formData.get("variant") ?? "").trim(),
      grade: String(formData.get("grade") ?? "").trim() || null,
    });
    return {
      ok: true,
      lowCents: r.lowCents,
      highCents: r.highCents,
      confidence: r.confidence,
      rationale: r.rationale,
      model: r.model,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Estimate failed.";
    return { ok: false, error: msg };
  }
}

export type SaveState = { ok: true; id: string } | { ok: false; error: string };

function parseFmvCents(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(/[$,]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Persist a new card. Serial is assigned by the DB trigger. */
export async function createCardAction(formData: FormData): Promise<SaveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const categoryRaw = String(formData.get("category") ?? "").trim();
  const category = VALID_CATEGORIES.includes(categoryRaw as CardCategory)
    ? (categoryRaw as CardCategory)
    : null;

  const playerOrCharacter =
    String(formData.get("player_or_character") ?? "").trim() || null;
  const setName = String(formData.get("set_name") ?? "").trim() || null;

  if (!playerOrCharacter && !setName) {
    return {
      ok: false,
      error: "Add at least the player/character or the set before saving.",
    };
  }

  const intentRaw = String(formData.get("intent") ?? "grade").trim();
  const intent = (VALID_INTENTS as ReadonlyArray<string>).includes(intentRaw)
    ? intentRaw
    : "grade";
  const idConfidenceRaw = String(formData.get("id_confidence") ?? "").trim();
  const idConfidence = idConfidenceRaw ? Number(idConfidenceRaw) : null;

  const idStatusRaw = String(formData.get("id_status") ?? "").trim();
  const idStatus = ["unidentified", "ai_suggested", "confirmed"].includes(
    idStatusRaw,
  )
    ? idStatusRaw
    : "unidentified";

  const submitterId = String(formData.get("submitter_id") ?? "").trim() || null;
  const fmvCents = parseFmvCents(String(formData.get("fmv") ?? ""));

  const idRawStr = String(formData.get("id_raw") ?? "").trim();
  let idRaw: unknown = null;
  if (idRawStr) {
    try {
      idRaw = JSON.parse(idRawStr);
    } catch {
      idRaw = null;
    }
  }

  const gradeReportStr = String(formData.get("grade_report") ?? "").trim();
  let gradeReport: unknown = null;
  let autoGrade: number | null = null;
  if (gradeReportStr) {
    try {
      gradeReport = JSON.parse(gradeReportStr);
      const og = (gradeReport as { overall?: unknown }).overall;
      if (typeof og === "number" && Number.isFinite(og)) autoGrade = og;
    } catch {
      gradeReport = null;
    }
  }
  const autoGradeLabel = String(formData.get("auto_grade_label") ?? "").trim() || null;

  // Staff can stock a card straight into the house pack pool.
  const wantsInventory = String(formData.get("in_inventory") ?? "") === "1";
  const stockInPool = wantsInventory && isStaff(await getRole());

  // Pool cards must be owned by the house owner — that's who open_pack draws
  // from and who the inventory view lists. Otherwise a staff-added pool card
  // would never actually enter the pool.
  let ownerId = user.id;
  if (stockInPool) {
    const { data: ownerUuid } = await supabase.rpc("app_owner_id");
    if (typeof ownerUuid === "string" && ownerUuid) ownerId = ownerUuid;
  }

  // Status is automatic, not picked by the user: pooled stock is "inventory",
  // a freshly graded card starts "graded", otherwise "received".
  const status = stockInPool ? "inventory" : gradeReport ? "graded" : "received";

  const { data, error } = await supabase
    .from("cards")
    .insert({
      owner_id: ownerId,
      submitter_id: submitterId,
      category,
      sport_or_game: String(formData.get("sport_or_game") ?? "").trim() || null,
      player_or_character: playerOrCharacter,
      card_year: String(formData.get("card_year") ?? "").trim() || null,
      manufacturer: String(formData.get("manufacturer") ?? "").trim() || null,
      set_name: setName,
      card_number: String(formData.get("card_number") ?? "").trim() || null,
      variant: String(formData.get("variant") ?? "").trim() || null,
      id_status: idStatus,
      id_confidence:
        idConfidence !== null && Number.isFinite(idConfidence)
          ? idConfidence
          : null,
      id_model: String(formData.get("id_model") ?? "").trim() || null,
      id_raw: idRaw,
      grade: autoGradeLabel, // grade comes only from the assessment, never user input
      auto_grade: autoGrade,
      auto_grade_label: autoGradeLabel,
      grade_report: gradeReport,
      fmv_cents: fmvCents,
      fmv_source: fmvCents !== null ? "operator" : null,
      fmv_notes: String(formData.get("fmv_notes") ?? "").trim() || null,
      intent,
      status,
      in_inventory: stockInPool,
      image_path: String(formData.get("image_path") ?? "").trim() || null,
      image_back_path:
        String(formData.get("image_back_path") ?? "").trim() || null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/cards");
  revalidatePath("/dashboard");
  if (submitterId) revalidatePath(`/dashboard/submitters/${submitterId}`);
  return { ok: true, id: data.id };
}

/** Update an existing card's identification / grade / value / workflow fields. */
export async function updateCardAction(
  cardId: string,
  formData: FormData,
): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const categoryRaw = String(formData.get("category") ?? "").trim();
  const category = VALID_CATEGORIES.includes(categoryRaw as CardCategory)
    ? (categoryRaw as CardCategory)
    : null;

  const intentRaw = String(formData.get("intent") ?? "grade").trim();
  const intent = (VALID_INTENTS as ReadonlyArray<string>).includes(intentRaw)
    ? intentRaw
    : "grade";
  const statusRaw = String(formData.get("status") ?? "received").trim();
  const status = (VALID_STATUSES as ReadonlyArray<string>).includes(statusRaw)
    ? statusRaw
    : "received";
  const idStatusRaw = String(formData.get("id_status") ?? "").trim();
  const idStatus = ["unidentified", "ai_suggested", "confirmed"].includes(
    idStatusRaw,
  )
    ? idStatusRaw
    : "unidentified";

  const submitterId = String(formData.get("submitter_id") ?? "").trim() || null;
  const fmvCents = parseFmvCents(String(formData.get("fmv") ?? ""));

  const { error } = await supabase
    .from("cards")
    .update({
      submitter_id: submitterId,
      category,
      sport_or_game: String(formData.get("sport_or_game") ?? "").trim() || null,
      player_or_character:
        String(formData.get("player_or_character") ?? "").trim() || null,
      card_year: String(formData.get("card_year") ?? "").trim() || null,
      manufacturer: String(formData.get("manufacturer") ?? "").trim() || null,
      set_name: String(formData.get("set_name") ?? "").trim() || null,
      card_number: String(formData.get("card_number") ?? "").trim() || null,
      variant: String(formData.get("variant") ?? "").trim() || null,
      id_status: idStatus,
      // grade is intentionally NOT updatable — it's set only by the assessment.
      fmv_cents: fmvCents,
      fmv_source: fmvCents !== null ? "operator" : null,
      fmv_notes: String(formData.get("fmv_notes") ?? "").trim() || null,
      intent,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/cards/${cardId}`);
  revalidatePath("/dashboard/cards");
}

/** Quick workflow status change from the card detail page. */
export async function updateCardStatusAction(
  cardId: string,
  status: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  if (!(VALID_STATUSES as ReadonlyArray<string>).includes(status)) return;

  await supabase
    .from("cards")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", cardId)
    .eq("owner_id", user.id);

  revalidatePath(`/dashboard/cards/${cardId}`);
  revalidatePath("/dashboard/cards");
}

export async function deleteCardAction(cardId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Soft-delete: archive it. The customer no longer sees it anywhere, but it's
  // retained in the back office for records.
  await supabase
    .from("cards")
    .update({ archived_at: new Date().toISOString(), archived_by: user.id })
    .eq("id", cardId)
    .eq("owner_id", user.id);

  revalidatePath("/dashboard/cards");
  revalidatePath("/dashboard");
  redirect("/dashboard/cards");
}

export type GradingResult =
  | { ok: true; serviceFeeCents: number; usedCredit: boolean; balanceAfter: number }
  | { ok: false; error: string };

/** Submit an intake card to an open grading company (APEX service fee from wallet). */
export async function requestGradingAction(
  cardId: string,
  company: string,
  declaredValueCents: number,
  turnaround: string,
  useCredit: boolean = false,
): Promise<GradingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.rpc("request_grading_submission", {
    p_card_id: cardId,
    p_company: company,
    p_declared_value_cents: Math.round(declaredValueCents),
    p_turnaround: turnaround,
    p_use_credit: useCredit,
  });
  if (error) {
    const msg = /suspended/i.test(error.message)
      ? "Your account is suspended — grading is paused."
      : /not accepting/i.test(error.message)
        ? "That grader isn't accepting submissions right now."
        : /not enough wallet/i.test(error.message)
          ? "Not enough wallet balance for the service fee."
          : /only intake cards/i.test(error.message)
            ? "Only intake cards (not game pulls) can be submitted for grading."
            : error.message;
    return { ok: false, error: msg };
  }
  revalidatePath(`/dashboard/cards/${cardId}`);
  revalidatePath("/dashboard/cards");
  const d = data as {
    service_fee_cents: number;
    used_credit: boolean;
    balance_after: number;
  };
  return {
    ok: true,
    serviceFeeCents: d.service_fee_cents,
    usedCredit: d.used_credit,
    balanceAfter: d.balance_after,
  };
}

export type ShipResult =
  | { ok: true; balanceAfter: number }
  | { ok: false; error: string };

/** Request a physical, insured shipment of a card the user owns (flat fee). */
export async function requestShipmentAction(
  cardId: string,
  address: {
    recipient: string;
    address1: string;
    address2?: string;
    city: string;
    region: string;
    postal: string;
    country?: string;
  },
): Promise<ShipResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.rpc("request_card_shipment", {
    p_card_id: cardId,
    p_recipient: address.recipient,
    p_address1: address.address1,
    p_address2: address.address2 ?? null,
    p_city: address.city,
    p_region: address.region,
    p_postal: address.postal,
    p_country: address.country ?? "US",
  });
  if (error) {
    const msg = /suspended/i.test(error.message)
      ? "Your account is suspended — shipping is paused."
      : /not enough wallet/i.test(error.message)
        ? "Not enough wallet balance for the $14.99 shipping fee."
        : /already in transit/i.test(error.message)
          ? "This card is already on its way or sold."
          : error.message;
    return { ok: false, error: msg };
  }
  revalidatePath("/dashboard/cards");
  const d = data as { balance_after: number };
  return { ok: true, balanceAfter: d.balance_after };
}
