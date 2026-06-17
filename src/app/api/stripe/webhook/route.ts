import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, planKeyForPrice } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Webhooks must read the raw body; disable Next.js body parsing.
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/webhook
 *
 * Verifies Stripe signature and syncs subscription state into Supabase.
 * Configure the endpoint in the Stripe dashboard:
 *   URL:     https://<your-domain>/api/stripe/webhook
 *   Events:  checkout.session.completed,
 *            customer.subscription.created,
 *            customer.subscription.updated,
 *            customer.subscription.deleted
 */
export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 },
    );
  }

  const raw = await request.text();

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        const userId =
          (session.metadata?.supabase_user_id as string | undefined) ??
          session.client_reference_id ??
          undefined;

        if (subscriptionId && userId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertSubscription(admin, sub, userId);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId =
          (sub.metadata?.supabase_user_id as string | undefined) ??
          (await lookupUserIdByCustomer(admin, sub.customer));
        if (userId) {
          await upsertSubscription(admin, sub, userId);
        }
        break;
      }

      default:
        // Ignore other events for now
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook handler error";
    console.error("[stripe webhook]", event.type, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function lookupUserIdByCustomer(
  admin: ReturnType<typeof createAdminClient>,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer,
): Promise<string | undefined> {
  const customerId = typeof customer === "string" ? customer : customer.id;
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id;
}

async function upsertSubscription(
  admin: ReturnType<typeof createAdminClient>,
  sub: Stripe.Subscription,
  userId: string,
) {
  const item = sub.items.data[0];
  const priceId = item?.price.id ?? null;
  const plan = planKeyForPrice(priceId);

  // Stripe puts current period on the subscription item in newer API versions.
  const periodStart = item?.current_period_start ?? null;
  const periodEnd = item?.current_period_end ?? null;

  const row = {
    id: sub.id,
    user_id: userId,
    status: sub.status,
    price_id: priceId,
    plan,
    current_period_start: periodStart ? toIso(periodStart) : null,
    current_period_end: periodEnd ? toIso(periodEnd) : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    trial_start: sub.trial_start ? toIso(sub.trial_start) : null,
    trial_end: sub.trial_end ? toIso(sub.trial_end) : null,
    canceled_at: sub.canceled_at ? toIso(sub.canceled_at) : null,
  };

  const { error } = await admin
    .from("subscriptions")
    .upsert(row, { onConflict: "id" });

  if (error) throw error;
}

function toIso(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString();
}
