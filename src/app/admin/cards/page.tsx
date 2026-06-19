import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cardTitle, formatMoneyCents, labelFor, CARD_STATUSES } from "@/lib/cards";

export default async function AdminCardsPage() {
  const supabase = await createClient();

  const { data: cards } = await supabase
    .from("cards")
    .select(
      "id, serial, status, auto_grade_label, fmv_cents, fmv_currency, owner_id, card_year, manufacturer, set_name, player_or_character, card_number, variant, created_at",
    )
    .order("created_at", { ascending: false });

  const ownerIds = [...new Set((cards ?? []).map((c) => c.owner_id))];
  const emailById = new Map<string, string>();
  if (ownerIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", ownerIds);
    (profs ?? []).forEach((p) => emailById.set(p.id, p.email ?? "—"));
  }

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Submissions</h1>
          <p className="mt-1 text-sm text-zinc-500">Every card across all customers.</p>
        </div>

        {cards && cards.length > 0 ? (
          <ul className="border border-black/10 dark:border-white/15">
            {cards.map((c) => (
              <li key={c.id} className="border-b border-black/10 last:border-0 dark:border-white/15">
                <Link
                  href={`/admin/cards/${c.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-950"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{cardTitle(c)}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                      <span className="font-mono normal-case tracking-normal">{c.serial}</span>
                      {" · "}
                      {labelFor(CARD_STATUSES, c.status)}
                      {emailById.get(c.owner_id) ? ` · ${emailById.get(c.owner_id)}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                    {c.auto_grade_label || "—"}
                    {c.fmv_cents !== null ? ` · ${formatMoneyCents(c.fmv_cents, c.fmv_currency)}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border border-dashed border-black/20 p-12 text-center text-sm text-zinc-500 dark:border-white/20">
            No submissions yet.
          </p>
        )}
      </div>
    </main>
  );
}
