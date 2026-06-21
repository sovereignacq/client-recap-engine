"use client";

import { useEffect, useState } from "react";

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/**
 * Live countdown to when a daily reward resets. Calls onElapsed once the timer
 * hits zero so the page can refresh and surface the claim button.
 */
export function ResetTimer({
  nextAt,
  onElapsed,
}: {
  nextAt: string;
  onElapsed?: () => void;
}) {
  const target = new Date(nextAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = target - now;

  useEffect(() => {
    if (remaining <= 0) onElapsed?.();
  }, [remaining, onElapsed]);

  return (
    <span className="tabular-nums">
      {remaining > 0 ? `Resets in ${fmt(remaining)}` : "Ready"}
    </span>
  );
}
