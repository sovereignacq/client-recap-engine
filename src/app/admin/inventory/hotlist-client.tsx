"use client";

import { useState, useTransition } from "react";
import { formatMoneyCents } from "@/lib/cards";
import { addPoolCardFromSearchAction } from "./actions";

export type HotlistPick = {
  tierKey: string;
  tierName: string;
  bandLabel: string;
  loCents: number;
  hiCents: number;
  catalogId: string;
  name: string;
  setName: string;
  number: string;
  rarity: string;
  imageUrl: string | null;
  marketCents: number;
  poolCnt: number;
};

export function HotlistClient({ initial }: { initial: HotlistPick[] }) {
  const [picks, setPicks] = useState<HotlistPick[]>(initial);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [adding, startAdd] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const keyOf = (p: HotlistPick) => `${p.tierKey}:${p.catalogId}`;
  const getQty = (k: string) => qty[k] ?? 1;
  const setCardQty = (k: string, v: number) =>
    setQty((q) => ({ ...q, [k]: Math.max(1, Math.min(100, v || 1)) }));

  function add(p: HotlistPick) {
    const k = keyOf(p);
    setMsg(null);
    setAddingKey(k);
    const n = getQty(k);
    startAdd(async () => {
      const res = await addPoolCardFromSearchAction(
        {
          id: p.catalogId,
          name: p.name,
          setName: p.setName,
          number: p.number,
          rarity: p.rarity,
          imageUrl: p.imageUrl,
          marketPriceCents: p.marketCents,
          language: "en",
        },
        n,
      );
      setAddingKey(null);
      if (res.ok) {
        // Bump pool counts for every row of this catalog card.
        setPicks((ps) =>
          ps.map((x) =>
            x.catalogId === p.catalogId
              ? { ...x, poolCnt: x.poolCnt + res.added }
              : x,
          ),
        );
      } else setMsg(res.error);
    });
  }

  // Group by tier, then band (rows arrive in order).
  const tiers: { tierKey: string; tierName: string; bands: Map<string, HotlistPick[]> }[] = [];
  for (const p of picks) {
    let t = tiers.find((x) => x.tierKey === p.tierKey);
    if (!t) {
      t = { tierKey: p.tierKey, tierName: p.tierName, bands: new Map() };
      tiers.push(t);
    }
    const arr = t.bands.get(p.bandLabel) ?? [];
    arr.push(p);
    t.bands.set(p.bandLabel, arr);
  }

  return (
    <div className="space-y-8">
      {msg && (
        <p className="border-l-2 border-red-500 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {msg}
        </p>
      )}

      {tiers.map((t) => (
        <section key={t.tierKey} className="border border-black/10 dark:border-white/15">
          <h2 className="border-b border-black/10 bg-black/[0.02] px-4 py-2 text-sm font-semibold dark:border-white/15 dark:bg-white/[0.03]">
            {t.tierName}
          </h2>
          <div className="divide-y divide-black/10 dark:divide-white/10">
            {[...t.bands.entries()].map(([band, rows]) => (
              <div key={band} className="px-4 py-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                  {band} band
                </p>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {rows.map((p) => {
                    const k = keyOf(p);
                    return (
                      <li
                        key={k}
                        className="flex flex-col border border-black/10 p-2 dark:border-white/15"
                      >
                        <div className="relative">
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              loading="lazy"
                              className="mb-1.5 aspect-[3/4] w-full object-contain"
                            />
                          ) : (
                            <div className="mb-1.5 aspect-[3/4] w-full bg-black/5 dark:bg-white/10" />
                          )}
                          <span
                            className={`absolute right-1 top-1 rounded-none border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
                              p.poolCnt > 0
                                ? "border-emerald-500/50 bg-black/70 text-emerald-300"
                                : "border-white/30 bg-black/70 text-zinc-300"
                            }`}
                          >
                            {p.poolCnt} in pool
                          </span>
                        </div>
                        <p className="truncate text-[11px] font-medium" title={p.name}>
                          {p.name}
                        </p>
                        {p.rarity && (
                          <p className="truncate text-[9px] uppercase tracking-[0.1em] text-zinc-500">
                            {p.rarity}
                          </p>
                        )}
                        <p className="text-xs font-semibold tabular-nums">
                          {formatMoneyCents(p.marketCents)}
                        </p>
                        <div className="mt-1.5 flex items-stretch gap-1">
                          <div className="flex items-center border border-black/20 dark:border-white/25">
                            <button
                              type="button"
                              onClick={() => setCardQty(k, getQty(k) - 1)}
                              className="px-1.5 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                              aria-label="Decrease"
                            >
                              −
                            </button>
                            <input
                              value={getQty(k)}
                              onChange={(e) => setCardQty(k, parseInt(e.target.value, 10))}
                              inputMode="numeric"
                              className="w-8 bg-transparent text-center text-xs tabular-nums outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setCardQty(k, getQty(k) + 1)}
                              className="px-1.5 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                              aria-label="Increase"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            disabled={adding && addingKey === k}
                            onClick={() => add(p)}
                            className="flex-1 rounded-none border border-black/20 px-1.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] transition hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10"
                          >
                            {adding && addingKey === k ? "…" : `Add ${getQty(k)}`}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
