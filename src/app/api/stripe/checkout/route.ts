import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, getPrices, isValidPlanKey } from "@/lib/stripe/server";

export const runtime = "nodejs";

/**
 * POST /api/stripe/checkout
 * Body: { plan: 'pro_monthly' | 'pro_annual' }
 *
 * Creates a Checkout Session for the signed-in user and returns the hosted URL.
 * Reuses an existing Stripe customer if one is linked to the user's profile.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let plan: unknown;
  try {
    const body = await request.json();
    plan = body?.plan;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidPlanKey(plan)) {
    return NextResponse.json(
      { error: "Invalid plan. Use pro_monthly or pro_annual." },
      { status: 400 },
    );
  }

  const priceId = getPrices()[plan];
  if (!priceId) {
    return NextResponse.json(
      { error: `Price not configured for plan: ${plan}` },
      { status: 500 },
    );
  }

  // Look up existing Stripe customer for this user.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id ?? null;

  const stripe = getStripe();
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? profile?.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    await admin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const origin =
    request.headers.get("origin") ??
    `https://${request.headers.get("host") ?? "localhost:3000"}`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { supabase_user_id: user.id, plan },
    },
    allow_promotion_codes: true,
    success_url: `${origin}/dashboard?checkout=success`,
    cancel_url: `${origin}/pricing?checkout=canceled`,
    client_reference_id: user.id,
    metadata: { supabase_user_id: user.id, plan },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a Checkout URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
