import { createClient } from "@/lib/supabase/server";

/**
 * Free-tier limits — enforced on creation. Pro users get unlimited.
 */
export const FREE_LIMITS = {
  clients: 1,
  recapsPerMonth: 3,
} as const;

type Plan = "free" | "pro";

/**
 * Determine the user's plan from their active subscription row.
 * `trialing`, `active`, and `past_due` all count as Pro (past_due still has
 * access; we'll lock them out once it transitions to `canceled` / `unpaid`).
 */
export async function getCurrentPlan(userId: string): Promise<Plan> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .in("status", ["trialing", "active", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? "pro" : "free";
}

export type UsageReport = {
  plan: Plan;
  clients: { used: number; limit: number | null };
  recapsThisMonth: { used: number; limit: number | null };
  atClientLimit: boolean;
  atRecapLimit: boolean;
};

export async function getUsage(userId: string): Promise<UsageReport> {
  const supabase = await createClient();
  const plan = await getCurrentPlan(userId);

  // Count clients (RLS already scopes to the current user, but we also filter
  // by owner_id explicitly as a belt-and-suspenders measure)
  const { count: clientsCount } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);

  // Recaps this calendar month (UTC) — first day of month, 00:00 UTC.
  const now = new Date();
  const startOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
  const { count: recapsCount } = await supabase
    .from("recaps")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .gte("created_at", startOfMonth);

  const clientLimit = plan === "free" ? FREE_LIMITS.clients : null;
  const recapLimit = plan === "free" ? FREE_LIMITS.recapsPerMonth : null;

  return {
    plan,
    clients: { used: clientsCount ?? 0, limit: clientLimit },
    recapsThisMonth: { used: recapsCount ?? 0, limit: recapLimit },
    atClientLimit:
      clientLimit !== null && (clientsCount ?? 0) >= clientLimit,
    atRecapLimit:
      recapLimit !== null && (recapsCount ?? 0) >= recapLimit,
  };
}
