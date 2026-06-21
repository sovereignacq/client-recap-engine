import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cardTitle, formatMoneyCents } from "@/lib/cards";
import { AddItems, type OwnedCard } from "./add-items";
import { RemoveItem } from "./remove-item";

type Item = {
  item_id: string;
  kind: string;
  name: string;
  image_url: string | null;
  set_name: string | null;
  language: string;
  unit_cents: number;
  quantity: number;
};

export default async function CollectionDetailPage({
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

  const { data: col } = await supabase
    .from("collections")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!col) notFound();

  const { data: itemData } = await supabase.rpc("collection_items_view", {
    p_collection: id,
  });
  const items = (itemData ?? []) as Item[];
  const total = items.reduce((s, i) => s + i.unit_cents * i.quantity, 0);

  // The user's APEX-owned cards available to add (not pooled/archived).
  const { data: ownedRows } = await supabase
    .from("cards")
    .select(
      "id, player_or_character, card_year, manufacturer, set_name, card_number, variant, fmv_cents, image_url, status",
    )
    .eq("owner_id", user.id)
    .is("archived_at", null)
    .eq("in_inventory", false) // never offer house pool stock as personal cards
    .order("created_at", { ascending: false });
  const owned: OwnedCard[] = (ownedRows ?? []).map((c) => ({
    id: c.id,
    title: cardTitle(c),
    fmvCents: c.fmv_cents,
    imageUrl: c.image_url,
  }));

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-3xl space-y-8">
        <div>
          <Link
            href="/dashboard/collections"
            className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 hover:text-black dark:hover:text-white"
          >
            ← Collections
          </Link>
          <div className="mt-2 flex items-end justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">{col.name}</h1>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                Value
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatMoneyCents(total)}
              </p>
            </div>
          </div>
        </div>

        <AddItems collectionId={id} owned={owned} />

        {items.length > 0 ? (
          <ul className="border border-black/10 dark:border-white/15">
            {items.map((i) => (
              <li
                key={i.item_id}
                className="flex items-center gap-3 border-b border-black/10 px-4 py-3 last:border-0 dark:border-white/15"
              >
                {i.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={i.image_url}
                    alt=""
                    className="h-14 w-10 shrink-0 object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-14 w-10 shrink-0 bg-black/5 dark:bg-white/10" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {i.language !== "en" ? `[${i.language}] ` : ""}
                    {i.name}
                    {i.quantity > 1 ? ` ×${i.quantity}` : ""}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                    {i.kind === "apex" ? "APEX card" : "Physical"}
                    {i.set_name ? ` · ${i.set_name}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums">
                  {formatMoneyCents(i.unit_cents * i.quantity)}
                </span>
                <RemoveItem itemId={i.item_id} collectionId={id} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="border border-dashed border-black/20 p-10 text-center text-sm text-zinc-500 dark:border-white/20">
            Empty collection — add cards above.
          </p>
        )}
      </div>
    </main>
  );
}
