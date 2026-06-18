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

// Shared minimalist styles
const INPUT =
  "mt-1 w-full rounded-none border border-black/15 bg-transparent px-3 py-2.5 text-sm outline-none transition focus:border-black dark:border-white/20 dark:focus:border-white";
const LABEL =
  "text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500";
const SECTION =
  "text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400";
const BTN_PRIMARY =
  "inline-flex items-center justify-center rounded-none bg-black px-5 py-3 text-xs font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200";
const BTN_GHOST =
  "inline-flex items-center justify-center rounded-none border border-black/20 bg-transparent px-5 py-3 text-xs font-medium uppercase tracking-[0.15em] text-black transition hover:bg-black/5 disabled:opacity-40 dark:border-white/25 dark:text-white dark:hover:bg-white/10";

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

  // Images
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imageBackPath, setImageBackPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBackUrl, setPreviewBackUrl] = useState<string | null>(null);

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
      setImageBackPath(r.imageBackPath);
      setPreviewUrl(r.previewUrl);
      setPreviewBackUrl(r.previewBackUrl);
      setIdModel(r.model);
      if (r.recognitionError) {
        setError(
          `Photos saved, but automatic identification didn't return a result. Enter the details manually.`,
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
    setImageBackPath(null);
    setPreviewUrl(null);
    setPreviewBackUrl(null);
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
    fd.set(
      "id_status",
      confirmed ? "confirmed" : confidence !== null ? "ai_suggested" : "unidentified",
    );
    if (confidence !== null) fd.set("id_confidence", String(confidence));
    if (idModel) fd.set("id_model", idModel);
    if (imagePath) fd.set("image_path", imagePath);
    if (imageBackPath) fd.set("image_back_path", imageBackPath);
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
      <form onSubmit={handleIdentify} className="space-y-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Uploader
            name="image_front"
            label="Front"
            required={aiConfigured}
            hint="Used to identify the card."
          />
          <Uploader
            name="image_back"
            label="Back"
            required={false}
            hint="Recommended — needed for accurate grading."
          />
        </div>

        <div>
          <label className={LABEL}>Hint (optional)</label>
          <input
            name="hint"
            placeholder="e.g. 2018 Prizm Luka rookie, silver"
            className={INPUT}
          />
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={!aiConfigured || isIdentifying} className={BTN_PRIMARY}>
            {isIdentifying ? "Identifying…" : "Identify card"}
          </button>
          <button type="button" onClick={handleManual} className={BTN_GHOST}>
            Enter manually
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
    <div className="space-y-8">
      {(previewUrl || previewBackUrl) && (
        <div className="flex flex-wrap gap-3">
          {previewUrl && <Thumb src={previewUrl} label="Front" />}
          {previewBackUrl && <Thumb src={previewBackUrl} label="Back" />}
        </div>
      )}

      {confidence !== null && (
        <div
          className={`border-l-2 px-4 py-3 text-sm ${
            lowConfidence
              ? "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              : "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          }`}
        >
          Match confidence:{" "}
          <span className="font-semibold">{Math.round(confidence * 100)}%</span>
          {lowConfidence &&
            " — low. Verify every field against the card before confirming."}
          {idNotes && <p className="mt-1 text-xs opacity-90">{idNotes}</p>}
        </div>
      )}

      {/* Identification */}
      <section className="space-y-4">
        <h2 className={SECTION}>Identification</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Category</label>
            <select
              value={id.category}
              onChange={(e) => setIdField("category", e.target.value)}
              className={INPUT}
            >
              <option value="">—</option>
              {CARD_CATEGORIES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <TextField label="Sport / game" value={id.sportOrGame} onChange={(v) => setIdField("sportOrGame", v)} />
          <TextField label="Player / character" value={id.playerOrCharacter} onChange={(v) => setIdField("playerOrCharacter", v)} />
          <TextField label="Year / season" value={id.cardYear} onChange={(v) => setIdField("cardYear", v)} />
          <TextField label="Manufacturer" value={id.manufacturer} onChange={(v) => setIdField("manufacturer", v)} />
          <TextField label="Set" value={id.setName} onChange={(v) => setIdField("setName", v)} />
          <TextField label="Card number" value={id.cardNumber} onChange={(v) => setIdField("cardNumber", v)} />
          <TextField label="Variant / parallel" value={id.variant} onChange={(v) => setIdField("variant", v)} />
        </div>

        <label className="flex items-start gap-3 border border-black/15 px-4 py-3 text-sm dark:border-white/20">
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
        <h2 className={SECTION}>Grade &amp; value</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Grade / condition" value={grade} onChange={setGrade} placeholder="e.g. PSA 10, BGS 9.5, Raw — NM" />
          <div>
            <label className={LABEL}>Fair market value (USD)</label>
            <input
              value={fmv}
              onChange={(e) => setFmv(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className={INPUT}
            />
          </div>
        </div>

        <div className="border border-black/15 p-4 dark:border-white/20">
          <div className="flex items-center justify-between gap-3">
            <p className={LABEL}>Value estimate</p>
            <button
              type="button"
              onClick={handleEstimate}
              disabled={!canEstimate || isEstimating}
              title={canEstimate ? undefined : "Confirm the identification first"}
              className="rounded-none border border-black/20 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 disabled:opacity-40 dark:border-white/25 dark:hover:bg-white/10"
            >
              {isEstimating ? "Estimating…" : "Estimate"}
            </button>
          </div>
          {estimate ? (
            <div className="mt-3 text-sm">
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
                    setFmv(((estimate.lowCents + estimate.highCents) / 2 / 100).toFixed(2))
                  }
                  className="mt-2 text-xs underline underline-offset-2 hover:opacity-70"
                >
                  Use midpoint as FMV
                </button>
              )}
              <p className="mt-2 text-xs text-zinc-400">
                Estimate based on recent comparable sales, for reference only. You set the final value.
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">
              Confirm the identification, then estimate a ballpark range. You always set the final value.
            </p>
          )}
        </div>

        <div>
          <label className={LABEL}>Value notes</label>
          <textarea
            value={fmvNotes}
            onChange={(e) => setFmvNotes(e.target.value)}
            rows={2}
            placeholder="Where the value came from — sold comps, agreed payout, etc."
            className={INPUT}
          />
        </div>
      </section>

      {/* Record */}
      <section className="space-y-4">
        <h2 className={SECTION}>Record</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={LABEL}>Submitter</label>
            <select value={submitterId} onChange={(e) => setSubmitterId(e.target.value)} className={INPUT}>
              <option value="">— none —</option>
              {submitters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Intent</label>
            <select value={intent} onChange={(e) => setIntent(e.target.value)} className={INPUT}>
              {CARD_INTENTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={INPUT}>
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

      {error && <ErrorBox>{error}</ErrorBox>}

      <div className="flex gap-3 border-t border-black/10 pt-5 dark:border-white/15">
        <button type="button" onClick={handleSave} disabled={isSaving} className={BTN_PRIMARY}>
          {isSaving ? "Saving…" : "Save & serialize"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPhase("upload");
            setError(null);
          }}
          disabled={isSaving}
          className={BTN_GHOST}
        >
          Start over
        </button>
      </div>
    </div>
  );
}

function Uploader({
  name,
  label,
  required,
  hint,
}: {
  name: string;
  label: string;
  required: boolean;
  hint: string;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <label className="flex cursor-pointer flex-col gap-2 border border-dashed border-black/20 px-4 py-6 text-center transition hover:border-black dark:border-white/25 dark:hover:border-white">
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        {label}
        {!required && <span className="ml-1 normal-case tracking-normal text-zinc-400">(optional)</span>}
      </span>
      <span className="truncate text-sm">{fileName ?? "Choose photo"}</span>
      <span className="text-[11px] text-zinc-400">{hint}</span>
      <input
        name={name}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
        required={required}
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        className="sr-only"
      />
    </label>
  );
}

function Thumb({ src, label }: { src: string; label: string }) {
  return (
    <figure className="space-y-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className="max-h-56 w-auto border border-black/10 dark:border-white/15" />
      <figcaption className="text-[11px] uppercase tracking-[0.15em] text-zinc-400">
        {label}
      </figcaption>
    </figure>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
      {children}
    </p>
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
      <label className={LABEL}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={INPUT}
      />
    </div>
  );
}
