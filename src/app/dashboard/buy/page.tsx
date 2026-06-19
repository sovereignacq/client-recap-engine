import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoneyCents } from "@/lib/cards";
import { BuyClient, type Tier } from "./buy-client";

export const maxDuration = 30;

type OpeningRow = {
  id: string;
  tier_key: string;
  price_cents: number;
  card_fmv_cents: number | null;
  outcome: string | null;
  profit_cents: number | null;
  created_at: string;
};

export default async function BuyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tierRows } = await supabase
    .from("pack_tiers")
    .select("key, name, price_cents, odds")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const tiers: Tier[] = (tierRows ?? []).map((t) => ({
    key: t.key,
    name: t.name,
    priceCents: t.price_cents,
    odds: (t.odds as Tier["odds"]) ?? [],
  }));

  // Pool size via a definer function so customers (who can't read house
  // inventory rows directly) still know whether packs are stocked.
  const { data: poolCount } = await supabase.rpc("pack_pool_count");

  const { data: openings } = await supabase
    .from("pack_openings")
    .select("id, tier_key, price_cents, card_fmv_cents, outcome, profit_cents, created_at")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const history = (openings ?? []) as OpeningRow[];
  const net = history.reduce((sum, o) => sum + (o.profit_cents ?? 0), 0);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-4xl space-y-10">
        <header>
          <Link
            href="/dashboard"
            className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 hover:text-black dark:hover:text-white"
          >
            ← My collection
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Buy</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Pick a tier, open a pack, get one random card. You might land below,
            around, or above what you paid — the odds are listed on each tier.
          </p>
        </header>

        <BuyClient tiers={tiers} poolAvailable={((poolCount as number) ?? 0) > 0} />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Your rips
            </h2>
            {history.length > 0 && (
              <span className="text-sm">
                Net{" "}
                <span
                  className={`font-semibold tabular-nums ${
                    net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {net >= 0 ? "+" : "−"}
                  {formatMoneyCents(Math.abs(net))}
                </span>
              </span>
            )}
          </div>
          {history.length > 0 ? (
            <ul className="border border-black/10 dark:border-white/15">
              {history.map((o) => {
                const profit = o.profit_cents ?? 0;
                return (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-3 text-sm last:border-0 dark:border-white/15"
                  >
                    <span className="capitalize">{o.tier_key}</span>
                    <span className="text-zinc-500">
                      paid {formatMoneyCents(o.price_cents)} · got{" "}
                      {formatMoneyCents(o.card_fmv_cents)}
                    </span>
                    <span
                      className={`font-medium tabular-nums ${
                        profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {profit >= 0 ? "+" : "−"}
                      {formatMoneyCents(Math.abs(profit))}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="border border-dashed border-black/20 p-8 text-center text-sm text-zinc-500 dark:border-white/20">
              No rips yet. Open a pack above.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
