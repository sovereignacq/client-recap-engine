import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  cardTitle,
  formatMoneyCents,
  labelFor,
  CARD_STATUSES,
} from "@/lib/cards";
import { DeleteSubmitterButton } from "./delete-button";

export default async function SubmitterDetailPage({
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

  const { data: submitter } = await supabase
    .from("submitters")
    .select("id, name, email, phone, address, notes, created_at")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!submitter) notFound();

  const { data: cards } = await supabase
    .from("cards")
    .select(
      "id, serial, status, fmv_cents, fmv_currency, card_year, manufacturer, set_name, player_or_character, card_number, variant, created_at",
    )
    .eq("submitter_id", id)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-3xl space-y-6">
        <Link
          href="/dashboard/submitters"
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← Back to submitters
        </Link>

        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {submitter.name}
            </h1>
            {submitter.email && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {submitter.email}
              </p>
            )}
            {submitter.phone && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {submitter.phone}
              </p>
            )}
            {submitter.address && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {submitter.address}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href={`/dashboard/submitters/${submitter.id}/edit`}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Edit
            </Link>
            <Link
              href={`/dashboard/offers/new?submitter=${submitter.id}`}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Make offer
            </Link>
            <Link
              href={`/dashboard/cards/new?submitter=${submitter.id}`}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              + Intake card
            </Link>
          </div>
        </header>

        {submitter.notes && (
          <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Notes
            </p>
            <p className="whitespace-pre-wrap text-sm">{submitter.notes}</p>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-medium">
            Submitted cards{" "}
            <span className="text-sm font-normal text-zinc-500">
              ({cards?.length ?? 0})
            </span>
          </h2>
          {cards && cards.length > 0 ? (
            <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {cards.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/cards/${c.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{cardTitle(c)}</p>
                      <p className="text-xs text-zinc-500">
                        <span className="font-mono">{c.serial}</span> ·{" "}
                        {labelFor(CARD_STATUSES, c.status)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                      {formatMoneyCents(c.fmv_cents, c.fmv_currency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              No cards logged for {submitter.name} yet.
            </div>
          )}
        </section>

        <section className="pt-6">
          <DeleteSubmitterButton
            submitterId={submitter.id}
            submitterName={submitter.name}
            cardCount={cards?.length ?? 0}
          />
        </section>
      </div>
    </main>
  );
}
