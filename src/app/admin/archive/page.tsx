import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cardTitle, labelFor, CARD_STATUSES } from "@/lib/cards";
import { AdminArchiveControl } from "../cards/[id]/archive-control";

export default async function AdminArchivePage() {
  const supabase = await createClient();

  const { data: cards } = await supabase
    .from("cards")
    .select(
      "id, serial, status, owner_id, archived_at, card_year, manufacturer, set_name, player_or_character, card_number, variant",
    )
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

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
          <h1 className="text-3xl font-semibold tracking-tight">Archive</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Deleted cards — kept here for records. Customers no longer see them.
            Open one to restore it.
          </p>
        </div>

        {cards && cards.length > 0 ? (
          <ul className="border border-black/10 dark:border-white/15">
            {cards.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 border-b border-black/10 px-5 py-4 last:border-0 dark:border-white/15"
              >
                <Link
                  href={`/admin/cards/${c.id}`}
                  className="min-w-0 flex-1 transition"
                >
                  <p className="truncate font-medium">{cardTitle(c)}</p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                    <span className="font-mono normal-case tracking-normal">{c.serial}</span>
                    {" · "}
                    {labelFor(CARD_STATUSES, c.status)}
                    {emailById.get(c.owner_id) ? ` · ${emailById.get(c.owner_id)}` : ""}
                  </p>
                </Link>
                <AdminArchiveControl cardId={c.id} archived={true} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="border border-dashed border-black/20 p-12 text-center text-sm text-zinc-500 dark:border-white/20">
            Nothing archived.
          </p>
        )}
      </div>
    </main>
  );
}
