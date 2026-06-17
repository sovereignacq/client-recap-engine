"use client";

import { useTransition } from "react";
import { deleteClientAction } from "../actions";

export function DeleteClientButton({
  clientId,
  clientName,
  recapCount,
}: {
  clientId: string;
  clientName: string;
  recapCount: number;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (
          confirm(
            `Delete ${clientName} and all ${recapCount} recap(s)? This cannot be undone.`,
          )
        ) {
          startTransition(async () => {
            await deleteClientAction(clientId);
          });
        }
      }}
      className="text-sm text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
    >
      {isPending ? "Deleting…" : "Delete client"}
    </button>
  );
}
