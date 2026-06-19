import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAIConfigured } from "@/lib/ai/client";
import {
  cardTitle,
  formatMoneyCents,
  labelFor,
  CARD_STATUSES,
  CARD_INTENTS,
  ID_STATUSES,
} from "@/lib/cards";
import { CardEditForm } from "./card-edit-form";
import { DeleteCardButton } from "./delete-button";
import { GradeReportView, type GradeReportData } from "../grade-report";

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

  const { data: card } = await supabase
    .from("cards")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
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
            <p className="mt-1 text-xs text-zinc-500">
              Grade: {card.grade || "—"}
            </p>
          </div>
        </section>

        {(imageUrl || imageBackUrl) && (
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
        )}

        {card.grade_report && (
          <section className="border border-black/10 p-6 dark:border-white/15">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Grade assessment
            </p>
            <GradeReportView report={card.grade_report as GradeReportData} />
          </section>
        )}

        <section className="border border-black/10 p-6 dark:border-white/15">
          <CardEditForm
            cardId={card.id}
            submitters={submitters ?? []}
            aiConfigured={isAIConfigured()}
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
