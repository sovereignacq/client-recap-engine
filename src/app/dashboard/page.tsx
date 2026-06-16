import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const { count: clientsCount } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true });

  const { count: recapsCount } = await supabase
    .from("recaps")
    .select("id", { count: "exact", head: true });

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16">
      <div className="w-full max-w-3xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Signed in as{" "}
              <span className="font-medium">
                {profile?.full_name || profile?.email || user.email}
              </span>
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Sign out
            </button>
          </form>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Clients</p>
            <p className="mt-2 text-3xl font-semibold">{clientsCount ?? 0}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Recaps</p>
            <p className="mt-2 text-3xl font-semibold">{recapsCount ?? 0}</p>
          </div>
        </section>

        <section className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          Next up: client and recap CRUD UI. For now, you&apos;re authenticated
          and the database is ready.
        </section>
      </div>
    </main>
  );
}
