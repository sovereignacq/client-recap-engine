import { createClient } from "@/lib/supabase/server";
import { cardTitle, formatMoneyCents, labelFor, GRADING_SUB_STATUSES } from "@/lib/cards";
import { GradingControl, GraderToggle } from "./grading-control";

type SubRow = {
  id: string;
  status: string;
  turnaround: string;
  declared_value_cents: number;
  service_fee_cents: number;
  grader_fee_cents: number | null;
  tracking_in: string | null;
  tracking_out: string | null;
  grade_result: string | null;
  created_at: string;
  company_key: string;
  card:
    | {
        serial: string | null;
        card_year: string | null;
        manufacturer: string | null;
        set_name: string | null;
        player_or_character: string | null;
        card_number: string | null;
        variant: string | null;
      }
    | null;
};

export default async function AdminGradingPage() {
  const supabase = await createClient();

  const { data: companies } = await supabase
    .from("grading_companies")
    .select("key, name, accepting")
    .order("sort_order", { ascending: true });

  const { data } = await supabase
    .from("grading_submissions")
    .select(
      "id, status, turnaround, declared_value_cents, service_fee_cents, grader_fee_cents, tracking_in, tracking_out, grade_result, created_at, company_key, card:cards(serial, card_year, manufacturer, set_name, player_or_character, card_number, variant)",
    )
    .order("created_at", { ascending: false });

  const rows: SubRow[] = (data ?? []).map((r) => ({
    ...r,
    card: Array.isArray(r.card) ? (r.card[0] ?? null) : r.card,
  })) as SubRow[];

  const open = rows.filter(
    (r) => !["completed", "returned", "canceled"].includes(r.status),
  );

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-5xl space-y-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Grading</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {open.length} open of {rows.length} submissions. Toggle which graders
            accept submissions and advance each card through grading.
          </p>
        </div>

        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Grader availability
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(companies ?? []).map((c) => (
              <GraderToggle
                key={c.key}
                graderKey={c.key}
                name={c.name}
                accepting={c.accepting}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Submissions
          </h2>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No submissions yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="border border-black/10 p-4 dark:border-white/15"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {r.card ? cardTitle(r.card) : "Card"}
                      </p>
                      <p className="font-mono text-xs text-zinc-500">
                        {r.card?.serial ?? "—"} · {r.company_key.toUpperCase()} ·{" "}
                        {labelFor(GRADING_SUB_STATUSES, r.status)} · {r.turnaround}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Declared {formatMoneyCents(r.declared_value_cents)} ·
                        service {formatMoneyCents(r.service_fee_cents)} · grader{" "}
                        {r.grader_fee_cents != null
                          ? formatMoneyCents(r.grader_fee_cents)
                          : "—"}
                      </p>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/15">
                    <GradingControl
                      id={r.id}
                      status={r.status}
                      graderFeeCents={r.grader_fee_cents}
                      trackingIn={r.tracking_in}
                      trackingOut={r.tracking_out}
                      grade={r.grade_result}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
