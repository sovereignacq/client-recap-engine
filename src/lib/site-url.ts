/**
 * Canonical, absolute base URL for the app (no trailing slash).
 *
 * Auth-confirmation and Stripe redirect links must point at the real
 * production domain — never at `localhost` or a per-deploy preview URL. We
 * therefore prefer an explicitly configured site URL over the incoming request
 * origin, which can be localhost during local dev or a preview host on Vercel.
 *
 * Set NEXT_PUBLIC_SITE_URL (or NEXT_PUBLIC_APP_URL) to your production domain.
 */
const CONFIGURED =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

const FALLBACK = "https://client-recap-engine.vercel.app";

export function siteUrl(): string {
  const raw = CONFIGURED || FALLBACK;
  const withProto = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withProto.replace(/\/+$/, "");
}
