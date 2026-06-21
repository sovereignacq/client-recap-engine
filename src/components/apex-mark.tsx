/**
 * APEX wordmark glyph — an "A" inside a ring with a breakout arrow bar to the
 * right, a nod to the Avengers "A" but our own. Inherits color via currentColor.
 */
export function ApexMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 124 100"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="5" />
      {/* the A */}
      <path
        d="M30 76 L50 24 L70 76"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* crossbar that breaks the ring and shoots out to the right */}
      <path
        d="M25 61 H116"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M100 47 L118 61 L100 75"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
