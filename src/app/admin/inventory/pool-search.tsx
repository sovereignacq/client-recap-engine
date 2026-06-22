"use client";

import { useState, useTransition } from "react";
import { formatMoneyCents } from "@/lib/cards";
import {
  searchPoolCardsAction,
  addPoolCardFromSearchAction,
  poolStockAction,
} from "./actions";
import type { PokemonSearchResult } from "@/lib/pokemon";

export function PoolSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PokemonSearchResult[]>([]);
  const [searching, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();
  const [stock, setStock] = useState<Record<string, number>>({});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [addingId, setAddingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function search() {
    setMsg(null);
    startSearch(async () => {
      const res = await searchPoolCardsAction(query);
      if (res.ok) {
        setResults(res.results);
        if (res.results.length === 0) setMsg("No matches — try a different name.");
        // Fetch current pool counts for these cards.
        const counts = await poolStockAction(res.results.map((r) => r.id));
        setStock(counts);
      } else {
        setMsg(res.error);
      }
    });
  }

  const getQty = (id: string) => qty[id] ?? 1;
  const setCardQty = (id: string, v: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(1, Math.min(100, v || 1)) }));

  function add(card: PokemonSearchResult) {
    setMsg(null);
    setAddingId(card.id);
    const n = getQty(card.id);
    startAdd(async () => {
      const res = await addPoolCardFromSearchAction(card, n);
      setAddingId(null);
      if (res.ok) {
        setStock((s) => ({ ...s, [card.id]: (s[card.id] ?? 0) + res.added }));
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
          Search the card database. Each result shows how many copies are already
          in your pool — pick a quantity and add that many at once.
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
            const inPool = stock[c.id] ?? 0;
            const isAdding = adding && addingId === c.id;
            return (
              <li
                key={c.id}
                className="flex flex-col border border-black/10 p-2 dark:border-white/15"
              >
                <div className="relative">
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
                  <span
                    className={`absolute right-1 top-1 rounded-none border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
                      inPool > 0
                        ? "border-emerald-500/50 bg-black/70 text-emerald-300"
                        : "border-white/30 bg-black/70 text-zinc-300"
                    }`}
                  >
                    {inPool} in pool
                  </span>
                </div>
                <p className="flex items-center gap-1 truncate text-xs font-medium" title={c.name}>
                  {c.language && c.language !== "en" && (
                    <span className="shrink-0 border border-rose-500/50 px-1 text-[8px] font-bold uppercase tracking-[0.1em] text-rose-600 dark:text-rose-400">
                      {c.language}
                    </span>
                  )}
                  <span className="truncate">{c.name}</span>
                </p>
                <p className="truncate text-[10px] text-zinc-500">
                  {c.setName} · {c.number}
                </p>
                <p className="mt-0.5 text-xs font-semibold tabular-nums">
                  {c.marketPriceCents != null
                    ? formatMoneyCents(c.marketPriceCents)
                    : "No price"}
                </p>
                <div className="mt-2 flex items-stretch gap-1">
                  <div className="flex items-center border border-black/20 dark:border-white/25">
                    <button
                      type="button"
                      onClick={() => setCardQty(c.id, getQty(c.id) - 1)}
                      className="px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                      aria-label="Decrease"
                    >
                      −
                    </button>
                    <input
                      value={getQty(c.id)}
                      onChange={(e) =>
                        setCardQty(c.id, parseInt(e.target.value, 10))
                      }
                      inputMode="numeric"
                      className="w-9 bg-transparent text-center text-xs tabular-nums outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setCardQty(c.id, getQty(c.id) + 1)}
                      className="px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={isAdding}
                    onClick={() => add(c)}
                    className="flex-1 rounded-none border border-black/20 px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10"
                  >
                    {isAdding ? "…" : `Add ${getQty(c.id)}`}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
