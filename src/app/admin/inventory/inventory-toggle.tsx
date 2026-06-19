"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminToggleInventory } from "../actions";

export function InventoryToggle({
  cardId,
  inInventory,
}: {
  cardId: string;
  inInventory: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await adminToggleInventory(cardId, !inInventory);
          router.refresh();
        })
      }
      className={`rounded-none px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition disabled:opacity-40 ${
        inInventory
          ? "border border-black/20 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
          : "bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      }`}
    >
      {isPending ? "…" : inInventory ? "Remove" : "Add to pool"}
    </button>
  );
}
