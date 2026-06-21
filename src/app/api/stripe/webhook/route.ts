import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, planKeyForPrice } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import {
  trialEndingEmail,
  paymentFailedEmail,
  subscriptionCanceledEmail,
} from "@/lib/email/templates";

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

        // Wallet deposit (one-time payment) — credit the wallet.
        if (session.metadata?.kind === "wallet_topup") {
          const uid =
            (session.metadata?.supabase_user_id as string | undefined) ??
            session.client_reference_id ??
            undefined;
          const amount = session.amount_total ?? 0;
          if (uid && amount > 0) {
            await admin.rpc("wallet_credit_external", {
              p_user: uid,
              p_amount_cents: amount,
            });
          }
          break;
        }

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
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId =
          (sub.metadata?.supabase_user_id as string | undefined) ??
          (await lookupUserIdByCustomer(admin, sub.customer));
        if (userId) {
          const prev = await fetchExistingSubscription(admin, sub.id);
          await upsertSubscription(admin, sub, userId);
          await sendBillingTransitionEmails({
            admin,
            event,
            sub,
            prev,
            userId,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId =
          (sub.metadata?.supabase_user_id as string | undefined) ??
          (await lookupUserIdByCustomer(admin, sub.customer));
        if (userId) {
          await upsertSubscription(admin, sub, userId);
          await sendSubscriptionCanceledEmail({
            admin,
            event,
            sub,
            userId,
          });
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

type ExistingSub = {
  status: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean | null;
} | null;

async function fetchExistingSubscription(
  admin: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
): Promise<ExistingSub> {
  const { data } = await admin
    .from("subscriptions")
    .select("status, trial_end, cancel_at_period_end")
    .eq("id", subscriptionId)
    .maybeSingle();
  return data ?? null;
}

async function upsertSubscription(
  admin: ReturnType<typeof createAdminClient>,
  sub: Stripe.Subscription,
  userId: string,
) {
  const item = sub.items.data[0];
  const priceId = item?.price.id ?? null;
  // pro_* plans map from env; membership plans (collector/dealer) carry their
  // key in the Stripe price metadata.
  const plan =
    planKeyForPrice(priceId) ??
    (typeof item?.price?.metadata?.plan === "string"
      ? item.price.metadata.plan
      : null);

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

  // Grant a membership's annual grading credits once per paid billing period.
  // No-op for pro_* plans (zero credits) and for non-active states.
  if (sub.status === "active" && plan) {
    await admin.rpc("grant_membership_credits", {
      p_user: userId,
      p_sub_id: sub.id,
      p_plan: plan,
      p_period_start: periodStart ? toIso(periodStart) : null,
    });
  }
}

function toIso(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString();
}

// ----------------------------------------------------------------------------
// Billing email logic
// ----------------------------------------------------------------------------

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://client-recap-engine.vercel.app";

/**
 * Detect billing state transitions on subscription.updated and send emails:
 *   - past_due  → payment failed
 *   - trial_will_end (status=trialing AND trial_end within ~3 days, only first time we see it)
 */
async function sendBillingTransitionEmails(opts: {
  admin: ReturnType<typeof createAdminClient>;
  event: Stripe.Event;
  sub: Stripe.Subscription;
  prev: ExistingSub;
  userId: string;
}) {
  const { admin, event, sub, prev, userId } = opts;

  const recipient = await fetchRecipient(admin, userId);
  if (!recipient?.email) return;

  // ---- payment failed: status transitioned to past_due ----
  if (sub.status === "past_due" && prev?.status !== "past_due") {
    const tpl = paymentFailedEmail({
      name: recipient.full_name,
      appUrl: APP_URL,
    });
    await sendEmail({
      to: recipient.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      tags: [
        { name: "type", value: "payment_failed" },
        { name: "event", value: event.id },
      ],
    });
  }

  // ---- trial ending: trialing AND trial_end within ~3 days, sent once ----
  const trialEndSec = sub.trial_end;
  if (
    sub.status === "trialing" &&
    trialEndSec &&
    isWithinDays(trialEndSec, 3) &&
    prev?.trial_end !== toIso(trialEndSec) // only on first observation of this trial_end
  ) {
    // Extra idempotency guard: skip if we already notified for this exact trial_end
    const alreadySent = await trialNotifiedFor(admin, sub.id, toIso(trialEndSec));
    if (!alreadySent) {
      const tpl = trialEndingEmail({
        name: recipient.full_name,
        trialEndsAt: new Date(trialEndSec * 1000),
        appUrl: APP_URL,
      });
      const result = await sendEmail({
        to: recipient.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        tags: [
          { name: "type", value: "trial_ending" },
          { name: "event", value: event.id },
        ],
      });
      if (result.id) {
        await markTrialNotified(admin, sub.id, toIso(trialEndSec));
      }
    }
  }
}

async function sendSubscriptionCanceledEmail(opts: {
  admin: ReturnType<typeof createAdminClient>;
  event: Stripe.Event;
  sub: Stripe.Subscription;
  userId: string;
}) {
  const { admin, event, sub, userId } = opts;
  const recipient = await fetchRecipient(admin, userId);
  if (!recipient?.email) return;

  const item = sub.items.data[0];
  const endsAtSec =
    item?.current_period_end ?? sub.canceled_at ?? Math.floor(Date.now() / 1000);

  const tpl = subscriptionCanceledEmail({
    name: recipient.full_name,
    endsAt: new Date(endsAtSec * 1000),
    appUrl: APP_URL,
  });
  await sendEmail({
    to: recipient.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    tags: [
      { name: "type", value: "subscription_canceled" },
      { name: "event", value: event.id },
    ],
  });
}

async function fetchRecipient(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{ email: string | null; full_name: string | null } | null> {
  // Try profiles first for full_name; fall back to auth.users for email.
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const { data: userResp, error } = await admin.auth.admin.getUserById(userId);
  if (error || !userResp?.user?.email) return null;
  return {
    email: userResp.user.email,
    full_name: profile?.full_name ?? null,
  };
}

function isWithinDays(epochSeconds: number, days: number): boolean {
  const nowSec = Math.floor(Date.now() / 1000);
  const diff = epochSeconds - nowSec;
  return diff > 0 && diff <= days * 24 * 60 * 60;
}

// Track which trial_end timestamps we've already emailed for, scoped per
// subscription. Uses the existing subscriptions row by stuffing a JSON payload
// into a dedicated column if present; otherwise relies on the prev.trial_end
// check above (best-effort idempotency).
async function trialNotifiedFor(
  admin: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
  trialEndIso: string,
): Promise<boolean> {
  const { data } = await admin
    .from("subscriptions")
    .select("trial_end_email_sent_for")
    .eq("id", subscriptionId)
    .maybeSingle();
  // Column may not exist yet; treat absence as "not sent".
  const sentFor = (data as { trial_end_email_sent_for?: string | null } | null)
    ?.trial_end_email_sent_for;
  return sentFor === trialEndIso;
}

async function markTrialNotified(
  admin: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
  trialEndIso: string,
): Promise<void> {
  // Best-effort: if column doesn't exist, ignore the error so emails still flow.
  const { error } = await admin
    .from("subscriptions")
    .update({ trial_end_email_sent_for: trialEndIso })
    .eq("id", subscriptionId);
  if (error) {
    console.warn(
      "[stripe webhook] could not mark trial notified (column missing?)",
      error.message,
    );
  }
}
