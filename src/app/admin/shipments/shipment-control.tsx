"use client";

import { useState, useTransition } from "react";
import { adminUpdateShipment } from "@/app/admin/actions";
import { SHIPMENT_STATUSES } from "@/lib/cards";

const INPUT =
  "rounded-none border border-black/20 bg-transparent px-2 py-1.5 text-xs outline-none focus:border-black dark:border-white/25 dark:focus:border-white";

export function ShipmentControl({
  id,
  status,
  carrier,
  tracking,
}: {
  id: string;
  status: string;
  carrier: string | null;
  tracking: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [st, setSt] = useState(status);
  const [car, setCar] = useState(carrier ?? "");
  const [trk, setTrk] = useState(tracking ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={INPUT}
        value={st}
        onChange={(e) => setSt(e.target.value)}
      >
        {SHIPMENT_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <input
        className={`${INPUT} w-24`}
        placeholder="Carrier"
        value={car}
        onChange={(e) => setCar(e.target.value)}
      />
      <input
        className={`${INPUT} w-40`}
        placeholder="Tracking #"
        value={trk}
        onChange={(e) => setTrk(e.target.value)}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMsg(null);
            const res = await adminUpdateShipment(id, st, car, trk);
            setMsg(res?.error ? res.error : "Saved");
          })
        }
        className="rounded-none bg-black px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {pending ? "…" : "Save"}
      </button>
      {msg && (
        <span
          className={`text-[10px] ${
            msg === "Saved"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {msg}
        </span>
      )}
    </div>
  );
}
