"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole, isStaff } from "@/lib/roles";
import { type PokemonSearchResult } from "@/lib/pokemon";
import { searchTcgdexEn, tcgdexDetail } from "@/lib/tcgdex";

export type PoolSearchResult =
  | { ok: true; results: PokemonSearchResult[] }
  | { ok: false; error: string };

/** Staff: search the local card catalog to stock the pool (no photos/research). */
export async function searchPoolCardsAction(
  query: string,
): Promise<PoolSearchResult> {
  if (!isStaff(await getRole())) return { ok: false, error: "Not authorized." };
  const q = query.trim();
  if (!q) return { ok: true, results: [] };

  // Primary: our local Pokémon catalog (fast, complete, no rate limits).
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_pokemon_catalog", {
    p_q: q,
  });
  const local: PokemonSearchResult[] =
    !error && Array.isArray(data)
      ? data.map(
          (c: {
            id: string;
            name: string;
            set_name: string | null;
            number: string | null;
            rarity: string | null;
            image_url: string | null;
            market_cents: number | null;
            language: string | null;
          }) => ({
            id: c.id,
            name: c.name,
            setName: c.set_name ?? "",
            number: c.number ?? "",
            rarity: c.rarity ?? "",
            imageUrl: c.image_url,
            marketPriceCents: c.market_cents,
            language: c.language ?? "en",
          }),
        )
      : [];

  // Supplement sparse local results with a live TCGdex lookup — it carries the
  // newest sets the local catalog may be missing (e.g. recent trainers).
  if (local.length >= 8) return { ok: true, results: local };
  const tg = await searchTcgdexEn(q);
  const seen = new Set(local.map((r) => `${r.name}|${r.number}`));
  const merged = [
    ...local,
    ...tg.filter((r) => !seen.has(`${r.name}|${r.number}`)),
  ].slice(0, 40);
  return { ok: true, results: merged };
}

export type AddPoolResult =
  | { ok: true; valued: boolean }
  | { ok: false; error: string };

/**
 * Staff: add a searched card straight into the house pack pool, with its market
 * price auto-filled as FMV — no photo, no manual research. House-owned so
 * open_pack can draw it.
 */
export async function addPoolCardFromSearchAction(
  card: PokemonSearchResult,
): Promise<AddPoolResult> {
  if (!isStaff(await getRole())) return { ok: false, error: "Not authorized." };
  const supabase = await createClient();

  const { data: ownerUuid } = await supabase.rpc("app_owner_id");
  if (typeof ownerUuid !== "string" || !ownerUuid) {
    return { ok: false, error: "No house owner configured." };
  }

  let fmvCents =
    typeof card.marketPriceCents === "number" && card.marketPriceCents > 0
      ? card.marketPriceCents
      : null;
  let setName = card.setName;
  let rarity = card.rarity;

  // Live TCGdex cards arrive without price/set/rarity — fetch the detail now.
  if (card.id.startsWith("tg:")) {
    const det = await tcgdexDetail(card.id.slice(3));
    if (fmvCents == null) fmvCents = det.priceCents;
    setName = setName || det.setName;
    rarity = rarity || det.rarity;
  }

  const { error } = await supabase.from("cards").insert({
    owner_id: ownerUuid,
    category: "tcg",
    sport_or_game: "Pokémon",
    player_or_character: card.name,
    set_name: setName || null,
    card_number: card.number || null,
    variant: rarity || null,
    id_status: "confirmed",
    id_model: "pokemontcg.io",
    fmv_cents: fmvCents,
    fmv_source: fmvCents !== null ? "market" : null,
    fmv_notes: fmvCents !== null ? "Auto-priced from the card database." : null,
    intent: "sell",
    status: "inventory",
    in_inventory: true,
    image_url: card.imageUrl,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  return { ok: true, valued: fmvCents !== null };
}

const GRADING_COMPANIES = ["PSA", "BGS", "CGC", "SGC", "TAG", "Other"];

/** Staff: stock a graded slab into the pack pool so it can be won in Apex Play. */
export async function addSlabToPoolAction(
  card: PokemonSearchResult,
  details: { gradingCompany: string; grade: string; certNumber?: string },
): Promise<AddPoolResult> {
  if (!isStaff(await getRole())) return { ok: false, error: "Not authorized." };
  const grade = details.grade.trim();
  if (!grade) return { ok: false, error: "Enter the slab grade." };
  const company = GRADING_COMPANIES.includes(details.gradingCompany)
    ? details.gradingCompany
    : "Other";

  const supabase = await createClient();
  const { data: ownerUuid } = await supabase.rpc("app_owner_id");
  if (typeof ownerUuid !== "string" || !ownerUuid) {
    return { ok: false, error: "No house owner configured." };
  }

  // Value comes from the slab price database (raw price × grade multiplier).
  const { data: valued } = await supabase.rpc("slab_value_cents", {
    p_catalog_id: card.id,
    p_company: company,
    p_grade: grade,
  });
  const fmvCents = typeof valued === "number" && valued > 0 ? valued : null;
  let setName = card.setName;

  if (card.id.startsWith("tg:")) {
    const det = await tcgdexDetail(card.id.slice(3));
    setName = setName || det.setName;
  }

  if (fmvCents == null || fmvCents <= 0) {
    return {
      ok: false,
      error: "No market price for this card, so the slab can't be auto-valued.",
    };
  }

  const { error } = await supabase.from("cards").insert({
    owner_id: ownerUuid,
    category: "tcg",
    sport_or_game: "Pokémon",
    player_or_character: card.name,
    set_name: setName || null,
    card_number: card.number || null,
    is_slab: true,
    grading_company: company,
    grade,
    cert_number: details.certNumber?.trim() || null,
    id_status: "confirmed",
    fmv_cents: fmvCents,
    fmv_source: "slab",
    fmv_notes: `${company} ${grade} slab`,
    intent: "sell",
    status: "inventory",
    in_inventory: true,
    image_url: card.imageUrl,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/slabs");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  return { ok: true, valued: true };
}

/** Preview a slab's value from the price database (raw price × grade multiplier). */
export async function slabValuePreviewAction(
  catalogId: string,
  company: string,
  grade: string,
): Promise<number | null> {
  if (!isStaff(await getRole())) return null;
  if (!catalogId || !grade.trim()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("slab_value_cents", {
    p_catalog_id: catalogId,
    p_company: company,
    p_grade: grade.trim(),
  });
  if (error) return null;
  return typeof data === "number" ? data : null;
}
