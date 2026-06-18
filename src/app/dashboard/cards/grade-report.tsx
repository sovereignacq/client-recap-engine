/**
 * Presentational grade report — no hooks, so it works in both Server and
 * Client components. Renders the overall grade, subgrades, itemized flaws
 * (with locations), and the rationale.
 */

type Flaw = {
  area?: string;
  location?: string;
  description?: string;
  severity?: string;
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
  flaws?: Flaw[] | null;
  summary?: string | null;
};

const SEVERITY: Record<string, string> = {
  major: "border-red-500 text-red-700 dark:text-red-300",
  moderate: "border-amber-500 text-amber-700 dark:text-amber-300",
  minor: "border-zinc-400 text-zinc-600 dark:text-zinc-400",
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

export function GradeReportView({ report }: { report: GradeReportData }) {
  const flaws = report.flaws ?? [];
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
                className={`border-l-2 pl-3 text-sm ${SEVERITY[f.severity ?? "minor"] ?? SEVERITY.minor}`}
              >
                <span className="font-medium capitalize">{f.severity}</span>
                {f.location ? ` · ${f.location}` : ""}
                <span className="block text-zinc-600 dark:text-zinc-400">
                  {f.description}
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
        Preliminary grade from the submitted photos — a guide, not a substitute
        for in-hand inspection.
      </p>
    </div>
  );
}
