import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsage } from "@/lib/usage";

type RecapRow = {
  id: string;
  subject_line: string | null;
  title: string;
  status: string;
  created_at: string;
  client: { id: string; name: string } | { id: string; name: string }[] | null;
};

export default async function RecapsListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("recaps")
    .select(
      "id, subject_line, title, status, created_at, client:clients(id, name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  const recaps = (data ?? []) as unknown as RecapRow[];

  const usage = await getUsage(user.id);

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
              Recaps
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {usage.recapsThisMonth.used}
              {usage.recapsThisMonth.limit !== null &&
                ` / ${usage.recapsThisMonth.limit}`}{" "}
              this month
              {usage.plan === "free" ? " on Free plan" : " on Pro"}
            </p>
          </div>
          <Link
            href="/dashboard/clients"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            + New recap
          </Link>
        </header>

        {recaps.length > 0 ? (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {recaps.map((r) => {
              const c = Array.isArray(r.client) ? r.client[0] : r.client;
              return (
                <li key={r.id}>
                  <Link
                    href={`/dashboard/recaps/${r.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <div>
                      <p className="font-medium">
                        {r.subject_line || r.title}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {c?.name ?? "—"} · {r.status} ·{" "}
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-zinc-600 dark:text-zinc-400">
              No recaps yet. Pick a client and start drafting.
            </p>
            <Link
              href="/dashboard/clients"
              className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              Go to clients
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
