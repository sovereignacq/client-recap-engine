"use client";

import { useState, type CSSProperties } from "react";
import { formatMoneyCents } from "@/lib/cards";
import { ApexMark } from "@/components/apex-mark";
import type { Tier, Mode } from "./buy-client";

// Foil gradients per tier (low → high rarity).
const FOILS = [
  "from-zinc-300 via-zinc-100 to-zinc-400",
  "from-emerald-400 via-teal-200 to-emerald-600",
  "from-sky-400 via-cyan-200 to-blue-600",
  "from-teal-400 via-emerald-200 to-cyan-600",
  "from-violet-500 via-fuchsia-300 to-purple-700",
  "from-orange-400 via-amber-200 to-rose-500",
  "from-pink-500 via-rose-300 to-fuchsia-600",
  "from-amber-300 via-yellow-100 to-orange-500",
];

export function PackCarousel({
  tiers,
  mode,
  catMult,
  balance,
  pity,
  categoryKey,
  onOpen,
  openingKey,
  isOpening,
  poolAvailable,
  paused,
}: {
  tiers: Tier[];
  mode: Mode | undefined;
  catMult: number;
  balance: number;
  pity: Record<string, number>;
  categoryKey: string;
  onOpen: (tier: Tier) => void;
  openingKey: string | null;
  isOpening: boolean;
  poolAvailable: boolean;
  paused: boolean;
}) {
  const [sel, setSel] = useState(0);
  const clamp = (i: number) => Math.max(0, Math.min(tiers.length - 1, i));
  const tier = tiers[sel];
  if (!tier) return null;

  const priceMult = mode?.priceMult ?? 1;
  const effPrice = Math.round(tier.priceCents * catMult * priceMult);
  const adj = tier.odds.map((b) => ({
    ...b,
    w: b.weight * (mode?.weightMults?.[b.key] ?? 1),
  }));
  const total = adj.reduce((s, b) => s + b.w, 0) || 1;
  // The pull range is the tier's absolute value band (what cards can be won),
  // NOT a multiple of the pack price.
  const minCents = tier.pullMinCents ?? 0;
  const maxCents = tier.pullMaxCents ?? effPrice;
  const pityCount = pity[`${categoryKey}:${tier.key}`] ?? 0;
  const pityPct = Math.min(100, (pityCount / tier.pityThreshold) * 100);
  const canAfford = balance >= effPrice;

  return (
    <div className="space-y-6">
      {/* Lazy-Susan carousel */}
      <div className="relative mx-auto h-[260px] w-full max-w-3xl [perspective:1200px]">
        {tiers.map((t, i) => {
          const offset = i - sel;
          const abs = Math.abs(offset);
          if (abs > 2) return null;
          const style: CSSProperties = {
            transform: `translate(-50%, -50%) translateX(${offset * 58}%) rotateY(${
              offset * -34
            }deg) scale(${offset === 0 ? 1.06 : 0.82})`,
            zIndex: 20 - abs,
            opacity: 1 - abs * 0.28,
            pointerEvents: abs > 2 ? "none" : "auto",
          };
          const foil = FOILS[i % FOILS.length];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setSel(i)}
              style={style}
              aria-label={t.name}
              className="absolute left-1/2 top-1/2 h-[214px] w-[150px] transition-all duration-300 ease-out [transform-style:preserve-3d] focus:outline-none"
            >
              <div
                className={`holo-card h-full w-full bg-gradient-to-br ${foil} ${
                  offset === 0 ? "shadow-2xl ring-2 ring-white/60" : ""
                }`}
              >
                <div className="m-[3px] flex h-[calc(100%-6px)] flex-col items-center justify-between rounded-[11px] bg-zinc-950/85 p-3 text-white">
                  <span className="text-[8px] font-semibold uppercase tracking-[0.25em] text-white/70">
                    Apex
                  </span>
                  <ApexMark className="h-12 w-16 text-white drop-shadow" />
                  <div className="text-center">
                    <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-white/60">
                      {t.name.replace(/^Apex /, "")}
                    </p>
                    <p className="text-sm font-bold tabular-nums">
                      {formatMoneyCents(
                        Math.round(t.priceCents * catMult * priceMult),
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Dial controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => setSel((s) => clamp(s - 1))}
          disabled={sel === 0}
          className="grid h-9 w-9 place-items-center rounded-full border border-black/20 text-lg transition hover:bg-black/5 disabled:opacity-30 dark:border-white/25 dark:hover:bg-white/10"
          aria-label="Previous pack"
        >
          ‹
        </button>
        <div className="flex gap-1.5">
          {tiers.map((t, i) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSel(i)}
              aria-label={`Select ${t.name}`}
              className={`h-1.5 rounded-full transition-all ${
                i === sel
                  ? "w-6 bg-black dark:bg-white"
                  : "w-1.5 bg-black/25 dark:bg-white/30"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSel((s) => clamp(s + 1))}
          disabled={sel === tiers.length - 1}
          className="grid h-9 w-9 place-items-center rounded-full border border-black/20 text-lg transition hover:bg-black/5 disabled:opacity-30 dark:border-white/25 dark:hover:bg-white/10"
          aria-label="Next pack"
        >
          ›
        </button>
      </div>

      {/* Selected pack details */}
      <div className="mx-auto max-w-md border border-black/10 p-6 dark:border-white/15">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            {tier.name}
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {formatMoneyCents(effPrice)}
          </p>
        </div>
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

        <div className="mt-4">
          <div className="flex justify-between text-[10px] uppercase tracking-[0.12em] text-zinc-400">
            <span>Guaranteed win</span>
            <span className="tabular-nums">
              {pityCount}/{tier.pityThreshold}
            </span>
          </div>
          <div className="mt-1 h-1 w-full bg-black/10 dark:bg-white/15">
            <div
              className="h-full bg-black dark:bg-white"
              style={{ width: `${pityPct}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpen(tier)}
          disabled={!poolAvailable || isOpening || !canAfford || paused}
          className="mt-5 w-full rounded-none bg-black px-4 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {openingKey === tier.key
            ? "Ripping…"
            : canAfford
              ? `Rip ${tier.name.replace(/^Apex /, "")} pack`
              : "Add funds to rip"}
        </button>
      </div>
    </div>
  );
}
