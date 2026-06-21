"use client";

import { useTransition } from "react";
import { acknowledgeWarningsAction } from "./actions";

export function WarningBanner({ reasons }: { reasons: string[] }) {
  const [pending, startTransition] = useTransition();
  if (reasons.length === 0) return null;

  return (
    <div className="border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">
            {reasons.length > 1
              ? `You have ${reasons.length} warnings from APEX TCG`
              : "A note from APEX TCG"}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await acknowledgeWarningsAction();
            })
          }
          className="shrink-0 rounded-none border border-amber-600/40 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.15em] transition hover:bg-amber-600/10 disabled:opacity-50"
        >
          {pending ? "…" : "I understand"}
        </button>
      </div>
    </div>
  );
}
