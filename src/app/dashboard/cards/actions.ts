"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  identifyCard,
  estimateCardValue,
  type CardCategory,
} from "@/lib/ai/client";

const BUCKET = "card-images";

const VALID_CATEGORIES: ReadonlyArray<CardCategory> = ["sports", "tcg", "other"];
const VALID_INTENTS = ["grade", "sell", "consign"] as const;
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

export type IdentifyState =
  | {
      ok: true;
      identification: Identification;
      model: string | null;
      recognitionError: string | null;
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
    return { ok: true, model: null, recognitionError: "Could not read the uploaded front photo.", identification: empty };
  }
  const back = input.backPath ? await downloadImage(supabase, input.backPath) : null;

  const images = [front, ...(back ? [back] : [])];

  try {
    const r = await identifyCard({ images, hint: input.hint });
    return {
      ok: true,
      model: r.model,
      recognitionError: null,
      identification: {
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
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Identification failed.";
    return { ok: true, model: null, recognitionError: msg, identification: empty };
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
  const statusRaw = String(formData.get("status") ?? "received").trim();
  const status = (VALID_STATUSES as ReadonlyArray<string>).includes(statusRaw)
    ? statusRaw
    : "received";

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

  const { data, error } = await supabase
    .from("cards")
    .insert({
      owner_id: user.id,
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
      grade: String(formData.get("grade") ?? "").trim() || null,
      fmv_cents: fmvCents,
      fmv_source: fmvCents !== null ? "operator" : null,
      fmv_notes: String(formData.get("fmv_notes") ?? "").trim() || null,
      intent,
      status,
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
      grade: String(formData.get("grade") ?? "").trim() || null,
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

  const { data: card } = await supabase
    .from("cards")
    .select("image_path, image_back_path")
    .eq("id", cardId)
    .eq("owner_id", user.id)
    .maybeSingle();

  await supabase.from("cards").delete().eq("id", cardId).eq("owner_id", user.id);

  const paths = [card?.image_path, card?.image_back_path].filter(
    (p): p is string => Boolean(p),
  );
  if (paths.length) {
    await supabase.storage.from(BUCKET).remove(paths);
  }

  revalidatePath("/dashboard/cards");
  revalidatePath("/dashboard");
  redirect("/dashboard/cards");
}
