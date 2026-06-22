"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OFFER_STATUSES, offerLabel } from "@/lib/offers";
import {
  updateOfferStatusAction,
  updateOfferDetailsAction,
} from "../actions";

const INPUT =
  "rounded-none border border-black/15 bg-transparent px-3 py-2.5 text-sm outline-none transition focus:border-black dark:border-white/20 dark:focus:border-white";
const LABEL =
  "text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500";

export function OfferControls({
  offerId,
  status,
  notes,
}: {
  offerId: string;
  status: string;
  notes: string | null;
}) {
  const router = useRouter();
  const [isStatus, startStatus] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState(notes ?? "");

  // Once we're processing the offer the customer can't change it anymore.
  const locked = ["accepted", "paid", "declined"].includes(status);

  const changeStatus = (next: string) => {
    setError(null);
    startStatus(async () => {
      const r = await updateOfferStatusAction(offerId, next);
      if (r && "error" in r && r.error) setError(r.error);
      else router.refresh();
    });
  };

  const saveNote = () => {
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("notes", note);
    startSave(async () => {
      const r = await updateOfferDetailsAction(offerId, fd);
      if (r && "error" in r && r.error) setError(r.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  };

  return (
    <section className="space-y-6 border border-black/10 p-6 dark:border-white/15">
      <div>
        <p className={LABEL}>Status</p>
        <p className="mt-2 text-sm">
          {offerLabel(OFFER_STATUSES, status)}
        </p>

        {status === "draft" && (
          <button
            type="button"
            disabled={isStatus}
            onClick={() => changeStatus("sent")}
            className="mt-3 rounded-none bg-black px-5 py-3 text-xs font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {isStatus ? "Submitting…" : "Submit offer for review"}
          </button>
        )}
        {status === "sent" && (
          <p className="mt-2 text-xs text-zinc-500">
            Submitted — our team will review and accept it, then send you the
            shipping address. You&apos;ll be paid to your wallet once the cards
            arrive and check out.
          </p>
        )}
        {status === "accepted" && (
          <p className="mt-2 text-xs text-zinc-500">
            Accepted — ship your cards to the address we sent you. We pay your
            wallet after they arrive and verify.
          </p>
        )}
        {status === "paid" && (
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
            Paid to your APEX wallet. Withdraw it any time from the wallet page.
          </p>
        )}
        {status === "declined" && (
          <p className="mt-2 text-xs text-zinc-500">
            This offer was declined.
          </p>
        )}

        {(status === "draft" || status === "sent") && (
          <button
            type="button"
            disabled={isStatus}
            onClick={() => changeStatus("canceled")}
            className="mt-3 ml-0 block rounded-none border border-black/20 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 disabled:opacity-40 dark:border-white/25 dark:hover:bg-white/10"
          >
            Cancel offer
          </button>
        )}
      </div>

      {!locked && status !== "canceled" && (
        <div>
          <label className={LABEL}>Notes</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={`mt-1 w-full ${INPUT}`}
          />
          <button
            type="button"
            onClick={saveNote}
            disabled={isSaving}
            className="mt-2 rounded-none border border-black/20 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 disabled:opacity-40 dark:border-white/25 dark:hover:bg-white/10"
          >
            {isSaving ? "Saving…" : "Save note"}
          </button>
        </div>
      )}

      {error && (
        <p className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {saved && !error && <p className="text-xs text-emerald-600">Saved.</p>}
    </section>
  );
}
