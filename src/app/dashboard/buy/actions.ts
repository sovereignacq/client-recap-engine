"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cardTitle } from "@/lib/cards";

export type OpenResult =
  | {
      ok: true;
      cardId: string;
      serial: string;
      title: string;
      grade: string | null;
      fmvCents: number;
      priceCents: number;
      outcome: "below" | "even" | "above";
      profitCents: number;
    }
  | { ok: false; error: string };

/**
 * Open a tier pack. The draw (odds + inventory pick + ownership transfer) runs
 * atomically in the open_pack() DB function so it can't be gamed client-side.
 */
export async function openPackAction(tierKey: string): Promise<OpenResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.rpc("open_pack", { p_tier: tierKey });
  if (error) return { ok: false, error: error.message };

  const d = data as {
    card_id: string;
    serial: string;
    fmv_cents: number;
    price_cents: number;
    outcome: "below" | "even" | "above";
    profit_cents: number;
  };

  const { data: card } = await supabase
    .from("cards")
    .select(
      "card_year, manufacturer, set_name, player_or_character, card_number, variant, auto_grade_label",
    )
    .eq("id", d.card_id)
    .maybeSingle();

  revalidatePath("/dashboard/buy");
  revalidatePath("/dashboard/cards");
  revalidatePath("/dashboard");

  return {
    ok: true,
    cardId: d.card_id,
    serial: d.serial,
    title: card
      ? cardTitle(card)
      : "Card",
    grade: card?.auto_grade_label ?? null,
    fmvCents: d.fmv_cents,
    priceCents: d.price_cents,
    outcome: d.outcome,
    profitCents: d.profit_cents,
  };
}
