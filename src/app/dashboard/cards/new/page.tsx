import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAIConfigured } from "@/lib/ai/client";
import { NewCardForm } from "./new-card-form";

export default async function NewCardPage({
  searchParams,
}: {
  searchParams: Promise<{ submitter?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { submitter } = await searchParams;

  const { data: submitters } = await supabase
    .from("submitters")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <Link
          href="/dashboard/cards"
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← Back to cards
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Intake a card</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Upload a photo to identify the card, confirm the details, then save
            to assign a tracking serial.
          </p>
        </div>

        {!isAIConfigured() && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            AI identification is unavailable until <code>GEMINI_API_KEY</code> is
            set. You can still enter cards manually below.
          </p>
        )}

        <NewCardForm
          submitters={submitters ?? []}
          defaultSubmitterId={submitter ?? null}
          aiConfigured={isAIConfigured()}
        />
      </div>
    </main>
  );
}
