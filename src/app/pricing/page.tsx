import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Pricing",
};

const BTN_SOLID =
  "block w-full rounded-none bg-black px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200";
const BTN_OUTLINE =
  "block w-full rounded-none border border-black/20 px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.18em] transition hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10";

type Tier = {
  key: string;
  name: string;
  blurb: string;
  price: string;
  cadence: string;
  note?: string;
  features: string[];
  featured?: boolean;
};

const TIERS: Tier[] = [
  {
    key: "free",
    name: "Free",
    blurb: "For getting started.",
    price: "$0",
    cadence: "forever",
    features: [
      "Photo identification",
      "Serialized card records & status tracking",
      "Submitter log",
      "Buy, sell-to-us & (soon) auction",
      "Grading submissions at standard service fee",
    ],
  },
  {
    key: "collector",
    name: "Collector",
    blurb: "For active collectors who grade regularly.",
    price: "$99",
    cadence: "/year",
    note: "≈ $8.25/mo, billed annually",
    features: [
      "Everything in Free",
      "3 grading credits / year (value tier)",
      "10% off every grading service fee",
      "Priority identification",
      "Confirmed value estimates",
    ],
  },
  {
    key: "dealer",
    name: "Dealer",
    blurb: "For shops and high-volume submitters.",
    price: "$299",
    cadence: "/year",
    note: "≈ $24.92/mo, billed annually",
    featured: true,
    features: [
      "Everything in Collector",
      "12 grading credits / year (value tier)",
      "20% off every grading service fee",
      "Bulk submission rates",
      "Unlimited cards & submitters",
      "Priority handling & support",
    ],
  },
];

type FeeRow = { value: string; fee: string };

const FEE_ROWS: FeeRow[] = [
  { value: "Up to $200", fee: "$8" },
  { value: "$201 – $500", fee: "$12" },
  { value: "$501 – $1,000", fee: "$20" },
  { value: "$1,001 – $2,500", fee: "$40" },
  { value: "$2,501 – $5,000", fee: "$75" },
  { value: "Over $5,000", fee: "2% of value" },
];

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-5xl space-y-20">
        <header className="space-y-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-400">
            Membership
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Grade more, pay less.
          </h1>
          <p className="mx-auto max-w-xl text-zinc-600 dark:text-zinc-400">
            Pick a membership the way you would with PSA or TAG — bundled grading
            credits and a standing discount. It only ever trims our service fee,
            never the grading company&apos;s cost.
          </p>
        </header>

        {/* MEMBERSHIP TIERS */}
        <section className="grid grid-cols-1 gap-px border border-black/10 bg-black/10 lg:grid-cols-3 dark:border-white/15 dark:bg-white/15">
          {TIERS.map((tier) => (
            <div
              key={tier.key}
              className={
                tier.featured
                  ? "flex flex-col bg-black p-8 text-white dark:bg-white dark:text-black"
                  : "flex flex-col bg-white p-8 dark:bg-black"
              }
            >
              <h2 className="text-lg font-semibold">{tier.name}</h2>
              <p
                className={`mt-1 text-sm ${
                  tier.featured ? "text-zinc-400" : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {tier.blurb}
              </p>
              <p className="mt-6 text-4xl font-semibold tracking-tight">
                {tier.price}
                <span
                  className={`text-base font-normal ${
                    tier.featured ? "text-zinc-400" : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {" "}
                  {tier.cadence}
                </span>
              </p>
              {tier.note && (
                <p
                  className={`mt-1 text-xs ${
                    tier.featured ? "text-zinc-400" : "text-zinc-500"
                  }`}
                >
                  {tier.note}
                </p>
              )}

              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden>·</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {tier.key === "free" ? (
                  <Link
                    href={user ? "/dashboard" : "/signup"}
                    className={tier.featured ? BTN_SOLID : BTN_OUTLINE}
                  >
                    {user ? "Go to dashboard" : "Start free"}
                  </Link>
                ) : (
                  <Link
                    href={user ? "/dashboard" : "/signup?next=/pricing"}
                    className={
                      tier.featured
                        ? "block w-full rounded-none bg-white px-4 py-3 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-black transition hover:bg-zinc-200 dark:bg-black dark:text-white dark:hover:bg-zinc-800"
                        : BTN_OUTLINE
                    }
                  >
                    {user ? "Choose " + tier.name : "Start free"}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </section>

        <p className="-mt-12 text-center text-xs text-zinc-500">
          Paid memberships are rolling out — start free today and upgrade from
          your dashboard when they go live.
        </p>

        {/* GRADING FEE SCHEDULE */}
        <section className="space-y-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Grading submission fees
              </h2>
              <span className="border border-black/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:border-white/20">
                Coming soon
              </span>
            </div>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              When you submit a card to PSA, TAG, or another grading company
              through APEX, you pay their grading fee and insured shipping
              <strong className="font-semibold"> at cost</strong>. APEX adds one
              flat service fee, by the card&apos;s declared value — that&apos;s
              the only part your membership discounts.
            </p>
          </div>

          <div className="overflow-hidden border border-black/10 dark:border-white/15">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 bg-black/[0.03] text-left dark:border-white/15 dark:bg-white/[0.04]">
                  <th className="px-5 py-3 font-semibold">Declared value</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    APEX service fee
                  </th>
                  <th className="hidden px-5 py-3 text-right font-semibold sm:table-cell">
                    Collector (−10%)
                  </th>
                  <th className="hidden px-5 py-3 text-right font-semibold sm:table-cell">
                    Dealer (−20%)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 dark:divide-white/15">
                {FEE_ROWS.map((row) => (
                  <tr key={row.value}>
                    <td className="px-5 py-3">{row.value}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {row.fee}
                    </td>
                    <td className="hidden px-5 py-3 text-right tabular-nums text-zinc-500 sm:table-cell">
                      {discounted(row.fee, 0.1)}
                    </td>
                    <td className="hidden px-5 py-3 text-right tabular-nums text-zinc-500 sm:table-cell">
                      {discounted(row.fee, 0.2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mx-auto max-w-2xl space-y-2 text-xs leading-5 text-zinc-500">
            <li>
              • Grading company fee + insured two-way shipping are passed through
              at cost and shown before you confirm.
            </li>
            <li>
              • Rush handling: Express +$15/card, Super Express +$40/card (the
              grader&apos;s own turnaround tiers are passed through at cost).
            </li>
            <li>
              • A membership grading credit waives the APEX service fee on one
              value-tier card (declared value up to $500).
            </li>
            <li>
              • Discounts and credits apply to the APEX service fee only — never
              to the grading company&apos;s cost.
            </li>
          </ul>
        </section>

        <p className="text-center text-xs text-zinc-500">
          Prices in USD. Memberships renew annually; cancel anytime in your
          billing portal.
        </p>
      </div>
    </main>
  );
}

/** Show a flat fee with the member discount applied; pass percentage fees through. */
function discounted(fee: string, rate: number): string {
  const match = fee.match(/^\$(\d+(?:\.\d+)?)$/);
  if (!match) return fee;
  const amount = Number(match[1]) * (1 - rate);
  return `$${amount.toFixed(2).replace(/\.00$/, "")}`;
}
