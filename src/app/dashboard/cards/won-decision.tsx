"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoneyCents } from "@/lib/cards";
import {
  keepCardAction,
  undecidedCardAction,
  sellBackAction,
} from "../buy/actions";

const WINDOW_MS = 72 * 60 * 60 * 1000;

/**
 * Decision prompt for a pulled card. The player has 72 hours to keep it, stay
 * undecided, or sell it back; if they do nothing it auto-sells back to the pool
 * and the buyback value lands in their wallet.
 *
 * `kept` (decided) cards show just a sell-back option so a player can change
 * their mind later.
 */
export function WonDecision({
  cardId,
  fmvCents,
  buybackCents,
  wonAt,
  decided,
}: {
  cardId: string;
  fmvCents: number | null;
  buybackCents: number;
  wonAt: string | null;
  decided: boolean;
}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const payout = buybackCents || (fmvCents ? Math.round(fmvCents * 0.85) : 0);

  const hoursLeft = useMemo(() => {
    if (!wonAt) return null;
    const deadline = new Date(wonAt).getTime() + WINDOW_MS;
    const ms = deadline - new Date().getTime();
    if (ms <= 0) return 0;
    return Math.ceil(ms / (60 * 60 * 1000));
  }, [wonAt]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.ok) router.refresh();
      else setError(r.error ?? "Something went wrong.");
    });
  };

  // Already kept — offer only a sell-back so they can change their mind.
  if (decided) {
    return (
      <div className="border-t border-black/10 px-5 py-3 dark:border-white/15">
        <button
          type="button"
          disabled={isPending || payout <= 0}
          onClick={() => run(() => sellBackAction(cardId))}
          className="rounded-none border border-black/20 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.15em] transition hover:bg-black/5 disabled:opacity-40 dark:border-white/25 dark:hover:bg-white/10"
        >
          Sell back +{formatMoneyCents(payout)}
        </button>
        {error && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-amber-500/30 bg-amber-50/60 px-5 py-3 dark:bg-amber-950/20">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-amber-700 dark:text-amber-400">
        Decide within 72 hours
        {hoursLeft !== null &&
          (hoursLeft > 0
            ? ` · ${hoursLeft}h left`
            : " · selling back soon")}
      </p>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Keep it, stay undecided, or sell it back. If you don&apos;t decide, we buy
        it back automatically and credit {formatMoneyCents(payout)} to your wallet.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => keepCardAction(cardId))}
          className="rounded-none bg-black px-4 py-2 text-[10px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Keep
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => undecidedCardAction(cardId))}
          className="rounded-none border border-black/20 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.15em] transition hover:bg-black/5 disabled:opacity-40 dark:border-white/25 dark:hover:bg-white/10"
        >
          Undecided
        </button>
        <button
          type="button"
          disabled={isPending || payout <= 0}
          onClick={() => run(() => sellBackAction(cardId))}
          className="rounded-none border border-black/20 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.15em] transition hover:bg-black/5 disabled:opacity-40 dark:border-white/25 dark:hover:bg-white/10"
        >
          Sell back +{formatMoneyCents(payout)}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
