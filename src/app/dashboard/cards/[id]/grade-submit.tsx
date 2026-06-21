"use client";

import { useMemo, useState, useTransition } from "react";
import { requestGradingAction } from "../actions";
import {
  formatMoneyCents,
  gradingServiceFeeCents,
  GRADING_TURNAROUNDS,
} from "@/lib/cards";

type Company = { key: string; name: string; turnaround_days: number | null };

const INPUT =
  "w-full rounded-none border border-black/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-black dark:border-white/25 dark:focus:border-white";

export function SubmitGrading({
  cardId,
  fmvCents,
  companies,
  discountPct = 0,
  availableCredits = 0,
}: {
  cardId: string;
  fmvCents: number | null;
  companies: Company[];
  discountPct?: number;
  availableCredits?: number;
}) {
  const [company, setCompany] = useState(companies[0]?.key ?? "");
  const [turnaround, setTurnaround] = useState("standard");
  const [valueDollars, setValueDollars] = useState(
    fmvCents ? (fmvCents / 100).toString() : "",
  );
  const [useCredit, setUseCredit] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valueCents = Math.round((parseFloat(valueDollars) || 0) * 100);
  const baseFee = useMemo(
    () => gradingServiceFeeCents(valueCents, turnaround),
    [valueCents, turnaround],
  );
  // Credits cover value-tier cards (declared value up to $500) and waive the fee.
  const creditEligible = availableCredits > 0 && valueCents > 0 && valueCents <= 50000;
  const applyingCredit = useCredit && creditEligible;
  const fee = applyingCredit
    ? 0
    : discountPct > 0
      ? Math.round(baseFee * (1 - discountPct / 100))
      : baseFee;

  if (companies.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No grading companies are accepting submissions right now. Check back
        soon — availability changes often.
      </p>
    );
  }

  if (done) {
    return (
      <p className="text-sm text-emerald-600 dark:text-emerald-400">{done}</p>
    );
  }

  function submit() {
    setError(null);
    if (valueCents <= 0) {
      setError("Set the card's declared value first.");
      return;
    }
    startTransition(async () => {
      const res = await requestGradingAction(
        cardId,
        company,
        valueCents,
        turnaround,
        applyingCredit,
      );
      if (res.ok)
        setDone(
          `Submitted for grading. The ${formatMoneyCents(
            res.serviceFeeCents,
          )} APEX service fee was charged to your wallet. The grader's own fee + insured shipping is billed at cost. Track status here.`,
        );
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Pick an open grading company. You pay the flat APEX service fee now; the
        grader&apos;s fee and insured shipping are billed at cost.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-400">
            Grader
          </span>
          <select
            className={INPUT}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          >
            {companies.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
                {c.turnaround_days ? ` · ~${c.turnaround_days}d` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-400">
            Turnaround
          </span>
          <select
            className={INPUT}
            value={turnaround}
            onChange={(e) => setTurnaround(e.target.value)}
          >
            {GRADING_TURNAROUNDS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-400">
            Declared value (USD)
          </span>
          <input
            className={INPUT}
            inputMode="decimal"
            value={valueDollars}
            onChange={(e) => setValueDollars(e.target.value)}
            placeholder="0.00"
          />
        </label>
      </div>

      {availableCredits > 0 && (
        <label
          className={`flex items-center gap-2 text-xs ${
            creditEligible ? "" : "text-zinc-400"
          }`}
        >
          <input
            type="checkbox"
            checked={applyingCredit}
            disabled={!creditEligible}
            onChange={(e) => setUseCredit(e.target.checked)}
          />
          Use a grading credit to waive the fee ({availableCredits} available
          {creditEligible ? "" : " · value-tier cards up to $500 only"})
        </label>
      )}

      <div className="flex items-center justify-between border-t border-black/10 pt-3 text-sm dark:border-white/15">
        <span className="text-zinc-500">
          APEX service fee
          {applyingCredit
            ? " · credit applied"
            : discountPct > 0
              ? ` · ${discountPct}% member discount`
              : ""}
        </span>
        <span className="font-semibold tabular-nums">
          {(applyingCredit || discountPct > 0) && (
            <span className="mr-2 font-normal text-zinc-400 line-through">
              {formatMoneyCents(baseFee)}
            </span>
          )}
          {formatMoneyCents(fee)}
        </span>
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="rounded-none bg-black px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {pending ? "Submitting…" : `Submit & pay ${formatMoneyCents(fee)}`}
      </button>
    </div>
  );
}
