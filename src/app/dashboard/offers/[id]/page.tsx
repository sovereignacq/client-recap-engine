import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cardTitle, formatMoneyCents } from "@/lib/cards";
import { OFFER_STATUSES, PAYOUT_METHODS, offerLabel } from "@/lib/offers";
import { OfferControls } from "./offer-controls";
import { DeleteOfferButton } from "./delete-button";

export default async function OfferDetailPage({
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

  const { data: offer } = await supabase
    .from("offers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!offer) notFound();

  const submitter = offer.submitter_id
    ? (
        await supabase
          .from("submitters")
          .select("id, name")
          .eq("id", offer.submitter_id)
          .maybeSingle()
      ).data
    : null;

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
      cardId: card?.id as string | undefined,
      serial: card?.serial as string | undefined,
      title: card ? cardTitle(card) : "Card removed",
    };
  });

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <Link
          href="/dashboard/offers"
          className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 hover:text-black dark:hover:text-white"
        >
          ← Sell-to-us
        </Link>

        <header className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            {offerLabel(OFFER_STATUSES, offer.status)}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {submitter ? (
              <Link
                href={`/dashboard/submitters/${submitter.id}`}
                className="hover:underline"
              >
                {submitter.name}
              </Link>
            ) : (
              "Walk-in"
            )}
          </h1>
          <p className="text-sm text-zinc-500">
            Offer total{" "}
            <span className="font-semibold tabular-nums text-black dark:text-white">
              {formatMoneyCents(offer.offer_total_cents)}
            </span>{" "}
            · {items.length} card{items.length === 1 ? "" : "s"}
          </p>
        </header>

        <section className="border border-black/10 dark:border-white/15">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex items-center justify-between gap-4 border-b border-black/10 px-4 py-3 last:border-0 dark:border-white/15"
            >
              <div className="min-w-0">
                {it.cardId ? (
                  <Link
                    href={`/dashboard/cards/${it.cardId}`}
                    className="truncate text-sm hover:underline"
                  >
                    {it.title}
                  </Link>
                ) : (
                  <span className="text-sm text-zinc-500">{it.title}</span>
                )}
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

        <OfferControls
          offerId={offer.id}
          status={offer.status}
          payoutMethod={offer.payout_method}
          payoutReference={offer.payout_reference}
          notes={offer.notes}
          payoutMethods={PAYOUT_METHODS.map((m) => ({ ...m }))}
          statuses={OFFER_STATUSES.map((s) => ({ ...s }))}
        />

        <footer className="flex items-center justify-between pt-2 text-xs text-zinc-500">
          <span>Created {new Date(offer.created_at).toLocaleString()}</span>
          <DeleteOfferButton offerId={offer.id} />
        </footer>
      </div>
    </main>
  );
}
