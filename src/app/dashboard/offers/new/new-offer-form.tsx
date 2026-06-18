"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoneyCents } from "@/lib/cards";
import { PAYOUT_METHODS } from "@/lib/offers";
import { createOfferAction } from "../actions";

type Submitter = { id: string; name: string };
type Card = {
  id: string;
  submitterId: string | null;
  fmvCents: number | null;
  title: string;
};

const INPUT =
  "rounded-none border border-black/15 bg-transparent px-3 py-2.5 text-sm outline-none transition focus:border-black dark:border-white/20 dark:focus:border-white";
const LABEL =
  "text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500";

export function NewOfferForm({
  submitters,
  cards,
  defaultSubmitterId,
}: {
  submitters: Submitter[];
  cards: Card[];
  defaultSubmitterId: string | null;
}) {
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [submitterId, setSubmitterId] = useState(defaultSubmitterId ?? "");
  const [payoutMethod, setPayoutMethod] = useState("");
  const [notes, setNotes] = useState("");
  // card id -> { selected, amount (dollar string) }
  const [picks, setPicks] = useState<
    Record<string, { selected: boolean; amount: string }>
  >({});

  const submitterCards = useMemo(
    () => cards.filter((c) => c.submitterId === submitterId),
    [cards, submitterId],
  );

  const dollars = (cents: number | null) =>
    cents !== null ? (cents / 100).toFixed(2) : "";

  const toggle = (card: Card, checked: boolean) =>
    setPicks((prev) => ({
      ...prev,
      [card.id]: {
        selected: checked,
        amount: prev[card.id]?.amount ?? dollars(card.fmvCents),
      },
    }));

  const setAmount = (cardId: string, amount: string) =>
    setPicks((prev) => ({
      ...prev,
      [cardId]: { selected: prev[cardId]?.selected ?? true, amount },
    }));

  const totalCents = useMemo(() => {
    return submitterCards.reduce((sum, c) => {
      const p = picks[c.id];
      if (!p?.selected) return sum;
      const n = Number((p.amount || "0").replace(/[$,]/g, ""));
      return sum + (Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0);
    }, 0);
  }, [submitterCards, picks]);

  const selectedCount = submitterCards.filter((c) => picks[c.id]?.selected).length;

  const handleSubmit = () => {
    setError(null);
    const fd = new FormData();
    fd.set("submitter_id", submitterId);
    fd.set("payout_method", payoutMethod);
    fd.set("notes", notes);
    submitterCards.forEach((c) => {
      const p = picks[c.id];
      if (p?.selected) {
        fd.set(`card_${c.id}`, "1");
        fd.set(`amount_${c.id}`, p.amount || "0");
      }
    });
    startSave(async () => {
      const r = await createOfferAction(fd);
      if (r.ok) router.push(`/dashboard/offers/${r.id}`);
      else setError(r.error);
    });
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col">
          <label className={LABEL}>Submitter</label>
          <select
            value={submitterId}
            onChange={(e) => setSubmitterId(e.target.value)}
            className={`mt-1 ${INPUT}`}
          >
            <option value="">— choose —</option>
            {submitters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className={LABEL}>Payout method</label>
          <select
            value={payoutMethod}
            onChange={(e) => setPayoutMethod(e.target.value)}
            className={`mt-1 ${INPUT}`}
          >
            <option value="">— not set —</option>
            {PAYOUT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!submitterId ? (
        <p className="border border-dashed border-black/20 p-8 text-center text-sm text-zinc-500 dark:border-white/20">
          Choose a submitter to see the cards you can buy from them.
        </p>
      ) : submitterCards.length === 0 ? (
        <p className="border border-dashed border-black/20 p-8 text-center text-sm text-zinc-500 dark:border-white/20">
          This submitter has no available (unsold) cards. Intake one first, or
          link an existing card to them.
        </p>
      ) : (
        <div className="border border-black/10 dark:border-white/15">
          {submitterCards.map((c) => {
            const p = picks[c.id];
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 border-b border-black/10 px-4 py-3 last:border-0 dark:border-white/15"
              >
                <input
                  type="checkbox"
                  checked={p?.selected ?? false}
                  onChange={(e) => toggle(c, e.target.checked)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{c.title}</p>
                  <p className="text-[11px] text-zinc-500">
                    FMV {formatMoneyCents(c.fmvCents)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-zinc-400">$</span>
                  <input
                    inputMode="decimal"
                    value={p?.amount ?? ""}
                    onChange={(e) => setAmount(c.id, e.target.value)}
                    placeholder={dollars(c.fmvCents) || "0.00"}
                    disabled={!p?.selected}
                    className={`w-24 ${INPUT} disabled:opacity-40`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <label className={LABEL}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={`mt-1 w-full ${INPUT}`}
        />
      </div>

      {error && (
        <p className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-black/10 pt-5 dark:border-white/15">
        <p className="text-sm">
          <span className={LABEL}>Offer total</span>
          <span className="ml-3 text-xl font-semibold tabular-nums">
            {formatMoneyCents(totalCents)}
          </span>
          <span className="ml-2 text-xs text-zinc-500">
            ({selectedCount} card{selectedCount === 1 ? "" : "s"})
          </span>
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving || selectedCount === 0}
          className="rounded-none bg-black px-5 py-3 text-xs font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {isSaving ? "Creating…" : "Create offer"}
        </button>
      </div>
    </div>
  );
}
