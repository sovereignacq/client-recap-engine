"use client";

import { useTransition } from "react";
import { deleteOfferAction } from "../actions";

export function DeleteOfferButton({ offerId }: { offerId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (confirm("Delete this offer? This cannot be undone.")) {
          startTransition(async () => {
            await deleteOfferAction(offerId);
          });
        }
      }}
      className="text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
    >
      {isPending ? "Deleting…" : "Delete offer"}
    </button>
  );
}
