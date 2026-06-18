"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const VALID_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "paid",
  "canceled",
] as const;
const VALID_PAYOUTS = [
  "cash",
  "paypal",
  "venmo",
  "store_credit",
  "check",
  "other",
] as const;

function parseCents(raw: string): number {
  const n = Number(raw.replace(/[$,]/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export type SaveState = { ok: true; id: string } | { ok: false; error: string };

/**
 * Create a sell-to-us offer from a set of the submitter's cards. The form sends
 * `card_<id>` (checked) and `amount_<id>` (dollar amount) for each selected card.
 */
export async function createOfferAction(
  formData: FormData,
): Promise<SaveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const submitterId = String(formData.get("submitter_id") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const payoutRaw = String(formData.get("payout_method") ?? "").trim();
  const payoutMethod = (VALID_PAYOUTS as ReadonlyArray<string>).includes(payoutRaw)
    ? payoutRaw
    : null;

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
      submitter_id: submitterId,
      status: "draft",
      offer_total_cents: total,
      payout_method: payoutMethod,
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
 * Move an offer through its lifecycle. Marking it "paid" closes out the deal:
 * the included cards are flipped to "sold".
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
  if (!(VALID_STATUSES as ReadonlyArray<string>).includes(status)) {
    return { error: "Invalid status." };
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "accepted") patch.accepted_at = new Date().toISOString();
  if (status === "paid") patch.paid_at = new Date().toISOString();

  const { error } = await supabase
    .from("offers")
    .update(patch)
    .eq("id", offerId)
    .eq("owner_id", user.id);
  if (error) return { error: error.message };

  // On payout, mark the included cards as sold.
  if (status === "paid") {
    const { data: items } = await supabase
      .from("offer_items")
      .select("card_id")
      .eq("offer_id", offerId)
      .eq("owner_id", user.id);
    const cardIds = (items ?? []).map((i) => i.card_id);
    if (cardIds.length) {
      await supabase
        .from("cards")
        .update({ status: "sold", updated_at: new Date().toISOString() })
        .in("id", cardIds)
        .eq("owner_id", user.id);
    }
  }

  revalidatePath(`/dashboard/offers/${offerId}`);
  revalidatePath("/dashboard/offers");
  revalidatePath("/dashboard");
}

export async function updateOfferDetailsAction(
  offerId: string,
  formData: FormData,
): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const payoutRaw = String(formData.get("payout_method") ?? "").trim();
  const payoutMethod = (VALID_PAYOUTS as ReadonlyArray<string>).includes(payoutRaw)
    ? payoutRaw
    : null;
  const payoutReference =
    String(formData.get("payout_reference") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const { error } = await supabase
    .from("offers")
    .update({
      payout_method: payoutMethod,
      payout_reference: payoutReference,
      notes,
      updated_at: new Date().toISOString(),
    })
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
