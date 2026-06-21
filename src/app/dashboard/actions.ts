"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Mark the current user's open warnings as read (clears the dashboard banner). */
export async function acknowledgeWarningsAction(): Promise<{
  error?: string;
} | void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("acknowledge_warnings");
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
}
