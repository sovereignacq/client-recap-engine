"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoneyCents } from "@/lib/cards";
import { getDedupePreviewAction, dedupePoolAction } from "./actions";

export type DedupeSegment = {
  loCents: number;
  hiCents: number;
  target: number;
  poolCnt: number;
  distinctCnt: number;
  dupCnt: number;
  removableCnt: number;
};

/**
 * De-duplication panel: surfaces bands whose pool already meets the number of
 * cards the odds require but carries surplus duplicate copies, and lets the
 * owner trim those extras in one pass. Distinct cards are always kept and no
 * band is taken below its target, so the odds stay intact.
 */
export function PoolDedupe({ initial }: { initial: DedupeSegment[] }) {
  const [segments, setSegments] = useState<DedupeSegment[]>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, startLoad] = useTransition();
  const [running, startRun] = useTransition();
  const router = useRouter();

  const totalRemovable = segments.reduce((s, x) => s + x.removableCnt, 0);

  const refresh = () =>
    startLoad(async () => {
      setSegments(await getDedupePreviewAction());
    });

  useEffect(() => {
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, []);

  const run = () =>
    startRun(async () => {
      setMsg(null);
      const r = await dedupePoolAction();
      setConfirming(false);
      if (r.ok) {
        setMsg(
          `Removed ${r.removed} duplicate cop${r.removed === 1 ? "y" : "ies"} from over-stocked bands.`,
        );
        setSegments(await getDedupePreviewAction());
        router.refresh();
      } else {
        setMsg(r.error ?? "De-dup failed.");
      }
    });

  return (
    <section className="border border-black/10 p-6 dark:border-white/15">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Trim over-stocked bands
          </h2>
          <p className="mt-1 max-w-prose text-sm text-zinc-500">
            Bands that already hold the number of cards the odds require but carry
            extra duplicate copies. Trimming archives the surplus duplicates only —
            every distinct card stays, and no band drops below its target, so the
            odds are unchanged. Archived cards can be restored.
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

      {segments.length === 0 ? (
        <p className="mt-4 border border-dashed border-black/20 p-8 text-center text-sm text-zinc-500 dark:border-white/20">
          No over-stocked bands — every band is at or below its target, or holds
          no duplicates.
        </p>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:border-white/15">
                  <th className="py-2 pr-3 font-medium">Value range</th>
                  <th className="py-2 pr-3 text-right font-medium">In pool</th>
                  <th className="py-2 pr-3 text-right font-medium">Distinct</th>
                  <th className="py-2 pr-3 text-right font-medium">Target</th>
                  <th className="py-2 pr-3 text-right font-medium">Trim</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((s, i) => (
                  <tr
                    key={i}
                    className="border-b border-black/5 last:border-0 dark:border-white/10"
                  >
                    <td className="py-2 pr-3 tabular-nums">
                      {formatMoneyCents(s.loCents)} – {formatMoneyCents(s.hiCents)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{s.poolCnt}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-zinc-500">
                      {s.distinctCnt}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-zinc-500">
                      {s.target}
                    </td>
                    <td
                      className={`py-2 pr-3 text-right tabular-nums font-semibold ${
                        s.removableCnt > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-zinc-400"
                      }`}
                    >
                      {s.removableCnt > 0 ? `−${s.removableCnt}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {confirming ? (
              <>
                <span className="text-sm text-zinc-600 dark:text-zinc-300">
                  Archive {totalRemovable} duplicate cop
                  {totalRemovable === 1 ? "y" : "ies"} out of the pool?
                </span>
                <button
                  type="button"
                  onClick={run}
                  disabled={running}
                  className="rounded-none bg-black px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  {running ? "Trimming…" : "Confirm trim"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={running}
                  className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 hover:text-black disabled:opacity-50 dark:hover:text-white"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={totalRemovable === 0}
                className="rounded-none border border-black/20 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 disabled:opacity-40 dark:border-white/25 dark:hover:bg-white/10"
              >
                Trim {totalRemovable} duplicate{totalRemovable === 1 ? "" : "s"}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
