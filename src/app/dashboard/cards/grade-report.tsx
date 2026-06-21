/**
 * Presentational grade report — no hooks, so it works in both Server and
 * Client components. Renders the overall grade, subgrades, PSA qualifiers,
 * itemized + numbered flaws (with locations), and the rationale. The companion
 * GradeFlawMap overlays the numbered flaws on the actual card photo.
 */

type FlawBox = { x: number; y: number; w: number; h: number };

type Flaw = {
  area?: string;
  location?: string;
  description?: string;
  severity?: string;
  side?: "front" | "back" | string;
  box?: FlawBox | null;
};

export type GradeReportData = {
  overall?: number | null;
  label?: string | null;
  centering?: number | null;
  corners?: number | null;
  edges?: number | null;
  surface?: number | null;
  centeringMeasurement?: string | null;
  photoQuality?: string | null;
  qualifiers?: string[] | null;
  flaws?: Flaw[] | null;
  summary?: string | null;
};

const SEVERITY: Record<string, string> = {
  major: "border-red-500 text-red-700 dark:text-red-300",
  moderate: "border-amber-500 text-amber-700 dark:text-amber-300",
  minor: "border-zinc-400 text-zinc-600 dark:text-zinc-400",
};

const BOX_COLOR: Record<string, string> = {
  major: "border-red-500",
  moderate: "border-amber-500",
  minor: "border-sky-400",
};
const MARK_COLOR: Record<string, string> = {
  major: "bg-red-500",
  moderate: "bg-amber-500",
  minor: "bg-sky-500",
};

const QUALIFIER_LABEL: Record<string, string> = {
  OC: "OC · Off-center",
  ST: "ST · Staining",
  PD: "PD · Print defect",
  OF: "OF · Out of focus",
  MC: "MC · Miscut",
  MK: "MK · Marks",
};

function Subgrade({ label, value }: { label: string; value: number | null | undefined }) {
  const v = typeof value === "number" ? value : null;
  const pct = v !== null ? (v / 10) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-zinc-500">
        <span>{label}</span>
        <span className="font-semibold tabular-nums text-black dark:text-white">
          {v !== null ? v : "—"}
        </span>
      </div>
      <div className="mt-1 h-1 w-full bg-black/10 dark:bg-white/15">
        <div className="h-full bg-black dark:bg-white" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Overlays numbered flaw boxes on one side's photo. Flaw numbers match the
 * positions in the full report flaw list (1-based), so the markers line up with
 * "Flaws found" below.
 */
export function GradeFlawMap({
  imageUrl,
  alt,
  side,
  flaws,
}: {
  imageUrl: string;
  alt: string;
  side: "front" | "back";
  flaws?: Flaw[] | null;
}) {
  const all = flaws ?? [];
  const marks = all
    .map((f, i) => ({ f, n: i + 1 }))
    .filter(({ f }) => (f.side ?? "front") === side && f.box);

  return (
    <figure className="space-y-1">
      <div className="relative inline-block leading-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={alt}
          className="max-h-96 w-auto border border-black/10 dark:border-white/15"
        />
        {marks.map(({ f, n }) => {
          const b = f.box!;
          const sev = f.severity ?? "minor";
          return (
            <div
              key={n}
              className={`absolute border-2 ${BOX_COLOR[sev] ?? BOX_COLOR.minor}`}
              style={{
                left: `${b.x * 100}%`,
                top: `${b.y * 100}%`,
                width: `${b.w * 100}%`,
                height: `${b.h * 100}%`,
              }}
              title={f.description ?? f.location ?? ""}
            >
              <span
                className={`absolute -left-2 -top-2 grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold text-white ${
                  MARK_COLOR[sev] ?? MARK_COLOR.minor
                }`}
              >
                {n}
              </span>
            </div>
          );
        })}
      </div>
      <figcaption className="text-[11px] uppercase tracking-[0.15em] text-zinc-400">
        {side === "front" ? "Front" : "Back"} · flaws mapped
      </figcaption>
    </figure>
  );
}

export function GradeReportView({ report }: { report: GradeReportData }) {
  const flaws = report.flaws ?? [];
  const qualifiers = (report.qualifiers ?? []).filter(Boolean);
  return (
    <div className="space-y-5">
      <div className="flex items-end gap-4">
        <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center border border-black/15 dark:border-white/20">
          <span className="text-3xl font-semibold tabular-nums leading-none">
            {report.overall ?? "—"}
          </span>
          <span className="mt-1 text-[9px] uppercase tracking-[0.15em] text-zinc-500">
            / 10
          </span>
        </div>
        <div>
          <p className="text-lg font-semibold uppercase tracking-[0.08em]">
            {report.label || "Ungraded"}
          </p>
          {report.centeringMeasurement && (
            <p className="text-xs text-zinc-500">
              Centering {report.centeringMeasurement}
            </p>
          )}
          {report.photoQuality && (
            <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-400">
              Photo quality: {report.photoQuality}
            </p>
          )}
        </div>
      </div>

      {qualifiers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {qualifiers.map((q) => (
            <span
              key={q}
              className="border border-amber-500/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300"
            >
              {QUALIFIER_LABEL[q] ?? q}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Subgrade label="Centering" value={report.centering} />
        <Subgrade label="Corners" value={report.corners} />
        <Subgrade label="Edges" value={report.edges} />
        <Subgrade label="Surface" value={report.surface} />
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Flaws found ({flaws.length})
        </p>
        {flaws.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {flaws.map((f, i) => (
              <li
                key={i}
                className={`flex gap-2 border-l-2 pl-3 text-sm ${SEVERITY[f.severity ?? "minor"] ?? SEVERITY.minor}`}
              >
                <span
                  className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white ${
                    MARK_COLOR[f.severity ?? "minor"] ?? MARK_COLOR.minor
                  }`}
                >
                  {i + 1}
                </span>
                <span>
                  <span className="font-medium capitalize">{f.severity}</span>
                  {f.location ? ` · ${f.location}` : ""}
                  <span className="block text-zinc-600 dark:text-zinc-400">
                    {f.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">No visible flaws called out.</p>
        )}
      </div>

      {report.summary && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Why this grade
          </p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {report.summary}
          </p>
        </div>
      )}

      <p className="text-[11px] text-zinc-400">
        Preliminary grade from the submitted photos using PSA standards — a
        guide, not a substitute for in-hand inspection.
      </p>
    </div>
  );
}
