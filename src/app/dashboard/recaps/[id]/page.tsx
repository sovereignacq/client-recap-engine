import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RecapView } from "./recap-view";

export default async function RecapDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: recap } = await supabase
    .from("recaps")
    .select(
      "id, client_id, title, subject_line, content, status, tone, meeting_date, call_to_action, raw_notes, model, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!recap) notFound();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, email, company")
    .eq("id", recap.client_id)
    .maybeSingle();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-3xl space-y-6">
        <Link
          href={
            client
              ? `/dashboard/clients/${client.id}`
              : "/dashboard/recaps"
          }
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← {client ? `Back to ${client.name}` : "Back to recaps"}
        </Link>

        <RecapView
          recap={{
            id: recap.id,
            subject: recap.subject_line || recap.title,
            body: recap.content || "",
            status: recap.status,
            tone: recap.tone,
            model: recap.model,
            meetingDate: recap.meeting_date,
            createdAt: recap.created_at,
          }}
          client={
            client
              ? { id: client.id, name: client.name, email: client.email }
              : null
          }
        />
      </div>
    </main>
  );
}
