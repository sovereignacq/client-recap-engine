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
