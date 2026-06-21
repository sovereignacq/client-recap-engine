"use client";

import { useState, useTransition } from "react";

export function MembershipButton({
  planKey,
  label,
  featured,
}: {
  planKey: "collector" | "dealer";
  label: string;
  featured?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function subscribe() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: planKey }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? "Checkout failed");
          return;
        }
        if (data?.url) window.location.href = data.url;
        else setError("Stripe did not return a URL");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
      }
    });
  }

  const cls = featured
    ? "block w-full rounded-none bg-white px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-black transition hover:bg-zinc-200 disabled:opacity-50 dark:bg-black dark:text-white dark:hover:bg-zinc-800"
    : "block w-full rounded-none border border-black/20 px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.18em] transition hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10";

  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} onClick={subscribe} className={cls}>
        {pending ? "Redirecting…" : label}
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
