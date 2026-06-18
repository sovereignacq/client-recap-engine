"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateOfferStatusAction,
  updateOfferDetailsAction,
} from "../actions";

type Option = { value: string; label: string };

const INPUT =
  "rounded-none border border-black/15 bg-transparent px-3 py-2.5 text-sm outline-none transition focus:border-black dark:border-white/20 dark:focus:border-white";
const LABEL =
  "text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500";

export function OfferControls({
  offerId,
  status,
  payoutMethod,
  payoutReference,
  notes,
  payoutMethods,
  statuses,
}: {
  offerId: string;
  status: string;
  payoutMethod: string | null;
  payoutReference: string | null;
  notes: string | null;
  payoutMethods: Option[];
  statuses: Option[];
}) {
  const router = useRouter();
  const [isStatus, startStatus] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [method, setMethod] = useState(payoutMethod ?? "");
  const [reference, setReference] = useState(payoutReference ?? "");
  const [note, setNote] = useState(notes ?? "");

  const changeStatus = (next: string) => {
    if (next === status) return;
    if (
      next === "paid" &&
      !confirm(
        "Mark this offer paid? The included cards will be marked as sold.",
      )
    ) {
      return;
    }
    setError(null);
    startStatus(async () => {
      const r = await updateOfferStatusAction(offerId, next);
      if (r && "error" in r && r.error) setError(r.error);
      else router.refresh();
    });
  };

  const saveDetails = () => {
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("payout_method", method);
    fd.set("payout_reference", reference);
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
        <div className="mt-2 flex flex-wrap gap-2">
          {statuses.map((s) => {
            const active = s.value === status;
            return (
              <button
                key={s.value}
                type="button"
                disabled={isStatus || active}
                onClick={() => changeStatus(s.value)}
                className={`rounded-none px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition disabled:opacity-100 ${
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
          <p className="mt-2 text-xs text-zinc-500">
            Included cards have been marked sold.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col">
          <label className={LABEL}>Payout method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className={`mt-1 ${INPUT}`}
          >
            <option value="">— not set —</option>
            {payoutMethods.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className={LABEL}>Payout reference</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Transaction ID, check #, etc."
            className={`mt-1 ${INPUT}`}
          />
        </div>
      </div>

      <div>
        <label className={LABEL}>Notes</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className={`mt-1 w-full ${INPUT}`}
        />
      </div>

      {error && (
        <p className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {saved && !error && <p className="text-xs text-emerald-600">Saved.</p>}

      <button
        type="button"
        onClick={saveDetails}
        disabled={isSaving}
        className="rounded-none bg-black px-5 py-3 text-xs font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {isSaving ? "Saving…" : "Save details"}
      </button>
    </section>
  );
}
