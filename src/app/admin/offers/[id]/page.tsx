import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cardTitle, formatMoneyCents } from "@/lib/cards";
import { OFFER_STATUSES, PAYOUT_METHODS, offerLabel } from "@/lib/offers";
import { AdminOfferStatusControl } from "./status-control";

export default async function AdminOfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: offer } = await supabase
    .from("offers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!offer) notFound();

  const { data: customer } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", offer.owner_id)
    .maybeSingle();

  const { data: itemRows } = await supabase
    .from("offer_items")
    .select(
      "id, amount_cents, card:cards(id, card_year, manufacturer, set_name, player_or_character, card_number, variant, serial)",
    )
    .eq("offer_id", id);

  const items = (itemRows ?? []).map((it) => {
    const card = Array.isArray(it.card) ? it.card[0] : it.card;
    return {
      id: it.id,
      amountCents: it.amount_cents as number,
      serial: card?.serial as string | undefined,
      title: card ? cardTitle(card) : "Card removed",
    };
  });

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <Link
          href="/admin/offers"
          className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 hover:text-black dark:hover:text-white"
        >
          ← Sell offers
        </Link>

        <header className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            {offerLabel(OFFER_STATUSES, offer.status)}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {customer?.email ?? "—"}
          </h1>
          <p className="text-sm text-zinc-500">
            Offer total{" "}
            <span className="font-semibold tabular-nums text-black dark:text-white">
              {formatMoneyCents(offer.offer_total_cents)}
            </span>{" "}
            · {items.length} card{items.length === 1 ? "" : "s"}
            {offer.payout_method
              ? ` · payout: ${offerLabel(PAYOUT_METHODS, offer.payout_method)}`
              : ""}
          </p>
        </header>

        <section className="border border-black/10 dark:border-white/15">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex items-center justify-between gap-4 border-b border-black/10 px-4 py-3 last:border-0 dark:border-white/15"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{it.title}</p>
                {it.serial && (
                  <p className="font-mono text-[11px] text-zinc-500">{it.serial}</p>
                )}
              </div>
              <span className="shrink-0 text-sm tabular-nums">
                {formatMoneyCents(it.amountCents)}
              </span>
            </div>
          ))}
        </section>

        {offer.notes && (
          <p className="border-l-2 border-black/15 pl-3 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
            {offer.notes}
          </p>
        )}

        <section className="border border-black/10 p-6 dark:border-white/15">
          <AdminOfferStatusControl
            offerId={offer.id}
            status={offer.status}
            statuses={OFFER_STATUSES.map((s) => ({ ...s }))}
          />
        </section>
      </div>
    </main>
  );
}
