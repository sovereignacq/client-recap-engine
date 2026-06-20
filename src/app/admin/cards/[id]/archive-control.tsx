"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminArchiveCard, adminRestoreCard } from "../../actions";

export function AdminArchiveControl({
  cardId,
  archived,
}: {
  cardId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!archived && !confirm("Archive this card? It leaves active lists and the pool.")) {
          return;
        }
        startTransition(async () => {
          if (archived) await adminRestoreCard(cardId);
          else await adminArchiveCard(cardId);
          router.refresh();
        });
      }}
      className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 hover:text-black disabled:opacity-50 dark:hover:text-white"
    >
      {isPending ? "…" : archived ? "Restore card" : "Archive card"}
    </button>
  );
}
