import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteClientButton } from "./delete-button";

export default async function ClientDetailPage({
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
    .select("id, name, email, company, notes, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!client) notFound();

  const { data: recaps } = await supabase
    .from("recaps")
    .select("id, title, subject_line, status, meeting_date, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-3xl space-y-6">
        <Link
          href="/dashboard/clients"
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← Back to clients
        </Link>

        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {client.name}
            </h1>
            {client.company && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {client.company}
              </p>
            )}
            {client.email && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {client.email}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href={`/dashboard/clients/${client.id}/edit`}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Edit
            </Link>
            <Link
              href={`/dashboard/clients/${client.id}/recaps/new`}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              + New recap
            </Link>
          </div>
        </header>

        {client.notes && (
          <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Notes
            </p>
            <p className="whitespace-pre-wrap text-sm">{client.notes}</p>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-medium">Recaps</h2>
          {recaps && recaps.length > 0 ? (
            <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {recaps.map((r) => (
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
                        {r.status} ·{" "}
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              No recaps for {client.name} yet.
            </div>
          )}
        </section>

        <section className="pt-6">
          <DeleteClientButton
            clientId={client.id}
            clientName={client.name}
            recapCount={recaps?.length ?? 0}
          />
        </section>
      </div>
    </main>
  );
}
