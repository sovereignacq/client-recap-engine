import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  cardTitle,
  formatMoneyCents,
  labelFor,
  CARD_STATUSES,
  ID_STATUSES,
} from "@/lib/cards";

type CardRow = {
  id: string;
  serial: string;
  status: string;
  id_status: string;
  fmv_cents: number | null;
  fmv_currency: string;
  card_year: string | null;
  manufacturer: string | null;
  set_name: string | null;
  player_or_character: string | null;
  card_number: string | null;
  variant: string | null;
  submitter: { name: string } | null;
  created_at: string;
};

export default async function CardsListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("cards")
    .select(
      "id, serial, status, id_status, fmv_cents, fmv_currency, card_year, manufacturer, set_name, player_or_character, card_number, variant, created_at, submitter:submitters(name)",
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const cards: CardRow[] = (data ?? []).map((c) => ({
    ...c,
    submitter: Array.isArray(c.submitter) ? (c.submitter[0] ?? null) : c.submitter,
  })) as CardRow[];

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
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Cards</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Every submitted card, serialized and tracked from intake to payout.
            </p>
          </div>
          <Link
            href="/dashboard/cards/new"
            className="shrink-0 rounded-none bg-black px-5 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Intake card
          </Link>
        </header>

        {cards.length > 0 ? (
          <ul className="border border-black/10 dark:border-white/15">
            {cards.map((c) => (
              <li key={c.id} className="border-b border-black/10 last:border-0 dark:border-white/15">
                <Link
                  href={`/dashboard/cards/${c.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-950"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{cardTitle(c)}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                      <span className="font-mono normal-case tracking-normal">
                        {c.serial}
                      </span>{" "}
                      · {labelFor(CARD_STATUSES, c.status)}
                      {c.submitter?.name ? ` · ${c.submitter.name}` : ""}
                      {c.id_status !== "confirmed"
                        ? ` · ${labelFor(ID_STATUSES, c.id_status)}`
                        : ""}
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
          <div className="border border-dashed border-black/20 p-16 text-center dark:border-white/20">
            <p className="text-sm text-zinc-500">
              No cards yet. Intake your first card to identify and serialize it.
            </p>
            <Link
              href="/dashboard/cards/new"
              className="mt-5 inline-block rounded-none bg-black px-5 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Intake card
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
