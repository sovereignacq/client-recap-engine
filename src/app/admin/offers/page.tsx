import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoneyCents } from "@/lib/cards";
import { OFFER_STATUSES, offerLabel } from "@/lib/offers";

export default async function AdminOffersPage() {
  const supabase = await createClient();

  const { data: offers } = await supabase
    .from("offers")
    .select("id, status, offer_total_cents, created_at, owner_id")
    .order("created_at", { ascending: false });

  const ownerIds = [...new Set((offers ?? []).map((o) => o.owner_id))];
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
          <h1 className="text-3xl font-semibold tracking-tight">Sell offers</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Customers selling cards to APEX. Review, accept, and mark paid.
          </p>
        </div>

        {offers && offers.length > 0 ? (
          <ul className="border border-black/10 dark:border-white/15">
            {offers.map((o) => (
              <li key={o.id} className="border-b border-black/10 last:border-0 dark:border-white/15">
                <Link
                  href={`/admin/offers/${o.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-950"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{emailById.get(o.owner_id) ?? "—"}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                      {offerLabel(OFFER_STATUSES, o.status)} ·{" "}
                      {new Date(o.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {formatMoneyCents(o.offer_total_cents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border border-dashed border-black/20 p-12 text-center text-sm text-zinc-500 dark:border-white/20">
            No sell offers yet.
          </p>
        )}
      </div>
    </main>
  );
}
