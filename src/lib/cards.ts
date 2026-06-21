/**
 * Shared display helpers + option lists for the card grading UI.
 * Keep the option arrays in sync with the DB check constraints in the
 * `card_grading_core` migration.
 */

export const CARD_CATEGORIES = [
  { value: "sports", label: "Sports card" },
  { value: "tcg", label: "Trading card game" },
  { value: "other", label: "Other" },
] as const;

export const CARD_INTENTS = [
  { value: "grade", label: "Grade & return" },
  { value: "sell", label: "Sell to us" },
] as const;

export const CARD_STATUSES = [
  { value: "received", label: "Received" },
  { value: "identifying", label: "Identifying" },
  { value: "identified", label: "Identified" },
  { value: "grading", label: "Grading" },
  { value: "graded", label: "Graded" },
  { value: "sold", label: "Sold" },
  { value: "returned", label: "Returned" },
] as const;

export const ID_STATUSES = [
  { value: "unidentified", label: "Unidentified" },
  { value: "ai_suggested", label: "Suggested" },
  { value: "confirmed", label: "Confirmed" },
] as const;

export function labelFor(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string | null | undefined,
): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

/** Build a readable one-line title for a card from its identification fields. */
export function cardTitle(c: {
  card_year: string | null;
  manufacturer: string | null;
  set_name: string | null;
  player_or_character: string | null;
  card_number: string | null;
  variant: string | null;
}): string {
  const parts = [
    c.card_year,
    c.manufacturer,
    c.set_name,
    c.player_or_character,
    c.card_number ? `#${c.card_number.replace(/^#/, "")}` : null,
    c.variant,
  ].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length ? parts.join(" · ") : "Unidentified card";
}

export function formatMoneyCents(
  cents: number | null | undefined,
  currency = "USD",
): string {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/** Extra card statuses used outside the manual status control (pool + shipping). */
const EXTRA_STATUS_LABELS: Record<string, string> = {
  inventory: "In pack pool",
  shipping: "Shipping",
  shipped: "Shipped to you",
};

/** Human label for any card status, including pool/shipping states. */
export function cardStatusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return (
    (CARD_STATUSES as ReadonlyArray<{ value: string; label: string }>).find(
      (o) => o.value === value,
    )?.label ??
    EXTRA_STATUS_LABELS[value] ??
    value
  );
}

/** Flat insured shipping fee (cents) to physically send a card to its owner. */
export const SHIPPING_FEE_CENTS = 1499;

export const SHIPMENT_STATUSES = [
  { value: "requested", label: "Requested" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "canceled", label: "Canceled" },
] as const;
