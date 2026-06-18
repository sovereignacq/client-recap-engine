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
    .maybeSingle();

  if (!card) notFound();

  const { data: submitters } = await supabase
    .from("submitters")
    .select("id, name")
    .order("name", { ascending: true });

  const submitter = card.submitter_id
    ? (await supabase
        .from("submitters")
        .select("id, name")
        .eq("id", card.submitter_id)
        .maybeSingle()).data
    : null;

  let imageUrl: string | null = null;
  if (card.image_path) {
    const { data: signed } = await supabase.storage
      .from("card-images")
      .createSignedUrl(card.image_path, 60 * 60);
    imageUrl = signed?.signedUrl ?? null;
  }

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <Link
          href="/dashboard/cards"
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← Back to cards
        </Link>

        <header className="space-y-1">
          <p className="font-mono text-sm text-zinc-500">{card.serial}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {cardTitle(card)}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {labelFor(CARD_STATUSES, card.status)} ·{" "}
            {labelFor(CARD_INTENTS, card.intent)} ·{" "}
            {labelFor(ID_STATUSES, card.id_status)}
            {card.id_confidence !== null &&
              card.id_status !== "confirmed" &&
              ` (${Math.round(Number(card.id_confidence) * 100)}% AI)`}
          </p>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Fair market value
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatMoneyCents(card.fmv_cents, card.fmv_currency)}
            </p>
            {card.fmv_notes && (
              <p className="mt-1 text-xs text-zinc-500">{card.fmv_notes}</p>
            )}
          </div>
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Submitter
            </p>
            {submitter ? (
              <Link
                href={`/dashboard/submitters/${submitter.id}`}
                className="mt-1 inline-block text-lg font-medium hover:underline"
              >
                {submitter.name}
              </Link>
            ) : (
              <p className="mt-1 text-lg text-zinc-500">— none linked —</p>
            )}
            <p className="mt-1 text-xs text-zinc-500">
              Grade: {card.grade || "—"}
            </p>
          </div>
        </section>

        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={card.serial}
            className="max-h-80 w-auto rounded-lg border border-zinc-200 dark:border-zinc-800"
          />
        )}

        <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
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
          <span>
            Intake {new Date(card.created_at).toLocaleString()}
            {card.id_model ? ` · identified via ${card.id_model}` : ""}
          </span>
          <DeleteCardButton cardId={card.id} serial={card.serial} />
        </footer>
      </div>
    </main>
  );
}
