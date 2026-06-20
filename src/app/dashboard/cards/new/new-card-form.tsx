"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CARD_CATEGORIES, CARD_INTENTS, formatMoneyCents } from "@/lib/cards";
import { createClient } from "@/lib/supabase/client";
import {
  identifyByPathsAction,
  estimateFmvAction,
  gradeByPathsAction,
  createCardAction,
  type IdentifyReference,
} from "../actions";
import type { GradeResult } from "@/lib/ai/client";
import { GradeReportView } from "../grade-report";

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

const BUCKET = "card-images";
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
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
  userId,
  staff,
}: {
  submitters: Submitter[];
  defaultSubmitterId: string | null;
  aiConfigured: boolean;
  userId: string;
  staff: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"upload" | "details">("upload");

  const [isIdentifying, startIdentify] = useTransition();
  const [isEstimating, startEstimate] = useTransition();
  const [isGrading, startGrade] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [gradeReport, setGradeReport] = useState<GradeResult | null>(null);

  // Files (uploaded straight to storage from the browser)
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [hint, setHint] = useState("");

  // Identification
  const [id, setId] = useState<Identification>(EMPTY_ID);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [idNotes, setIdNotes] = useState("");
  const [idModel, setIdModel] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [reference, setReference] = useState<IdentifyReference | null>(null);

  // Stored image paths + local previews
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
  const [stockInPool, setStockInPool] = useState(false);

  const setIdField = (k: keyof Identification, v: string) =>
    setId((prev) => ({ ...prev, [k]: v }));

  async function uploadToStorage(file: File): Promise<string> {
    const ext = EXT[file.type];
    if (!ext) throw new Error("Unsupported image type. Use JPEG, PNG, WEBP, or HEIC.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Image is too large (max 10MB).");
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const supabase = createClient();
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
    return path;
  }

  const handleIdentify = () => {
    setError(null);
    if (!frontFile) {
      setError("Add a photo of the front of the card.");
      return;
    }
    startIdentify(async () => {
      try {
        const frontPath = await uploadToStorage(frontFile);
        const backPath = backFile ? await uploadToStorage(backFile) : null;
        setImagePath(frontPath);
        setImageBackPath(backPath);
        setPreviewUrl(URL.createObjectURL(frontFile));
        setPreviewBackUrl(backFile ? URL.createObjectURL(backFile) : null);

        const r = await identifyByPathsAction({ frontPath, backPath, hint: hint.trim() || null });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setIdModel(r.model);
        setReference(r.reference);
        if (r.recognitionError) {
          setError("Photos saved, but automatic identification didn't return a result. Enter the details manually.");
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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong uploading the photo.");
      }
    });
  };

  const handleManual = () => {
    setError(null);
    setId(EMPTY_ID);
    setConfidence(null);
    setIdNotes("");
    setIdModel(null);
    setReference(null);
    setGradeReport(null);
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
    fd.set("grade", gradeReport?.label ?? "");
    if (reference?.marketPriceCents) {
      fd.set("reference_cents", String(reference.marketPriceCents));
    }
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

  const handleGrade = () => {
    if (!imagePath) {
      setError("Add photos and identify first — grading needs the card images.");
      return;
    }
    setError(null);
    startGrade(async () => {
      const r = await gradeByPathsAction({ frontPath: imagePath, backPath: imageBackPath });
      if (r.ok) {
        setGradeReport(r.grade);
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
    fd.set("intent", intent);
    if (stockInPool) fd.set("in_inventory", "1");
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
    fd.set("id_raw", JSON.stringify({ ...id, confidence, notes: idNotes, model: idModel }));
    if (gradeReport) {
      fd.set("grade_report", JSON.stringify(gradeReport));
      if (gradeReport.label) fd.set("auto_grade_label", gradeReport.label);
    }
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
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Uploader
            label="Front"
            required
            hint="Used to identify the card."
            file={frontFile}
            onChange={setFrontFile}
          />
          <Uploader
            label="Back"
            required={false}
            hint="Recommended — needed for accurate grading."
            file={backFile}
            onChange={setBackFile}
          />
        </div>

        <div>
          <label className={LABEL}>Hint (optional)</label>
          <input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="e.g. 2018 Prizm Luka rookie, silver"
            className={INPUT}
          />
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleIdentify}
            disabled={!aiConfigured || isIdentifying}
            className={BTN_PRIMARY}
          >
            {isIdentifying ? "Uploading & identifying…" : "Identify card"}
          </button>
          <button type="button" onClick={handleManual} className={BTN_GHOST}>
            Enter manually
          </button>
        </div>
      </div>
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

      {reference && (
        <div className="border border-black/15 p-4 dark:border-white/20">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            <span aria-hidden>✓</span> Verified match
          </p>
          <p className="mt-1.5 text-sm">{reference.label}</p>
          {reference.marketPriceCents !== null && (
            <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3 dark:border-white/15">
              <span className="text-sm">
                <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                  Market price
                </span>{" "}
                <span className="ml-1 font-semibold tabular-nums">
                  {formatMoneyCents(reference.marketPriceCents)}
                </span>
              </span>
              <button
                type="button"
                onClick={() =>
                  setFmv((reference.marketPriceCents! / 100).toFixed(2))
                }
                className="rounded-none border border-black/20 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
              >
                Use as FMV
              </button>
            </div>
          )}
          {reference.url && (
            <a
              href={reference.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-[11px] uppercase tracking-[0.12em] text-zinc-500 underline-offset-2 hover:underline"
            >
              View market data ↗
            </a>
          )}
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
        <div className="flex items-center justify-between gap-3">
          <h2 className={SECTION}>Grade &amp; value</h2>
          <button
            type="button"
            onClick={handleGrade}
            disabled={!imagePath || isGrading}
            title={imagePath ? undefined : "Grading needs the uploaded photos"}
            className="rounded-none border border-black/20 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 disabled:opacity-40 dark:border-white/25 dark:hover:bg-white/10"
          >
            {isGrading ? "Grading…" : gradeReport ? "Re-grade" : "Grade card"}
          </button>
        </div>

        {!imagePath && (
          <p className="text-xs text-zinc-500">
            Grading runs on the card photos. Use “Identify card” with photos to enable it.
          </p>
        )}

        {gradeReport && (
          <div className="border border-black/15 p-4 dark:border-white/20">
            <GradeReportView report={gradeReport} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Grade</label>
            <div className={`${INPUT} flex items-center text-zinc-500`}>
              {gradeReport
                ? `${gradeReport.overall} · ${gradeReport.label}`
                : "Run “Grade card” to assess"}
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">
              Set by the grade assessment — not editable.
            </p>
          </div>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>What should happen to it?</label>
            <select value={intent} onChange={(e) => setIntent(e.target.value)} className={INPUT}>
              {CARD_INTENTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-zinc-400">
              “Sell to us” means APEX TCG buys it from the owner at fair market value.
            </p>
          </div>
          <div>
            <label className={LABEL}>Owner / submitter (optional)</label>
            {submitters.length > 0 ? (
              <select value={submitterId} onChange={(e) => setSubmitterId(e.target.value)} className={INPUT}>
                <option value="">— not specified —</option>
                {submitters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className={`${INPUT} flex items-center justify-between text-zinc-500`}>
                <span>No submitters yet</span>
                <a
                  href="/dashboard/submitters/new"
                  target="_blank"
                  className="text-[11px] uppercase tracking-[0.12em] underline-offset-2 hover:underline"
                >
                  + Add
                </a>
              </div>
            )}
            <p className="mt-1 text-[11px] text-zinc-400">
              Who this card belongs to. Leave blank if it&apos;s your own stock.
            </p>
          </div>
        </div>
        {staff && (
          <label className="flex items-start gap-3 border border-black/15 px-4 py-3 text-sm dark:border-white/20">
            <input
              type="checkbox"
              checked={stockInPool}
              onChange={(e) => setStockInPool(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Stock this card in the pack pool (house inventory)
              <span className="block text-xs text-zinc-500">
                It becomes winnable from packs in its category. Needs an FMV.
              </span>
            </span>
          </label>
        )}
        <p className="text-[11px] text-zinc-400">
          Status is tracked automatically — newly graded cards start as “Graded,”
          others as “Received.”
        </p>
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
  label,
  required,
  hint,
  file,
  onChange,
}: {
  label: string;
  required: boolean;
  hint: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <label className="flex cursor-pointer flex-col gap-2 border border-dashed border-black/20 px-4 py-6 text-center transition hover:border-black dark:border-white/25 dark:hover:border-white">
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        {label}
        {!required && <span className="ml-1 normal-case tracking-normal text-zinc-400">(optional)</span>}
      </span>
      <span className="truncate text-sm">{file?.name ?? "Choose photo"}</span>
      <span className="text-[11px] text-zinc-400">{hint}</span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
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
