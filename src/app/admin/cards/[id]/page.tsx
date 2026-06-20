import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  cardTitle,
  formatMoneyCents,
  labelFor,
  CARD_STATUSES,
  CARD_INTENTS,
  ID_STATUSES,
} from "@/lib/cards";
import { GradeReportView, type GradeReportData } from "@/app/dashboard/cards/grade-report";
import { AdminCardStatusControl } from "./status-control";
import { AdminArchiveControl } from "./archive-control";

export default async function AdminCardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: card } = await supabase
    .from("cards")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!card) notFound();

  const { data: customer } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", card.owner_id)
    .maybeSingle();

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
          href="/admin/cards"
          className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 hover:text-black dark:hover:text-white"
        >
          ← Submissions
        </Link>

        {card.archived_at && (
          <p className="border-l-2 border-amber-500 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Archived {new Date(card.archived_at).toLocaleString()}
          </p>
        )}

        <header className="space-y-1">
          <p className="font-mono text-sm text-zinc-500">{card.serial}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{cardTitle(card)}</h1>
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            {labelFor(CARD_STATUSES, card.status)} · {labelFor(CARD_INTENTS, card.intent)} ·{" "}
            {labelFor(ID_STATUSES, card.id_status)}
          </p>
        </header>

        <section className="grid grid-cols-1 gap-px border border-black/10 bg-black/10 sm:grid-cols-3 dark:border-white/15 dark:bg-white/15">
          <div className="bg-white p-5 dark:bg-black">
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Customer</p>
            <p className="mt-2 truncate text-sm font-medium">{customer?.email ?? "—"}</p>
            {customer?.full_name && (
              <p className="text-xs text-zinc-500">{customer.full_name}</p>
            )}
          </div>
          <div className="bg-white p-5 dark:bg-black">
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Grade</p>
            <p className="mt-2 text-lg font-semibold">{card.auto_grade_label || "—"}</p>
          </div>
          <div className="bg-white p-5 dark:bg-black">
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">FMV</p>
            <p className="mt-2 text-lg font-semibold tabular-nums">
              {formatMoneyCents(card.fmv_cents, card.fmv_currency)}
            </p>
          </div>
        </section>

        {(imageUrl || imageBackUrl) && (
          <div className="flex flex-wrap gap-3">
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="front" className="max-h-72 w-auto border border-black/10 dark:border-white/15" />
            )}
            {imageBackUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageBackUrl} alt="back" className="max-h-72 w-auto border border-black/10 dark:border-white/15" />
            )}
          </div>
        )}

        <section className="border border-black/10 p-6 dark:border-white/15">
          <AdminCardStatusControl
            cardId={card.id}
            status={card.status}
            statuses={CARD_STATUSES.map((s) => ({ ...s }))}
          />
        </section>

        {card.grade_report && (
          <section className="border border-black/10 p-6 dark:border-white/15">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Grade assessment
            </p>
            <GradeReportView report={card.grade_report as GradeReportData} />
          </section>
        )}

        <footer className="flex justify-end pt-2">
          <AdminArchiveControl cardId={card.id} archived={!!card.archived_at} />
        </footer>
      </div>
    </main>
  );
}
