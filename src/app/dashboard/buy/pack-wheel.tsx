"use client";

import { useMemo, useRef, useState } from "react";

const TILE = 84; // px per tile incl. gap
const LAND_INDEX = 34; // where the won card sits in the reel

/**
 * Wheel-of-fortune pack reel. The result is already decided server-side; the
 * player just starts and stops the spin, which always decelerates onto the won
 * card. Decoy art fills the rest of the reel.
 */
export function PackWheel({
  reel,
  wonImage,
  wonLabel,
  onLanded,
}: {
  reel: string[];
  wonImage: string | null;
  wonLabel: string;
  onLanded: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"ready" | "spinning" | "landed">("ready");
  const [offset, setOffset] = useState(0);
  const [transition, setTransition] = useState("none");

  const faces = useMemo(() => {
    const pool = reel.filter(Boolean);
    const arr: (string | null)[] = [];
    for (let i = 0; i < 42; i++) {
      arr.push(pool.length ? pool[i % pool.length] : null);
    }
    arr[LAND_INDEX] = wonImage ?? arr[LAND_INDEX];
    return arr;
  }, [reel, wonImage]);

  function centerOffset(i: number) {
    const vw = viewportRef.current?.clientWidth ?? 320;
    return -(i * TILE + TILE / 2 - vw / 2);
  }

  function spin() {
    setPhase("spinning");
    requestAnimationFrame(() => {
      setTransition("transform 5s cubic-bezier(0.08,0.85,0.18,1)");
      setOffset(centerOffset(LAND_INDEX));
    });
  }

  function stop() {
    const strip = stripRef.current;
    if (!strip) return;
    const m = new DOMMatrixReadOnly(getComputedStyle(strip).transform);
    setTransition("none");
    setOffset(m.m41);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setTransition("transform 1.15s cubic-bezier(0.18,0.85,0.2,1)");
        setOffset(centerOffset(LAND_INDEX));
      }),
    );
  }

  function handleEnd() {
    if (phase === "spinning") {
      setPhase("landed");
      onLanded();
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div
        ref={viewportRef}
        className="relative w-full overflow-hidden"
        style={{ height: 120 }}
      >
        {/* center marker */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-full w-0.5 -translate-x-1/2 bg-amber-400/80" />
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 text-amber-400">
          ▼
        </div>
        <div
          ref={stripRef}
          onTransitionEnd={handleEnd}
          className="flex items-center"
          style={{
            gap: 4,
            height: 120,
            transform: `translateX(${offset}px)`,
            transition,
          }}
        >
          {faces.map((src, i) => (
            <div
              key={i}
              className={`flex h-[112px] w-[80px] shrink-0 items-center justify-center overflow-hidden rounded-sm border ${
                i === LAND_INDEX
                  ? "border-amber-400"
                  : "border-white/15"
              } bg-zinc-900`}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-contain"
                  loading="eager"
                />
              ) : (
                <span className="text-[8px] uppercase tracking-widest text-zinc-600">
                  Apex
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 h-9">
        {phase === "ready" && (
          <button
            type="button"
            onClick={spin}
            className="rounded-none bg-white px-8 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-zinc-200"
          >
            Spin
          </button>
        )}
        {phase === "spinning" && (
          <button
            type="button"
            onClick={stop}
            className="rounded-none border border-amber-400 px-8 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300 transition hover:bg-amber-400/10"
          >
            Stop
          </button>
        )}
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
        {phase === "ready"
          ? "Tap spin to rip"
          : phase === "spinning"
            ? "Tap stop when you're ready"
            : wonLabel}
      </p>
    </div>
  );
}
