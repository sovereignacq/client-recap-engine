"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoneyCents } from "@/lib/cards";
import { PackCarousel } from "./pack-carousel";
import {
  openPackAction,
  topUpAction,
  sellBackAction,
  createDepositCheckoutAction,
  confirmAgeAction,
  setPlayPauseAction,
  setPlayLimitsAction,
  tradeUpAction,
  redeemPackCreditAction,
  dailyCheckinAction,
  dailySpinAction,
  requestWithdrawalAction,
  type OpenResult,
  type TradeUpResult,
  type RedeemResult,
  type SpinResult,
} from "./actions";

const WITHDRAW_METHODS = [
  { value: "paypal", label: "PayPal" },
  { value: "venmo", label: "Venmo" },
  { value: "cashapp", label: "Cash App" },
  { value: "zelle", label: "Zelle" },
  { value: "other", label: "Other" },
];

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
export type OwnedCard = {
  id: string;
  serial: string;
  fmvCents: number;
  grade: string | null;
  title: string;
};
export type PackCredit = {
  id: string;
  tierKey: string | null;
  mystery: boolean;
  source: string;
};
export type SpinPrize = {
  key: string;
  label: string;
  kind: "cash" | "pack" | "none";
  amountCents: number;
  tierKey: string | null;
};

const CREDIT_SOURCE_LABEL: Record<string, string> = {
  referral_signup: "Welcome pack",
  referral_bonus: "Referral reward",
  referral_mystery: "Mystery reward",
  streak_week: "Weekly streak",
  streak_month: "Monthly streak",
  daily_spin: "Daily spin",
  admin: "Gift",
};

// House keeps 15% on a consolidation trade-up; mirrors trade_up() in the DB.
const TRADEUP_RATE = 0.85;

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
type TradeWon = Extract<TradeUpResult, { ok: true }>;
type Redeemed = Extract<RedeemResult, { ok: true }>;
type SpinWin = Extract<SpinResult, { ok: true }>;

export function BuyClient({
  tiers,
  modes,
  canChangeOdds,
  categories,
  activeCategory,
  poolAvailable,
  ownedCards,
  balance: initialBalance,
  withdrawable: initialWithdrawable,
  pityByTier: initialPity,
  credits: initialCredits,
  spinPrizes,
  checkin: initialCheckin,
  spinClaimable: initialSpinClaimable,
  emailVerified,
  referralCode,
  referralUrl,
  referralQualified,
  referralPending,
  staff,
  ageConfirmed,
  pausedUntil,
  spendLimitCents,
  depositLimitCents,
}: {
  tiers: Tier[];
  modes: Mode[];
  canChangeOdds: boolean;
  categories: Category[];
  activeCategory: string;
  poolAvailable: boolean;
  ownedCards: OwnedCard[];
  balance: number;
  withdrawable: number;
  pityByTier: Record<string, number>;
  credits: PackCredit[];
  spinPrizes: SpinPrize[];
  checkin: { claimable: boolean; streak: number; total: number };
  spinClaimable: boolean;
  emailVerified: boolean;
  referralCode: string;
  referralUrl: string;
  referralQualified: number;
  referralPending: number;
  staff: boolean;
  ageConfirmed: boolean;
  pausedUntil: string | null;
  spendLimitCents: number | null;
  depositLimitCents: number | null;
}) {
  const router = useRouter();
  const [isOpening, startOpen] = useTransition();
  const [isFunding, startFund] = useTransition();
  const [isSelling, startSell] = useTransition();

  const [ageOk, setAgeOk] = useState(ageConfirmed);
  const [isPlay, startPlay] = useTransition();
  const paused = !!pausedUntil;
  const [spendInput, setSpendInput] = useState(
    spendLimitCents ? String(Math.round(spendLimitCents / 100)) : "",
  );
  const [depositInput, setDepositInput] = useState(
    depositLimitCents ? String(Math.round(depositLimitCents / 100)) : "",
  );
  const [playMsg, setPlayMsg] = useState<string | null>(null);

  const confirmAge = () =>
    startPlay(async () => {
      const r = await confirmAgeAction();
      if (r.ok) setAgeOk(true);
      else setPlayMsg(r.error);
    });
  const takeBreak = (days: number) => {
    if (!confirm(`Pause play for ${days} day(s)? You can't shorten this early.`)) return;
    startPlay(async () => {
      const r = await setPlayPauseAction(days);
      if (r.ok) router.refresh();
      else setPlayMsg(r.error);
    });
  };
  const saveLimits = () =>
    startPlay(async () => {
      const sp = spendInput ? Math.round(Number(spendInput) * 100) : null;
      const dp = depositInput ? Math.round(Number(depositInput) * 100) : null;
      const r = await setPlayLimitsAction(sp, dp);
      setPlayMsg(r.ok ? "Limits saved." : r.error);
    });
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [result, setResult] = useState<Won | null>(null);
  const [sold, setSold] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [balance, setBalance] = useState(initialBalance);
  const [withdrawable, setWithdrawable] = useState(initialWithdrawable);
  const [pity, setPity] = useState<Record<string, number>>(initialPity);

  const [isWithdrawing, startWithdraw] = useTransition();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [wAmount, setWAmount] = useState("");
  const [wMethod, setWMethod] = useState(WITHDRAW_METHODS[0].value);
  const [wHandle, setWHandle] = useState("");
  const [wMsg, setWMsg] = useState<string | null>(null);

  const submitWithdraw = () => {
    setWMsg(null);
    const cents = Math.round(Number(wAmount) * 100);
    if (!Number.isFinite(cents) || cents < 500) {
      setWMsg("Minimum withdrawal is $5.");
      return;
    }
    startWithdraw(async () => {
      const r = await requestWithdrawalAction(cents, wMethod, wHandle);
      if (r.ok) {
        setBalance(r.balance);
        setWithdrawable(r.withdrawable);
        setWAmount("");
        setWHandle("");
        setShowWithdraw(false);
        setWMsg("Withdrawal requested — we'll process it shortly.");
      } else {
        setWMsg(r.error);
      }
    });
  };

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

  const [customFund, setCustomFund] = useState("");
  const addCustomFunds = () => {
    const dollars = parseFloat(customFund);
    if (!Number.isFinite(dollars) || dollars < 1) {
      setError("Enter an amount of $1 or more.");
      return;
    }
    addFunds(Math.round(dollars * 100));
  };

  const testCredit = (cents: number) => {
    setError(null);
    startFund(async () => {
      const r = await topUpAction(cents);
      if (r.ok) setBalance(r.balance);
      else setError(r.error);
    });
  };

  // Daily rewards: login check-in streak, daily spin, and free-pack credits.
  const [isCheckin, startCheckin] = useTransition();
  const [isSpinning, startSpin] = useTransition();
  const [isRedeeming, startRedeem] = useTransition();
  const [checkin, setCheckin] = useState(initialCheckin);
  const [spinAvailable, setSpinAvailable] = useState(initialSpinClaimable);
  const [credits, setCredits] = useState(initialCredits);
  const [rewardMsg, setRewardMsg] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redeemResult, setRedeemResult] = useState<Redeemed | null>(null);
  const [copied, setCopied] = useState(false);

  const tierNameMap = useMemo(
    () => new Map(tiers.map((t) => [t.key, t.name])),
    [tiers],
  );
  const tierLabel = (key: string | null) =>
    key ? (tierNameMap.get(key) ?? key) : "Mystery";

  const doCheckin = () => {
    setRewardMsg(null);
    startCheckin(async () => {
      const r = await dailyCheckinAction();
      if (r.ok) {
        setCheckin({ claimable: false, streak: r.streak, total: r.total });
        if (r.granted !== "none") {
          setRewardMsg(
            `🔥 ${r.streak}-day streak — free ${tierLabel(r.tier)} pack unlocked!`,
          );
          router.refresh();
        } else {
          setRewardMsg(`Checked in — ${r.streak}-day streak`);
        }
      } else {
        setRewardMsg(r.error);
      }
    });
  };

  // Spin wheel suspense
  const [spinResult, setSpinResult] = useState<SpinWin | null>(null);
  const [spinPhase, setSpinPhase] = useState<"idle" | "spinning" | "landed">(
    "idle",
  );
  const [spinFace, setSpinFace] = useState(0);

  const doSpin = () => {
    setRewardMsg(null);
    startSpin(async () => {
      const r = await dailySpinAction();
      if (!r.ok) {
        setRewardMsg(r.error);
        return;
      }
      setSpinAvailable(false);
      if (r.kind === "cash") setBalance(r.balance);
      if (r.kind === "pack") router.refresh();
      setSpinResult(r);
      setSpinPhase("spinning");
    });
  };

  // Cycle the wheel faces, then land on the won prize.
  useEffect(() => {
    if (spinPhase !== "spinning" || !spinResult) return;
    const winIdx = Math.max(
      0,
      spinPrizes.findIndex((p) => p.key === spinResult.prizeKey),
    );
    let ticks = 0;
    const total = 18 + winIdx;
    const id = setInterval(() => {
      ticks += 1;
      setSpinFace((f) => (f + 1) % Math.max(1, spinPrizes.length));
      if (ticks >= total) {
        clearInterval(id);
        setSpinFace(winIdx);
        setSpinPhase("landed");
      }
    }, 80);
    return () => clearInterval(id);
  }, [spinPhase, spinResult, spinPrizes]);

  const redeem = (creditId: string) => {
    setError(null);
    setRedeemingId(creditId);
    startRedeem(async () => {
      const r = await redeemPackCreditAction(creditId);
      setRedeemingId(null);
      if (r.ok) {
        setCredits((cs) => cs.filter((c) => c.id !== creditId));
        setSold(false);
        setRedeemResult(r);
      } else {
        setError(r.error);
      }
    });
  };

  const copyReferral = () => {
    if (!referralUrl) return;
    navigator.clipboard?.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const sellBack = (cardId: string) => {
    startSell(async () => {
      const r = await sellBackAction(cardId);
      if (r.ok) {
        setBalance(r.balance);
        setSold(true);
      } else {
        setError(r.error);
      }
    });
  };

  // Trade-up (consolidation)
  const [isTrading, startTrade] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tradeResult, setTradeResult] = useState<TradeWon | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedSumCents = useMemo(
    () =>
      ownedCards
        .filter((c) => selected.has(c.id))
        .reduce((s, c) => s + c.fmvCents, 0),
    [ownedCards, selected],
  );
  const estTradeCents = Math.floor(selectedSumCents * TRADEUP_RATE);

  const tradeUp = () => {
    setTradeError(null);
    const ids = [...selected];
    startTrade(async () => {
      const r = await tradeUpAction(ids);
      if (r.ok) {
        setSelected(new Set());
        setTradeResult(r);
      } else {
        setTradeError(r.error);
      }
    });
  };

  return (
    <section className="space-y-5">
      {!ageOk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm border border-white/15 bg-black p-8 text-center text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-400">
              Before you play
            </p>
            <h3 className="mt-4 text-xl font-semibold">Are you 18 or older?</h3>
            <p className="mt-3 text-sm text-zinc-400">
              Packs are a game of chance with real value. You must be 18+ to play.
              Please play responsibly and within your means.
            </p>
            <div className="mt-7 flex gap-3">
              <a
                href="/dashboard"
                className="flex-1 rounded-none border border-white/25 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-white/10"
              >
                Not yet
              </a>
              <button
                type="button"
                disabled={isPlay}
                onClick={confirmAge}
                className="flex-1 rounded-none bg-white px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-black transition hover:bg-zinc-200 disabled:opacity-50"
              >
                {isPlay ? "…" : "I'm 18+"}
              </button>
            </div>
          </div>
        </div>
      )}

      {paused && (
        <p className="border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          You&apos;re taking a break from play until{" "}
          {new Date(pausedUntil!).toLocaleDateString()}. Packs and deposits are
          paused until then.
        </p>
      )}

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
          <p className="text-[11px] text-zinc-500">
            {formatMoneyCents(withdrawable)} withdrawable · rest is bonus (play
            only)
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Deposit any amount ≥ $1 */}
          <div className="flex items-stretch gap-2">
            <div className="flex items-center rounded-none border border-black/20 px-2 dark:border-white/25">
              <span className="text-sm text-zinc-400">$</span>
              <input
                value={customFund}
                onChange={(e) => setCustomFund(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomFunds()}
                inputMode="decimal"
                placeholder="Amount"
                className="w-24 bg-transparent px-1.5 py-1.5 text-sm outline-none"
              />
            </div>
            <button
              type="button"
              disabled={isFunding}
              onClick={addCustomFunds}
              className="rounded-none bg-black px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white transition hover:bg-zinc-800 active:scale-95 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {isFunding ? "…" : "Add funds"}
            </button>
            <button
              type="button"
              onClick={() => setShowWithdraw((s) => !s)}
              disabled={withdrawable < 500}
              title={withdrawable < 500 ? "Minimum withdrawal is $5" : undefined}
              className="rounded-none border border-black/20 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 active:scale-95 disabled:opacity-40 dark:border-white/25 dark:hover:bg-white/10"
            >
              Withdraw
            </button>
          </div>
          {/* Quick presets */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-400">
              Quick
            </span>
            {TOPUP_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={isFunding}
                onClick={() => addFunds(c)}
                className="rounded-none border border-black/15 px-2.5 py-1 text-[11px] tabular-nums transition hover:bg-black/5 active:scale-95 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
              >
                +{formatMoneyCents(c)}
              </button>
            ))}
          </div>
        </div>
      </div>
      {showWithdraw && (
        <div className="space-y-3 border border-black/10 p-5 dark:border-white/15">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Cash out · {formatMoneyCents(withdrawable)} available
          </p>
          <p className="text-xs text-zinc-500">
            Minimum $5. Only deposited funds can be withdrawn — bonus and reward
            money stays in-app.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              value={wAmount}
              onChange={(e) => setWAmount(e.target.value)}
              inputMode="decimal"
              placeholder="Amount (USD)"
              className="rounded-none border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
            />
            <select
              value={wMethod}
              onChange={(e) => setWMethod(e.target.value)}
              className="rounded-none border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
            >
              {WITHDRAW_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <input
              value={wHandle}
              onChange={(e) => setWHandle(e.target.value)}
              placeholder="Send to (email / @handle)"
              className="rounded-none border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
            />
          </div>
          <button
            type="button"
            disabled={isWithdrawing}
            onClick={submitWithdraw}
            className="rounded-none bg-black px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-white transition hover:bg-zinc-800 active:scale-95 disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {isWithdrawing ? "Requesting…" : "Request withdrawal"}
          </button>
        </div>
      )}
      {wMsg && (
        <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
          {wMsg}
        </p>
      )}
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
      {!emailVerified && (
        <p className="border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Verify your email to unlock daily rewards, the spin, and free packs.
          Check your inbox for the confirmation link.
        </p>
      )}

      {/* Daily rewards: check-in streak + spin */}
      <div className="grid grid-cols-1 gap-px border border-black/10 bg-black/10 sm:grid-cols-2 dark:border-white/15 dark:bg-white/15">
        <div className="flex items-center justify-between gap-3 bg-white px-5 py-4 dark:bg-black">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Daily check-in
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {checkin.streak}
              <span className="ml-1 text-base">🔥</span>
            </p>
            <p className="text-[11px] text-zinc-500">
              7 days = free pack · 30 = bigger pack
            </p>
          </div>
          <button
            type="button"
            disabled={isCheckin || !checkin.claimable || !emailVerified}
            onClick={doCheckin}
            className="rounded-none bg-black px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white transition hover:bg-zinc-800 active:scale-95 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {checkin.claimable ? (isCheckin ? "…" : "Check in") : "Done ✓"}
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 bg-white px-5 py-4 dark:bg-black">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Daily spin
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              One free spin a day — cash or a pack.
            </p>
          </div>
          <button
            type="button"
            disabled={isSpinning || !spinAvailable || !emailVerified}
            onClick={doSpin}
            className="rounded-none bg-gradient-to-br from-violet-600 to-fuchsia-600 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white transition hover:opacity-90 active:scale-95 disabled:opacity-40"
          >
            {spinAvailable ? (isSpinning ? "…" : "Spin") : "Spun ✓"}
          </button>
        </div>
      </div>
      {rewardMsg && (
        <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
          {rewardMsg}
        </p>
      )}

      {/* Free packs to redeem */}
      {credits.length > 0 && (
        <section className="space-y-3 border border-black/10 p-5 dark:border-white/15">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Free packs · {credits.length}
          </h2>
          <div className="grid grid-cols-1 gap-px border border-black/10 bg-black/10 sm:grid-cols-2 dark:border-white/15 dark:bg-white/15">
            {credits.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 bg-white px-4 py-3 dark:bg-black"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {c.mystery ? "Mystery pack" : `${tierLabel(c.tierKey)} pack`}
                  </p>
                  <p className="truncate text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                    {CREDIT_SOURCE_LABEL[c.source] ?? "Reward"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isRedeeming || !emailVerified || !poolAvailable}
                  onClick={() => redeem(c.id)}
                  className="shrink-0 rounded-none bg-black px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-white transition hover:bg-zinc-800 active:scale-95 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  {redeemingId === c.id ? "Opening…" : "Open free"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Referral */}
      <section className="space-y-3 border border-black/10 p-5 dark:border-white/15">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Invite friends
          </h2>
          <span className="text-[11px] text-zinc-500">
            {referralQualified} joined · {referralPending} pending
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          Share your code. Your friend gets a free pack, and once they verify
          their email and open it, you get two free packs — including a mystery
          one.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-none border border-black/15 px-3 py-2 text-sm font-semibold tracking-[0.2em] dark:border-white/20">
            {referralCode || "—"}
          </code>
          <button
            type="button"
            onClick={copyReferral}
            disabled={!referralUrl}
            className="rounded-none bg-black px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-white transition hover:bg-zinc-800 active:scale-95 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {copied ? "Copied!" : "Copy invite link"}
          </button>
        </div>
      </section>

      {/* Odds level */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Odds
        </span>
        <div className="inline-flex border border-black/15 dark:border-white/20">
          {modes.map((m) => {
            const active = m.key === modeKey;
            const locked = !canChangeOdds && m.key !== "normal";
            return (
              <button
                key={m.key}
                type="button"
                disabled={locked}
                title={
                  locked ? "Unlocks after your first withdrawal" : undefined
                }
                onClick={() => !locked && setModeKey(m.key)}
                className={`px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] transition ${
                  active
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : locked
                      ? "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
                      : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {m.name}
                {locked ? " 🔒" : ""}
              </button>
            );
          })}
        </div>
        {mode && canChangeOdds && (
          <span className="text-[11px] text-zinc-500">{MODE_DESC[mode.key] ?? ""}</span>
        )}
        {!canChangeOdds && (
          <span className="text-[11px] text-zinc-500">
            Odds control unlocks after your first withdrawal.
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

      <PackCarousel
        tiers={tiers}
        mode={mode}
        catMult={catMult}
        balance={balance}
        pity={pity}
        categoryKey={categoryKey}
        onOpen={open}
        openingKey={openingKey}
        isOpening={isOpening}
        poolAvailable={poolAvailable}
        paused={paused}
      />

      {/* Trade-up: consolidate several cards into one bigger pull. */}
      <details className="border border-black/10 dark:border-white/15">
        <summary className="cursor-pointer list-none px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 transition hover:text-black dark:hover:text-white">
          Trade up{" "}
          {ownedCards.length > 0 && (
            <span className="font-normal normal-case tracking-normal text-zinc-400">
              · combine {ownedCards.length} card{ownedCards.length > 1 ? "s" : ""} into one
            </span>
          )}
        </summary>
        <div className="space-y-4 border-t border-black/10 px-5 py-4 dark:border-white/15">
          <p className="text-xs text-zinc-500">
            Pick two or more cards you own and trade them in for one stronger
            card from the pool — worth up to 85% of their combined value. The
            cards you trade in go back into circulation.
          </p>

          {ownedCards.length === 0 ? (
            <p className="border border-dashed border-black/20 p-6 text-center text-sm text-zinc-500 dark:border-white/20">
              Win and keep some cards first, then combine them here.
            </p>
          ) : (
            <>
              <div className="grid max-h-72 grid-cols-1 gap-px overflow-y-auto border border-black/10 bg-black/10 sm:grid-cols-2 dark:border-white/15 dark:bg-white/15">
                {ownedCards.map((c) => {
                  const on = selected.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleSelect(c.id)}
                      className={`flex items-center justify-between gap-3 px-4 py-3 text-left transition ${
                        on
                          ? "bg-black text-white dark:bg-white dark:text-black"
                          : "bg-white hover:bg-zinc-50 dark:bg-black dark:hover:bg-zinc-950"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {c.title}
                        </span>
                        <span
                          className={`block truncate text-[11px] ${
                            on ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-500"
                          }`}
                        >
                          {c.grade ? `${c.grade} · ` : ""}
                          {c.serial}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums">
                        {formatMoneyCents(c.fmvCents)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {tradeError && (
                <p className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {tradeError}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="text-zinc-500">
                    {selected.size} selected ·{" "}
                  </span>
                  <span className="tabular-nums">
                    {formatMoneyCents(selectedSumCents)}
                  </span>
                  {selected.size >= 2 && (
                    <span className="text-zinc-500">
                      {" "}
                      → trade value{" "}
                      <span className="font-semibold tabular-nums text-black dark:text-white">
                        {formatMoneyCents(estTradeCents)}
                      </span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={selected.size < 2 || isTrading || paused}
                  onClick={tradeUp}
                  className="rounded-none bg-black px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 active:scale-[0.97] disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  {isTrading ? "Trading…" : "Trade up"}
                </button>
              </div>
            </>
          )}
        </div>
      </details>

      <details className="border border-black/10 dark:border-white/15">
        <summary className="cursor-pointer list-none px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 transition hover:text-black dark:hover:text-white">
          Play settings
        </summary>
        <div className="space-y-4 border-t border-black/10 px-5 py-4 dark:border-white/15">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                Daily spend limit (USD)
              </label>
              <input
                value={spendInput}
                onChange={(e) => setSpendInput(e.target.value)}
                inputMode="numeric"
                placeholder="No limit"
                className="mt-1 w-full rounded-none border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                Daily deposit limit (USD)
              </label>
              <input
                value={depositInput}
                onChange={(e) => setDepositInput(e.target.value)}
                inputMode="numeric"
                placeholder="No limit"
                className="mt-1 w-full rounded-none border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={isPlay}
            onClick={saveLimits}
            className="rounded-none bg-black px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-white transition hover:bg-zinc-800 active:scale-95 disabled:opacity-40 dark:bg-white dark:text-black"
          >
            Save limits
          </button>

          <div className="border-t border-black/10 pt-4 dark:border-white/15">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
              Take a break
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Pause packs and deposits. You can extend a break but not shorten it.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 7, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={isPlay}
                  onClick={() => takeBreak(d)}
                  className="rounded-none border border-black/20 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 active:scale-95 disabled:opacity-40 dark:border-white/25 dark:hover:bg-white/10"
                >
                  {d} day{d > 1 ? "s" : ""}
                </button>
              ))}
            </div>
          </div>
          {playMsg && <p className="text-[11px] text-zinc-500">{playMsg}</p>}
        </div>
      </details>

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
                      onClick={() => sellBack(result.cardId)}
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

      {tradeResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            setTradeResult(null);
            router.refresh();
          }}
        >
          <div
            className="w-full max-w-sm overflow-hidden border border-white/15 bg-black p-8 text-center text-white animate-[fadeIn_300ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-300">
              Traded up
            </p>
            <h3 className="mt-4 text-lg font-semibold">{tradeResult.title}</h3>
            <p className="mt-1 font-mono text-xs text-zinc-400">
              {tradeResult.serial}
            </p>
            {tradeResult.grade && (
              <p className="mt-1 text-sm text-zinc-300">{tradeResult.grade}</p>
            )}
            <p className="mt-5 text-4xl font-semibold tabular-nums">
              {formatMoneyCents(tradeResult.fmvCents)}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.15em] text-zinc-400">
              {tradeResult.tradedCount} cards in ·{" "}
              {formatMoneyCents(tradeResult.inputCents)}
            </p>
            <div className="mt-7 flex gap-3">
              <a
                href={`/dashboard/cards/${tradeResult.cardId}`}
                className="flex-1 rounded-none bg-white px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-black transition hover:bg-zinc-200"
              >
                View card
              </a>
              <button
                type="button"
                onClick={() => {
                  setTradeResult(null);
                  router.refresh();
                }}
                className="flex-1 rounded-none border border-white/25 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-white/10"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {spinResult && spinPhase !== "idle" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            if (spinPhase === "landed") {
              setSpinResult(null);
              setSpinPhase("idle");
            }
          }}
        >
          <div
            className="w-full max-w-sm overflow-hidden border border-white/15 bg-black p-8 text-center text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-fuchsia-300">
              Daily spin
            </p>
            {spinPhase === "spinning" ? (
              <div className="mt-6 py-6">
                <div className="mx-auto flex h-16 items-center justify-center border border-white/15 bg-gradient-to-br from-violet-700/40 to-fuchsia-700/40 px-4 text-lg font-semibold">
                  {spinPrizes[spinFace]?.label ?? "…"}
                </div>
                <p className="mt-4 animate-pulse text-[11px] uppercase tracking-[0.4em] text-zinc-400">
                  Spinning…
                </p>
              </div>
            ) : (
              <div className="animate-[fadeIn_300ms_ease-out]">
                <h3 className="mt-6 text-3xl font-semibold">
                  {spinResult.kind === "cash"
                    ? `+${formatMoneyCents(spinResult.amountCents)}`
                    : spinResult.kind === "pack"
                      ? "Free pack!"
                      : "Better luck tomorrow"}
                </h3>
                <p className="mt-2 text-sm text-zinc-300">{spinResult.label}</p>
                {spinResult.kind === "pack" && (
                  <p className="mt-1 text-[11px] uppercase tracking-[0.15em] text-zinc-400">
                    Added to your free packs
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSpinResult(null);
                    setSpinPhase("idle");
                  }}
                  className="mt-7 w-full rounded-none bg-white px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-black transition hover:bg-zinc-200"
                >
                  Sweet
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {redeemResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            setRedeemResult(null);
            router.refresh();
          }}
        >
          <div
            className="w-full max-w-sm overflow-hidden border border-white/15 bg-black p-8 text-center text-white animate-[fadeIn_300ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-300">
              Free pack opened
            </p>
            <h3 className="mt-4 text-lg font-semibold">{redeemResult.title}</h3>
            <p className="mt-1 font-mono text-xs text-zinc-400">
              {redeemResult.serial}
            </p>
            {redeemResult.grade && (
              <p className="mt-1 text-sm text-zinc-300">{redeemResult.grade}</p>
            )}
            <p className="mt-5 text-4xl font-semibold tabular-nums">
              {formatMoneyCents(redeemResult.fmvCents)}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.15em] text-emerald-400">
              Free — all yours
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
                  onClick={() => sellBack(redeemResult.cardId)}
                  className="flex-1 rounded-none border border-white/25 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-white/10 disabled:opacity-40"
                >
                  {isSelling
                    ? "…"
                    : `Sell back +${formatMoneyCents(redeemResult.buybackCents)}`}
                </button>
                <a
                  href={`/dashboard/cards/${redeemResult.cardId}`}
                  className="flex-1 rounded-none bg-white px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-black transition hover:bg-zinc-200"
                >
                  Keep
                </a>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setRedeemResult(null);
                router.refresh();
              }}
              className="mt-3 text-[11px] uppercase tracking-[0.15em] text-zinc-400 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
