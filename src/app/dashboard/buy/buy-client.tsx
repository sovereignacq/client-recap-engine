"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoneyCents } from "@/lib/cards";
import { openPackAction, type OpenResult } from "./actions";

export type Bucket = {
  key: string;
  label: string;
  min_mult: number;
  max_mult: number;
  weight: number;
};
export type Tier = {
  key: string;
  name: string;
  priceCents: number;
  odds: Bucket[];
};
export type Mode = {
  key: string;
  name: string;
  priceMult: number;
  weightMults: Record<string, number>;
};

const OUTCOME_LABEL: Record<string, string> = {
  below: "Below",
  even: "Break-even",
  above: "Above",
};

const MODE_DESC: Record<string, string> = {
  normal: "Balanced odds.",
  high: "Polarized — more downside, bigger upside.",
  max: "All or nothing — only Below or Jackpot.",
};

export function BuyClient({
  tiers,
  modes,
  poolAvailable,
}: {
  tiers: Tier[];
  modes: Mode[];
  poolAvailable: boolean;
}) {
  const router = useRouter();
  const [isOpening, startOpen] = useTransition();
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<OpenResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [modeKey, setModeKey] = useState(modes[0]?.key ?? "normal");
  const mode = useMemo(
    () => modes.find((m) => m.key === modeKey) ?? modes[0],
    [modes, modeKey],
  );

  const open = (tier: Tier) => {
    setError(null);
    setOpeningKey(tier.key);
    startOpen(async () => {
      const r = await openPackAction(tier.key, modeKey);
      setOpeningKey(null);
      if (r.ok) setResult(r);
      else setError(r.error);
    });
  };

  return (
    <section className="space-y-5">
      {/* Odds level selector */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Odds
        </span>
        <div className="inline-flex border border-black/15 dark:border-white/20">
          {modes.map((m) => {
            const active = m.key === modeKey;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setModeKey(m.key)}
                className={`px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] transition ${
                  active
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {m.name}
              </button>
            );
          })}
        </div>
        {mode && (
          <span className="text-[11px] text-zinc-500">
            {MODE_DESC[mode.key] ?? ""}
          </span>
        )}
      </div>

      {!poolAvailable && (
        <p className="border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          No cards are in the pack pool yet. Packs open once inventory is stocked.
        </p>
      )}
      {error && (
        <p className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-px border border-black/10 bg-black/10 sm:grid-cols-2 lg:grid-cols-3 dark:border-white/15 dark:bg-white/15">
        {tiers.map((t) => {
          const priceMult = mode?.priceMult ?? 1;
          const effPrice = Math.round(t.priceCents * priceMult);
          const adj = t.odds.map((b) => ({
            ...b,
            w: b.weight * (mode?.weightMults?.[b.key] ?? 1),
          }));
          const total = adj.reduce((s, b) => s + b.w, 0) || 1;
          const minCents = Math.round(
            Math.min(...t.odds.map((b) => b.min_mult)) * effPrice,
          );
          const maxCents = Math.round(
            Math.max(...t.odds.map((b) => b.max_mult)) * effPrice,
          );
          return (
            <div key={t.key} className="flex flex-col bg-white p-6 dark:bg-black">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {t.name}
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {formatMoneyCents(effPrice)}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                Pull {formatMoneyCents(minCents)} – {formatMoneyCents(maxCents)}
              </p>
              <ul className="mt-4 space-y-1 text-xs text-zinc-500">
                {adj
                  .filter((b) => b.w > 0)
                  .map((b) => (
                    <li key={b.key} className="flex justify-between gap-2">
                      <span>{b.label}</span>
                      <span className="tabular-nums">
                        {Math.round((b.w / total) * 100)}%
                      </span>
                    </li>
                  ))}
              </ul>
              <button
                type="button"
                onClick={() => open(t)}
                disabled={!poolAvailable || isOpening}
                className="mt-5 rounded-none bg-black px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                {openingKey === t.key ? "Opening…" : "Open pack"}
              </button>
            </div>
          );
        })}
      </div>

      {result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setResult(null)}
        >
          <div
            className="w-full max-w-sm border border-white/15 bg-black p-8 text-center text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className={`text-[11px] font-semibold uppercase tracking-[0.3em] ${
                result.outcome === "above"
                  ? "text-emerald-400"
                  : result.outcome === "below"
                    ? "text-red-400"
                    : "text-zinc-300"
              }`}
            >
              {OUTCOME_LABEL[result.outcome]}
            </p>
            <h3 className="mt-4 text-lg font-semibold">{result.title}</h3>
            <p className="mt-1 font-mono text-xs text-zinc-400">{result.serial}</p>
            {result.grade && (
              <p className="mt-1 text-sm text-zinc-300">{result.grade}</p>
            )}
            <p className="mt-5 text-4xl font-semibold tabular-nums">
              {formatMoneyCents(result.fmvCents)}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.15em] text-zinc-400">
              Paid {formatMoneyCents(result.priceCents)}
            </p>
            <p
              className={`mt-3 text-sm font-medium ${
                result.profitCents >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {result.profitCents >= 0 ? "+" : "−"}
              {formatMoneyCents(Math.abs(result.profitCents))}
            </p>

            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  router.refresh();
                }}
                className="flex-1 rounded-none border border-white/25 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-white/10"
              >
                Close
              </button>
              <a
                href={`/dashboard/cards/${result.cardId}`}
                className="flex-1 rounded-none bg-white px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-black transition hover:bg-zinc-200"
              >
                View card
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
