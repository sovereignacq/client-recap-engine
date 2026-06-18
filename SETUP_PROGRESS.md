# client-recap-engine — Setup Progress

## Checklist

- [x] **Step 1 — Next.js Scaffold**: App Router, TypeScript, Tailwind CSS, ESLint, `src/` directory, `@/*` import alias. ✅
- [x] **Step 2 — Supabase**: Database + Auth wired up. ✅
- [x] **Step 3 — Vercel**: Deployment + environment variables. ✅
- [x] **Step 4 — Stripe**: Billing integration (code + DB ready; pending manual product creation). ⚠️
- [x] **Step 5 — Resend**: Transactional email setup (code complete; API key live; **domain verification pending** — DuckDNS doesn't support the required DKIM/CNAME records, revisit when a real domain is acquired). ⚠️
- [x] **Step 6 — Core product: Clients + Recaps + AI generation**: code complete; pending `GEMINI_API_KEY`. ⚠️
- [x] **Step 8 — Card grading: identification + serialization + submitter records**: code + DB complete; reuses `GEMINI_API_KEY`. ⚠️

---

## Step 8 details

### What's been built

A card grading platform layer on top of the existing app: identify a submitted
card from a photo, serialize it, value it, and keep a record of who submitted it.

**Database** (migrations `card_grading_core`, `card_images_storage`, `harden_set_card_serial_search_path`):

- `submitters` — record log of people who submit cards (name, email, phone, address, notes). Per-owner RLS.
- `cards` — one row per physical card, with:
  - **Serialization:** `serial` (e.g. `SAC-000123`), assigned by a `before insert` trigger off the global `card_serial_seq`. Globally unique, like a cert number.
  - **Structured identification:** `category` (sports/tcg/other), `sport_or_game`, `player_or_character`, `card_year`, `manufacturer`, `set_name`, `card_number`, `variant`, plus `id_status` (unidentified → ai_suggested → confirmed), `id_confidence`, `id_model`, and `id_raw` (jsonb audit snapshot).
  - **Grade + value:** `grade`, `fmv_cents`, `fmv_currency`, `fmv_source`, `fmv_notes`.
  - **Workflow:** `intent` (grade/sell/consign), `status` (received → … → sold/returned), `image_path`.
  - `submitter_id` FK is `ON DELETE SET NULL` so deleting a submitter never destroys card records.
- Private Supabase Storage bucket `card-images` (10MB limit, image MIME types), with per-owner RLS on `storage.objects` keyed by `<owner_id>/` folder.

**Code:**

| Path | Purpose |
| --- | --- |
| `src/lib/ai/client.ts` | `identifyCard()` (Gemini vision → structured ID + confidence, never returns a price) and `estimateCardValue()` (separate, labeled ballpark) |
| `src/lib/cards.ts` | Option lists (kept in sync with DB check constraints), `cardTitle()`, money formatting |
| `src/app/dashboard/cards/` | Card list, photo-driven intake (`new/`), and detail/edit |
| `src/app/dashboard/submitters/` | Submitter CRUD + per-submitter card history |
| `src/app/dashboard/page.tsx` | Dashboard tiles for Cards + Submitters |

### Accuracy guardrails (the "wrong card → wrong FMV" problem)

- Identification returns **no price**. Value is a *separate* call.
- The value estimate button is **disabled until the operator ticks "verified against the physical card"** (`id_status = confirmed`), so a misread card can't silently carry a price.
- AI confidence is surfaced; < 60% shows a "verify every field" warning.
- The AI estimate is always a labeled *range* the operator must approve; the final `fmv_cents` is operator-set (`fmv_source = 'operator'`). No live market feed is claimed.

### ⚠️ Manual steps

- Set `GEMINI_API_KEY` (same key as Step 6) for photo identification + value estimates. Without it, intake still works manually.
- The `card-images` bucket and its RLS policies are already created in the live project. Nothing to do unless you recreate the project.

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

## Step 5 details

### What's been built

**Database** (migration `add_welcome_email_sent_at` + `add_trial_end_email_sent_for`):
- `profiles.welcome_email_sent_at` (timestamptz) — idempotency for the welcome email.
- `subscriptions.trial_end_email_sent_for` (timestamptz) — idempotency for trial-ending emails (one per `trial_end` value).

**Code:**

| Path                                          | Purpose                                                       |
| --------------------------------------------- | ------------------------------------------------------------- |
| `src/lib/email/resend.ts`                     | Lazy Resend client + `sendEmail()` wrapper that swallows errors |
| `src/lib/email/templates.ts`                  | Plain-HTML templates: welcome, trial ending, payment failed, canceled |
| `src/app/auth/callback/route.ts`              | Sends welcome email after first email confirmation (idempotent) |
| `src/app/api/stripe/webhook/route.ts`         | Sends billing emails on `past_due`, trial ending (≤3 days), and cancellation |

**When emails fire:**
- **Welcome** — fires once when a user confirms their email and `/auth/callback` exchanges the code. Re-runs are skipped via `welcome_email_sent_at`.
- **Trial ending** — fires on `customer.subscription.updated` when `status=trialing` and `trial_end` is within 3 days. Stripe automatically sends a `trial_will_end` event ~3 days before trial end, which arrives as a `subscription.updated` mirror. Stored `trial_end_email_sent_for` prevents duplicates.
- **Payment failed** — fires when subscription status transitions to `past_due` (previous DB row had any other status).
- **Subscription canceled** — fires on `customer.subscription.deleted`.

All templates are dependency-free HTML (no React Email). All sends are best-effort: a Resend outage will log an error but will NOT break the auth callback or the Stripe webhook.

### ⚠️ Manual steps required

#### 1. Sign up for Resend + create an API key

1. Go to [resend.com](https://resend.com) and sign up (free tier covers 3,000 emails/mo, 100/day).
2. After signup, go to [resend.com/api-keys](https://resend.com/api-keys) → **Create API Key** → name it `client-recap-engine production` → permission **Sending access** → scope **Full access** (or restrict to a single domain later).
3. Copy the `re_...` key. You'll only see it once.

#### 2. Add the API key to Vercel

```bash
cd client-recap-engine
echo "re_..." | npx vercel env add RESEND_API_KEY production
echo "re_..." | npx vercel env add RESEND_API_KEY preview
echo "re_..." | npx vercel env add RESEND_API_KEY development
```

Also add it to `.env.local` for local testing.

#### 3. (Optional but recommended) Verify a sending domain

Until you verify a domain, Resend sandbox mode will **only deliver to the email address you signed up with**. To send to anyone else:

1. Go to [resend.com/domains](https://resend.com/domains) → **Add Domain** → enter the domain you own (e.g. `clientrecap.com`).
2. Resend will show 4 DNS records (SPF, DKIM ×2, optionally a MAIL FROM record). Add them at your registrar (Cloudflare, Namecheap, Route53, etc.).
3. Click **Verify DNS Records** in Resend. Usually completes within minutes; can take up to 72h depending on registrar TTL.
4. Once verified, set the `from` address:

   ```bash
   echo 'client-recap-engine <hello@yourdomain.com>' | npx vercel env add RESEND_FROM_EMAIL production
   ```

If you skip this step, leave `RESEND_FROM_EMAIL` unset and the app will fall back to `onboarding@resend.dev` — fine for testing, not for production.

#### 4. Redeploy

```bash
npx vercel --prod
```

#### 5. Test the flow

- **Welcome email:** sign up a brand-new account with an email address you can check, confirm via the Supabase confirmation email, and the welcome email should arrive within seconds.
- **Billing emails:** in the Stripe test dashboard, find the test subscription you created at [dashboard.stripe.com/test/subscriptions](https://dashboard.stripe.com/test/subscriptions) and trigger:
  - **Trial ending:** click the subscription → "Actions" → "Update trial end" → set a date <3 days away. Within seconds Stripe fires `customer.subscription.updated` and you'll get the trial-ending email.
  - **Payment failed:** swap the card to Stripe's `4000000000000341` test card → wait for next invoice attempt (or in the dashboard, manually mark the invoice as failed).
  - **Canceled:** cancel the subscription from the portal at `/dashboard` → cancellation email arrives.

---

## Step 6 details

### What's been built

**Database** (migrations `extend_recaps_for_ai` + `recaps_cascade_on_client_delete`):
- `recaps` gained `subject_line`, `tone` (check: professional|friendly|brief), `raw_notes`, `call_to_action`, `model` columns.
- Indexes on `recaps(owner_id, created_at)`, `recaps(client_id, created_at)`, `clients(owner_id, created_at)`.
- `recaps.client_id` FK now `ON DELETE CASCADE` so deleting a client removes its recaps.

**Code:**

| Path                                                          | Purpose                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------- |
| `src/lib/ai/client.ts`                                        | Lazy Gemini client + `generateRecap()` with tone-aware prompt |
| `src/lib/usage.ts`                                            | `getCurrentPlan()` + `getUsage()` for free-tier enforcement   |
| `src/app/dashboard/clients/`                                  | Client CRUD: list, new, [id], [id]/edit, delete with cascade  |
| `src/app/dashboard/clients/[id]/recaps/new/`                  | Generate-then-save recap form with editable AI output         |
| `src/app/dashboard/recaps/`                                   | Flat list of all recaps                                       |
| `src/app/dashboard/recaps/[id]/`                              | View / edit / mark sent / delete a recap; copy + mailto links |
| `src/app/dashboard/recaps/actions.ts`                         | Server actions: generate, save, update, delete, mark sent     |

**Free-tier enforcement:**
- Free: 1 client, 3 recaps per calendar month
- Pro (any active subscription — trialing/active/past_due): unlimited
- Limits checked server-side in `actions.ts` AND surfaced in the UI with Upgrade CTAs.

**AI model:** `gemini-2.5-flash` (via `@google/genai` v2.8). Response uses JSON schema mode so we always get a clean `{subject, body}` object.

### ⚠️ Manual step — add the Gemini API key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and create or reuse an API key.
2. Add it to Vercel:

   ```bash
   cd client-recap-engine
   echo "YOUR_GEMINI_KEY" | npx vercel env add GEMINI_API_KEY production
   echo "YOUR_GEMINI_KEY" | npx vercel env add GEMINI_API_KEY preview
   echo "YOUR_GEMINI_KEY" | npx vercel env add GEMINI_API_KEY development
   ```

3. Also paste it into `.env.local` for local development.
4. Redeploy: `npx vercel --prod`

Without the key, the New Recap page will show an inline warning and disable the Generate button. Everything else (creating clients, viewing past recaps, etc.) still works.

### Test flow

1. Sign in → dashboard → click **Clients** card → **+ New client**.
2. Add a client → land on their detail page → **+ New recap**.
3. Paste any notes, pick a tone, click **Generate recap**.
4. Edit the subject/body if needed → **Save recap**.
5. On the recap view: **Copy** to clipboard, or **Open in email** (mailto: — only if the client has an email on file).
6. **Mark as sent** when you've sent it.

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
