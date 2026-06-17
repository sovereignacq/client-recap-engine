import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsage } from "@/lib/usage";

export default async function ClientsListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email, company, created_at")
    .order("created_at", { ascending: false });

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
              Clients
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {usage.clients.used}
              {usage.clients.limit !== null && ` / ${usage.clients.limit}`} used
              {usage.plan === "free" ? " on Free plan" : " on Pro"}
            </p>
          </div>
          {usage.atClientLimit ? (
            <Link
              href="/pricing"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              Upgrade to add more
            </Link>
          ) : (
            <Link
              href="/dashboard/clients/new"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              + New client
            </Link>
          )}
        </header>

        {clients && clients.length > 0 ? (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {clients.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/clients/${c.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {c.company || c.email || "—"}
                    </p>
                  </div>
                  <span className="text-sm text-zinc-500">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-zinc-600 dark:text-zinc-400">
              No clients yet. Add your first one to start generating recaps.
            </p>
            <Link
              href="/dashboard/clients/new"
              className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              Add client
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
