import Stripe from "stripe";

/**
 * Lazily-initialized Stripe client. We instantiate on first use rather than at
 * module load so production builds don't crash when STRIPE_SECRET_KEY is
 * unset in the build environment (the key is only needed at runtime).
 *
 * Never import this from a Client Component.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  _stripe = new Stripe(key, {
    apiVersion: "2026-05-27.dahlia",
    appInfo: {
      name: "client-recap-engine",
      version: "0.1.0",
    },
  });
  return _stripe;
}

/**
 * Price IDs come from Stripe and are configured per environment.
 * In test mode use price_test_..., in live mode use price_live_...
 */
export function getPrices() {
  return {
    pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL ?? "",
  } as const;
}

export type PlanKey = "pro_monthly" | "pro_annual";

export function isValidPlanKey(value: unknown): value is PlanKey {
  return value === "pro_monthly" || value === "pro_annual";
}

/**
 * Map a Stripe price ID back to our plan key, for webhook handlers.
 */
export function planKeyForPrice(priceId: string | null | undefined): PlanKey | null {
  if (!priceId) return null;
  const prices = getPrices();
  if (priceId === prices.pro_monthly) return "pro_monthly";
  if (priceId === prices.pro_annual) return "pro_annual";
  return null;
}
