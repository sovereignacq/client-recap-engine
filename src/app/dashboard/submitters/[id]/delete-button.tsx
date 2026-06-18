"use client";

import { useTransition } from "react";
import { deleteSubmitterAction } from "../actions";

export function DeleteSubmitterButton({
  submitterId,
  submitterName,
  cardCount,
}: {
  submitterId: string;
  submitterName: string;
  cardCount: number;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (
          confirm(
            `Delete ${submitterName}? Their ${cardCount} card record(s) are kept but will no longer be linked to a submitter. This cannot be undone.`,
          )
        ) {
          startTransition(async () => {
            await deleteSubmitterAction(submitterId);
          });
        }
      }}
      className="text-sm text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
    >
      {isPending ? "Deleting…" : "Delete submitter"}
    </button>
  );
}
