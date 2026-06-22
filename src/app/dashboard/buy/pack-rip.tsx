"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ApexMark } from "@/components/apex-mark";

type Phase = "sealed" | "tearing" | "dealing" | "anticipate" | "reveal";

const DECOYS = 5; // cards flipped through before reaching the hit

// Base (slow, suspenseful) timings in ms — divided by the current speed.
const TEAR_MS = 2200;
const DEAL_MS = 950;
const ANTICIPATE_MS = { normal: 1700, jackpot: 2600 };
const REVEAL_HOLD_MS = { normal: 2400, jackpot: 3400 };
const FAST_SPEED = 2.75; // multiplier when the player taps to hurry it along

const prefersReduced = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Tiny Web-Audio sound kit, synthesized so we ship no audio files. Created on a
 * user gesture (the rip tap) to satisfy autoplay policies. Every call is
 * wrapped so a missing/blocked AudioContext just no-ops.
 */
function makePackAudio() {
  let ctx: AudioContext | null = null;
  const ensure = (): AudioContext | null => {
    try {
      if (!ctx) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === "suspended") void ctx.resume();
      return ctx;
    } catch {
      return null;
    }
  };
  const tone = (
    freq: number,
    dur: number,
    opts: { type?: OscillatorType; gain?: number; delay?: number; slideTo?: number } = {},
  ) => {
    const c = ensure();
    if (!c) return;
    const { type = "sine", gain = 0.18, delay = 0, slideTo } = opts;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  };
  const noise = (dur: number, gain = 0.18, lowpass = 1500) => {
    const c = ensure();
    if (!c) return;
    const frames = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, frames, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = lowpass;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(filt);
    filt.connect(g);
    g.connect(c.destination);
    src.start();
    src.stop(c.currentTime + dur);
  };
  return {
    resume: ensure,
    rip: () => {
      noise(0.55, 0.22, 1800);
      tone(140, 0.5, { type: "sawtooth", gain: 0.08, slideTo: 70 });
    },
    tick: () => tone(620, 0.06, { type: "square", gain: 0.07 }),
    rise: (durSec: number) =>
      tone(180, Math.max(0.4, durSec), { type: "sawtooth", gain: 0.06, slideTo: 900 }),
    reveal: () => {
      tone(523.25, 0.5, { gain: 0.12 });
      tone(659.25, 0.5, { gain: 0.12, delay: 0.05 });
      tone(783.99, 0.6, { gain: 0.12, delay: 0.1 });
    },
    jackpot: () => {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(f, 0.55, { type: "triangle", gain: 0.14, delay: i * 0.1 }),
      );
      noise(0.35, 0.05, 6000);
    },
  };
}

/**
 * TikTok-style pack rip. The result is already decided server-side; this just
 * plays the ritual: tear the pack, riffle the back stack, turn it over, deal
 * cards one-by-one, build anticipation, then reveal the won card — big for a
 * jackpot, subtle otherwise. Slow and suspenseful by default; tap the screen to
 * speed it up. Synthesized sound effects throughout.
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
  const [speed, setSpeed] = useState(1);
  const audio = useRef<ReturnType<typeof makePackAudio> | null>(null);
  const soundedPhase = useRef<string>("");

  // Render-time duration. Under reduced-motion the `.pack-anim` CSS rule zeroes
  // animation durations via !important, so we don't need to special-case here.
  const dur = (base: number) => base / speed;

  const decoys = useMemo(() => {
    // Mix tier decoys with a couple of grail "teasers" — eye-candy that flashes
    // by to build hype. Teasers are never the actual pull.
    const pool = reel.filter(Boolean);
    const grails = teasers.filter(Boolean);
    const out: (string | null)[] = [];
    for (let i = 0; i < DECOYS; i++) {
      if ((i === 1 || i === 3) && grails.length) out.push(grails[i % grails.length]);
      else if (pool.length) out.push(pool[i % pool.length]);
      else if (grails.length) out.push(grails[i % grails.length]);
      else out.push(null);
    }
    return out;
  }, [reel, teasers]);

  // Phase timers + per-phase sound cues. Re-runs when speed changes so a tap
  // shortens the remaining wait; sounds are gated so they don't replay.
  useEffect(() => {
    const reduced = prefersReduced();
    const scale = (base: number) => (reduced ? 1 : base / speed);
    if (phase === "tearing") {
      const t = setTimeout(() => setPhase("dealing"), scale(TEAR_MS));
      return () => clearTimeout(t);
    }
    if (phase === "anticipate") {
      const ms = scale(jackpot ? ANTICIPATE_MS.jackpot : ANTICIPATE_MS.normal);
      if (soundedPhase.current !== "anticipate") {
        soundedPhase.current = "anticipate";
        audio.current?.rise(ms / 1000);
      }
      const t = setTimeout(() => setPhase("reveal"), ms);
      return () => clearTimeout(t);
    }
    if (phase === "reveal") {
      if (soundedPhase.current !== "reveal") {
        soundedPhase.current = "reveal";
        if (jackpot) audio.current?.jackpot();
        else audio.current?.reveal();
      }
      const t = setTimeout(
        onDone,
        scale(jackpot ? REVEAL_HOLD_MS.jackpot : REVEAL_HOLD_MS.normal),
      );
      return () => clearTimeout(t);
    }
  }, [phase, speed, jackpot, onDone]);

  // A soft tick as each decoy deals past.
  useEffect(() => {
    if (phase === "dealing") audio.current?.tick();
  }, [phase, dealIndex]);

  const start = () => {
    audio.current ??= makePackAudio();
    audio.current.resume();
    if (prefersReduced()) {
      setPhase("reveal");
      return;
    }
    audio.current.rip();
    setPhase("tearing");
  };

  // Tap anywhere (once we're past the sealed pack, before the reveal) to hurry
  // the reveal along.
  const speedUp = () => {
    if (phase === "sealed" || phase === "reveal") return;
    setSpeed((s) => (s === 1 ? FAST_SPEED : s));
  };

  const onDecoyEnd = () => {
    if (dealIndex < DECOYS - 1) setDealIndex((i) => i + 1);
    else setPhase("anticipate");
  };

  const dealtAnim: CSSProperties = {
    animation: `dealCycle ${Math.round(dur(DEAL_MS))}ms ease-in-out forwards`,
  };
  const revealAnim: CSSProperties = {
    animation: `revealPop ${Math.round(dur(950))}ms cubic-bezier(0.18,0.85,0.2,1) forwards`,
  };

  const canSpeed = phase !== "sealed" && phase !== "reveal" && speed === 1;

  return (
    <div className="flex flex-col items-center">
      <div
        onClick={speedUp}
        className={`relative flex h-[340px] w-full items-center justify-center overflow-hidden [perspective:1100px] ${
          phase !== "sealed" ? "cursor-pointer" : ""
        }`}
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
              className="pack-anim"
              style={dealtAnim}
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
              className="pack-anim z-10"
              style={revealAnim}
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
            : canSpeed
              ? "Tap to speed up"
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
  style,
  onAnimEnd,
  glow = false,
}: {
  faceImage: string | null;
  start?: "back";
  className?: string;
  style?: CSSProperties;
  onAnimEnd?: () => void;
  glow?: boolean;
}) {
  return (
    <div
      onAnimationEnd={onAnimEnd}
      style={style}
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
