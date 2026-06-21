import type { CSSProperties } from "react";

/**
 * Stylized holographic "trading card" built entirely from CSS — evokes a
 * premium foil pull without depicting any real (copyrighted) card.
 */
export function HoloCard({
  rarity,
  label,
  value,
  tilt = "0deg",
  float = true,
  className = "",
}: {
  rarity: string;
  label: string;
  value: string;
  tilt?: string;
  float?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`holo-card ${float ? "card-float" : ""} w-40 sm:w-44 ${className}`}
      style={{ "--tilt": tilt } as CSSProperties}
    >
      <div className="m-[3px] flex aspect-[3/4] flex-col justify-between rounded-[11px] bg-zinc-950/90 p-4 text-white">
        <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.2em] text-white/70">
          <span>{rarity}</span>
          <span>APEX</span>
        </div>
        <div className="relative mx-auto my-2 grid h-20 w-20 place-items-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 via-white/10 to-transparent blur-[2px]" />
          <div className="absolute inset-3 rounded-full border border-white/30" />
          <span className="relative text-2xl">★</span>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">
            {label}
          </p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        </div>
      </div>
    </div>
  );
}
