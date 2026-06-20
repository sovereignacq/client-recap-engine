"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole, isStaff } from "@/lib/roles";

const OFFER_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "paid",
  "canceled",
] as const;
const CARD_STATUSES = [
  "received",
  "identifying",
  "identified",
  "grading",
  "graded",
  "sold",
  "returned",
] as const;

/** Staff: settle a withdrawal request. Rejecting refunds the held funds. */
export async function adminProcessWithdrawal(
  id: string,
  status: "paid" | "rejected",
  note?: string,
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  if (status !== "paid" && status !== "rejected") {
    return { error: "Invalid status." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("process_withdrawal", {
    p_id: id,
    p_status: status,
    p_note: note ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/withdrawals");
}

/**
 * Staff/owner action — operates across all customers (staff RLS permits it),
 * so there is intentionally no owner_id filter. Always role-guarded first.
 */
export async function adminUpdateOfferStatus(
  offerId: string,
  status: string,
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  if (!(OFFER_STATUSES as ReadonlyArray<string>).includes(status)) {
    return { error: "Invalid status." };
  }
  const supabase = await createClient();

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "accepted") patch.accepted_at = new Date().toISOString();
  if (status === "paid") patch.paid_at = new Date().toISOString();

  const { error } = await supabase.from("offers").update(patch).eq("id", offerId);
  if (error) return { error: error.message };

  if (status === "paid") {
    const { data: items } = await supabase
      .from("offer_items")
      .select("card_id")
      .eq("offer_id", offerId);
    const cardIds = (items ?? []).map((i) => i.card_id);
    if (cardIds.length) {
      // Cards we buy become house inventory, eligible to be packed.
      const { data: owner } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "owner")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      await supabase
        .from("cards")
        .update({
          status: "inventory",
          in_inventory: true,
          owner_id: owner?.id,
          updated_at: new Date().toISOString(),
        })
        .in("id", cardIds);
    }
  }

  revalidatePath(`/admin/offers/${offerId}`);
  revalidatePath("/admin/offers");
  revalidatePath("/admin");
}

/** Staff archive a card (soft-delete). Removed from active lists + the pool. */
export async function adminArchiveCard(
  cardId: string,
): Promise<{ error?: string } | void> {
  const role = await getRole();
  if (!isStaff(role)) return { error: "Not authorized." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("cards")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: user?.id,
      in_inventory: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId);
  if (error) return { error: error.message };
  revalidatePath("/admin/cards");
  revalidatePath("/admin/archive");
  revalidatePath("/admin");
}

export async function adminRestoreCard(
  cardId: string,
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("cards")
    .update({ archived_at: null, archived_by: null, updated_at: new Date().toISOString() })
    .eq("id", cardId);
  if (error) return { error: error.message };
  revalidatePath("/admin/archive");
  revalidatePath("/admin/cards");
}

/** Add or remove a card from the house pack pool. */
export async function adminToggleInventory(
  cardId: string,
  inInventory: boolean,
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("cards")
    .update({
      in_inventory: inInventory,
      status: inInventory ? "inventory" : "graded",
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId);
  if (error) return { error: error.message };
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
}

export async function adminUpdateCardStatus(
  cardId: string,
  status: string,
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  if (!(CARD_STATUSES as ReadonlyArray<string>).includes(status)) {
    return { error: "Invalid status." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("cards")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", cardId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/cards/${cardId}`);
  revalidatePath("/admin/cards");
  revalidatePath("/admin");
}
