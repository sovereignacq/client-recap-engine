"use client";

import { useState, useTransition } from "react";

type Plan = "pro_monthly" | "pro_annual";

export function PricingButtons() {
  const [plan, setPlan] = useState<Plan>("pro_monthly");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function startCheckout() {
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Checkout failed");
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setError("Stripe did not return a URL");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-md bg-zinc-100 p-1 text-sm dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setPlan("pro_monthly")}
          className={`rounded px-3 py-1.5 font-medium transition-colors ${
            plan === "pro_monthly"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setPlan("pro_annual")}
          className={`rounded px-3 py-1.5 font-medium transition-colors ${
            plan === "pro_annual"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          Annual <span className="text-xs">(save 17%)</span>
        </button>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(startCheckout)}
        className="block w-full rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
      >
        {pending ? "Redirecting…" : "Start 14-day free trial"}
      </button>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
