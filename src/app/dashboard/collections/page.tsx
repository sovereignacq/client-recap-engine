import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoneyCents } from "@/lib/cards";
import { NewCollection } from "./new-collection";

type Row = {
  id: string;
  name: string;
  item_count: number;
  total_cents: number;
  cover_images: string[] | null;
};

export default async function CollectionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.rpc("my_collections_view");
  const list = (data ?? []) as Row[];
  const portfolio = list.reduce((s, c) => s + Number(c.total_cents || 0), 0);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-3xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Collections</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Track what your cards are worth — pulls and physical cards together.
            Values update with live market data.
          </p>
          <div className="mt-4 border border-black/10 p-5 dark:border-white/15">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Portfolio value
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {formatMoneyCents(portfolio)}
            </p>
            <p className="text-[11px] text-zinc-500">
              across {list.length} collection{list.length === 1 ? "" : "s"}
            </p>
          </div>
        </header>

        <NewCollection />

        {list.length > 0 ? (
          <ul className="border border-black/10 dark:border-white/15">
            {list.map((c) => (
              <li
                key={c.id}
                className="border-b border-black/10 last:border-0 dark:border-white/15"
              >
                <Link
                  href={`/dashboard/collections/${c.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-950"
                >
                  <div className="flex shrink-0 -space-x-3">
                    {(c.cover_images ?? []).slice(0, 4).map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt=""
                        loading="lazy"
                        className="h-14 w-10 rounded-sm border border-black/10 bg-white object-contain shadow-sm dark:border-white/15 dark:bg-black"
                      />
                    ))}
                    {(c.cover_images ?? []).length === 0 && (
                      <div className="grid h-14 w-10 place-items-center rounded-sm border border-dashed border-black/15 text-[8px] uppercase tracking-widest text-zinc-400 dark:border-white/20">
                        Empty
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                      {c.item_count} card{c.item_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatMoneyCents(Number(c.total_cents || 0))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border border-dashed border-black/20 p-12 text-center text-sm text-zinc-500 dark:border-white/20">
            No collections yet. Create one to start tracking your portfolio.
          </p>
        )}
      </div>
    </main>
  );
}
