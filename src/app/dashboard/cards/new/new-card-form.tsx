"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CARD_CATEGORIES,
  CARD_INTENTS,
  CARD_STATUSES,
  formatMoneyCents,
} from "@/lib/cards";
import {
  identifyCardAction,
  estimateFmvAction,
  createCardAction,
} from "../actions";

type Submitter = { id: string; name: string };

type Identification = {
  category: string;
  sportOrGame: string;
  playerOrCharacter: string;
  cardYear: string;
  manufacturer: string;
  setName: string;
  cardNumber: string;
  variant: string;
};

const EMPTY_ID: Identification = {
  category: "",
  sportOrGame: "",
  playerOrCharacter: "",
  cardYear: "",
  manufacturer: "",
  setName: "",
  cardNumber: "",
  variant: "",
};

type Estimate = {
  lowCents: number;
  highCents: number;
  confidence: number;
  rationale: string;
};

export function NewCardForm({
  submitters,
  defaultSubmitterId,
  aiConfigured,
}: {
  submitters: Submitter[];
  defaultSubmitterId: string | null;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"upload" | "details">("upload");

  const [isIdentifying, startIdentify] = useTransition();
  const [isEstimating, startEstimate] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Identification
  const [id, setId] = useState<Identification>(EMPTY_ID);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [idNotes, setIdNotes] = useState("");
  const [idModel, setIdModel] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Image
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Value
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [fmv, setFmv] = useState("");
  const [fmvNotes, setFmvNotes] = useState("");

  // Workflow / record
  const [submitterId, setSubmitterId] = useState(defaultSubmitterId ?? "");
  const [intent, setIntent] = useState("grade");
  const [status, setStatus] = useState("received");
  const [grade, setGrade] = useState("");

  const setIdField = (k: keyof Identification, v: string) =>
    setId((prev) => ({ ...prev, [k]: v }));

  const handleIdentify = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startIdentify(async () => {
      const r = await identifyCardAction(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setImagePath(r.imagePath);
      setPreviewUrl(r.previewUrl);
      setIdModel(r.model);
      if (r.aiError) {
        setError(
          `Photo saved, but identification failed: ${r.aiError}. Enter the details manually.`,
        );
        setConfidence(null);
      } else {
        const i = r.identification;
        setId({
          category: i.category,
          sportOrGame: i.sportOrGame,
          playerOrCharacter: i.playerOrCharacter,
          cardYear: i.cardYear,
          manufacturer: i.manufacturer,
          setName: i.setName,
          cardNumber: i.cardNumber,
          variant: i.variant,
        });
        setConfidence(i.confidence);
        setIdNotes(i.notes);
      }
      setPhase("details");
    });
  };

  const handleManual = () => {
    setError(null);
    setId(EMPTY_ID);
    setConfidence(null);
    setIdNotes("");
    setIdModel(null);
    setImagePath(null);
    setPreviewUrl(null);
    setPhase("details");
  };

  const handleEstimate = () => {
    setError(null);
    const fd = new FormData();
    fd.set("category", id.category);
    fd.set("sport_or_game", id.sportOrGame);
    fd.set("player_or_character", id.playerOrCharacter);
    fd.set("card_year", id.cardYear);
    fd.set("manufacturer", id.manufacturer);
    fd.set("set_name", id.setName);
    fd.set("card_number", id.cardNumber);
    fd.set("variant", id.variant);
    fd.set("grade", grade);
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
    const fd = new FormData();
    fd.set("category", id.category);
    fd.set("sport_or_game", id.sportOrGame);
    fd.set("player_or_character", id.playerOrCharacter);
    fd.set("card_year", id.cardYear);
    fd.set("manufacturer", id.manufacturer);
    fd.set("set_name", id.setName);
    fd.set("card_number", id.cardNumber);
    fd.set("variant", id.variant);
    fd.set("grade", grade);
    fd.set("intent", intent);
    fd.set("status", status);
    fd.set("submitter_id", submitterId);
    fd.set("fmv", fmv);
    fd.set("fmv_notes", fmvNotes);
    fd.set("id_status", confirmed ? "confirmed" : confidence !== null ? "ai_suggested" : "unidentified");
    if (confidence !== null) fd.set("id_confidence", String(confidence));
    if (idModel) fd.set("id_model", idModel);
    if (imagePath) fd.set("image_path", imagePath);
    // Store the identification snapshot for the record/audit trail.
    fd.set(
      "id_raw",
      JSON.stringify({ ...id, confidence, notes: idNotes, model: idModel }),
    );
    startSave(async () => {
      const r = await createCardAction(fd);
      if (r.ok) {
        router.push(`/dashboard/cards/${r.id}`);
      } else {
        setError(r.error);
      }
    });
  };

  // ---------------- Upload phase ----------------
  if (phase === "upload") {
    return (
      <form onSubmit={handleIdentify} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Card photo</label>
          <input
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
            required={aiConfigured}
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800 dark:file:bg-white dark:file:text-zinc-900"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Clear, well-lit photo of the front. JPEG/PNG/WEBP/HEIC, max 10MB.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium">Hint (optional)</label>
          <input
            name="hint"
            placeholder="Anything the submitter told you — e.g. '2018 Prizm Luka rookie, silver'"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        {error && (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={!aiConfigured || isIdentifying}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            {isIdentifying ? "Identifying…" : "Identify card"}
          </button>
          <button
            type="button"
            onClick={handleManual}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Enter manually instead
          </button>
        </div>
      </form>
    );
  }

  // ---------------- Details phase ----------------
  const lowConfidence = confidence !== null && confidence < 0.6;
  const canEstimate =
    confirmed && (id.playerOrCharacter.trim() || id.setName.trim());

  return (
    <div className="space-y-6">
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Card"
          className="max-h-72 w-auto rounded-lg border border-zinc-200 dark:border-zinc-800"
        />
      )}

      {confidence !== null && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            lowConfidence
              ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
              : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          }`}
        >
          AI identification confidence:{" "}
          <span className="font-semibold">
            {Math.round(confidence * 100)}%
          </span>
          {lowConfidence && " — low. Verify every field against the card before confirming."}
          {idNotes && <p className="mt-1 text-xs opacity-90">{idNotes}</p>}
        </div>
      )}

      {/* Identification */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Identification
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Category</label>
            <select
              value={id.category}
              onChange={(e) => setIdField("category", e.target.value)}
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
          <TextField
            label="Sport / game"
            value={id.sportOrGame}
            onChange={(v) => setIdField("sportOrGame", v)}
          />
          <TextField
            label="Player / character"
            value={id.playerOrCharacter}
            onChange={(v) => setIdField("playerOrCharacter", v)}
          />
          <TextField
            label="Year / season"
            value={id.cardYear}
            onChange={(v) => setIdField("cardYear", v)}
          />
          <TextField
            label="Manufacturer"
            value={id.manufacturer}
            onChange={(v) => setIdField("manufacturer", v)}
          />
          <TextField
            label="Set"
            value={id.setName}
            onChange={(v) => setIdField("setName", v)}
          />
          <TextField
            label="Card number"
            value={id.cardNumber}
            onChange={(v) => setIdField("cardNumber", v)}
          />
          <TextField
            label="Variant / parallel"
            value={id.variant}
            onChange={(v) => setIdField("variant", v)}
          />
        </div>

        <label className="flex items-start gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => {
              setConfirmed(e.target.checked);
              if (!e.target.checked) setEstimate(null);
            }}
            className="mt-0.5"
          />
          <span>
            I&apos;ve verified this identification against the physical card.
            <span className="block text-xs text-zinc-500">
              Required before estimating a value — prevents pricing the wrong card.
            </span>
          </span>
        </label>
      </section>

      {/* Grade + value */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Grade &amp; value
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Grade / condition"
            value={grade}
            onChange={setGrade}
            placeholder="e.g. PSA 10, BGS 9.5, Raw — NM"
          />
          <div>
            <label className="text-sm font-medium">
              Fair market value (USD)
            </label>
            <input
              value={fmv}
              onChange={(e) => setFmv(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">AI value estimate</p>
            <button
              type="button"
              onClick={handleEstimate}
              disabled={!canEstimate || isEstimating}
              title={
                canEstimate
                  ? undefined
                  : "Confirm the identification first"
              }
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
                  {formatMoneyCents(estimate.lowCents)} –{" "}
                  {formatMoneyCents(estimate.highCents)}
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
                  onClick={() => {
                    const mid = (estimate.lowCents + estimate.highCents) / 2;
                    setFmv((mid / 100).toFixed(2));
                  }}
                  className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  Use midpoint as FMV
                </button>
              )}
              <p className="mt-1 text-xs text-zinc-400">
                Estimate from model knowledge, not a live market feed. Verify
                before relying on it.
              </p>
            </div>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">
              Confirm the identification, then estimate a ballpark range. You
              always set the final value yourself.
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Value notes</label>
          <textarea
            value={fmvNotes}
            onChange={(e) => setFmvNotes(e.target.value)}
            rows={2}
            placeholder="Where the value came from — eBay sold comps, agreed payout, etc."
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
      </section>

      {/* Record */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Record
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium">Submitter</label>
            <select
              value={submitterId}
              onChange={(e) => setSubmitterId(e.target.value)}
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
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
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
              value={status}
              onChange={(e) => setStatus(e.target.value)}
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
        {submitters.length === 0 && (
          <p className="text-xs text-zinc-500">
            No submitters yet — you can save without one and link it later.
          </p>
        )}
      </section>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
        >
          {isSaving ? "Saving…" : "Save & serialize card"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPhase("upload");
            setError(null);
          }}
          disabled={isSaving}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Start over
        </button>
      </div>
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
