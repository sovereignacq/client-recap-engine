"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminProcessWithdrawal } from "../actions";

export function ProcessControl({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const act = (status: "paid" | "rejected") => {
    const verb = status === "paid" ? "mark as PAID" : "REJECT and refund";
    if (!confirm(`${verb} this withdrawal?`)) return;
    setError(null);
    start(async () => {
      const r = await adminProcessWithdrawal(id, status);
      if (r?.error) setError(r.error);
      else router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => act("rejected")}
          className="rounded-none border border-black/20 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 disabled:opacity-40 dark:border-white/25 dark:hover:bg-white/10"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act("paid")}
          className="rounded-none bg-black px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Mark paid
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
