import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cardTitle } from "@/lib/cards";
import { NewOfferForm } from "./new-offer-form";

export default async function NewOfferPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The customer's own cards that are still available to sell us — exclude
  // house pool stock and cards already sold or in transit.
  const { data: cardRows } = await supabase
    .from("cards")
    .select(
      "id, fmv_cents, card_year, manufacturer, set_name, player_or_character, card_number, variant, status",
    )
    .eq("owner_id", user.id)
    .eq("in_inventory", false)
    .not("status", "in", "(sold,inventory,shipping,shipped)")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const cards = (cardRows ?? []).map((c) => ({
    id: c.id,
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
          <h1 className="text-3xl font-semibold tracking-tight">Sell cards to us</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Choose which of your cards to sell and set your asking price for each
            (defaults to FMV). We pay your APEX wallet once your cards arrive.
          </p>
        </div>

        <NewOfferForm cards={cards} />
      </div>
    </main>
  );
}
