"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsage } from "@/lib/usage";

type FormResult = { error: string } | void;

export async function createClientAction(formData: FormData): Promise<FormResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Enforce free-tier client limit
  const usage = await getUsage(user.id);
  if (usage.atClientLimit) {
    return {
      error: `Free plan is limited to ${usage.clients.limit} client. Upgrade to add more.`,
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const company = String(formData.get("company") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) return { error: "Name is required." };

  const { data, error } = await supabase
    .from("clients")
    .insert({ owner_id: user.id, name, email, company, notes })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard");
  redirect(`/dashboard/clients/${data.id}`);
}

export async function updateClientAction(
  clientId: string,
  formData: FormData,
): Promise<FormResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const company = String(formData.get("company") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) return { error: "Name is required." };

  const { error } = await supabase
    .from("clients")
    .update({ name, email, company, notes, updated_at: new Date().toISOString() })
    .eq("id", clientId)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/clients");
  redirect(`/dashboard/clients/${clientId}`);
}

export async function deleteClientAction(clientId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("owner_id", user.id);

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard");
  redirect("/dashboard/clients");
}
