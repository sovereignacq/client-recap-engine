import Link from "next/link";
import { getHotlistAction } from "../inventory/actions";
import { HotlistClient, type HotlistPick } from "../inventory/hotlist-client";

export default async function AdminHotlistPage() {
  const picks = (await getHotlistAction(3)) as HotlistPick[];

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-5xl space-y-6">
        <div>
          <Link
            href="/admin/inventory"
            className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 hover:text-black dark:hover:text-white"
          >
            ← Inventory
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Hotlist</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Sought-after cards to acquire for each tier band — so every band has
            a desirable pull. Shows how many you already hold; pick a quantity to
            add straight to the pool.
          </p>
          <p className="mt-2 text-[11px] text-zinc-400">
            Ranked by chase rarity + popular characters + value (we don&apos;t have
            a TCGplayer stock/trending feed). Every active band is covered; cards
            shown fall within that band&apos;s value range. English cards only.
          </p>
        </div>

        {picks.length > 0 ? (
          <HotlistClient initial={picks} />
        ) : (
          <p className="border border-dashed border-black/20 p-10 text-center text-sm text-zinc-500 dark:border-white/20">
            No catalog matches yet.
          </p>
        )}
      </div>
    </main>
  );
}
