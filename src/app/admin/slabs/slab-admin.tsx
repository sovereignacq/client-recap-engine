"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoneyCents } from "@/lib/cards";
import type { PokemonSearchResult } from "@/lib/pokemon";
import {
  searchPoolCardsAction,
  addSlabToPoolAction,
} from "../inventory/actions";
import { adminToggleInventory } from "../actions";

const GRADING_COMPANIES = ["PSA", "BGS", "CGC", "SGC", "TAG", "Other"];

export type SlabRow = {
  id: string;
  name: string;
  company: string | null;
  grade: string | null;
  cert: string | null;
  valueCents: number | null;
  ownerEmail: string | null;
  inPool: boolean;
  imageUrl: string | null;
};

const INPUT =
  "rounded-none border border-black/20 bg-transparent px-2 py-2 text-sm outline-none focus:border-black dark:border-white/25 dark:focus:border-white";

export function SlabAdmin({ slabs }: { slabs: SlabRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PokemonSearchResult[]>([]);
  const [searching, startSearch] = useTransition();
  const [pending, startAction] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const [pick, setPick] = useState<PokemonSearchResult | null>(null);
  const [company, setCompany] = useState("PSA");
  const [grade, setGrade] = useState("10");
  const [cert, setCert] = useState("");
  const [value, setValue] = useState("");

  const search = () =>
    startSearch(async () => {
      const r = await searchPoolCardsAction(query);
      setResults(r.ok ? r.results : []);
      if (!r.ok) setMsg(r.error);
    });

  const addToPool = () => {
    if (!pick) return;
    setMsg(null);
    startAction(async () => {
      const r = await addSlabToPoolAction(pick, {
        gradingCompany: company,
        grade,
        certNumber: cert || undefined,
        valueCents: value
          ? Math.round(Number(value.replace(/[$,]/g, "")) * 100)
          : null,
      });
      if (r.ok) {
        setPick(null);
        setCert("");
        setValue("");
        router.refresh();
      } else setMsg(r.error);
    });
  };

  const togglePool = (id: string, inPool: boolean) =>
    startAction(async () => {
      const r = await adminToggleInventory(id, !inPool);
      if (r && "error" in r && r.error) setMsg(r.error);
      else router.refresh();
    });

  return (
    <div className="space-y-8">
      {/* Add a slab to the pool */}
      <section className="border border-black/10 p-5 dark:border-white/15">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Add a slab to Apex Play
        </p>

        {pick ? (
          <div className="mt-3 space-y-3 border border-black/10 p-3 dark:border-white/15">
            <div className="flex items-center gap-3">
              {pick.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pick.imageUrl} alt="" className="h-16 w-12 object-contain" />
              )}
              <div>
                <p className="text-sm font-medium">{pick.name}</p>
                <button
                  type="button"
                  onClick={() => setPick(null)}
                  className="text-[10px] uppercase tracking-[0.12em] text-zinc-500 underline-offset-2 hover:underline"
                >
                  Change card
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <select value={company} onChange={(e) => setCompany(e.target.value)} className={INPUT}>
                {GRADING_COMPANIES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Grade" className={INPUT} />
              <input value={cert} onChange={(e) => setCert(e.target.value)} placeholder="Cert # (opt)" className={INPUT} />
              <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="Value $" className={INPUT} />
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={addToPool}
              className="rounded-none bg-black px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {pending ? "Adding…" : "Stock slab in pool"}
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder="Search the catalog for the slab's card…"
                className={`w-full ${INPUT}`}
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
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {results.map((c) => (
                  <li key={c.id} className="flex flex-col border border-black/10 p-2 dark:border-white/15">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt={c.name} className="mb-1 aspect-[3/4] w-full object-contain" loading="lazy" />
                    ) : (
                      <div className="mb-1 grid aspect-[3/4] w-full place-items-center bg-black/5 text-[9px] text-zinc-400 dark:bg-white/10">
                        No image
                      </div>
                    )}
                    <p className="truncate text-[11px] font-medium" title={c.name}>{c.name}</p>
                    <button
                      type="button"
                      onClick={() => setPick(c)}
                      className="mt-1 rounded-none border border-black/20 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
                    >
                      Select
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {msg && <p className="text-sm text-red-600 dark:text-red-400">{msg}</p>}

      {/* All slabs */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          All slabs ({slabs.length})
        </h2>
        {slabs.length > 0 ? (
          <ul className="mt-3 border border-black/10 dark:border-white/15">
            {slabs.map((s) => (
              <li key={s.id} className="flex items-center gap-3 border-b border-black/10 px-4 py-3 last:border-0 dark:border-white/15">
                {s.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imageUrl} alt="" className="h-14 w-10 shrink-0 object-contain" loading="lazy" />
                ) : (
                  <div className="h-14 w-10 shrink-0 bg-black/5 dark:bg-white/10" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{s.name}</span>
                    <span className="shrink-0 rounded-none border border-amber-500/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-amber-600 dark:text-amber-400">
                      {[s.company, s.grade].filter(Boolean).join(" ") || "Slab"}
                    </span>
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {s.inPool ? "House pool" : s.ownerEmail ?? "—"}
                    {s.cert ? ` · cert ${s.cert}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums">
                  {formatMoneyCents(s.valueCents)}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => togglePool(s.id, s.inPool)}
                  className="shrink-0 rounded-none border border-black/20 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10"
                >
                  {s.inPool ? "Remove from pool" : "Add to pool"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">No slabs yet.</p>
        )}
      </section>
    </div>
  );
}
