"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { siteUrl } from "@/lib/site-url";

export type PayoutStatus = {
  hasAccount: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
};

type OnboardingResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

function connectError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "Payout setup failed.";
  // The most common live-mode failure: Connect isn't enabled on the platform yet.
  if (/connect/i.test(msg) && /(enable|not.*config|sign up)/i.test(msg)) {
    return "Payouts aren't enabled on the platform yet. Please try again later.";
  }
  return msg;
}

/**
 * Start (or resume) Stripe Connect Express onboarding for the current user.
 * Creates the connected account on first use and returns a Stripe-hosted
 * onboarding URL that collects identity (KYC) + bank details.
 */
export async function startPayoutOnboardingAction(): Promise<OnboardingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_connect_id")
    .eq("id", user.id)
    .maybeSingle();

  const stripe = getStripe();
  try {
    let accountId = profile?.stripe_connect_id as string | null;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email ?? undefined,
        business_type: "individual",
        capabilities: { transfers: { requested: true } },
        metadata: { supabase_user_id: user.id },
      });
      accountId = account.id;
      await admin
        .from("profiles")
        .update({ stripe_connect_id: accountId })
        .eq("id", user.id);
    }

    const base = siteUrl();
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${base}/dashboard/buy?payout=refresh`,
      return_url: `${base}/dashboard/buy?payout=return`,
    });
    return { ok: true, url: link.url };
  } catch (e) {
    return { ok: false, error: connectError(e) };
  }
}

/**
 * Re-sync the connected account's verification state from Stripe (called after
 * the user returns from onboarding). Returns the current payout status.
 */
export async function refreshPayoutStatusAction(): Promise<
  | (PayoutStatus & { ok: true })
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_connect_id")
    .eq("id", user.id)
    .maybeSingle();

  const accountId = profile?.stripe_connect_id as string | null;
  if (!accountId) {
    return { ok: true, hasAccount: false, detailsSubmitted: false, payoutsEnabled: false };
  }

  try {
    const account = await getStripe().accounts.retrieve(accountId);
    const detailsSubmitted = !!account.details_submitted;
    const payoutsEnabled = !!account.payouts_enabled;
    await admin
      .from("profiles")
      .update({
        connect_details_submitted: detailsSubmitted,
        connect_payouts_enabled: payoutsEnabled,
      })
      .eq("id", user.id);
    revalidatePath("/dashboard/buy");
    return {
      ok: true,
      hasAccount: true,
      detailsSubmitted,
      payoutsEnabled,
    };
  } catch (e) {
    return { ok: false, error: connectError(e) };
  }
}
