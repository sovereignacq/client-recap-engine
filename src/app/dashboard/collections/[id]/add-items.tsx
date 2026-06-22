"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoneyCents } from "@/lib/cards";
import type { PokemonSearchResult } from "@/lib/pokemon";
import {
  addApexCardAction,
  addPhysicalCardAction,
  addSlabAction,
  lookupSlabValueAction,
  searchCatalogAction,
} from "../actions";

export type OwnedCard = {
  id: string;
  title: string;
  fmvCents: number | null;
  imageUrl: string | null;
};

const GRADING_COMPANIES = ["PSA", "BGS", "CGC", "SGC", "TAG", "Other"];

export function AddItems({
  collectionId,
  owned,
}: {
  collectionId: string;
  owned: OwnedCard[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"apex" | "physical" | "slab">("apex");
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PokemonSearchResult[]>([]);
  const [searching, startSearch] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // Slab entry: picked catalog card + grading details.
  const [slabPick, setSlabPick] = useState<PokemonSearchResult | null>(null);
  const [slabCompany, setSlabCompany] = useState("PSA");
  const [slabGrade, setSlabGrade] = useState("10");
  const [slabCert, setSlabCert] = useState("");
  const [slabValueCents, setSlabValueCents] = useState<number | null>(null);
  const [valuing, startValue] = useTransition();

  // Pull the slab's value from the price database whenever the card/company/
  // grade changes.
  useEffect(() => {
    const p = slabPick;
    const g = slabGrade.trim();
    startValue(async () => {
      if (!p || !g) {
        setSlabValueCents(null);
        return;
      }
      setSlabValueCents(await lookupSlabValueAction(p.id, slabCompany, g));
    });
  }, [slabPick, slabCompany, slabGrade]);

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
  function addSlab() {
    if (!slabPick) return;
    setMsg(null);
    startTransition(async () => {
      const r = await addSlabAction(collectionId, {
        catalogId: slabPick.id,
        gradingCompany: slabCompany,
        grade: slabGrade,
        certNumber: slabCert || undefined,
      });
      if (r.ok) {
        setSlabPick(null);
        setSlabCert("");
        router.refresh();
      } else setMsg(r.error);
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
      <div className="mt-3 inline-flex flex-wrap border border-black/15 dark:border-white/20">
        <button type="button" className={TAB(tab === "apex")} onClick={() => setTab("apex")}>
          My APEX cards
        </button>
        <button type="button" className={TAB(tab === "physical")} onClick={() => setTab("physical")}>
          Physical card
        </button>
        <button type="button" className={TAB(tab === "slab")} onClick={() => setTab("slab")}>
          Slab
        </button>
      </div>

      {msg && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{msg}</p>}

      {tab === "slab" && slabPick && (
        <div className="mt-4 space-y-3 border border-black/10 p-3 dark:border-white/15">
          <div className="flex items-center gap-3">
            {slabPick.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slabPick.imageUrl} alt="" className="h-16 w-12 object-contain" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{slabPick.name}</p>
              <button
                type="button"
                onClick={() => setSlabPick(null)}
                className="text-[10px] uppercase tracking-[0.12em] text-zinc-500 underline-offset-2 hover:underline"
              >
                Change card
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={slabCompany}
              onChange={(e) => setSlabCompany(e.target.value)}
              className="rounded-none border border-black/20 bg-transparent px-2 py-2 text-sm outline-none focus:border-black dark:border-white/25 dark:focus:border-white"
            >
              {GRADING_COMPANIES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <input
              value={slabGrade}
              onChange={(e) => setSlabGrade(e.target.value)}
              placeholder="Grade (e.g. 10)"
              className="rounded-none border border-black/20 bg-transparent px-2 py-2 text-sm outline-none focus:border-black dark:border-white/25 dark:focus:border-white"
            />
            <input
              value={slabCert}
              onChange={(e) => setSlabCert(e.target.value)}
              placeholder="Cert # (optional)"
              className="col-span-2 rounded-none border border-black/20 bg-transparent px-2 py-2 text-sm outline-none focus:border-black dark:border-white/25 dark:focus:border-white"
            />
          </div>
          <p className="text-sm">
            <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
              Value{" "}
            </span>
            <span className="font-semibold tabular-nums">
              {valuing
                ? "…"
                : slabValueCents != null
                  ? formatMoneyCents(slabValueCents)
                  : "—"}
            </span>
            <span className="ml-2 text-[11px] text-zinc-500">
              auto-priced from the slab database
            </span>
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={addSlab}
            className="rounded-none bg-black px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {pending ? "Adding…" : "Add slab"}
          </button>
        </div>
      )}

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
                    onClick={() =>
                      tab === "slab" ? setSlabPick(c) : addPhysical(c.id)
                    }
                    className="mt-1 rounded-none border border-black/20 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10"
                  >
                    {tab === "slab" ? "Select" : "Add"}
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
