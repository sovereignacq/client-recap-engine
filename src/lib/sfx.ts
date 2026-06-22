"use client";

/**
 * Tiny synthesized sound effects (no audio files). Reuses one AudioContext,
 * created lazily on a user gesture. Every call no-ops if audio is unavailable
 * or blocked.
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
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
}

function bell(c: AudioContext, freq: number, at: number, dur: number, gain: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** Cash-register "cha-ching" — two bright ascending bell tones + a sparkle. */
export function playCashRegister() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  bell(c, 987.77, t, 0.45, 0.2); // B5  "cha"
  bell(c, 1318.51, t + 0.1, 0.55, 0.2); // E6  "ching"
  bell(c, 1975.53, t + 0.16, 0.4, 0.09); // B6 sparkle
}
