"use client";

import { useEffect, useState, useTransition } from "react";
import { formatMoneyCents } from "@/lib/cards";
import { getPoolEconomicsAction } from "./actions";

export type EconBand = {
  label: string;
  loCents: number;
  hiCents: number;
  weight: number;
  probPct: number;
  poolCnt: number;
  avgFmvCents: number;
};

export type PoolEconRow = {
  tierKey: string;
  name: string;
  priceCents: number;
  evCents: number;
  marginCents: number;
  marginPct: number;
  poolCards: number;
  status: "positive" | "negative" | "empty";
  advice: string;
  bands: EconBand[];
};

/**
 * Live house-economics scale: per tier, the bands ($ range + probability), the
 * cards stocked in each, the average payout, the house margin, and owner
 * guidance on what to stock. Recomputes from the live pool (auto + on demand).
 */
export function PoolEconomics({ initial }: { initial: PoolEconRow[] }) {
  const [rows, setRows] = useState<PoolEconRow[]>(initial);
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date());
  const [pending, start] = useTransition();

  const refresh = () =>
    start(async () => {
      const r = (await getPoolEconomicsAction()) as PoolEconRow[];
      setRows(r);
      setUpdatedAt(new Date());
    });

  useEffect(() => {
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, []);

  const houseTotal = rows.reduce((s, r) => s + r.marginCents, 0);

  const statusChip = (r: PoolEconRow) => {
    if (r.status === "empty")
      return (
        <span className="rounded-none border border-zinc-400/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
          No stock
        </span>
      );
    const good = r.status === "positive";
    return (
      <span
        className={`rounded-none border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
          good
            ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
            : "border-red-500/40 text-red-600 dark:text-red-400"
        }`}
      >
        {good ? "+" : "−"}
        {formatMoneyCents(Math.abs(r.marginCents))}/pull · {r.marginPct > 0 ? "+" : ""}
        {r.marginPct}%
      </span>
    );
  };

  return (
    <section className="border border-black/10 p-6 dark:border-white/15">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Live pull economics
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            What each pull actually pays from your current pool, by band, with the
            house margin and stocking advice. Updates as you add, remove, or pull
            cards.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={pending}
          className="rounded-none border border-black/20 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10"
        >
          {pending ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="mt-5 space-y-5">
        {rows.map((r) => (
          <div key={r.tierKey} className="border border-black/10 dark:border-white/15">
            {/* Tier header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-black/[0.02] px-4 py-3 dark:border-white/15 dark:bg-white/[0.03]">
              <div className="flex items-center gap-3">
                <span className="font-semibold">{r.name}</span>
                <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                  {formatMoneyCents(r.priceCents)} pack
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                <span>
                  avg payout{" "}
                  <span className="font-semibold tabular-nums text-black dark:text-white">
                    {r.poolCards > 0 ? formatMoneyCents(r.evCents) : "—"}
                  </span>
                </span>
                {statusChip(r)}
              </div>
            </div>

            {/* Bands */}
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                  <th className="px-4 py-1.5 font-medium">Band ($)</th>
                  <th className="px-2 py-1.5 text-right font-medium">Odds</th>
                  <th className="px-2 py-1.5 text-right font-medium">Chance now</th>
                  <th className="px-2 py-1.5 text-right font-medium">Cards</th>
                  <th className="px-4 py-1.5 text-right font-medium">Avg value</th>
                </tr>
              </thead>
              <tbody>
                {r.bands.map((b, i) => {
                  const pricey = b.poolCnt > 0 && b.avgFmvCents > r.priceCents;
                  return (
                    <tr
                      key={i}
                      className="border-t border-black/5 dark:border-white/10"
                    >
                      <td className="px-4 py-1.5">{b.label}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-zinc-500">
                        {b.weight}%
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {b.poolCnt > 0 ? `${b.probPct.toFixed(0)}%` : "—"}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right tabular-nums ${
                          b.poolCnt === 0 ? "text-zinc-400" : ""
                        }`}
                      >
                        {b.poolCnt}
                      </td>
                      <td
                        className={`px-4 py-1.5 text-right tabular-nums ${
                          pricey ? "text-red-600 dark:text-red-400" : "text-zinc-500"
                        }`}
                      >
                        {b.poolCnt > 0 ? formatMoneyCents(b.avgFmvCents) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Advice */}
            <p
              className={`border-t border-black/10 px-4 py-3 text-xs dark:border-white/15 ${
                r.status === "negative"
                  ? "text-red-700 dark:text-red-300"
                  : r.status === "positive"
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-zinc-500"
              }`}
            >
              {r.advice}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          Net of one pull per tier:{" "}
          <span
            className={`font-semibold tabular-nums ${
              houseTotal >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {houseTotal >= 0 ? "+" : "−"}
            {formatMoneyCents(Math.abs(houseTotal))}
          </span>
        </span>
        <span>Updated {updatedAt.toLocaleTimeString()}</span>
      </div>
      <p className="mt-2 text-[11px] text-zinc-400">
        “Odds” is the set weight; “Chance now” renormalizes over only the bands
        that currently have cards (empty bands can&apos;t be pulled). Red avg value
        = that band pays out above the pack price.
      </p>
    </section>
  );
}
