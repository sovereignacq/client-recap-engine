"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoneyCents } from "@/lib/cards";
import { addPoolCardFromSearchAction } from "./actions";

export type BandFillCard = {
  catalogId: string;
  name: string;
  setName: string;
  number: string;
  rarity: string;
  imageUrl: string | null;
  marketCents: number;
  trending: boolean;
  trendScore: number;
};

export type BandFillGroup = {
  tierKey: string;
  tierName: string;
  bandLabel: string;
  loCents: number;
  hiCents: number;
  target: number;
  have: number;
  need: number;
  picks: BandFillCard[];
};

/**
 * Recommendations to complete each band: the cards to add so every band reaches
 * the number of distinct cards its odds require, favouring what's trending. Add
 * a single pick, or "Complete band" to add all of a band's recommendations.
 */
export function BandFillClient({ initial }: { initial: BandFillGroup[] }) {
  const [groups, setGroups] = useState<BandFillGroup[]>(initial);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [, startTx] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const cardKey = (g: BandFillGroup, c: BandFillCard) =>
    `${g.tierKey}:${g.bandLabel}:${c.catalogId}`;
  const bandKey = (g: BandFillGroup) => `${g.tierKey}:${g.bandLabel}`;

  const totalNeeded = groups.reduce((s, g) => s + g.picks.length, 0);

  function addCards(g: BandFillGroup, cards: BandFillCard[], key: string) {
    if (cards.length === 0) return;
    setMsg(null);
    setBusyKey(key);
    startTx(async () => {
      let added = 0;
      let failed = 0;
      for (const c of cards) {
        const res = await addPoolCardFromSearchAction(
          {
            id: c.catalogId,
            name: c.name,
            setName: c.setName,
            number: c.number,
            rarity: c.rarity,
            imageUrl: c.imageUrl,
            marketPriceCents: c.marketCents,
            language: "en",
          },
          1,
        );
        if (res.ok) added += 1;
        else failed += 1;
      }
      setBusyKey(null);
      // Drop the added cards from the recommendation list and shrink "need".
      const addedIds = new Set(cards.map((c) => c.catalogId));
      setGroups((gs) =>
        gs
          .map((x) =>
            bandKey(x) === bandKey(g)
              ? {
                  ...x,
                  have: x.have + added,
                  need: Math.max(0, x.need - added),
                  picks: x.picks.filter((p) => !addedIds.has(p.catalogId)),
                }
              : x,
          )
          .filter((x) => x.picks.length > 0),
      );
      setMsg(
        failed > 0
          ? `Added ${added} card${added === 1 ? "" : "s"}; ${failed} could not be added.`
          : `Added ${added} card${added === 1 ? "" : "s"} to the pool.`,
      );
      router.refresh();
    });
  }

  /** Add every recommended card across all bands in one pass. */
  function addAll() {
    const all = groups.flatMap((g) => g.picks);
    if (all.length === 0) return;
    setMsg(null);
    setBusyKey("__all__");
    startTx(async () => {
      let added = 0;
      let failed = 0;
      for (const c of all) {
        const res = await addPoolCardFromSearchAction(
          {
            id: c.catalogId,
            name: c.name,
            setName: c.setName,
            number: c.number,
            rarity: c.rarity,
            imageUrl: c.imageUrl,
            marketPriceCents: c.marketCents,
            language: "en",
          },
          1,
        );
        if (res.ok) added += 1;
        else failed += 1;
      }
      setBusyKey(null);
      setGroups([]);
      setMsg(
        failed > 0
          ? `Completed bands — added ${added} card${added === 1 ? "" : "s"}; ${failed} could not be added.`
          : `Completed every band — added ${added} card${added === 1 ? "" : "s"} to the pool.`,
      );
      router.refresh();
    });
  }

  // Group bands under their tier for display.
  const tiers: { tierKey: string; tierName: string; bands: BandFillGroup[] }[] = [];
  for (const g of groups) {
    let t = tiers.find((x) => x.tierKey === g.tierKey);
    if (!t) {
      t = { tierKey: g.tierKey, tierName: g.tierName, bands: [] };
      tiers.push(t);
    }
    t.bands.push(g);
  }

  if (groups.length === 0) {
    return (
      <p className="border border-dashed border-black/20 p-10 text-center text-sm text-zinc-500 dark:border-white/20">
        Every band already holds the number of cards its odds require — nothing to
        complete right now.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-black/10 bg-black/[0.02] px-4 py-3 dark:border-white/15 dark:bg-white/[0.03]">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          <span className="font-semibold">{totalNeeded}</span> recommended card
          {totalNeeded === 1 ? "" : "s"} across{" "}
          <span className="font-semibold">{groups.length}</span> band
          {groups.length === 1 ? "" : "s"} will complete every band&apos;s set.
        </p>
        <button
          type="button"
          disabled={busyKey !== null || totalNeeded === 0}
          onClick={addAll}
          className="rounded-none bg-black px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 active:scale-[0.97] disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {busyKey === "__all__"
            ? "Adding all…"
            : `Add all ${totalNeeded} & complete bands`}
        </button>
      </div>

      {msg && (
        <p className="border-l-2 border-emerald-500 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {msg}
        </p>
      )}

      {tiers.map((t) => (
        <section key={t.tierKey} className="border border-black/10 dark:border-white/15">
          <h2 className="border-b border-black/10 bg-black/[0.02] px-4 py-2 text-sm font-semibold dark:border-white/15 dark:bg-white/[0.03]">
            {t.tierName}
          </h2>
          <div className="divide-y divide-black/10 dark:divide-white/10">
            {t.bands.map((g) => {
              const bk = bandKey(g);
              const busyBand = busyKey === bk;
              return (
                <div key={bk} className="px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                      {g.bandLabel} band
                      <span className="ml-2 normal-case tracking-normal text-amber-600 dark:text-amber-400">
                        needs {g.need} more
                      </span>
                      <span className="ml-2 normal-case tracking-normal text-zinc-400">
                        (have {g.have} / target {g.target})
                      </span>
                    </p>
                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() => addCards(g, g.picks, bk)}
                      className="rounded-none border border-black/20 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] transition hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10"
                    >
                      {busyBand ? "Adding…" : `Complete band (+${g.picks.length})`}
                    </button>
                  </div>
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {g.picks.map((c) => {
                      const k = cardKey(g, c);
                      return (
                        <li
                          key={k}
                          className="flex flex-col border border-black/10 p-2 dark:border-white/15"
                        >
                          {c.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.imageUrl}
                              alt={c.name}
                              loading="lazy"
                              className="mb-1.5 aspect-[3/4] w-full object-contain"
                            />
                          ) : (
                            <div className="mb-1.5 aspect-[3/4] w-full bg-black/5 dark:bg-white/10" />
                          )}
                          <p
                            className="flex items-center gap-1 truncate text-[11px] font-medium"
                            title={c.name}
                          >
                            {c.trending && (
                              <span
                                className="shrink-0 text-[10px]"
                                title={`Trending (${c.trendScore})`}
                              >
                                🔥
                              </span>
                            )}
                            <span className="truncate">{c.name}</span>
                          </p>
                          {c.rarity && (
                            <p className="truncate text-[9px] uppercase tracking-[0.1em] text-zinc-500">
                              {c.rarity}
                            </p>
                          )}
                          <p className="text-xs font-semibold tabular-nums">
                            {formatMoneyCents(c.marketCents)}
                          </p>
                          <button
                            type="button"
                            disabled={busyKey !== null}
                            onClick={() => addCards(g, [c], k)}
                            className="mt-1.5 rounded-none border border-black/20 px-1.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] transition hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10"
                          >
                            {busyKey === k ? "…" : "Add"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
