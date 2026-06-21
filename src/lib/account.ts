import { createClient } from "@/lib/supabase/server";

/**
 * True when the signed-in user is suspended. Suspension blocks money/reward
 * actions (buy, spin, check-in, withdraw, ship) while still allowing read-only
 * access to their collection.
 */
export async function isCurrentUserSuspended(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("suspended_at")
    .eq("id", user.id)
    .maybeSingle();
  return !!data?.suspended_at;
}

export const SUSPENDED_MESSAGE =
  "Your account is suspended — this action is paused. Contact support.";
