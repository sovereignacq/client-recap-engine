import { createClient } from "@/lib/supabase/server";

export type Role = "customer" | "staff" | "owner";

/** Role of the current user, or null if signed out. Defaults to customer. */
export async function getRole(): Promise<Role | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return ((data?.role as Role) ?? "customer") as Role;
}

export function isStaff(role: Role | null): boolean {
  return role === "staff" || role === "owner";
}
