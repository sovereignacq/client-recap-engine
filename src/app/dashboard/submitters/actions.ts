"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type FormResult = { error: string } | void;

/**
 * Submitters are the external people who hand us cards to grade / sell.
 * They are NOT app users — just records owned by the operator (auth user).
 */
export async function createSubmitterAction(
  formData: FormData,
): Promise<FormResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) return { error: "Name is required." };

  const { data, error } = await supabase
    .from("submitters")
    .insert({ owner_id: user.id, name, email, phone, address, notes })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/submitters");
  revalidatePath("/dashboard");
  redirect(`/dashboard/submitters/${data.id}`);
}

export async function updateSubmitterAction(
  submitterId: string,
  formData: FormData,
): Promise<FormResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) return { error: "Name is required." };

  const { error } = await supabase
    .from("submitters")
    .update({
      name,
      email,
      phone,
      address,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", submitterId)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/submitters/${submitterId}`);
  revalidatePath("/dashboard/submitters");
  redirect(`/dashboard/submitters/${submitterId}`);
}

export async function deleteSubmitterAction(
  submitterId: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Cards keep their records; their submitter_id is set NULL by the FK.
  await supabase
    .from("submitters")
    .delete()
    .eq("id", submitterId)
    .eq("owner_id", user.id);

  revalidatePath("/dashboard/submitters");
  revalidatePath("/dashboard/cards");
  revalidatePath("/dashboard");
  redirect("/dashboard/submitters");
}
