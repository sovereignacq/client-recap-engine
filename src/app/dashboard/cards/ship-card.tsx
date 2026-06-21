"use client";

import { useState, useTransition } from "react";
import { requestShipmentAction } from "./actions";
import { formatMoneyCents, SHIPPING_FEE_CENTS } from "@/lib/cards";

const INPUT =
  "w-full rounded-none border border-black/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-black dark:border-white/25 dark:focus:border-white";

export function ShipCard({ cardId }: { cardId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    recipient: "",
    address1: "",
    address2: "",
    city: "",
    region: "",
    postal: "",
    country: "US",
  });

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  if (done) {
    return (
      <p className="px-5 pb-4 text-xs text-emerald-600 dark:text-emerald-400">
        Shipment requested — track its status here. The {" "}
        {formatMoneyCents(SHIPPING_FEE_CENTS)} fee was charged to your wallet.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="px-5 pb-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-none border border-black/20 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] transition hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
        >
          Ship to me — {formatMoneyCents(SHIPPING_FEE_CENTS)} insured
        </button>
      </div>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await requestShipmentAction(cardId, {
        recipient: f.recipient,
        address1: f.address1,
        address2: f.address2 || undefined,
        city: f.city,
        region: f.region,
        postal: f.postal,
        country: f.country || "US",
      });
      if (res.ok) setDone(true);
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-2 border-t border-black/10 bg-black/[0.02] px-5 py-4 dark:border-white/15 dark:bg-white/[0.03]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
        Ship this card to you · {formatMoneyCents(SHIPPING_FEE_CENTS)} insured
      </p>
      <input
        className={INPUT}
        placeholder="Full name"
        value={f.recipient}
        onChange={(e) => set("recipient", e.target.value)}
      />
      <input
        className={INPUT}
        placeholder="Address line 1"
        value={f.address1}
        onChange={(e) => set("address1", e.target.value)}
      />
      <input
        className={INPUT}
        placeholder="Address line 2 (optional)"
        value={f.address2}
        onChange={(e) => set("address2", e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className={INPUT}
          placeholder="City"
          value={f.city}
          onChange={(e) => set("city", e.target.value)}
        />
        <input
          className={INPUT}
          placeholder="State / region"
          value={f.region}
          onChange={(e) => set("region", e.target.value)}
        />
        <input
          className={INPUT}
          placeholder="Postal code"
          value={f.postal}
          onChange={(e) => set("postal", e.target.value)}
        />
        <input
          className={INPUT}
          placeholder="Country"
          value={f.country}
          onChange={(e) => set("country", e.target.value)}
        />
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-none bg-black px-4 py-2 text-[10px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {pending ? "Requesting…" : `Pay ${formatMoneyCents(SHIPPING_FEE_CENTS)} & ship`}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-none border border-black/20 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.15em] transition hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
