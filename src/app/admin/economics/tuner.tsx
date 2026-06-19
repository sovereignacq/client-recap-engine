"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminUpdateTier, adminUpdateMode } from "./actions";

export type Bucket = {
  key: string;
  label: string;
  min_mult: number;
  max_mult: number;
  weight: number;
};
export type TunerTier = {
  key: string;
  name: string;
  priceCents: number;
  pityThreshold: number;
  pityMinMult: number;
  pityMaxMult: number;
  odds: Bucket[];
};
export type TunerMode = {
  key: string;
  name: string;
  weightMults: Record<string, number>;
};

const BUCKET_KEYS = ["below", "even", "above", "jackpot"] as const;

const INPUT =
  "w-full rounded-none border border-black/15 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-black dark:border-white/20 dark:focus:border-white";

/** Expected return as a multiple of price for a tier under a mode's weights. */
function expectedMultiple(odds: Bucket[], mults: Record<string, number>): number {
  const w = odds.map((b) => b.weight * (mults[b.key] ?? 1));
  const total = w.reduce((s, x) => s + x, 0) || 1;
  return odds.reduce(
    (sum, b, i) => sum + (w[i] / total) * ((b.min_mult + b.max_mult) / 2),
    0,
  );
}

function edgeClass(edge: number) {
  return edge >= 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";
}

export function EconomicsTuner({
  tiers,
  modes,
  buybackPct,
}: {
  tiers: TunerTier[];
  modes: TunerMode[];
  buybackPct: number;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // Local editable copies
  const [modeState, setModeState] = useState(modes);
  const [tierState, setTierState] = useState(
    tiers.map((t) => ({
      ...t,
      priceStr: (t.priceCents / 100).toFixed(2),
      pityStr: String(t.pityThreshold),
    })),
  );

  const setModeMult = (mk: string, bk: string, v: string) =>
    setModeState((ms) =>
      ms.map((m) =>
        m.key === mk
          ? { ...m, weightMults: { ...m.weightMults, [bk]: Number(v) } }
          : m,
      ),
    );

  const saveMode = (mk: string) => {
    setMsg(null);
    const m = modeState.find((x) => x.key === mk)!;
    const wm = {
      below: Number(m.weightMults.below ?? 1),
      even: Number(m.weightMults.even ?? 1),
      above: Number(m.weightMults.above ?? 1),
      jackpot: Number(m.weightMults.jackpot ?? 1),
    };
    startSave(async () => {
      const r = await adminUpdateMode(mk, wm);
      if (r && "error" in r && r.error) setMsg(r.error);
      else {
        setMsg(`Saved ${m.name} odds.`);
        router.refresh();
      }
    });
  };

  const saveTier = (tk: string) => {
    setMsg(null);
    const t = tierState.find((x) => x.key === tk)!;
    const price = Math.round(Number(t.priceStr) * 100);
    const pity = parseInt(t.pityStr, 10);
    startSave(async () => {
      const r = await adminUpdateTier(tk, price, pity);
      if (r && "error" in r && r.error) setMsg(r.error);
      else {
        setMsg(`Saved ${t.name}.`);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-10">
      {msg && (
        <p className="border-l-2 border-emerald-500 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {msg}
        </p>
      )}

      {/* Odds levels */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Odds levels (weight multipliers)
        </h2>
        <div className="space-y-3">
          {modeState.map((m) => (
            <div
              key={m.key}
              className="flex flex-wrap items-end gap-3 border border-black/10 p-4 dark:border-white/15"
            >
              <span className="w-16 text-sm font-medium">{m.name}</span>
              {BUCKET_KEYS.map((bk) => (
                <label key={bk} className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                  {bk}
                  <input
                    value={m.weightMults[bk] ?? 1}
                    onChange={(e) => setModeMult(m.key, bk, e.target.value)}
                    inputMode="decimal"
                    className={`${INPUT} mt-1 w-16`}
                  />
                </label>
              ))}
              <button
                type="button"
                disabled={saving}
                onClick={() => saveMode(m.key)}
                className="rounded-none bg-black px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white disabled:opacity-40 dark:bg-white dark:text-black"
              >
                Save
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Tiers + live house edge */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Tiers — house edge previews live
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:border-white/15">
                <th className="py-2 text-left">Tier</th>
                <th className="py-2 text-left">Price</th>
                <th className="py-2 text-left">Pity</th>
                {modeState.map((m) => (
                  <th key={m.key} className="py-2 text-right">
                    {m.name} edge
                  </th>
                ))}
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tierState.map((t, ti) => (
                <tr key={t.key} className="border-b border-black/10 dark:border-white/15">
                  <td className="py-2 pr-3 font-medium">{t.name}</td>
                  <td className="py-2 pr-3">
                    <input
                      value={t.priceStr}
                      onChange={(e) =>
                        setTierState((ts) =>
                          ts.map((x, i) =>
                            i === ti ? { ...x, priceStr: e.target.value } : x,
                          ),
                        )
                      }
                      inputMode="decimal"
                      className={`${INPUT} w-20`}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      value={t.pityStr}
                      onChange={(e) =>
                        setTierState((ts) =>
                          ts.map((x, i) =>
                            i === ti ? { ...x, pityStr: e.target.value } : x,
                          ),
                        )
                      }
                      inputMode="numeric"
                      className={`${INPUT} w-14`}
                    />
                  </td>
                  {modeState.map((m) => {
                    const em = expectedMultiple(t.odds, m.weightMults);
                    const edge = 1 - em;
                    return (
                      <td
                        key={m.key}
                        className={`py-2 text-right tabular-nums ${edgeClass(edge)}`}
                      >
                        {(edge * 100).toFixed(0)}%
                      </td>
                    );
                  })}
                  <td className="py-2 pl-3 text-right">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => saveTier(t.key)}
                      className="rounded-none border border-black/20 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] disabled:opacity-40 dark:border-white/25"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-400">
          Edge = house share kept per open, using each bucket&apos;s midpoint value.
          Real results also depend on your actual inventory mix. Sell-back adds a{" "}
          {Math.round((1 - buybackPct) * 100)}% margin whenever a player cashes a
          card in. Aim to keep every cell positive.
        </p>
      </section>
    </div>
  );
}
