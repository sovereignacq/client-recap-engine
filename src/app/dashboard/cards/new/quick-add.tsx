"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoneyCents } from "@/lib/cards";
import type { PokemonSearchResult } from "@/lib/pokemon";
import { quickCatalogSearchAction, quickAddCardAction } from "../actions";

/**
 * Quick collector intake — search the catalog (à la Collectr), tap a card and
 * it's added to your cards with name, artwork and market value pre-filled. No
 * photos, no grading. For people who just want to catalog what they own.
 */
export function QuickAdd() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PokemonSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [addedCount, setAddedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function search() {
    if (!query.trim()) return;
    setError(null);
    startSearch(async () => {
      const r = await quickCatalogSearchAction(query);
      setResults(r);
      setSearched(true);
    });
  }

  function add(catalogId: string) {
    setError(null);
    startAdd(async () => {
      const r = await quickAddCardAction(catalogId);
      if (r.ok) {
        setAddedIds((prev) => [...prev, catalogId]);
        setAddedCount((n) => n + 1);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search a card — name, set, number…"
          className="w-full rounded-none border border-black/20 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-black dark:border-white/25 dark:focus:border-white"
        />
        <button
          type="button"
          onClick={search}
          disabled={searching}
          className="shrink-0 rounded-none bg-black px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {searching ? "…" : "Search"}
        </button>
      </div>

      {addedCount > 0 && (
        <p className="border-l-2 border-emerald-500 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          Added {addedCount} card{addedCount === 1 ? "" : "s"} to your collection.{" "}
          <Link href="/dashboard/cards" className="underline underline-offset-2">
            View cards
          </Link>
        </p>
      )}
      {error && (
        <p className="border-l-2 border-red-500 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {results.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {results.map((c) => {
            const added = addedIds.includes(c.id);
            return (
              <li
                key={c.id}
                className="flex flex-col border border-black/10 p-2 dark:border-white/15"
              >
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.imageUrl}
                    alt={c.name}
                    className="mb-1.5 aspect-[3/4] w-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="mb-1.5 grid aspect-[3/4] w-full place-items-center bg-black/5 text-[9px] text-zinc-400 dark:bg-white/10">
                    No image
                  </div>
                )}
                <p className="truncate text-[11px] font-medium" title={c.name}>
                  {c.language !== "en" ? `[${c.language}] ` : ""}
                  {c.name}
                </p>
                <p className="truncate text-[10px] text-zinc-500">
                  {c.setName}
                  {c.number ? ` · #${c.number}` : ""}
                </p>
                <p className="text-[10px] text-zinc-500 tabular-nums">
                  {c.marketPriceCents != null
                    ? formatMoneyCents(c.marketPriceCents)
                    : "—"}
                </p>
                <button
                  type="button"
                  disabled={adding || added}
                  onClick={() => add(c.id)}
                  className="mt-1.5 rounded-none border border-black/20 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10"
                >
                  {added ? "Added ✓" : "Add"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : searched && !searching ? (
        <p className="border border-dashed border-black/20 p-10 text-center text-sm text-zinc-500 dark:border-white/20">
          No matches. Try a different name or set.
        </p>
      ) : (
        <p className="text-sm text-zinc-500">
          Search our catalog of Pokémon cards (English &amp; Japanese) and add the
          ones you own. Values come straight from market data — no photos needed.
        </p>
      )}
    </div>
  );
}
