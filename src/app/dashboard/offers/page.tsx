import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoneyCents } from "@/lib/cards";
import { OFFER_STATUSES, offerLabel } from "@/lib/offers";

type OfferRow = {
  id: string;
  status: string;
  offer_total_cents: number;
  created_at: string;
  submitter: { name: string } | null;
};

export default async function OffersListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("offers")
    .select(
      "id, status, offer_total_cents, created_at, submitter:submitters(name)",
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const offers: OfferRow[] = (data ?? []).map((o) => ({
    ...o,
    submitter: Array.isArray(o.submitter) ? (o.submitter[0] ?? null) : o.submitter,
  })) as OfferRow[];

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
              Sell-to-us
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Offers to buy cards from submitters at fair market value.
            </p>
          </div>
          <Link
            href="/dashboard/offers/new"
            className="shrink-0 rounded-none bg-black px-5 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            New offer
          </Link>
        </header>

        {offers.length > 0 ? (
          <ul className="border border-black/10 dark:border-white/15">
            {offers.map((o) => (
              <li key={o.id} className="border-b border-black/10 last:border-0 dark:border-white/15">
                <Link
                  href={`/dashboard/offers/${o.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-950"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {o.submitter?.name || "Walk-in"}
                    </p>
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
          <div className="border border-dashed border-black/20 p-16 text-center dark:border-white/20">
            <p className="text-sm text-zinc-500">
              No offers yet. Make one to buy cards from a submitter.
            </p>
            <Link
              href="/dashboard/offers/new"
              className="mt-5 inline-block rounded-none bg-black px-5 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              New offer
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
