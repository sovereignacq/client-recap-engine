import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRole, isStaff } from "@/lib/roles";
import { isAIConfigured } from "@/lib/ai/client";
import {
  cardTitle,
  formatMoneyCents,
  labelFor,
  CARD_STATUSES,
  CARD_INTENTS,
  ID_STATUSES,
  GRADING_SUB_STATUSES,
} from "@/lib/cards";
import { CardEditForm } from "./card-edit-form";
import { DeleteCardButton } from "./delete-button";
import { SubmitGrading } from "./grade-submit";
import {
  GradeReportView,
  GradeFlawMap,
  type GradeReportData,
} from "../grade-report";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const staff = isStaff(await getRole());

  const { data: card } = await supabase
    .from("cards")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("archived_at", null)
    .maybeSingle();

  if (!card) notFound();

  const { data: submitters } = await supabase
    .from("submitters")
    .select("id, name")
    .eq("owner_id", user.id)
    .order("name", { ascending: true });

  const submitter = card.submitter_id
    ? (await supabase
        .from("submitters")
        .select("id, name")
        .eq("id", card.submitter_id)
        .maybeSingle()).data
    : null;

  async function signedUrl(path: string | null): Promise<string | null> {
    if (!path) return null;
    const { data } = await supabase.storage
      .from("card-images")
      .createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? null;
  }
  const [imageUrl, imageBackUrl] = await Promise.all([
    signedUrl(card.image_path),
    signedUrl(card.image_back_path),
  ]);

  const gradeReport = (card.grade_report as GradeReportData | null) ?? null;
  const gradeReportFlaws = gradeReport?.flaws ?? [];

  // Grading: existing submission for this card + currently-open graders.
  const { data: gradingSub } = await supabase
    .from("grading_submissions")
    .select(
      "status, turnaround, declared_value_cents, service_fee_cents, grader_fee_cents, tracking_in, tracking_out, grade_result, created_at, company:grading_companies(name)",
    )
    .eq("card_id", card.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const subCompany = gradingSub
    ? Array.isArray(gradingSub.company)
      ? gradingSub.company[0]
      : gradingSub.company
    : null;
  const { data: openGraders } = await supabase
    .from("grading_companies")
    .select("key, name, turnaround_days")
    .eq("accepting", true)
    .order("sort_order", { ascending: true });
  const { data: memberDiscount } = await supabase.rpc(
    "current_member_discount_pct",
  );
  const { data: availableCredits } = await supabase.rpc(
    "available_grading_credits",
  );

  // Intake cards only (game pulls have status 'won'); not already in transit.
  const gradable = !["won", "grading", "shipping", "shipped", "sold"].includes(
    card.status,
  );

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <Link
          href="/dashboard/cards"
          className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 hover:text-black dark:hover:text-white"
        >
          ← Cards
        </Link>

        <header className="space-y-1">
          <p className="font-mono text-sm text-zinc-500">{card.serial}</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {cardTitle(card)}
          </h1>
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            {labelFor(CARD_STATUSES, card.status)} ·{" "}
            {labelFor(CARD_INTENTS, card.intent)} ·{" "}
            {labelFor(ID_STATUSES, card.id_status)}
            {card.id_confidence !== null &&
              card.id_status !== "confirmed" &&
              ` (${Math.round(Number(card.id_confidence) * 100)}% match)`}
          </p>
        </header>

        <section className="grid grid-cols-1 gap-px border border-black/10 bg-black/10 sm:grid-cols-2 dark:border-white/15 dark:bg-white/15">
          <div className="bg-white p-5 dark:bg-black">
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
              Fair market value
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatMoneyCents(card.fmv_cents, card.fmv_currency)}
            </p>
            {card.fmv_notes && (
              <p className="mt-1 text-xs text-zinc-500">{card.fmv_notes}</p>
            )}
          </div>
          <div className="bg-white p-5 dark:bg-black">
            {staff ? (
              <>
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                  Submitter
                </p>
                {submitter ? (
                  <Link
                    href={`/dashboard/submitters/${submitter.id}`}
                    className="mt-2 inline-block text-lg font-medium hover:underline"
                  >
                    {submitter.name}
                  </Link>
                ) : (
                  <p className="mt-2 text-lg text-zinc-500">— none linked —</p>
                )}
              </>
            ) : (
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                Grade
              </p>
            )}
            <p className="mt-1 text-xs text-zinc-500">
              Grade: {card.grade || "—"}
            </p>
          </div>
        </section>

        {(imageUrl || imageBackUrl) &&
          (gradeReportFlaws.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {imageUrl && (
                <GradeFlawMap
                  imageUrl={imageUrl}
                  alt={`${card.serial} front`}
                  side="front"
                  flaws={gradeReportFlaws}
                />
              )}
              {imageBackUrl && (
                <GradeFlawMap
                  imageUrl={imageBackUrl}
                  alt={`${card.serial} back`}
                  side="back"
                  flaws={gradeReportFlaws}
                />
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {imageUrl && (
                <figure className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt={`${card.serial} front`}
                    className="max-h-80 w-auto border border-black/10 dark:border-white/15"
                  />
                  <figcaption className="text-[11px] uppercase tracking-[0.15em] text-zinc-400">
                    Front
                  </figcaption>
                </figure>
              )}
              {imageBackUrl && (
                <figure className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageBackUrl}
                    alt={`${card.serial} back`}
                    className="max-h-80 w-auto border border-black/10 dark:border-white/15"
                  />
                  <figcaption className="text-[11px] uppercase tracking-[0.15em] text-zinc-400">
                    Back
                  </figcaption>
                </figure>
              )}
            </div>
          ))}

        {card.grade_report && (
          <section className="border border-black/10 p-6 dark:border-white/15">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Grade assessment
            </p>
            <GradeReportView report={card.grade_report as GradeReportData} />
          </section>
        )}

        {/* Grading submission */}
        <section className="border border-black/10 p-6 dark:border-white/15">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Grading
          </p>
          {gradingSub ? (
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">
                  {subCompany?.name ?? "Grader"}
                </span>{" "}
                ·{" "}
                {labelFor(GRADING_SUB_STATUSES, gradingSub.status)}
                {gradingSub.grade_result
                  ? ` · graded ${gradingSub.grade_result}`
                  : ""}
              </p>
              <p className="text-xs text-zinc-500">
                Declared {formatMoneyCents(gradingSub.declared_value_cents)} ·
                service fee {formatMoneyCents(gradingSub.service_fee_cents)}
                {gradingSub.grader_fee_cents
                  ? ` · grader fee ${formatMoneyCents(gradingSub.grader_fee_cents)}`
                  : " · grader fee billed at cost"}
              </p>
              {(gradingSub.tracking_in || gradingSub.tracking_out) && (
                <p className="text-xs text-zinc-500">
                  {gradingSub.tracking_in
                    ? `To grader: ${gradingSub.tracking_in}`
                    : ""}
                  {gradingSub.tracking_out
                    ? ` · Back to you: ${gradingSub.tracking_out}`
                    : ""}
                </p>
              )}
            </div>
          ) : gradable ? (
            <SubmitGrading
              cardId={card.id}
              fmvCents={card.fmv_cents}
              companies={openGraders ?? []}
              discountPct={(memberDiscount as number) ?? 0}
              availableCredits={(availableCredits as number) ?? 0}
            />
          ) : (
            <p className="text-sm text-zinc-500">
              This card isn&apos;t eligible for grading submission (game pulls
              and cards already in transit can&apos;t be submitted).
            </p>
          )}
        </section>

        <section className="border border-black/10 p-6 dark:border-white/15">
          <CardEditForm
            cardId={card.id}
            submitters={submitters ?? []}
            aiConfigured={isAIConfigured()}
            staff={staff}
            initial={{
              category: card.category,
              sport_or_game: card.sport_or_game,
              player_or_character: card.player_or_character,
              card_year: card.card_year,
              manufacturer: card.manufacturer,
              set_name: card.set_name,
              card_number: card.card_number,
              variant: card.variant,
              id_status: card.id_status,
              grade: card.grade,
              fmv_cents: card.fmv_cents,
              fmv_notes: card.fmv_notes,
              intent: card.intent,
              status: card.status,
              submitter_id: card.submitter_id,
            }}
          />
        </section>

        <footer className="flex items-center justify-between pt-2 text-xs text-zinc-500">
          <span>Intake {new Date(card.created_at).toLocaleString()}</span>
          <DeleteCardButton cardId={card.id} serial={card.serial} />
        </footer>
      </div>
    </main>
  );
}
