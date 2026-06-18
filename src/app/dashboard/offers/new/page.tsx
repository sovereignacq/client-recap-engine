import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cardTitle } from "@/lib/cards";
import { NewOfferForm } from "./new-offer-form";

export default async function NewOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ submitter?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { submitter } = await searchParams;

  const { data: submitters } = await supabase
    .from("submitters")
    .select("id, name")
    .order("name", { ascending: true });

  // Cards still available to sell (not already sold), with the info we need to
  // show a label and default amount.
  const { data: cardRows } = await supabase
    .from("cards")
    .select(
      "id, submitter_id, fmv_cents, card_year, manufacturer, set_name, player_or_character, card_number, variant, status",
    )
    .neq("status", "sold")
    .order("created_at", { ascending: false });

  const cards = (cardRows ?? []).map((c) => ({
    id: c.id,
    submitterId: c.submitter_id as string | null,
    fmvCents: c.fmv_cents as number | null,
    title: cardTitle(c),
  }));

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-14">
      <div className="w-full max-w-2xl space-y-8">
        <Link
          href="/dashboard/offers"
          className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 hover:text-black dark:hover:text-white"
        >
          ← Sell-to-us
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">New offer</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Pick a submitter, choose which of their cards to buy, and set the
            amount for each (defaults to FMV).
          </p>
        </div>

        <NewOfferForm
          submitters={submitters ?? []}
          cards={cards}
          defaultSubmitterId={submitter ?? null}
        />
      </div>
    </main>
  );
}
