"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoneyCents } from "@/lib/cards";
import {
  openPackAction,
  topUpAction,
  sellBackAction,
  claimDailyAction,
  createDepositCheckoutAction,
  type OpenResult,
} from "./actions";

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
  pityThreshold: number;
};
export type Mode = {
  key: string;
  name: string;
  priceMult: number;
  weightMults: Record<string, number>;
};
export type Category = {
  key: string;
  name: string;
  active: boolean;
  priceMult: number;
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
const TOPUP_PRESETS = [500, 2000, 5000, 10000];

type Won = Extract<OpenResult, { ok: true }>;

export function BuyClient({
  tiers,
  modes,
  categories,
  activeCategory,
  poolAvailable,
  balance: initialBalance,
  pityByTier: initialPity,
  dailyClaimable: initialDailyClaimable,
  dailyStreak: initialStreak,
  staff,
}: {
  tiers: Tier[];
  modes: Mode[];
  categories: Category[];
  activeCategory: string;
  poolAvailable: boolean;
  balance: number;
  pityByTier: Record<string, number>;
  dailyClaimable: boolean;
  dailyStreak: number;
  staff: boolean;
}) {
  const router = useRouter();
  const [isOpening, startOpen] = useTransition();
  const [isFunding, startFund] = useTransition();
  const [isSelling, startSell] = useTransition();
  const [isClaiming, startClaim] = useTransition();
  const [daily, setDaily] = useState({
    claimable: initialDailyClaimable,
    streak: initialStreak,
  });
  const [dailyMsg, setDailyMsg] = useState<string | null>(null);
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [result, setResult] = useState<Won | null>(null);
  const [sold, setSold] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [balance, setBalance] = useState(initialBalance);
  const [pity, setPity] = useState<Record<string, number>>(initialPity);

  // Reveal suspense + value count-up
  const [phase, setPhase] = useState<"charging" | "revealed">("revealed");
  const [displayCents, setDisplayCents] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => {
      setPhase("revealed");
      const target = result.fmvCents;
      const start = performance.now();
      const dur = 750;
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplayCents(Math.round(target * eased));
        if (p < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, 1100);
    return () => {
      clearTimeout(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [result]);

  const [modeKey, setModeKey] = useState(modes[0]?.key ?? "normal");
  const mode = useMemo(
    () => modes.find((m) => m.key === modeKey) ?? modes[0],
    [modes, modeKey],
  );

  const [categoryKey, setCategoryKey] = useState(activeCategory);
  const category = useMemo(
    () => categories.find((c) => c.key === categoryKey),
    [categories, categoryKey],
  );
  const catMult = category?.priceMult ?? 1;

  const open = (tier: Tier) => {
    setError(null);
    setOpeningKey(tier.key);
    startOpen(async () => {
      const r = await openPackAction(tier.key, modeKey, categoryKey);
      setOpeningKey(null);
      if (r.ok) {
        setBalance(r.balanceAfter);
        setPity((p) => ({ ...p, [`${categoryKey}:${tier.key}`]: r.pityCount }));
        setSold(false);
        setPhase("charging");
        setDisplayCents(0);
        setResult(r);
      } else {
        setError(r.error);
      }
    });
  };

  const addFunds = (cents: number) => {
    setError(null);
    startFund(async () => {
      const r = await createDepositCheckoutAction(cents);
      if (r.ok) window.location.href = r.url;
      else setError(r.error);
    });
  };

  const testCredit = (cents: number) => {
    setError(null);
    startFund(async () => {
      const r = await topUpAction(cents);
      if (r.ok) setBalance(r.balance);
      else setError(r.error);
    });
  };

  const claimDaily = () => {
    setDailyMsg(null);
    startClaim(async () => {
      const r = await claimDailyAction();
      if (r.ok) {
        setBalance(r.balance);
        setDaily({ claimable: false, streak: r.streak });
        setDailyMsg(
          `+${formatMoneyCents(r.rewardCents)} · ${r.streak}-day streak`,
        );
      } else {
        setDailyMsg(r.error);
      }
    });
  };

  const sellBack = (won: Won) => {
    startSell(async () => {
      const r = await sellBackAction(won.cardId);
      if (r.ok) {
        setBalance(r.balance);
        setSold(true);
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <section className="space-y-5">
      {/* Category columns */}
      <div className="grid grid-cols-2 gap-px border border-black/10 bg-black/10 sm:grid-cols-3 lg:grid-cols-6 dark:border-white/15 dark:bg-white/15">
        {categories.map((c) => {
          const selected = c.key === categoryKey;
          return (
            <button
              key={c.key}
              type="button"
              disabled={!c.active}
              onClick={() => c.active && setCategoryKey(c.key)}
              className={`flex flex-col items-center gap-1 px-3 py-4 text-center transition active:scale-[0.98] ${
                selected
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : c.active
                    ? "bg-white hover:bg-zinc-50 dark:bg-black dark:hover:bg-zinc-950"
                    : "cursor-not-allowed bg-white text-zinc-400 dark:bg-black dark:text-zinc-600"
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                {c.name}
              </span>
              {!c.active && (
                <span className="text-[9px] uppercase tracking-[0.15em] text-zinc-400">
                  Coming soon
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Wallet */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-black/10 px-5 py-4 dark:border-white/15">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Wallet
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {formatMoneyCents(balance)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={isClaiming || !daily.claimable}
            onClick={claimDaily}
            className="rounded-none bg-black px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white transition hover:bg-zinc-800 active:scale-95 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {daily.claimable ? "Claim daily" : `Daily · ${daily.streak}🔥`}
          </button>
          {TOPUP_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={isFunding}
              onClick={() => addFunds(c)}
              className="rounded-none border border-black/20 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 active:scale-95 disabled:opacity-40 dark:border-white/25 dark:hover:bg-white/10"
            >
              Add {formatMoneyCents(c)}
            </button>
          ))}
        </div>
      </div>
      {staff && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-400">
            Test credit
          </span>
          {TOPUP_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={isFunding}
              onClick={() => testCredit(c)}
              className="rounded-none border border-dashed border-black/20 px-2.5 py-1 text-[11px] tabular-nums transition hover:bg-black/5 active:scale-95 disabled:opacity-40 dark:border-white/25 dark:hover:bg-white/10"
            >
              +{formatMoneyCents(c)}
            </button>
          ))}
        </div>
      )}
      {dailyMsg && (
        <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
          {dailyMsg}
        </p>
      )}

      {/* Odds level */}
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
          <span className="text-[11px] text-zinc-500">{MODE_DESC[mode.key] ?? ""}</span>
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
          const effPrice = Math.round(t.priceCents * catMult * priceMult);
          const adj = t.odds.map((b) => ({
            ...b,
            w: b.weight * (mode?.weightMults?.[b.key] ?? 1),
          }));
          const total = adj.reduce((s, b) => s + b.w, 0) || 1;
          const minCents = Math.round(Math.min(...t.odds.map((b) => b.min_mult)) * effPrice);
          const maxCents = Math.round(Math.max(...t.odds.map((b) => b.max_mult)) * effPrice);
          const pityCount = pity[`${categoryKey}:${t.key}`] ?? 0;
          const pityPct = Math.min(100, (pityCount / t.pityThreshold) * 100);
          const canAfford = balance >= effPrice;
          return (
            <div
              key={t.key}
              className="flex flex-col bg-white p-6 transition-colors hover:bg-zinc-50 dark:bg-black dark:hover:bg-zinc-950"
            >
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

              <div className="mt-4">
                <div className="flex justify-between text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                  <span>Guaranteed win</span>
                  <span className="tabular-nums">
                    {pityCount}/{t.pityThreshold}
                  </span>
                </div>
                <div className="mt-1 h-1 w-full bg-black/10 dark:bg-white/15">
                  <div className="h-full bg-black dark:bg-white" style={{ width: `${pityPct}%` }} />
                </div>
              </div>

              <button
                type="button"
                onClick={() => open(t)}
                disabled={!poolAvailable || isOpening || !canAfford}
                className="mt-5 rounded-none bg-black px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 active:scale-[0.97] disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                {openingKey === t.key
                  ? "Opening…"
                  : canAfford
                    ? "Open pack"
                    : "Add funds"}
              </button>
            </div>
          );
        })}
      </div>

      {result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            setResult(null);
            router.refresh();
          }}
        >
          <div
            className="w-full max-w-sm overflow-hidden border border-white/15 bg-black p-8 text-center text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {phase === "charging" ? (
              <div className="flex flex-col items-center py-6">
                <div className="h-28 w-20 animate-pulse rounded-sm bg-gradient-to-br from-zinc-700 via-zinc-500 to-zinc-800 shadow-[0_0_40px_rgba(255,255,255,0.25)]" />
                <p className="mt-6 animate-pulse text-[11px] uppercase tracking-[0.4em] text-zinc-400">
                  Opening…
                </p>
              </div>
            ) : (
              <div className="animate-[fadeIn_300ms_ease-out]">
                {result.guaranteed && (
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-300">
                    Guaranteed pull
                  </p>
                )}
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
                {result.grade && <p className="mt-1 text-sm text-zinc-300">{result.grade}</p>}
                <p className="mt-5 text-4xl font-semibold tabular-nums">
                  {formatMoneyCents(displayCents)}
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

                {sold ? (
                  <p className="mt-6 text-sm text-emerald-400">
                    Sold back · wallet {formatMoneyCents(balance)}
                  </p>
                ) : (
                  <div className="mt-7 flex gap-3">
                    <button
                      type="button"
                      disabled={isSelling}
                      onClick={() => sellBack(result)}
                      className="flex-1 rounded-none border border-white/25 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-white/10 disabled:opacity-40"
                    >
                      {isSelling ? "…" : `Sell back +${formatMoneyCents(result.buybackCents)}`}
                    </button>
                    <a
                      href={`/dashboard/cards/${result.cardId}`}
                      className="flex-1 rounded-none bg-white px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-black transition hover:bg-zinc-200"
                    >
                      Keep
                    </a>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    router.refresh();
                  }}
                  className="mt-3 text-[11px] uppercase tracking-[0.15em] text-zinc-400 hover:text-white"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
