"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole, isStaff } from "@/lib/roles";
import { searchPokemonCards, type PokemonSearchResult } from "@/lib/pokemon";

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
  if (!error && Array.isArray(data) && data.length > 0) {
    const results: PokemonSearchResult[] = data.map(
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
    );
    return { ok: true, results };
  }

  // Fallback: live database lookup if the catalog has no hit yet.
  try {
    const results = await searchPokemonCards(q);
    return { ok: true, results };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Search failed." };
  }
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

  const fmvCents =
    typeof card.marketPriceCents === "number" && card.marketPriceCents > 0
      ? card.marketPriceCents
      : null;

  const { error } = await supabase.from("cards").insert({
    owner_id: ownerUuid,
    category: "tcg",
    sport_or_game: "Pokémon",
    player_or_character: card.name,
    set_name: card.setName || null,
    card_number: card.number || null,
    variant: card.rarity || null,
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
