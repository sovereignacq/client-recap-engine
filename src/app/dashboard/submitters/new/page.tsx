import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubmitterForm } from "../submitter-form";

export default async function NewSubmitterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-xl space-y-6">
        <Link
          href="/dashboard/submitters"
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← Back to submitters
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New submitter</h1>
        <SubmitterForm mode="create" />
      </div>
    </main>
  );
}
