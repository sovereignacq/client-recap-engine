"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoneyCents } from "@/lib/cards";
import { keepCardAction, sellBackAction } from "../buy/actions";

const DECISION_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Decision prompt for a freshly pulled card. The player has 3 days to keep it
 * or sell it back; if they do nothing it auto-sells back to the pool and the
 * buyback value lands in their wallet.
 */
export function WonDecision({
  cardId,
  fmvCents,
  wonAt,
}: {
  cardId: string;
  fmvCents: number | null;
  wonAt: string | null;
}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const buybackCents = fmvCents ? Math.round(fmvCents * 0.9) : 0;

  const daysLeft = useMemo(() => {
    if (!wonAt) return null;
    const deadline = new Date(wonAt).getTime() + DECISION_MS;
    const ms = deadline - new Date().getTime();
    if (ms <= 0) return 0;
    return Math.ceil(ms / (24 * 60 * 60 * 1000));
  }, [wonAt]);

  const keep = () => {
    setError(null);
    start(async () => {
      const r = await keepCardAction(cardId);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  };

  const sell = () => {
    setError(null);
    start(async () => {
      const r = await sellBackAction(cardId);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  };

  return (
    <div className="border-t border-amber-500/30 bg-amber-50/60 px-5 py-3 dark:bg-amber-950/20">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-amber-700 dark:text-amber-400">
        Decide within 3 days
        {daysLeft !== null &&
          (daysLeft > 0
            ? ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
            : " · selling back soon")}
      </p>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Keep this card in your collection, or sell it back to us. If you don&apos;t
        decide, we&apos;ll buy it back automatically and credit{" "}
        {formatMoneyCents(buybackCents)} to your wallet.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={keep}
          className="rounded-none bg-black px-4 py-2 text-[10px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Keep
        </button>
        <button
          type="button"
          disabled={isPending || buybackCents <= 0}
          onClick={sell}
          className="rounded-none border border-black/20 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.15em] transition hover:bg-black/5 disabled:opacity-40 dark:border-white/25 dark:hover:bg-white/10"
        >
          Sell back +{formatMoneyCents(buybackCents)}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
