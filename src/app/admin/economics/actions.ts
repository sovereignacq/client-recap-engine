"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole, isStaff } from "@/lib/roles";

export async function adminUpdateTier(
  key: string,
  priceCents: number,
  pityThreshold: number,
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    return { error: "Price must be greater than 0." };
  }
  if (!Number.isInteger(pityThreshold) || pityThreshold < 1) {
    return { error: "Pity threshold must be a whole number ≥ 1." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("pack_tiers")
    .update({ price_cents: Math.round(priceCents), pity_threshold: pityThreshold })
    .eq("key", key);
  if (error) return { error: error.message };
  revalidatePath("/admin/economics");
  revalidatePath("/dashboard/buy");
}

export async function adminUpdateMode(
  key: string,
  weightMults: { below: number; even: number; above: number; jackpot: number },
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  for (const v of Object.values(weightMults)) {
    if (!Number.isFinite(v) || v < 0) return { error: "Multipliers must be ≥ 0." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("pack_modes")
    .update({ weight_mults: weightMults })
    .eq("key", key);
  if (error) return { error: error.message };
  revalidatePath("/admin/economics");
  revalidatePath("/dashboard/buy");
}
