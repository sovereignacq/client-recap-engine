# client-recap-engine — Setup Progress

## Checklist

- [x] **Step 1 — Next.js Scaffold**: App Router, TypeScript, Tailwind CSS, ESLint, `src/` directory, `@/*` import alias. ✅
- [x] **Step 2 — Supabase**: Database + Auth wired up. ✅
- [ ] **Step 3 — Vercel**: Deployment + environment variables (not started)
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
- `src/middleware.ts` runs on all routes, refreshes the auth cookie, and redirects unauthenticated requests to `/login`.
- Routes:
  - `/login` + Server Action (`signInWithPassword`)
  - `/signup` + Server Action (`signUp` with `emailRedirectTo`)
  - `/auth/callback` route handler (`exchangeCodeForSession`) for email confirmation
  - `/dashboard` (protected) showing the signed-in user and counts of clients/recaps

### Environment variables (already in `.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://cmcjqwlsjxnsxpiofijz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_…
```

See `.env.local.example` for the template (committed). The real `.env.local` is gitignored.

### Auth method

Email + password. Confirmation emails redirect to `/auth/callback?next=/dashboard`.

### How to run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```
