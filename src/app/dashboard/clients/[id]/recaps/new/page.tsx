import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsage } from "@/lib/usage";
import { isAIConfigured } from "@/lib/ai/client";
import { NewRecapForm } from "./new-recap-form";

export default async function NewRecapPage({
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

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, company")
    .eq("id", id)
    .maybeSingle();
  if (!client) notFound();

  const usage = await getUsage(user.id);
  const aiReady = isAIConfigured();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <Link
          href={`/dashboard/clients/${client.id}`}
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← Back to {client.name}
        </Link>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            New recap for {client.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Paste raw notes, pick a tone, and let Gemini draft a ready-to-send
            email. You can edit before saving.
          </p>
        </div>

        {!aiReady && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            AI generation is not yet configured. Ask the project owner to add
            <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900">
              GEMINI_API_KEY
            </code>
            to Vercel.
          </div>
        )}

        {usage.atRecapLimit && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            You&apos;ve used all {usage.recapsThisMonth.limit} recaps this month
            on the Free plan.{" "}
            <Link href="/pricing" className="underline">
              Upgrade for unlimited
            </Link>
            .
          </div>
        )}

        <NewRecapForm
          clientId={client.id}
          disabled={!aiReady || usage.atRecapLimit}
        />
      </div>
    </main>
  );
}
