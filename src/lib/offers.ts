/**
 * Shared display helpers + option lists for sell-to-us offers.
 * Keep these in sync with the DB check constraints in the
 * `sell_to_us_offers` migration.
 */

export const OFFER_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "paid", label: "Paid" },
  { value: "canceled", label: "Canceled" },
] as const;

export const PAYOUT_METHODS = [
  { value: "wallet", label: "APEX wallet" },
  { value: "cash", label: "Cash" },
  { value: "paypal", label: "PayPal" },
  { value: "venmo", label: "Venmo" },
  { value: "store_credit", label: "Store credit" },
  { value: "check", label: "Check" },
  { value: "other", label: "Other" },
] as const;

export function offerLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string | null | undefined,
): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}
