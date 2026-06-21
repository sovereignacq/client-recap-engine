"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Customers may only submit or cancel their own offers; accept/decline/pay are
// staff actions handled in the admin area (payout goes to the seller's wallet).
const CUSTOMER_STATUSES = ["draft", "sent", "canceled"] as const;

function parseCents(raw: string): number {
  const n = Number(raw.replace(/[$,]/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export type SaveState = { ok: true; id: string } | { ok: false; error: string };

/**
 * Create a sell-to-us offer from a set of the customer's own cards. The form
 * sends `card_<id>` (checked) and `amount_<id>` (dollar amount) for each card.
 * Payout is always to the APEX wallet — the seller withdraws on their own.
 */
export async function createOfferAction(
  formData: FormData,
): Promise<SaveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const notes = String(formData.get("notes") ?? "").trim() || null;

  // Collect selected cards + per-card amounts.
  const items: { card_id: string; amount_cents: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("card_") && value) {
      const cardId = key.slice("card_".length);
      const amount = parseCents(String(formData.get(`amount_${cardId}`) ?? "0"));
      items.push({ card_id: cardId, amount_cents: amount });
    }
  }

  if (items.length === 0) {
    return { ok: false, error: "Select at least one card to include in the offer." };
  }

  const total = items.reduce((sum, i) => sum + i.amount_cents, 0);

  const { data: offer, error } = await supabase
    .from("offers")
    .insert({
      owner_id: user.id,
      submitter_id: null,
      status: "draft",
      offer_total_cents: total,
      payout_method: "wallet",
      notes,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const { error: itemsError } = await supabase.from("offer_items").insert(
    items.map((i) => ({
      owner_id: user.id,
      offer_id: offer.id,
      card_id: i.card_id,
      amount_cents: i.amount_cents,
    })),
  );
  if (itemsError) {
    // Roll back the offer so we don't leave an empty shell.
    await supabase.from("offers").delete().eq("id", offer.id);
    return { ok: false, error: itemsError.message };
  }

  revalidatePath("/dashboard/offers");
  revalidatePath("/dashboard");
  return { ok: true, id: offer.id };
}

/**
 * Customer-side status change: submit a draft for review ("sent") or cancel.
 * Accepting, declining and paying out are staff-only (see admin_pay_offer).
 */
export async function updateOfferStatusAction(
  offerId: string,
  status: string,
): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!(CUSTOMER_STATUSES as ReadonlyArray<string>).includes(status)) {
    return { error: "You can only submit or cancel an offer." };
  }

  // Don't let a customer reopen/cancel an offer that's already been processed.
  const { data: current } = await supabase
    .from("offers")
    .select("status")
    .eq("id", offerId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!current) return { error: "Offer not found." };
  if (["accepted", "paid", "declined"].includes(current.status)) {
    return { error: "This offer is already being processed by our team." };
  }

  const { error } = await supabase
    .from("offers")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", offerId)
    .eq("owner_id", user.id);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/offers/${offerId}`);
  revalidatePath("/dashboard/offers");
  revalidatePath("/dashboard");
}

/** Customers can edit the note on an offer that hasn't been processed yet. */
export async function updateOfferDetailsAction(
  offerId: string,
  formData: FormData,
): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const notes = String(formData.get("notes") ?? "").trim() || null;

  const { error } = await supabase
    .from("offers")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", offerId)
    .eq("owner_id", user.id);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/offers/${offerId}`);
}

export async function deleteOfferAction(offerId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("offers").delete().eq("id", offerId).eq("owner_id", user.id);

  revalidatePath("/dashboard/offers");
  revalidatePath("/dashboard");
  redirect("/dashboard/offers");
}
