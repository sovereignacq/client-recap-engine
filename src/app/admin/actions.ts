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
  const patch: Record<string, unknown> = {
    in_inventory: inInventory,
    status: inInventory ? "inventory" : "graded",
    updated_at: new Date().toISOString(),
  };
  // open_pack only draws pool cards owned by the house owner, so reassign the
  // card to the owner when it joins the pool (otherwise it can't be pulled).
  if (inInventory) {
    const { data: ownerUuid } = await supabase.rpc("app_owner_id");
    if (typeof ownerUuid === "string" && ownerUuid) patch.owner_id = ownerUuid;
  }
  const { error } = await supabase.from("cards").update(patch).eq("id", cardId);
  if (error) return { error: error.message };
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
}

// ============ User management (staff/owner) ============

/** Credit (positive) or debit (negative) a user's wallet, in cents. */
export async function adminAdjustBalance(
  userId: string,
  deltaCents: number,
  reason: string,
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  if (!Number.isFinite(deltaCents) || deltaCents === 0) {
    return { error: "Enter a non-zero amount." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_adjust_balance", {
    p_user: userId,
    p_delta: Math.round(deltaCents),
    p_reason: reason || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function adminSetSuspended(
  userId: string,
  suspend: boolean,
  reason?: string,
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_suspended", {
    p_user: userId,
    p_suspend: suspend,
    p_reason: reason ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function adminIssueWarning(
  userId: string,
  reason: string,
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  if (!reason?.trim()) return { error: "A reason is required." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_issue_warning", {
    p_user: userId,
    p_reason: reason.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/users/${userId}`);
}

export async function adminSetRole(
  userId: string,
  role: string,
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", {
    p_user: userId,
    p_role: role,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function adminDeleteUser(
  userId: string,
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_user", { p_user: userId });
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
}

/** Advance a shipment through packed → shipped (with tracking) → delivered. */
export async function adminUpdateShipment(
  id: string,
  status: string,
  carrier?: string,
  tracking?: string,
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_shipment", {
    p_id: id,
    p_status: status,
    p_carrier: carrier ?? null,
    p_tracking: tracking ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/shipments");
}

/** Advance a grading submission, record at-cost grader fee, tracking, grade. */
export async function adminUpdateGrading(
  id: string,
  status: string,
  graderFeeCents?: number,
  trackingIn?: string,
  trackingOut?: string,
  grade?: string,
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_grading", {
    p_id: id,
    p_status: status,
    p_grader_fee_cents:
      graderFeeCents != null && Number.isFinite(graderFeeCents)
        ? Math.round(graderFeeCents)
        : null,
    p_tracking_in: trackingIn ?? null,
    p_tracking_out: trackingOut ?? null,
    p_grade: grade ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/grading");
}

/** Open or close a grading company for new submissions. */
export async function adminSetGraderAccepting(
  key: string,
  accepting: boolean,
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_grader_accepting", {
    p_key: key,
    p_accepting: accepting,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/grading");
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
