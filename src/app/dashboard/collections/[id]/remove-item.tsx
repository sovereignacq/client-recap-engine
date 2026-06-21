"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeItemAction } from "../actions";

export function RemoveItem({
  itemId,
  collectionId,
}: {
  itemId: string;
  collectionId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await removeItemAction(itemId, collectionId);
          router.refresh();
        })
      }
      className="text-[11px] uppercase tracking-[0.15em] text-zinc-400 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
    >
      {pending ? "…" : "Remove"}
    </button>
  );
}
