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
      balanceAfter: number;
      guaranteed: boolean;
      pityCount: number;
      pityThreshold: number;
      buybackCents: number;
    }
  | { ok: false; error: string };

const BUYBACK_PCT = 0.8;

/**
 * Open a tier pack. Charging the wallet, the odds + pity draw, and the ownership
 * transfer all run atomically in open_pack() so it can't be gamed client-side
 * and a no-inventory roll never charges the buyer.
 */
export async function openPackAction(
  tierKey: string,
  mode: string,
): Promise<OpenResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.rpc("open_pack", {
    p_tier: tierKey,
    p_mode: mode,
  });
  if (error) {
    const msg = /insufficient funds/i.test(error.message)
      ? "Not enough funds — add to your wallet to keep opening."
      : error.message;
    return { ok: false, error: msg };
  }

  const d = data as {
    card_id: string;
    serial: string;
    fmv_cents: number;
    price_cents: number;
    outcome: "below" | "even" | "above";
    profit_cents: number;
    balance_after: number;
    guaranteed: boolean;
    pity_count: number;
    pity_threshold: number;
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
    title: card ? cardTitle(card) : "Card",
    grade: card?.auto_grade_label ?? null,
    fmvCents: d.fmv_cents,
    priceCents: d.price_cents,
    outcome: d.outcome,
    profitCents: d.profit_cents,
    balanceAfter: d.balance_after,
    guaranteed: d.guaranteed,
    pityCount: d.pity_count,
    pityThreshold: d.pity_threshold,
    buybackCents: Math.round(d.fmv_cents * BUYBACK_PCT),
  };
}

export type TopUpResult =
  | { ok: true; balance: number }
  | { ok: false; error: string };

/** Records-first wallet top-up. Stripe will replace the funding source later. */
export async function topUpAction(amountCents: number): Promise<TopUpResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.rpc("wallet_topup", {
    p_amount_cents: Math.round(amountCents),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/buy");
  return { ok: true, balance: data as number };
}

export type SellBackResult =
  | { ok: true; payoutCents: number; balance: number }
  | { ok: false; error: string };

/** Sell a won card back to APEX at the buyback rate; it returns to the pool. */
export async function sellBackAction(cardId: string): Promise<SellBackResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.rpc("sell_card_back", {
    p_card_id: cardId,
  });
  if (error) return { ok: false, error: error.message };
  const d = data as { payout_cents: number; balance_after: number };
  revalidatePath("/dashboard/buy");
  revalidatePath("/dashboard/cards");
  revalidatePath("/dashboard");
  return { ok: true, payoutCents: d.payout_cents, balance: d.balance_after };
}
