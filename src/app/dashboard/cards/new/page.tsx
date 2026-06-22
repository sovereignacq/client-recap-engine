import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAIConfigured } from "@/lib/ai/client";
import { getRole, isStaff } from "@/lib/roles";
import { IntakeModes } from "./intake-modes";

// Identification (photo upload + vision) can run well past the default
// serverless limit, especially with both front and back images. Allow up to
// 60s so the request isn't killed mid-identification.
export const maxDuration = 60;

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
    .eq("owner_id", user.id)
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
          <h1 className="text-3xl font-semibold tracking-tight">Add a card</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Just collecting? Use <strong>Quick add</strong> to search the catalog
            and add cards in seconds. Sending a card to grading or selling it?
            Use <strong>Grade &amp; serialize</strong> for the full photo,
            grade and serial workflow.
          </p>
        </div>

        {!isAIConfigured() && (
          <p className="border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Automatic identification is currently offline. Quick add still works,
            and you can enter cards manually under Grade &amp; serialize.
          </p>
        )}

        <IntakeModes
          submitters={submitters ?? []}
          defaultSubmitterId={submitter ?? null}
          aiConfigured={isAIConfigured()}
          userId={user.id}
          staff={isStaff(await getRole())}
        />
      </div>
    </main>
  );
}
