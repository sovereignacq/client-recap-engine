"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoneyCents } from "@/lib/cards";
import {
  getEconomicsFixPlansAction,
  applyEconomicsFixAction,
} from "./actions";

export type FixChange = { label: string; from: string; to: string };

export type EconFixPlan = {
  tierKey: string;
  tierName: string;
  kind: "reweight" | "price";
  priceCents: number;
  evCents: number;
  marginCents: number;
  afterEvCents: number;
  afterMarginCents: number;
  afterMarginPct: number;
  why: string;
  what: string;
  changes: FixChange[];
};

/**
 * Auto-correct panel for money-losing tiers. For each negative tier it spells
 * out WHY it's losing money and WHAT the fix will change (with the exact
 * before→after values) before any button is pressed; the button then applies it.
 */
export function EconomicsAutoFix({ initial }: { initial: EconFixPlan[] }) {
  const [plans, setPlans] = useState<EconFixPlan[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [applying, startApply] = useTransition();
  const router = useRouter();

  const refresh = () =>
    startLoad(async () => {
      setPlans(await getEconomicsFixPlansAction());
    });

  // Keep the list current as the pool changes underneath.
  useEffect(() => {
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, []);

  const apply = (tierKey?: string, key?: string) =>
    startApply(async () => {
      setMsg(null);
      setBusy(key ?? "__all__");
      const r = await applyEconomicsFixAction(tierKey);
      setBusy(null);
      if (r.ok) {
        setMsg(
          `Applied ${r.applied} fix${r.applied === 1 ? "" : "es"}. The tier${
            r.applied === 1 ? " is" : "s are"
          } back in the black.`,
        );
        setPlans(await getEconomicsFixPlansAction());
        router.refresh();
      } else {
        setMsg(r.error ?? "Fix failed.");
      }
    });

  const totalLoss = plans.reduce((s, p) => s + Math.abs(p.marginCents), 0);

  return (
    <section className="border border-black/10 p-6 dark:border-white/15">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Auto-correct losing tiers
          </h2>
          <p className="mt-1 max-w-prose text-sm text-zinc-500">
            Tiers whose average payout is above the pack price — i.e. the house
            loses money on every pull. Each card explains why it&apos;s losing and
            exactly what the fix changes before you apply it.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-none border border-black/20 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10"
        >
          {loading ? "Checking…" : "Re-check"}
        </button>
      </div>

      {msg && (
        <p className="mt-4 border-l-2 border-emerald-500 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {msg}
        </p>
      )}

      {plans.length === 0 ? (
        <p className="mt-4 border border-dashed border-black/20 p-8 text-center text-sm text-zinc-500 dark:border-white/20">
          No tier is losing money right now — every stocked tier holds a positive
          house margin. 🎉
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-red-500/30 bg-red-50/60 px-4 py-3 dark:bg-red-950/30">
            <p className="text-sm text-red-700 dark:text-red-300">
              <span className="font-semibold">{plans.length}</span> tier
              {plans.length === 1 ? "" : "s"} losing a combined{" "}
              <span className="font-semibold tabular-nums">
                {formatMoneyCents(totalLoss)}
              </span>{" "}
              per pull.
            </p>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => apply(undefined, "__all__")}
              className="rounded-none bg-black px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 active:scale-[0.97] disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {busy === "__all__" && applying ? "Fixing all…" : "Fix all tiers"}
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {plans.map((p) => (
              <div
                key={p.tierKey}
                className="border border-black/10 dark:border-white/15"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-black/[0.02] px-4 py-3 dark:border-white/15 dark:bg-white/[0.03]">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{p.tierName}</span>
                    <span className="rounded-none border border-red-500/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-600 dark:text-red-400">
                      −{formatMoneyCents(Math.abs(p.marginCents))}/pull
                    </span>
                    <span className="rounded-none border border-black/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500 dark:border-white/20">
                      {p.kind === "reweight" ? "Reweight odds" : "Raise price"}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => apply(p.tierKey, p.tierKey)}
                    className="rounded-none border border-black/20 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10"
                  >
                    {busy === p.tierKey && applying ? "Applying…" : "Apply fix"}
                  </button>
                </div>

                <div className="space-y-3 px-4 py-3 text-sm">
                  <p>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-500">
                      Why
                    </span>
                    <br />
                    <span className="text-zinc-700 dark:text-zinc-300">{p.why}</span>
                  </p>
                  <p>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
                      What changes
                    </span>
                    <br />
                    <span className="text-zinc-700 dark:text-zinc-300">{p.what}</span>
                  </p>

                  {p.changes.length > 0 && (
                    <ul className="divide-y divide-black/5 border border-black/10 text-xs dark:divide-white/10 dark:border-white/15">
                      {p.changes.map((c, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between gap-3 px-3 py-1.5"
                        >
                          <span className="text-zinc-500">{c.label}</span>
                          <span className="tabular-nums">
                            <span className="text-zinc-400 line-through">{c.from}</span>
                            <span className="mx-1.5">→</span>
                            <span className="font-semibold">{c.to}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
                    <span>
                      Avg payout{" "}
                      <span className="tabular-nums text-zinc-400 line-through">
                        {formatMoneyCents(p.evCents)}
                      </span>{" "}
                      →{" "}
                      <span className="font-semibold tabular-nums text-black dark:text-white">
                        {formatMoneyCents(p.afterEvCents)}
                      </span>
                    </span>
                    <span>
                      House margin{" "}
                      <span className="tabular-nums text-red-500">
                        −{formatMoneyCents(Math.abs(p.marginCents))}
                      </span>{" "}
                      →{" "}
                      <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        +{formatMoneyCents(p.afterMarginCents)} ({p.afterMarginPct}%)
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
