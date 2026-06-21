"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cardTitle } from "@/lib/cards";
import { getStripe } from "@/lib/stripe/server";
import { isCurrentUserSuspended, SUSPENDED_MESSAGE } from "@/lib/account";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://client-recap-engine.vercel.app";

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
  category: string,
): Promise<OpenResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (await isCurrentUserSuspended())
    return { ok: false, error: SUSPENDED_MESSAGE };

  const { data, error } = await supabase.rpc("open_pack", {
    p_tier: tierKey,
    p_mode: mode,
    p_category: category,
  });
  if (error) {
    const msg = /insufficient funds/i.test(error.message)
      ? "Not enough funds — add to your wallet to keep opening."
      : /coming soon/i.test(error.message)
        ? "That category isn't live yet."
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

export type PlayResult = { ok: true } | { ok: false; error: string };

/** Confirm the player is 18+. */
export async function confirmAgeAction(): Promise<PlayResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await supabase.rpc("confirm_age");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/buy");
  return { ok: true };
}

/** Take a break from play for N days (can only extend). */
export async function setPlayPauseAction(days: number): Promise<PlayResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_play_pause", { p_days: days });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/buy");
  return { ok: true };
}

/** Set self-protective daily limits (cents; null/0 clears). */
export async function setPlayLimitsAction(
  spendCents: number | null,
  depositCents: number | null,
): Promise<PlayResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_play_limits", {
    p_spend: spendCents ?? 0,
    p_deposit: depositCents ?? 0,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/buy");
  return { ok: true };
}

export type DepositResult = { ok: true; url: string } | { ok: false; error: string };

/** Real money: start a Stripe Checkout session to fund the wallet. */
export async function createDepositCheckoutAction(
  amountCents: number,
): Promise<DepositResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  // Minimum $1; upper bound is just Stripe's per-charge ceiling ($999,999.99)
  // so customers can deposit any amount at or above the minimum.
  if (!Number.isFinite(amountCents) || amountCents < 100) {
    return { ok: false, error: "Minimum deposit is $1." };
  }
  if (amountCents > 99_999_999) {
    return { ok: false, error: "That exceeds the single-deposit maximum." };
  }

  // Responsible-play guards: respect an active break and the daily deposit cap.
  const { data: prof } = await supabase
    .from("profiles")
    .select("play_paused_until, daily_deposit_limit_cents")
    .eq("id", user.id)
    .maybeSingle();
  if (prof?.play_paused_until && new Date(prof.play_paused_until) > new Date()) {
    return { ok: false, error: "You're taking a break — deposits are paused." };
  }
  if (prof?.daily_deposit_limit_cents) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { data: today } = await supabase
      .from("wallet_transactions")
      .select("amount_cents")
      .eq("user_id", user.id)
      .eq("kind", "topup")
      .gte("created_at", startOfDay.toISOString());
    const sum = (today ?? []).reduce((s, t) => s + (t.amount_cents ?? 0), 0);
    if (sum + amountCents > prof.daily_deposit_limit_cents) {
      return { ok: false, error: "That would pass your daily deposit limit." };
    }
  }

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    return { ok: false, error: "Payments aren't configured yet (no Stripe key)." };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "APEX TCG wallet deposit" },
            unit_amount: Math.round(amountCents),
          },
          quantity: 1,
        },
      ],
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id, kind: "wallet_topup" },
      success_url: `${APP_URL}/dashboard/buy?deposit=success`,
      cancel_url: `${APP_URL}/dashboard/buy?deposit=cancel`,
    });
    if (!session.url) return { ok: false, error: "Could not start checkout." };
    return { ok: true, url: session.url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Checkout failed." };
  }
}

export type TopUpResult =
  | { ok: true; balance: number }
  | { ok: false; error: string };

/** Staff-only free test credit (the DB function enforces the staff check). */
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

export type DailyResult =
  | { ok: true; rewardCents: number; streak: number; balance: number }
  | { ok: false; error: string };

/** Claim the once-per-day wallet bonus (scales with streak). */
export async function claimDailyAction(): Promise<DailyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.rpc("claim_daily");
  if (error) {
    const msg = /already claimed/i.test(error.message)
      ? "Already claimed today — come back tomorrow."
      : error.message;
    return { ok: false, error: msg };
  }
  const d = data as { reward_cents: number; streak: number; balance_after: number };
  revalidatePath("/dashboard/buy");
  return { ok: true, rewardCents: d.reward_cents, streak: d.streak, balance: d.balance_after };
}

export type TradeUpResult =
  | {
      ok: true;
      cardId: string;
      serial: string;
      title: string;
      grade: string | null;
      fmvCents: number;
      inputCents: number;
      tradedCount: number;
      outcome: "below" | "even" | "above";
      buybackCents: number;
    }
  | { ok: false; error: string };

/**
 * Consolidate several owned cards into one bigger card from the pool. The reward
 * is capped at 85% of the combined value (house keeps 15%); trade_up() runs the
 * whole swap atomically so it can't be gamed.
 */
export async function tradeUpAction(cardIds: string[]): Promise<TradeUpResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!Array.isArray(cardIds) || cardIds.length < 2) {
    return { ok: false, error: "Pick at least two cards to trade up." };
  }

  const { data, error } = await supabase.rpc("trade_up", {
    p_card_ids: cardIds,
  });
  if (error) return { ok: false, error: error.message };

  const d = data as {
    card_id: string;
    serial: string;
    fmv_cents: number;
    input_cents: number;
    traded: number;
    outcome: "below" | "even" | "above";
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
    inputCents: d.input_cents,
    tradedCount: d.traded,
    outcome: d.outcome,
    buybackCents: Math.round(d.fmv_cents * BUYBACK_PCT),
  };
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

export type WithdrawResult =
  | { ok: true; balance: number; withdrawable: number }
  | { ok: false; error: string };

/** Request a cash-out (min $5, capped at the withdrawable balance). */
export async function requestWithdrawalAction(
  amountCents: number,
  method: string,
  handle: string,
): Promise<WithdrawResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (await isCurrentUserSuspended())
    return { ok: false, error: SUSPENDED_MESSAGE };
  if (!Number.isFinite(amountCents) || amountCents < 500) {
    return { ok: false, error: "Minimum withdrawal is $5." };
  }

  const { data, error } = await supabase.rpc("request_withdrawal", {
    p_amount_cents: Math.round(amountCents),
    p_method: method,
    p_handle: handle,
  });
  if (error) {
    const msg = /exceeds your withdrawable/i.test(error.message)
      ? "That's more than your withdrawable balance (bonus money can't be cashed out)."
      : /minimum withdrawal/i.test(error.message)
        ? "Minimum withdrawal is $5."
        : /taking a break/i.test(error.message)
          ? "You're taking a break — withdrawals are paused."
          : error.message;
    return { ok: false, error: msg };
  }
  const d = data as { balance_after: number; withdrawable_after: number };
  revalidatePath("/dashboard/buy");
  return { ok: true, balance: d.balance_after, withdrawable: d.withdrawable_after };
}

export type RedeemResult =
  | {
      ok: true;
      cardId: string;
      serial: string;
      title: string;
      grade: string | null;
      fmvCents: number;
      tierKey: string;
      outcome: "below" | "even" | "above";
      buybackCents: number;
    }
  | { ok: false; error: string };

/** Open a free-pack credit (no wallet charge); draws a real card from the pool. */
export async function redeemPackCreditAction(
  creditId: string,
): Promise<RedeemResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.rpc("redeem_pack_credit", {
    p_credit_id: creditId,
  });
  if (error) {
    const msg = /verify your email/i.test(error.message)
      ? "Verify your email first to open free packs."
      : /no inventory/i.test(error.message)
        ? "No cards available to pull right now — check back soon."
        : error.message;
    return { ok: false, error: msg };
  }

  const d = data as {
    card_id: string;
    serial: string;
    fmv_cents: number;
    tier_key: string;
    outcome: "below" | "even" | "above";
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
    tierKey: d.tier_key,
    outcome: d.outcome,
    buybackCents: Math.round(d.fmv_cents * BUYBACK_PCT),
  };
}

export type CheckinResult =
  | {
      ok: true;
      streak: number;
      total: number;
      granted: "none" | "week" | "month";
      tier: string | null;
      weekDays: number;
      monthDays: number;
    }
  | { ok: false; error: string };

/** Daily login check-in: builds a streak, drops free packs at milestones. */
export async function dailyCheckinAction(): Promise<CheckinResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (await isCurrentUserSuspended())
    return { ok: false, error: SUSPENDED_MESSAGE };

  const { data, error } = await supabase.rpc("daily_checkin");
  if (error) {
    const msg = /already checked in/i.test(error.message)
      ? "Already checked in — come back in 24 hours."
      : /verify your email/i.test(error.message)
        ? "Verify your email to start earning rewards."
        : error.message;
    return { ok: false, error: msg };
  }
  const d = data as {
    streak: number;
    total: number;
    granted: "none" | "week" | "month";
    tier: string | null;
    week_days: number;
    month_days: number;
  };
  revalidatePath("/dashboard/buy");
  return {
    ok: true,
    streak: d.streak,
    total: d.total,
    granted: d.granted,
    tier: d.tier,
    weekDays: d.week_days,
    monthDays: d.month_days,
  };
}

export type SpinResult =
  | {
      ok: true;
      prizeKey: string;
      label: string;
      kind: "cash" | "pack" | "none";
      amountCents: number;
      tierKey: string | null;
      balance: number;
    }
  | { ok: false; error: string };

/** Daily spin: one weighted prize per day (cash or a free pack). */
export async function dailySpinAction(): Promise<SpinResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (await isCurrentUserSuspended())
    return { ok: false, error: SUSPENDED_MESSAGE };

  const { data, error } = await supabase.rpc("daily_spin");
  if (error) {
    const msg = /already spun/i.test(error.message)
      ? "You already spun — come back in 24 hours."
      : /verify your email/i.test(error.message)
        ? "Verify your email to spin."
        : error.message;
    return { ok: false, error: msg };
  }
  const d = data as {
    prize_key: string;
    label: string;
    kind: "cash" | "pack" | "none";
    amount_cents: number;
    tier_key: string | null;
    balance_after: number;
  };
  revalidatePath("/dashboard/buy");
  return {
    ok: true,
    prizeKey: d.prize_key,
    label: d.label,
    kind: d.kind,
    amountCents: d.amount_cents,
    tierKey: d.tier_key,
    balance: d.balance_after,
  };
}
