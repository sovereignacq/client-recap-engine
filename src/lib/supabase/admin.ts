import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client using the service-role key.
 * Bypasses RLS \u2014 use ONLY in server-side code that has already verified the
 * caller's identity (e.g., Stripe webhook after signature verification).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
