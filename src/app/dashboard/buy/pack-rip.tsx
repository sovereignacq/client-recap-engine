"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ApexMark } from "@/components/apex-mark";

type Phase = "sealed" | "tearing" | "dealing" | "anticipate" | "reveal";

const DECOYS = 5; // cards flipped through before reaching the hit

/**
 * TikTok-style pack rip. The result is already decided server-side; this just
 * plays the ritual: tear the pack, riffle the back stack, turn it over, deal
 * cards one-by-one, build anticipation, then reveal the won card — big for a
 * jackpot, subtle otherwise.
 */
export function PackRip({
  reel,
  teasers = [],
  wonImage,
  wonLabel,
  jackpot,
  onDone,
}: {
  reel: string[];
  teasers?: string[];
  wonImage: string | null;
  wonLabel: string;
  jackpot: boolean;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("sealed");
  const [dealIndex, setDealIndex] = useState(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const decoys = useMemo(() => {
    // Mix tier decoys with a couple of grail "teasers" — eye-candy that flashes
    // by to build hype. Teasers are never the actual pull.
    const pool = reel.filter(Boolean);
    const grails = teasers.filter(Boolean);
    const out: (string | null)[] = [];
    for (let i = 0; i < DECOYS; i++) {
      // Sprinkle a grail at positions 1 and 3 when we have them.
      if ((i === 1 || i === 3) && grails.length) {
        out.push(grails[i % grails.length]);
      } else if (pool.length) {
        out.push(pool[i % pool.length]);
      } else if (grails.length) {
        out.push(grails[i % grails.length]);
      } else {
        out.push(null);
      }
    }
    return out;
  }, [reel, teasers]);

  // Phase timers.
  useEffect(() => {
    if (phase === "tearing") {
      const t = setTimeout(() => setPhase("dealing"), reduced.current ? 1 : 1500);
      return () => clearTimeout(t);
    }
    if (phase === "anticipate") {
      const t = setTimeout(
        () => setPhase("reveal"),
        reduced.current ? 1 : jackpot ? 1500 : 950,
      );
      return () => clearTimeout(t);
    }
    if (phase === "reveal") {
      const t = setTimeout(onDone, reduced.current ? 600 : jackpot ? 2600 : 1800);
      return () => clearTimeout(t);
    }
  }, [phase, jackpot, onDone]);

  const start = () => {
    if (reduced.current) {
      setPhase("reveal");
      return;
    }
    setPhase("tearing");
  };

  const onDecoyEnd = () => {
    if (dealIndex < DECOYS - 1) setDealIndex((i) => i + 1);
    else setPhase("anticipate");
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex h-[340px] w-full items-center justify-center overflow-hidden [perspective:1100px]"
        aria-live="polite"
      >
        {/* Sealed pack */}
        {phase === "sealed" && (
          <div className="flex flex-col items-center gap-6">
            <Pack className="animate-[packWiggle_1.4s_ease-in-out_infinite]" />
            <button
              type="button"
              onClick={start}
              className="rounded-none bg-white px-8 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-zinc-200"
            >
              Rip open
            </button>
          </div>
        )}

        {/* Tear: pack splits, the back stack rises and turns over */}
        {phase === "tearing" && (
          <div className="relative h-[300px] w-[210px]">
            <div className="pack-anim absolute inset-0 origin-top animate-[packTearTop_900ms_ease-in_forwards]">
              <Pack half="top" />
            </div>
            <div className="pack-anim absolute inset-0 origin-bottom animate-[packTearBottom_900ms_ease-in_forwards]">
              <Pack half="bottom" />
            </div>
            <div className="pack-anim absolute inset-0 flex items-center justify-center opacity-0 [animation:deckRise_700ms_ease-out_700ms_forwards]">
              <DeckStack />
            </div>
          </div>
        )}

        {/* Deal decoys one by one */}
        {phase === "dealing" && (
          <div className="relative h-[300px] w-[210px]">
            <DeckStack faded />
            <FlipCard
              key={dealIndex}
              faceImage={decoys[dealIndex] ?? null}
              className="pack-anim animate-[dealCycle_720ms_ease-in-out_forwards]"
              onAnimEnd={onDecoyEnd}
            />
          </div>
        )}

        {/* Anticipation */}
        {phase === "anticipate" && (
          <div
            className={`relative flex h-[300px] w-[210px] items-center justify-center ${
              jackpot ? "animate-[anticipateShake_320ms_ease-in-out_infinite]" : ""
            }`}
          >
            {jackpot && (
              <div className="pointer-events-none absolute h-[420px] w-[420px] animate-[spinRays_3s_linear_infinite] bg-[conic-gradient(rgba(251,191,36,0.35)_0deg,transparent_30deg,rgba(251,191,36,0.35)_60deg,transparent_90deg,rgba(251,191,36,0.35)_120deg,transparent_150deg,rgba(251,191,36,0.35)_180deg,transparent_210deg,rgba(251,191,36,0.35)_240deg,transparent_270deg,rgba(251,191,36,0.35)_300deg,transparent_330deg)]" />
            )}
            <div className="animate-[anticipateGlow_700ms_ease-in-out_infinite] rounded-[14px]">
              <CardBack />
            </div>
            <p className="absolute -bottom-1 text-[10px] uppercase tracking-[0.35em] text-amber-300">
              {jackpot ? "Big one incoming…" : "Here it comes…"}
            </p>
          </div>
        )}

        {/* Reveal */}
        {phase === "reveal" && (
          <div className="relative flex h-[320px] w-full items-center justify-center">
            {jackpot && <JackpotFx />}
            <FlipCard
              faceImage={wonImage}
              start="back"
              className="pack-anim z-10 animate-[revealPop_900ms_cubic-bezier(0.18,0.85,0.2,1)_forwards]"
              glow={jackpot}
            />
            {!jackpot && (
              <div className="pointer-events-none absolute h-44 w-32 animate-[subtleShine_900ms_ease-out_500ms] rounded-[14px] bg-white/30 blur-md" />
            )}
          </div>
        )}
      </div>

      <p className="mt-3 h-4 text-[10px] uppercase tracking-[0.3em] text-zinc-400">
        {phase === "sealed"
          ? "Tap to rip the pack"
          : phase === "reveal"
            ? wonLabel
            : phase === "anticipate"
              ? ""
              : "Ripping…"}
      </p>
    </div>
  );
}

/* ---- pieces ---- */

function Pack({
  className = "",
  half,
}: {
  className?: string;
  half?: "top" | "bottom";
}) {
  const clip =
    half === "top"
      ? { clipPath: "inset(0 0 55% 0)" }
      : half === "bottom"
        ? { clipPath: "inset(45% 0 0 0)" }
        : undefined;
  return (
    <div
      style={clip}
      className={`relative h-[300px] w-[210px] overflow-hidden rounded-[14px] bg-gradient-to-br from-violet-500 via-fuchsia-400 to-amber-400 shadow-2xl ${className}`}
    >
      <div className="absolute inset-[3px] flex flex-col items-center justify-center gap-3 rounded-[11px] bg-zinc-950/85 text-white">
        <ApexMark className="h-16 w-24 text-white drop-shadow" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/70">
          Apex
        </span>
        {!half && (
          <span className="absolute top-2 text-[8px] uppercase tracking-[0.3em] text-white/40">
            tear here ✂
          </span>
        )}
      </div>
    </div>
  );
}

function CardBack({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex h-44 w-32 items-center justify-center rounded-[12px] border border-white/15 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black ${className}`}
    >
      <ApexMark className="h-9 w-14 text-white/70" />
    </div>
  );
}

function DeckStack({ faded = false }: { faded?: boolean }) {
  return (
    <div className={`relative h-44 w-32 ${faded ? "opacity-40" : ""}`}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute inset-0 flex items-center justify-center rounded-[12px] border border-white/15 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black"
          style={{
            transform: `translate(${i * 4}px, ${i * -4}px)`,
            zIndex: 3 - i,
          }}
        >
          {i === 0 && <ApexMark className="h-9 w-14 text-white/60" />}
        </div>
      ))}
    </div>
  );
}

/** A double-sided flip card. `start="back"` means it begins face-down. */
function FlipCard({
  faceImage,
  className = "",
  onAnimEnd,
  glow = false,
}: {
  faceImage: string | null;
  start?: "back";
  className?: string;
  onAnimEnd?: () => void;
  glow?: boolean;
}) {
  return (
    <div
      onAnimationEnd={onAnimEnd}
      className={`pack-3d absolute left-1/2 top-1/2 h-44 w-32 -translate-x-1/2 -translate-y-1/2 ${className}`}
    >
      {/* front (face) */}
      <div
        className={`pack-face absolute inset-0 overflow-hidden rounded-[12px] border bg-zinc-900 ${
          glow ? "border-amber-400 shadow-[0_0_50px_rgba(251,191,36,0.7)]" : "border-white/20"
        }`}
      >
        {faceImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={faceImage}
            alt=""
            className="h-full w-full object-contain"
            loading="eager"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-widest text-zinc-600">
            Apex
          </div>
        )}
      </div>
      {/* back */}
      <div className="pack-face pack-face-back absolute inset-0 flex items-center justify-center rounded-[12px] border border-white/15 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black">
        <ApexMark className="h-9 w-14 text-white/70" />
      </div>
    </div>
  );
}

function JackpotFx() {
  const colors = ["#fbbf24", "#f472b6", "#34d399", "#60a5fa", "#f87171"];
  return (
    <>
      {/* gold rays */}
      <div className="pointer-events-none absolute h-[460px] w-[460px] animate-[spinRays_4s_linear_infinite] bg-[conic-gradient(rgba(251,191,36,0.4)_0deg,transparent_24deg,rgba(251,191,36,0.4)_48deg,transparent_72deg,rgba(251,191,36,0.4)_96deg,transparent_120deg,rgba(251,191,36,0.4)_144deg,transparent_168deg,rgba(251,191,36,0.4)_192deg,transparent_216deg,rgba(251,191,36,0.4)_240deg,transparent_264deg,rgba(251,191,36,0.4)_288deg,transparent_312deg,rgba(251,191,36,0.4)_336deg)]" />
      {/* expanding rings */}
      <div className="pointer-events-none absolute h-40 w-40 rounded-full border-4 border-amber-300 animate-[burstRing_1200ms_ease-out_forwards]" />
      <div className="pointer-events-none absolute h-40 w-40 rounded-full border-2 border-fuchsia-300 animate-[burstRing_1200ms_ease-out_200ms_forwards]" />
      {/* confetti */}
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="pointer-events-none absolute top-0 h-2.5 w-1.5 animate-[confettiFall_1500ms_ease-in_forwards]"
          style={{
            left: `${(i / 18) * 100}%`,
            backgroundColor: colors[i % colors.length],
            animationDelay: `${(i % 6) * 90}ms`,
            transform: "translateY(-20px)",
          }}
        />
      ))}
    </>
  );
}
