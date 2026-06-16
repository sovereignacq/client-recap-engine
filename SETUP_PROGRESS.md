# client-recap-engine — Setup Progress

## Checklist

- [x] **Step 1 — Next.js Scaffold**: App Router, TypeScript, Tailwind CSS, ESLint, `src/` directory, `@/*` import alias. ✅
- [x] **Step 2 — Supabase**: Database + Auth wired up. ✅
- [x] **Step 3 — Vercel**: Deployment + environment variables. ✅
- [ ] **Step 4 — Stripe**: Billing integration (not started)
- [ ] **Step 5 — Resend**: Transactional email setup (not started)

---

## Step 2 details

**Project:** `cmcjqwlsjxnsxpiofijz` (org: sovereign acquisitions, region: us-west-2, Postgres 17)
**URL:** `https://cmcjqwlsjxnsxpiofijz.supabase.co`

### Database schema (migration `init_schema_profiles_clients_recaps`)

| Table         | Purpose                                                 | RLS |
| ------------- | ------------------------------------------------------- | --- |
| `profiles`    | 1:1 with `auth.users`; auto-created via trigger on signup | ✅  |
| `clients`     | Per-user CRM rows (`owner_id` → `auth.users`)            | ✅  |
| `recaps`      | Recaps belong to a client; status: draft/sent/archived   | ✅  |

- `updated_at` is auto-maintained on all three tables via the `public.set_updated_at()` trigger.
- New auth users automatically get a `profiles` row via `public.handle_new_user()` (fires on `auth.users` insert).
- RLS policies restrict every row to its `owner_id = auth.uid()`.
- Hardening migration `harden_security_definer_functions` pinned `set_updated_at` search_path and revoked RPC EXECUTE on `handle_new_user`.
- Supabase advisors return **0 lints**.

### Next.js integration

- Installed `@supabase/supabase-js` and `@supabase/ssr`.
- Client helpers:
  - `src/lib/supabase/client.ts` — browser client (Client Components)
  - `src/lib/supabase/server.ts` — server client (Server Components, Route Handlers, Server Actions)
  - `src/lib/supabase/middleware.ts` — `updateSession()` refresh helper
- `src/proxy.ts` — Next.js 16 proxy (formerly `middleware.ts`) runs on all routes, refreshes auth cookies, and redirects unauthenticated requests to `/login`.
- Routes:
  - `/login` + Server Action (`signInWithPassword`)
  - `/signup` + Server Action (`signUp` with `emailRedirectTo`)
  - `/auth/callback` route handler (`exchangeCodeForSession`) for email confirmation
  - `/dashboard` (protected) showing the signed-in user and counts of clients/recaps

### Auth method

Email + password. Confirmation emails redirect to `/auth/callback?next=/dashboard`.

---

## Step 3 details

**Vercel project:** `client-recap-engine` (team: soverign-acquisitions, id `prj_9LEfRnMj5a0UrCr1mrUCO9JJGcQM`)

### Live URLs

- **Production:** https://client-recap-engine.vercel.app
- **Latest deployment:** https://client-recap-engine-g59qap4g4-soverign-acquisitions.vercel.app
- **Project dashboard:** https://vercel.com/soverign-acquisitions/client-recap-engine

### Environment variables

Set in all three Vercel environments (Production, Preview, Development):

| Variable                        | Value                                                |
| ------------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://cmcjqwlsjxnsxpiofijz.supabase.co`           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_…` (publishable, safe in browser)    |

### Deployment workflow

Right now this project is deployed via Vercel CLI from the local checkout (the GitHub → Vercel auto-integration could not be wired through the proxied git host). To redeploy:

```bash
npx vercel --prod
```

To wire up push-to-deploy from GitHub (recommended), in the Vercel dashboard go to
**Project → Settings → Git** and connect `sovereignacq/client-recap-engine`.

### ⚠️ One manual step required in Supabase

For signup confirmation emails to redirect correctly in production, add the Vercel URL
to Supabase's allowed redirect list:

1. Open **[Authentication → URL Configuration](https://supabase.com/dashboard/project/cmcjqwlsjxnsxpiofijz/auth/url-configuration)** in the Supabase dashboard.
2. Set **Site URL** to `https://client-recap-engine.vercel.app`.
3. Under **Redirect URLs**, add:
   - `https://client-recap-engine.vercel.app/**`
   - `https://*-soverign-acquisitions.vercel.app/**` (for preview deploys)
   - `http://localhost:3000/**`

---

## How to run locally

```bash
npm install
npm run dev    # http://localhost:3000
```

## How to deploy

```bash
npx vercel --prod    # or just push to main once Git integration is connected
```
