import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SubmittersListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: submitters } = await supabase
    .from("submitters")
    .select("id, name, email, phone, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
            >
              ← Back to dashboard
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Submitters
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              People who submit cards to be graded, sent off, or sold to you.
            </p>
          </div>
          <Link
            href="/dashboard/submitters/new"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            + New submitter
          </Link>
        </header>

        {submitters && submitters.length > 0 ? (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {submitters.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/dashboard/submitters/${s.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {s.email || s.phone || "—"}
                    </p>
                  </div>
                  <span className="text-sm text-zinc-500">
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-zinc-600 dark:text-zinc-400">
              No submitters yet. Add one to start logging card intake.
            </p>
            <Link
              href="/dashboard/submitters/new"
              className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              Add submitter
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
