"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsage } from "@/lib/usage";
import { generateRecap, type RecapTone } from "@/lib/ai/client";

export type GenerateState =
  | { ok: true; subject: string; body: string; model: string }
  | { ok: false; error: string };

const VALID_TONES: ReadonlyArray<RecapTone> = [
  "professional",
  "friendly",
  "brief",
];

/**
 * Server action invoked from the new-recap form. Validates input, calls Gemini,
 * and returns the generated subject + body so the client component can show it
 * for editing before saving.
 */
export async function generateRecapAction(
  formData: FormData,
): Promise<GenerateState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const usage = await getUsage(user.id);
  if (usage.atRecapLimit) {
    return {
      ok: false,
      error: `Free plan is limited to ${usage.recapsThisMonth.limit} recaps per month. Upgrade for unlimited.`,
    };
  }

  const clientId = String(formData.get("client_id") ?? "");
  const rawNotes = String(formData.get("raw_notes") ?? "").trim();
  const toneRaw = String(formData.get("tone") ?? "professional");
  const cta = String(formData.get("call_to_action") ?? "").trim();
  const meetingDate = String(formData.get("meeting_date") ?? "").trim();

  if (!clientId) return { ok: false, error: "Missing client." };
  if (rawNotes.length < 10) {
    return {
      ok: false,
      error: "Add at least a sentence or two of raw notes so the AI has something to work with.",
    };
  }
  const tone = (VALID_TONES.includes(toneRaw as RecapTone)
    ? toneRaw
    : "professional") as RecapTone;

  // Pull client + sender info for context
  const { data: client } = await supabase
    .from("clients")
    .select("name, company")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { ok: false, error: "Client not found." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  try {
    const result = await generateRecap({
      clientName: client.name,
      clientCompany: client.company,
      senderName: profile?.full_name ?? null,
      rawNotes,
      tone,
      callToAction: cta || null,
      meetingDate: meetingDate || null,
    });
    return {
      ok: true,
      subject: result.subject,
      body: result.body,
      model: result.model,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed.";
    return { ok: false, error: msg };
  }
}

export type SaveState = { ok: true; id: string } | { ok: false; error: string };

/**
 * Persist a recap to the DB. Called after the user reviews/edits the AI output.
 */
export async function saveRecapAction(formData: FormData): Promise<SaveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const usage = await getUsage(user.id);
  if (usage.atRecapLimit) {
    return {
      ok: false,
      error: `Free plan is limited to ${usage.recapsThisMonth.limit} recaps per month. Upgrade for unlimited.`,
    };
  }

  const clientId = String(formData.get("client_id") ?? "");
  const rawNotes = String(formData.get("raw_notes") ?? "").trim();
  const toneRaw = String(formData.get("tone") ?? "professional");
  const cta = String(formData.get("call_to_action") ?? "").trim() || null;
  const meetingDate = String(formData.get("meeting_date") ?? "").trim() || null;
  const subjectLine = String(formData.get("subject_line") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim() || null;

  if (!clientId || !subjectLine || !content) {
    return { ok: false, error: "Missing required fields." };
  }
  const tone = (VALID_TONES.includes(toneRaw as RecapTone)
    ? toneRaw
    : "professional") as RecapTone;

  const { data, error } = await supabase
    .from("recaps")
    .insert({
      client_id: clientId,
      owner_id: user.id,
      title: subjectLine.slice(0, 120),
      subject_line: subjectLine,
      content,
      raw_notes: rawNotes,
      tone,
      call_to_action: cta,
      meeting_date: meetingDate,
      model,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/recaps");
  revalidatePath("/dashboard");
  return { ok: true, id: data.id };
}

export async function updateRecapAction(
  recapId: string,
  formData: FormData,
): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const subjectLine = String(formData.get("subject_line") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const status = String(formData.get("status") ?? "draft");

  if (!subjectLine || !content) return { error: "Cannot save empty recap." };
  if (!["draft", "sent", "archived"].includes(status)) {
    return { error: "Invalid status." };
  }

  const { error } = await supabase
    .from("recaps")
    .update({
      subject_line: subjectLine,
      title: subjectLine.slice(0, 120),
      content,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recapId)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/recaps/${recapId}`);
  revalidatePath("/dashboard/recaps");
}

export async function deleteRecapAction(recapId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: recap } = await supabase
    .from("recaps")
    .select("client_id")
    .eq("id", recapId)
    .eq("owner_id", user.id)
    .maybeSingle();

  await supabase
    .from("recaps")
    .delete()
    .eq("id", recapId)
    .eq("owner_id", user.id);

  revalidatePath("/dashboard/recaps");
  revalidatePath("/dashboard");
  if (recap?.client_id) {
    revalidatePath(`/dashboard/clients/${recap.client_id}`);
    redirect(`/dashboard/clients/${recap.client_id}`);
  } else {
    redirect("/dashboard/recaps");
  }
}

export async function markRecapSentAction(recapId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("recaps")
    .update({ status: "sent", updated_at: new Date().toISOString() })
    .eq("id", recapId)
    .eq("owner_id", user.id);

  revalidatePath(`/dashboard/recaps/${recapId}`);
  revalidatePath("/dashboard/recaps");
}
