"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type NavItem = { label: string; href: string };
export type NavGroup = { label: string; items: NavItem[] };

const LINK =
  "px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.15em] text-zinc-500 transition hover:text-black dark:hover:text-white";

/**
 * Horizontal menu bar where each group opens a dropdown of links. Plain
 * top-level links render alongside the dropdown triggers. Used in the
 * dashboard and back-office headers to tame the page sprawl.
 */
export function NavMenu({
  links = [],
  groups,
  className = "",
}: {
  links?: NavItem[];
  groups: NavGroup[];
  className?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className={`flex flex-wrap items-center gap-x-1 gap-y-0.5 ${className}`}>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={LINK}>
          {l.label}
        </Link>
      ))}
      {groups.map((g) => (
        <div key={g.label} className="relative">
          <button
            type="button"
            onClick={() => setOpen(open === g.label ? null : g.label)}
            className={`${LINK} inline-flex items-center gap-1 ${
              open === g.label ? "text-black dark:text-white" : ""
            }`}
            aria-expanded={open === g.label}
          >
            {g.label}
            <span aria-hidden className="text-[8px]">
              ▼
            </span>
          </button>
          {open === g.label && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-48 border border-black/10 bg-white py-1 shadow-lg dark:border-white/15 dark:bg-black">
              {g.items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(null)}
                  className="block px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-600 transition hover:bg-black/5 hover:text-black dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  {it.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
