"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CARD_CATEGORIES,
  CARD_INTENTS,
  CARD_STATUSES,
  formatMoneyCents,
} from "@/lib/cards";
import { updateCardAction, estimateFmvAction } from "../actions";

type Submitter = { id: string; name: string };

export type CardEditInitial = {
  category: string | null;
  sport_or_game: string | null;
  player_or_character: string | null;
  card_year: string | null;
  manufacturer: string | null;
  set_name: string | null;
  card_number: string | null;
  variant: string | null;
  id_status: string;
  grade: string | null;
  fmv_cents: number | null;
  fmv_notes: string | null;
  intent: string;
  status: string;
  submitter_id: string | null;
};

export function CardEditForm({
  cardId,
  initial,
  submitters,
  aiConfigured,
}: {
  cardId: string;
  initial: CardEditInitial;
  submitters: Submitter[];
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [isEstimating, startEstimate] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [f, setF] = useState({
    category: initial.category ?? "",
    sport_or_game: initial.sport_or_game ?? "",
    player_or_character: initial.player_or_character ?? "",
    card_year: initial.card_year ?? "",
    manufacturer: initial.manufacturer ?? "",
    set_name: initial.set_name ?? "",
    card_number: initial.card_number ?? "",
    variant: initial.variant ?? "",
    id_status: initial.id_status,
    grade: initial.grade ?? "",
    fmv:
      initial.fmv_cents !== null ? (initial.fmv_cents / 100).toFixed(2) : "",
    fmv_notes: initial.fmv_notes ?? "",
    intent: initial.intent,
    status: initial.status,
    submitter_id: initial.submitter_id ?? "",
  });

  const [estimate, setEstimate] = useState<{
    lowCents: number;
    highCents: number;
    confidence: number;
    rationale: string;
  } | null>(null);

  const set = (k: keyof typeof f, v: string) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const confirmed = f.id_status === "confirmed";
  const canEstimate =
    aiConfigured &&
    confirmed &&
    (f.player_or_character.trim() || f.set_name.trim());

  const handleEstimate = () => {
    setError(null);
    const fd = new FormData();
    fd.set("category", f.category);
    fd.set("sport_or_game", f.sport_or_game);
    fd.set("player_or_character", f.player_or_character);
    fd.set("card_year", f.card_year);
    fd.set("manufacturer", f.manufacturer);
    fd.set("set_name", f.set_name);
    fd.set("card_number", f.card_number);
    fd.set("variant", f.variant);
    fd.set("grade", f.grade);
    startEstimate(async () => {
      const r = await estimateFmvAction(fd);
      if (r.ok) {
        setEstimate({
          lowCents: r.lowCents,
          highCents: r.highCents,
          confidence: r.confidence,
          rationale: r.rationale,
        });
      } else {
        setError(r.error);
      }
    });
  };

  const handleSave = () => {
    setError(null);
    setSaved(false);
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.set(k, v));
    startSave(async () => {
      const r = await updateCardAction(cardId, fd);
      if (r && "error" in r && r.error) {
        setError(r.error);
      } else {
        setSaved(true);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Identification
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Category</label>
            <select
              value={f.category}
              onChange={(e) => set("category", e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">—</option>
              {CARD_CATEGORIES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <TextField label="Sport / game" value={f.sport_or_game} onChange={(v) => set("sport_or_game", v)} />
          <TextField label="Player / character" value={f.player_or_character} onChange={(v) => set("player_or_character", v)} />
          <TextField label="Year / season" value={f.card_year} onChange={(v) => set("card_year", v)} />
          <TextField label="Manufacturer" value={f.manufacturer} onChange={(v) => set("manufacturer", v)} />
          <TextField label="Set" value={f.set_name} onChange={(v) => set("set_name", v)} />
          <TextField label="Card number" value={f.card_number} onChange={(v) => set("card_number", v)} />
          <TextField label="Variant / parallel" value={f.variant} onChange={(v) => set("variant", v)} />
        </div>
        <label className="flex items-start gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => {
              set("id_status", e.target.checked ? "confirmed" : "ai_suggested");
              if (!e.target.checked) setEstimate(null);
            }}
            className="mt-0.5"
          />
          <span>Identification verified against the physical card.</span>
        </label>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Grade &amp; value
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Grade / condition" value={f.grade} onChange={(v) => set("grade", v)} placeholder="e.g. PSA 10, Raw — NM" />
          <div>
            <label className="text-sm font-medium">Fair market value (USD)</label>
            <input
              value={f.fmv}
              onChange={(e) => set("fmv", e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
        </div>

        {aiConfigured && (
          <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">AI value estimate</p>
              <button
                type="button"
                onClick={handleEstimate}
                disabled={!canEstimate || isEstimating}
                title={canEstimate ? undefined : "Confirm the identification first"}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                {isEstimating ? "Estimating…" : "Estimate value"}
              </button>
            </div>
            {estimate ? (
              <div className="mt-2 text-sm">
                <p>
                  Estimated range:{" "}
                  <span className="font-semibold tabular-nums">
                    {formatMoneyCents(estimate.lowCents)} – {formatMoneyCents(estimate.highCents)}
                  </span>{" "}
                  <span className="text-xs text-zinc-500">
                    ({Math.round(estimate.confidence * 100)}% confidence)
                  </span>
                </p>
                {estimate.rationale && (
                  <p className="mt-1 text-xs text-zinc-500">{estimate.rationale}</p>
                )}
                {estimate.highCents > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "fmv",
                        ((estimate.lowCents + estimate.highCents) / 2 / 100).toFixed(2),
                      )
                    }
                    className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Use midpoint as FMV
                  </button>
                )}
                <p className="mt-1 text-xs text-zinc-400">
                  Estimate from model knowledge, not a live market feed.
                </p>
              </div>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">
                Confirm the identification to enable an AI ballpark. You set the final value.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="text-sm font-medium">Value notes</label>
          <textarea
            value={f.fmv_notes}
            onChange={(e) => set("fmv_notes", e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Record
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium">Submitter</label>
            <select
              value={f.submitter_id}
              onChange={(e) => set("submitter_id", e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">— none —</option>
              {submitters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Intent</label>
            <select
              value={f.intent}
              onChange={(e) => set("intent", e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              {CARD_INTENTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Status</label>
            <select
              value={f.status}
              onChange={(e) => set("status", e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              {CARD_STATUSES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          Saved.
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
      >
        {isSaving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
    </div>
  );
}
