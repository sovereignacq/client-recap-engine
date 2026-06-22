"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PokemonSearchResult } from "@/lib/pokemon";

async function ownsCollection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  collectionId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("collections")
    .select("id")
    .eq("id", collectionId)
    .eq("owner_id", userId)
    .maybeSingle();
  return !!data;
}

export async function createCollectionAction(
  name: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Name your collection." };
  const { data, error } = await supabase
    .from("collections")
    .insert({ owner_id: user.id, name: clean })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/collections");
  return { ok: true, id: data.id };
}

export async function deleteCollectionAction(
  id: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/collections");
}

export async function addApexCardAction(
  collectionId: string,
  cardId: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!(await ownsCollection(supabase, user.id, collectionId)))
    return { error: "Collection not found." };
  // Card must belong to the user (RLS scopes this select to their own).
  const { data: card } = await supabase
    .from("cards")
    .select("id")
    .eq("id", cardId)
    .maybeSingle();
  if (!card) return { error: "That card isn't yours." };
  const { error } = await supabase.from("collection_items").insert({
    collection_id: collectionId,
    owner_id: user.id,
    card_id: cardId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/collections/${collectionId}`);
}

export async function addPhysicalCardAction(
  collectionId: string,
  catalogId: string,
  quantity: number,
): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!(await ownsCollection(supabase, user.id, collectionId)))
    return { error: "Collection not found." };
  const qty = Math.max(1, Math.min(999, Math.round(quantity || 1)));
  const { error } = await supabase.from("collection_items").insert({
    collection_id: collectionId,
    owner_id: user.id,
    catalog_id: catalogId,
    quantity: qty,
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/collections/${collectionId}`);
}

const GRADING_COMPANIES = ["PSA", "BGS", "CGC", "SGC", "TAG", "Other"];

/**
 * Add a slab (graded card) the player owns: pick the card identity from the
 * catalog, then record the grading company, grade and cert number. Creates an
 * APEX card flagged as a slab and drops it into the collection.
 */
export async function addSlabAction(
  collectionId: string,
  input: {
    catalogId: string;
    gradingCompany: string;
    grade: string;
    certNumber?: string;
    valueCents?: number | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!(await ownsCollection(supabase, user.id, collectionId)))
    return { ok: false, error: "Collection not found." };

  const grade = input.grade.trim();
  if (!grade) return { ok: false, error: "Enter the grade (e.g. 10, 9.5)." };
  const company = GRADING_COMPANIES.includes(input.gradingCompany)
    ? input.gradingCompany
    : "Other";

  const { data: cat } = await supabase
    .from("pokemon_cards")
    .select("name, set_name, number, image_url, market_cents")
    .eq("id", input.catalogId)
    .maybeSingle();
  if (!cat) return { ok: false, error: "Pick a card from the catalog first." };

  const valueCents =
    typeof input.valueCents === "number" && input.valueCents >= 0
      ? Math.round(input.valueCents)
      : (cat.market_cents ?? null);

  const { data: card, error: cardErr } = await supabase
    .from("cards")
    .insert({
      owner_id: user.id,
      category: "tcg",
      sport_or_game: "Pokémon",
      player_or_character: cat.name,
      set_name: cat.set_name,
      card_number: cat.number,
      image_url: cat.image_url,
      is_slab: true,
      grading_company: company,
      grade,
      cert_number: input.certNumber?.trim() || null,
      id_status: "confirmed",
      fmv_cents: valueCents,
      fmv_source: "slab",
      fmv_notes: `${company} ${grade} slab`,
      intent: "grade",
      status: "graded",
      in_inventory: false,
    })
    .select("id")
    .single();
  if (cardErr) return { ok: false, error: cardErr.message };

  const { error } = await supabase.from("collection_items").insert({
    collection_id: collectionId,
    owner_id: user.id,
    card_id: card.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/collections/${collectionId}`);
  revalidatePath("/dashboard/cards");
  return { ok: true };
}

export async function removeItemAction(
  itemId: string,
  collectionId: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("collection_items")
    .delete()
    .eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/collections/${collectionId}`);
}

/** Search the card catalog for a physical card to add. */
export async function searchCatalogAction(
  q: string,
): Promise<PokemonSearchResult[]> {
  const supabase = await createClient();
  if (!q.trim()) return [];
  const { data, error } = await supabase.rpc("public_catalog_search", {
    p_q: q.trim(),
  });
  if (error || !Array.isArray(data)) return [];
  return (
    data as {
      id: string;
      name: string;
      set_name: string | null;
      number: string | null;
      rarity: string | null;
      image_url: string | null;
      market_cents: number | null;
      language: string | null;
    }[]
  ).map((c) => ({
    id: c.id,
    name: c.name,
    setName: c.set_name ?? "",
    number: c.number ?? "",
    rarity: c.rarity ?? "",
    imageUrl: c.image_url,
    marketPriceCents: c.market_cents,
    language: c.language ?? "en",
  }));
}
