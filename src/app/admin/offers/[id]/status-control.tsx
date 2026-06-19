"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminUpdateOfferStatus } from "../../actions";

type Option = { value: string; label: string };

export function AdminOfferStatusControl({
  offerId,
  status,
  statuses,
}: {
  offerId: string;
  status: string;
  statuses: Option[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const change = (next: string) => {
    if (next === status) return;
    if (
      next === "paid" &&
      !confirm("Mark this offer paid? The included cards will be marked sold.")
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await adminUpdateOfferStatus(offerId, next);
      if (r && "error" in r && r.error) setError(r.error);
      else router.refresh();
    });
  };

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
        Status
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {statuses.map((s) => {
          const active = s.value === status;
          return (
            <button
              key={s.value}
              type="button"
              disabled={isPending || active}
              onClick={() => change(s.value)}
              className={`rounded-none px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition ${
                active
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "border border-black/20 hover:bg-black/5 disabled:opacity-40 dark:border-white/25 dark:hover:bg-white/10"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      {status === "paid" && (
        <p className="mt-2 text-xs text-zinc-500">Included cards marked sold.</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
