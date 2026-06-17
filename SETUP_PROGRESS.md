# client-recap-engine — Setup Progress

## Checklist

- [x] **Step 1 — Next.js Scaffold**: App Router, TypeScript, Tailwind CSS, ESLint, `src/` directory, `@/*` import alias. ✅
- [x] **Step 2 — Supabase**: Database + Auth wired up. ✅
- [x] **Step 3 — Vercel**: Deployment + environment variables. ✅
- [x] **Step 4 — Stripe**: Billing integration (code + DB ready; pending manual product creation). ⚠️
- [ ] **Step 5 — Resend**: Transactional email setup (not started)

---

## Step 4 details

### What's been built

**Database** (migration `add_billing_tables`):
- `profiles.stripe_customer_id` column added (unique).
- `subscriptions` table mirroring Stripe state — id, user_id, status, plan, price_id, current_period_*, cancel_at_period_end, trial_*, canceled_at.
- RLS: users can SELECT only their own subscription rows; INSERT/UPDATE/DELETE are limited to `service_role` (webhook only).
- View `current_subscription` returning the latest non-canceled subscription per user.

**Code:**

| Path                                          | Purpose                                                       |
| --------------------------------------------- | ------------------------------------------------------------- |
| `src/lib/stripe/server.ts`                    | Lazy Stripe client + price ID helpers + plan key validation   |
| `src/lib/supabase/admin.ts`                   | Service-role Supabase client (webhook use only)               |
| `src/app/api/stripe/checkout/route.ts`        | `POST` → creates Checkout Session, returns hosted URL          |
| `src/app/api/stripe/portal/route.ts`          | `POST` → creates Customer Portal session                       |
| `src/app/api/stripe/webhook/route.ts`         | `POST` → verifies signature, syncs subscription state to DB    |
| `src/app/pricing/page.tsx` (+ client buttons) | Public pricing page with Free vs Pro tiers, monthly/annual toggle |
| `src/app/dashboard/page.tsx`                  | Updated with current-plan card and Upgrade / Manage billing CTA |

**Pricing model:**
- Free — 1 client, 3 recaps/month (enforced in app logic — TBD)
- Pro — $29/mo or $290/yr (annual saves ~17%)
- 14-day free trial on Pro, no card required at signup but card collected at checkout
- Promotion codes allowed at checkout

### ⚠️ Manual steps required (only you can do these)

The Stripe MCP connector uses live-mode credentials; we deliberately did **not** create products via API to keep that account clean. You'll create the products yourself, in test mode.

#### 1. Create products + prices in Stripe (test mode)

1. Go to [dashboard.stripe.com/test/products](https://dashboard.stripe.com/test/products) (make sure the top-right toggle says **Test mode**).
2. Click **+ Add product**:
   - **Name:** `client-recap-engine Pro`
   - **Description:** `Unlimited clients and recaps, priority support.`
3. Under **Pricing**, add two prices on the same product:
   - **Monthly recurring**, $29.00 USD, lookup key `pro_monthly`
   - **Yearly recurring**, $290.00 USD, lookup key `pro_annual`
4. Copy each `price_...` ID — you'll paste them into env vars next.

#### 2. Add Stripe env vars to Vercel

Run these locally (replace placeholders with your actual values):

```bash
cd client-recap-engine
# Secret key — from https://dashboard.stripe.com/test/apikeys
echo "sk_test_..." | npx vercel env add STRIPE_SECRET_KEY production
echo "sk_test_..." | npx vercel env add STRIPE_SECRET_KEY development
# Price IDs from step 1
echo "price_..." | npx vercel env add STRIPE_PRICE_PRO_MONTHLY production
echo "price_..." | npx vercel env add STRIPE_PRICE_PRO_MONTHLY development
echo "price_..." | npx vercel env add STRIPE_PRICE_PRO_ANNUAL production
echo "price_..." | npx vercel env add STRIPE_PRICE_PRO_ANNUAL development
# Service role key — from https://supabase.com/dashboard/project/cmcjqwlsjxnsxpiofijz/settings/api-keys
echo "eyJ..." | npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
echo "eyJ..." | npx vercel env add SUPABASE_SERVICE_ROLE_KEY development
```

Repeat all of the above for `preview` if you want preview deployments to support billing.

Also add the same values to `.env.local` for local dev.

#### 3. Set up the webhook endpoint

1. Go to [dashboard.stripe.com/test/webhooks](https://dashboard.stripe.com/test/webhooks).
2. **Add endpoint** → URL: `https://client-recap-engine.vercel.app/api/stripe/webhook`
3. **Listen to:** select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. After creating, click **Reveal** under Signing secret, copy the `whsec_...` value, and add it to Vercel:

   ```bash
   echo "whsec_..." | npx vercel env add STRIPE_WEBHOOK_SECRET production
   ```

5. Redeploy: `npx vercel --prod`

#### 4. Enable the Customer Portal

1. Go to [dashboard.stripe.com/test/settings/billing/portal](https://dashboard.stripe.com/test/settings/billing/portal).
2. Click **Activate test link**.
3. Default settings are fine — you can let customers cancel, swap plans, and update payment methods.

#### 5. Test the flow

1. Visit https://client-recap-engine.vercel.app/pricing → log in → click **Start 14-day free trial**.
2. Use Stripe's test card: **4242 4242 4242 4242**, any future expiry, any CVC, any ZIP.
3. After successful checkout you should land on `/dashboard?checkout=success` with the Pro plan shown.
4. Click **Manage billing** to confirm the portal opens.

### Switching to live mode later

When ready to charge real money:
1. Recreate the same product + prices in live mode at [dashboard.stripe.com/products](https://dashboard.stripe.com/products).
2. Create a live-mode webhook at the same URL.
3. Replace the `STRIPE_*` env vars in Vercel production with the `sk_live_...`, live `price_...`, and live `whsec_...` values.
4. Redeploy.

---

## Step 1–3 details (collapsed)

See git history for full details. Short version:

- **Supabase** project `cmcjqwlsjxnsxpiofijz` (region us-west-2, Postgres 17). Schema: `profiles`, `clients`, `recaps` with full RLS. Auth = email + password; confirmation emails redirect to `/auth/callback`.
- **Vercel** project `client-recap-engine` (team soverign-acquisitions). Production at https://client-recap-engine.vercel.app. Env vars `NEXT_PUBLIC_SUPABASE_*` set for Production, Preview, Development.

---

## How to run locally

```bash
npm install
cp .env.local.example .env.local   # then fill in real values
npm run dev    # http://localhost:3000
```

## How to deploy

```bash
npx vercel --prod
```
