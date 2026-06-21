"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCollectionAction } from "./actions";

export function NewCollection() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function create() {
    setError(null);
    startTransition(async () => {
      const res = await createCollectionAction(name);
      if (res.ok) {
        setName("");
        router.push(`/dashboard/collections/${res.id}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && create()}
        placeholder="New collection name…"
        className="min-w-0 flex-1 rounded-none border border-black/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-black dark:border-white/25 dark:focus:border-white"
      />
      <button
        type="button"
        onClick={create}
        disabled={pending}
        className="rounded-none bg-black px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {pending ? "…" : "Create"}
      </button>
      {error && <p className="w-full text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
