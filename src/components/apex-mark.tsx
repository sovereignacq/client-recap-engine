/**
 * APEX mark — a bold, italic "A" with a crossbar that slashes out to the right
 * in a sharp breakout point, evoking the aggressive WWE/WWF "scratch" wordmark
 * look. Filled shapes (not thin strokes) so it reads heavy at any size.
 * Inherits color via currentColor.
 */
export function ApexMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 145 100"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Heavy A frame (thick legs, open foot). */}
      <path d="M57 6 L73 6 L124 96 L96 96 L65 26 L34 96 L6 96 Z" />
      {/* Crossbar that slashes up-right and breaks out to a sharp point. */}
      <path d="M40 55 L118 49 L138 60 L118 71 L40 67 Z" />
    </svg>
  );
}
