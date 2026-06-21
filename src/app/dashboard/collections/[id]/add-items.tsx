"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoneyCents } from "@/lib/cards";
import type { PokemonSearchResult } from "@/lib/pokemon";
import {
  addApexCardAction,
  addPhysicalCardAction,
  searchCatalogAction,
} from "../actions";

export type OwnedCard = {
  id: string;
  title: string;
  fmvCents: number | null;
  imageUrl: string | null;
};

export function AddItems({
  collectionId,
  owned,
}: {
  collectionId: string;
  owned: OwnedCard[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"apex" | "physical">("apex");
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PokemonSearchResult[]>([]);
  const [searching, startSearch] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function addApex(cardId: string) {
    startTransition(async () => {
      const r = await addApexCardAction(collectionId, cardId);
      if (r?.error) setMsg(r.error);
      else router.refresh();
    });
  }
  function addPhysical(catalogId: string) {
    startTransition(async () => {
      const r = await addPhysicalCardAction(collectionId, catalogId, 1);
      if (r?.error) setMsg(r.error);
      else router.refresh();
    });
  }
  function search() {
    startSearch(async () => {
      setResults(await searchCatalogAction(query));
    });
  }

  const TAB = (active: boolean) =>
    `px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] transition ${
      active
        ? "bg-black text-white dark:bg-white dark:text-black"
        : "hover:bg-black/5 dark:hover:bg-white/10"
    }`;

  return (
    <section className="border border-black/10 p-5 dark:border-white/15">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
        Add a card
      </p>
      <div className="mt-3 inline-flex border border-black/15 dark:border-white/20">
        <button type="button" className={TAB(tab === "apex")} onClick={() => setTab("apex")}>
          My APEX cards
        </button>
        <button type="button" className={TAB(tab === "physical")} onClick={() => setTab("physical")}>
          Physical card
        </button>
      </div>

      {msg && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{msg}</p>}

      {tab === "apex" ? (
        owned.length > 0 ? (
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {owned.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 border border-black/10 px-3 py-2 dark:border-white/15"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{c.title}</p>
                  <p className="text-[11px] text-zinc-500 tabular-nums">
                    {formatMoneyCents(c.fmvCents)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => addApex(c.id)}
                  className="shrink-0 rounded-none border border-black/20 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">
            No APEX cards yet — pull or intake some, then add them here.
          </p>
        )
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Search a card you own…"
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
          {results.length > 0 && (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {results.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col border border-black/10 p-2 dark:border-white/15"
                >
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt={c.name} className="mb-1 aspect-[3/4] w-full object-contain" loading="lazy" />
                  ) : (
                    <div className="mb-1 grid aspect-[3/4] w-full place-items-center bg-black/5 text-[9px] text-zinc-400 dark:bg-white/10">
                      No image
                    </div>
                  )}
                  <p className="truncate text-[11px] font-medium" title={c.name}>
                    {c.language !== "en" ? `[${c.language}] ` : ""}
                    {c.name}
                  </p>
                  <p className="text-[10px] text-zinc-500 tabular-nums">
                    {c.marketPriceCents != null ? formatMoneyCents(c.marketPriceCents) : "—"}
                  </p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => addPhysical(c.id)}
                    className="mt-1 rounded-none border border-black/20 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
