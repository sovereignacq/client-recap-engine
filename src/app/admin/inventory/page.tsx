import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cardTitle, formatMoneyCents } from "@/lib/cards";
import { InventoryToggle } from "./inventory-toggle";

type CardRow = {
  id: string;
  serial: string;
  in_inventory: boolean;
  fmv_cents: number | null;
  fmv_currency: string;
  auto_grade_label: string | null;
  card_year: string | null;
  manufacturer: string | null;
  set_name: string | null;
  player_or_character: string | null;
  card_number: string | null;
  variant: string | null;
};

function Row({ c }: { c: CardRow }) {
  return (
    <li className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-3 last:border-0 dark:border-white/15">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{cardTitle(c)}</p>
        <p className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">
          <span className="font-mono normal-case tracking-normal">{c.serial}</span>
          {c.auto_grade_label ? ` · ${c.auto_grade_label}` : ""} ·{" "}
          {formatMoneyCents(c.fmv_cents, c.fmv_currency)}
        </p>
      </div>
      <InventoryToggle cardId={c.id} inInventory={c.in_inventory} />
    </li>
  );
}

export default async function AdminInventoryPage() {
  const supabase = await createClient();

  const { data: owner } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: cardRows } = owner
    ? await supabase
        .from("cards")
        .select(
          "id, serial, in_inventory, fmv_cents, fmv_currency, auto_grade_label, card_year, manufacturer, set_name, player_or_character, card_number, variant, status",
        )
        .eq("owner_id", owner.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const cards = (cardRows ?? []) as (CardRow & { status: string })[];
  const valued = cards.filter((c) => c.fmv_cents !== null && c.status !== "won");
  const pool = valued.filter((c) => c.in_inventory);
  const available = valued.filter((c) => !c.in_inventory);
  const unvalued = cards.filter((c) => c.fmv_cents === null && c.status !== "won");

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-3xl space-y-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Pack inventory</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Cards in the pool can be won from packs. Cards you buy from
              customers land here automatically; add your own stock below. Only
              cards with an FMV can be packed.
            </p>
          </div>
          <Link
            href="/dashboard/cards/new"
            className="shrink-0 rounded-none bg-black px-5 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 active:scale-[0.97] dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            + Add a card
          </Link>
        </div>

        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            In the pool ({pool.length})
          </h2>
          {pool.length > 0 ? (
            <ul className="border border-black/10 dark:border-white/15">
              {pool.map((c) => (
                <Row key={c.id} c={c} />
              ))}
            </ul>
          ) : (
            <p className="border border-dashed border-black/20 p-8 text-center text-sm text-zinc-500 dark:border-white/20">
              The pool is empty. Add valued cards below.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Available to add ({available.length})
          </h2>
          {available.length > 0 ? (
            <ul className="border border-black/10 dark:border-white/15">
              {available.map((c) => (
                <Row key={c.id} c={c} />
              ))}
            </ul>
          ) : (
            <p className="border border-dashed border-black/20 p-8 text-center text-sm text-zinc-500 dark:border-white/20">
              No valued house cards available. Intake and grade cards, or buy them
              from customers.
            </p>
          )}
        </section>

        {unvalued.length > 0 && (
          <p className="text-xs text-zinc-400">
            {unvalued.length} card(s) have no FMV and can&apos;t be packed yet —
            set a value on them first.
          </p>
        )}
      </div>
    </main>
  );
}
