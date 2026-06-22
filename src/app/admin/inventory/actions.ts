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
  | { ok: true; valued: boolean; added: number }
  | { ok: false; error: string };

/**
 * Staff: add one or more copies of a searched card into the house pack pool,
 * with its market price auto-filled as FMV. House-owned so open_pack can draw it.
 */
export async function addPoolCardFromSearchAction(
  card: PokemonSearchResult,
  quantity = 1,
): Promise<AddPoolResult> {
  if (!isStaff(await getRole())) return { ok: false, error: "Not authorized." };
  const qty = Math.max(1, Math.min(100, Math.round(quantity || 1)));
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

  const base = {
    owner_id: ownerUuid,
    catalog_id: card.id,
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
  };
  const rows = Array.from({ length: qty }, () => ({ ...base }));

  const { error } = await supabase.from("cards").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  return { ok: true, valued: fmvCents !== null, added: qty };
}

/** Staff: current pool copy-counts for a set of catalog cards. */
export async function poolStockAction(
  ids: string[],
): Promise<Record<string, number>> {
  if (!isStaff(await getRole())) return {};
  const local = ids.filter((id) => !id.startsWith("tg:"));
  if (local.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pool_stock_for_catalog", {
    p_ids: local,
  });
  if (error || !Array.isArray(data)) return {};
  const out: Record<string, number> = {};
  for (const r of data as { catalog_id: string; cnt: number }[]) {
    out[r.catalog_id] = r.cnt;
  }
  return out;
}

type HotlistPick = {
  tierKey: string;
  tierName: string;
  bandLabel: string;
  loCents: number;
  hiCents: number;
  catalogId: string;
  name: string;
  setName: string;
  number: string;
  rarity: string;
  imageUrl: string | null;
  marketCents: number;
  poolCnt: number;
};

/** Staff: sourcing hotlist of sought-after cards to acquire, per tier band. */
export async function getHotlistAction(perBand = 3): Promise<HotlistPick[]> {
  if (!isStaff(await getRole())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inventory_hotlist", {
    p_per_band: perBand,
  });
  if (error || !Array.isArray(data)) return [];
  return (
    data as {
      tier_key: string;
      tier_name: string;
      band_label: string;
      lo_cents: number;
      hi_cents: number;
      catalog_id: string;
      name: string;
      set_name: string | null;
      number: string | null;
      rarity: string | null;
      image_url: string | null;
      market_cents: number;
      pool_cnt: number;
    }[]
  ).map((r) => ({
    tierKey: r.tier_key,
    tierName: r.tier_name,
    bandLabel: r.band_label,
    loCents: r.lo_cents,
    hiCents: r.hi_cents,
    catalogId: r.catalog_id,
    name: r.name,
    setName: r.set_name ?? "",
    number: r.number ?? "",
    rarity: r.rarity ?? "",
    imageUrl: r.image_url,
    marketCents: r.market_cents,
    poolCnt: r.pool_cnt,
  }));
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
    catalog_id: card.id,
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
  return { ok: true, valued: true, added: 1 };
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
