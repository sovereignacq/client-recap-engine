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
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-14">
      <div className="w-full max-w-4xl space-y-8">
        <header className="flex items-end justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 hover:text-black dark:hover:text-white"
            >
              ← Dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Submitters
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              People who submit cards to be graded, sent off, or sold to you.
            </p>
          </div>
          <Link
            href="/dashboard/submitters/new"
            className="shrink-0 rounded-none bg-black px-5 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            New submitter
          </Link>
        </header>

        {submitters && submitters.length > 0 ? (
          <ul className="border border-black/10 dark:border-white/15">
            {submitters.map((s) => (
              <li key={s.id} className="border-b border-black/10 last:border-0 dark:border-white/15">
                <Link
                  href={`/dashboard/submitters/${s.id}`}
                  className="flex items-center justify-between px-5 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-950"
                >
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {s.email || s.phone || "—"}
                    </p>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.1em] text-zinc-400">
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="border border-dashed border-black/20 p-16 text-center dark:border-white/20">
            <p className="text-sm text-zinc-500">
              No submitters yet. Add one to start logging card intake.
            </p>
            <Link
              href="/dashboard/submitters/new"
              className="mt-5 inline-block rounded-none bg-black px-5 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Add submitter
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
