"use client";

import { useState, useTransition } from "react";
import { formatMoneyCents } from "@/lib/cards";
import {
  searchPoolCardsAction,
  addPoolCardFromSearchAction,
} from "./actions";
import type { PokemonSearchResult } from "@/lib/pokemon";

export function PoolSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PokemonSearchResult[]>([]);
  const [searching, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  function search() {
    setMsg(null);
    startSearch(async () => {
      const res = await searchPoolCardsAction(query);
      if (res.ok) {
        setResults(res.results);
        if (res.results.length === 0) setMsg("No matches — try a different name.");
      } else {
        setMsg(res.error);
      }
    });
  }

  function add(card: PokemonSearchResult) {
    setMsg(null);
    startAdd(async () => {
      const res = await addPoolCardFromSearchAction(card);
      if (res.ok) {
        setAddedIds((s) => new Set(s).add(card.id));
        if (!res.valued)
          setMsg(
            "Added, but no market price was available — set its value to make it packable.",
          );
      } else {
        setMsg(res.error);
      }
    });
  }

  return (
    <section className="space-y-4 border border-black/10 p-5 dark:border-white/15">
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Search &amp; add to pool
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Search the card database and add a card in one tap — its market price
          fills in automatically as the FMV. No photos or research needed.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="e.g. Charizard, Pikachu ex…"
          className="w-full rounded-none border border-black/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-black dark:border-white/25 dark:focus:border-white"
        />
        <button
          type="button"
          onClick={search}
          disabled={searching}
          className="shrink-0 rounded-none bg-black px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {searching ? "…" : "Search"}
        </button>
      </div>

      {msg && <p className="text-xs text-zinc-500">{msg}</p>}

      {results.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {results.map((c) => {
            const added = addedIds.has(c.id);
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
                    className="mb-2 aspect-[3/4] w-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="mb-2 grid aspect-[3/4] w-full place-items-center bg-black/5 text-[10px] text-zinc-400 dark:bg-white/10">
                    No image
                  </div>
                )}
                <p className="truncate text-xs font-medium" title={c.name}>
                  {c.name}
                </p>
                <p className="truncate text-[10px] text-zinc-500">
                  {c.setName} · {c.number}
                </p>
                <p className="mt-0.5 text-xs font-semibold tabular-nums">
                  {c.marketPriceCents != null
                    ? formatMoneyCents(c.marketPriceCents)
                    : "No price"}
                </p>
                <button
                  type="button"
                  disabled={adding || added}
                  onClick={() => add(c)}
                  className="mt-2 rounded-none border border-black/20 px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10"
                >
                  {added ? "Added ✓" : "Add to pool"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
