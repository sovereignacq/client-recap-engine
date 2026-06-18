"use client";

import { useTransition } from "react";
import { deleteCardAction } from "../actions";

export function DeleteCardButton({
  cardId,
  serial,
}: {
  cardId: string;
  serial: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (
          confirm(
            `Delete card ${serial} and its photo? This cannot be undone.`,
          )
        ) {
          startTransition(async () => {
            await deleteCardAction(cardId);
          });
        }
      }}
      className="text-sm text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
    >
      {isPending ? "Deleting…" : "Delete card"}
    </button>
  );
}
