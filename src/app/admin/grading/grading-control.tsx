"use client";

import { useState, useTransition } from "react";
import { adminUpdateGrading, adminSetGraderAccepting } from "@/app/admin/actions";
import { GRADING_SUB_STATUSES } from "@/lib/cards";

const INPUT =
  "rounded-none border border-black/20 bg-transparent px-2 py-1.5 text-xs outline-none focus:border-black dark:border-white/25 dark:focus:border-white";

export function GradingControl({
  id,
  status,
  graderFeeCents,
  trackingIn,
  trackingOut,
  grade,
}: {
  id: string;
  status: string;
  graderFeeCents: number | null;
  trackingIn: string | null;
  trackingOut: string | null;
  grade: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [st, setSt] = useState(status);
  const [fee, setFee] = useState(
    graderFeeCents != null ? (graderFeeCents / 100).toString() : "",
  );
  const [tin, setTin] = useState(trackingIn ?? "");
  const [tout, setTout] = useState(trackingOut ?? "");
  const [gr, setGr] = useState(grade ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <select className={INPUT} value={st} onChange={(e) => setSt(e.target.value)}>
        {GRADING_SUB_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <input
        className={INPUT}
        inputMode="decimal"
        placeholder="Grader fee $"
        value={fee}
        onChange={(e) => setFee(e.target.value)}
      />
      <input
        className={INPUT}
        placeholder="Final grade"
        value={gr}
        onChange={(e) => setGr(e.target.value)}
      />
      <input
        className={INPUT}
        placeholder="Tracking → grader"
        value={tin}
        onChange={(e) => setTin(e.target.value)}
      />
      <input
        className={INPUT}
        placeholder="Tracking → customer"
        value={tout}
        onChange={(e) => setTout(e.target.value)}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMsg(null);
            const cents = fee ? Math.round(parseFloat(fee) * 100) : undefined;
            const res = await adminUpdateGrading(id, st, cents, tin, tout, gr);
            setMsg(res?.error ? res.error : "Saved");
          })
        }
        className="rounded-none bg-black px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {pending ? "…" : "Save"}
      </button>
      {msg && (
        <span
          className={`col-span-2 text-[10px] sm:col-span-3 ${
            msg === "Saved"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {msg}
        </span>
      )}
    </div>
  );
}

export function GraderToggle({
  graderKey,
  name,
  accepting,
}: {
  graderKey: string;
  name: string;
  accepting: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [on, setOn] = useState(accepting);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const next = !on;
          const res = await adminSetGraderAccepting(graderKey, next);
          if (!res?.error) setOn(next);
        })
      }
      className={`flex items-center justify-between gap-3 border px-4 py-2.5 text-sm transition disabled:opacity-50 ${
        on
          ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
          : "border-black/15 text-zinc-500 dark:border-white/20"
      }`}
    >
      <span className="font-medium">{name}</span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">
        {on ? "Open · close it" : "Closed · open it"}
      </span>
    </button>
  );
}
