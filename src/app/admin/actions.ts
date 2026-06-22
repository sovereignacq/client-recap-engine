"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole, isStaff } from "@/lib/roles";
import { getStripe } from "@/lib/stripe/server";

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

/**
 * Staff: settle a withdrawal request.
 * - "paid": sends the money for real via a Stripe Connect transfer to the
 *   payee's verified connected account, then marks the request paid. The wallet
 *   was already debited (held) at request time, so marking paid only finalizes.
 * - "rejected": refunds the held funds to the user's withdrawable balance.
 */
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

  if (status === "paid") {
    // Load the request and payee's connected account.
    const { data: req } = await supabase
      .from("withdrawal_requests")
      .select("id, user_id, amount_cents, status")
      .eq("id", id)
      .maybeSingle();
    if (!req) return { error: "Request not found." };
    if (req.status !== "pending") return { error: "Already processed." };

    const { data: payee } = await supabase
      .from("profiles")
      .select("stripe_connect_id, connect_payouts_enabled")
      .eq("id", req.user_id)
      .maybeSingle();
    if (!payee?.stripe_connect_id || !payee.connect_payouts_enabled) {
      return {
        error: "Payee hasn't finished payout setup (identity not verified yet).",
      };
    }

    // Send the payout. Stripe pays out from the connected account's balance to
    // their bank on its normal schedule once the transfer lands.
    let transferId: string;
    try {
      const transfer = await getStripe().transfers.create({
        amount: req.amount_cents,
        currency: "usd",
        destination: payee.stripe_connect_id,
        metadata: { withdrawal_id: req.id, supabase_user_id: req.user_id },
      });
      transferId = transfer.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stripe transfer failed.";
      return { error: `Payout failed: ${msg}` };
    }

    const { error } = await supabase.rpc("process_withdrawal", {
      p_id: id,
      p_status: "paid",
      p_note: note ?? null,
    });
    if (error) return { error: error.message };
    await supabase
      .from("withdrawal_requests")
      .update({ stripe_transfer_id: transferId })
      .eq("id", id);
    revalidatePath("/admin/withdrawals");
    return;
  }

  // Rejection path: refund the hold.
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

  // Paying out runs atomically in admin_pay_offer: credit the seller's wallet
  // (withdrawable) and move the bought cards into the house pool.
  if (status === "paid") {
    const { error } = await supabase.rpc("admin_pay_offer", {
      p_offer_id: offerId,
    });
    if (error) {
      const msg = /already paid/i.test(error.message)
        ? "This offer has already been paid out."
        : error.message;
      return { error: msg };
    }
  } else {
    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "accepted") patch.accepted_at = new Date().toISOString();
    const { error } = await supabase
      .from("offers")
      .update(patch)
      .eq("id", offerId);
    if (error) return { error: error.message };
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
  if ((await getRole()) !== "owner") return { error: "Only the owner can delete accounts." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_user", { p_user: userId });
  if (error) return { error: error.message };
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

/** Staff flag an account for the owner to review for deletion. */
export async function adminRecommendDeletion(
  userId: string,
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_recommend_deletion", {
    p_user: userId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

/** Restore a soft-deleted account (clears deletion + the delete suspension). */
export async function adminRestoreUser(
  userId: string,
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_restore_user", { p_user: userId });
  if (error) return { error: error.message };
  revalidatePath(`/admin/users/${userId}`);
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
