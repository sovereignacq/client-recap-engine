"use client";

import { useState } from "react";
import { NewCardForm } from "./new-card-form";
import { QuickAdd } from "./quick-add";

type Submitter = { id: string; name: string };

/**
 * Two ways in: a fast catalog quick-add for collectors, and the full
 * photo + grade + serialize intake for cards headed to grading or the pool.
 */
export function IntakeModes({
  submitters,
  defaultSubmitterId,
  aiConfigured,
  userId,
  staff,
}: {
  submitters: Submitter[];
  defaultSubmitterId: string | null;
  aiConfigured: boolean;
  userId: string;
  staff: boolean;
}) {
  const [mode, setMode] = useState<"quick" | "full">("quick");

  const TAB = (active: boolean) =>
    `flex-1 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] transition ${
      active
        ? "bg-black text-white dark:bg-white dark:text-black"
        : "hover:bg-black/5 dark:hover:bg-white/10"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex border border-black/15 dark:border-white/20">
        <button
          type="button"
          className={TAB(mode === "quick")}
          onClick={() => setMode("quick")}
        >
          Quick add
        </button>
        <button
          type="button"
          className={TAB(mode === "full")}
          onClick={() => setMode("full")}
        >
          Grade &amp; serialize
        </button>
      </div>

      {mode === "quick" ? (
        <QuickAdd />
      ) : (
        <NewCardForm
          submitters={submitters}
          defaultSubmitterId={defaultSubmitterId}
          aiConfigured={aiConfigured}
          userId={userId}
          staff={staff}
        />
      )}
    </div>
  );
}
