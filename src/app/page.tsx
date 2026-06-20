import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

const BTN_SOLID =
  "inline-flex items-center justify-center rounded-none bg-black px-6 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200";
const BTN_OUTLINE =
  "inline-flex items-center justify-center rounded-none border border-black/20 px-6 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-black transition hover:bg-black/5 dark:border-white/25 dark:text-white dark:hover:bg-white/10";
const EYEBROW =
  "text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-400";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = !!user;

  return (
    <div className="flex flex-1 flex-col bg-white text-black dark:bg-black dark:text-white">
      <SiteHeader signedIn={signedIn} />

      {/* HERO */}
      <section className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto grid w-full max-w-6xl gap-14 px-4 py-24 sm:px-6 sm:py-32 lg:grid-cols-2 lg:items-center lg:gap-20">
          <div>
            <p className={EYEBROW}>Grade · Submit · Buy · Sell · Auction</p>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Everything
              <br />
              your cards
              <br />
              need.
            </h1>
            <p className="mt-8 max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Grade and identify your cards, submit them to PSA, TAG, and the
              other majors without leaving home, then buy, sell, and auction —
              all in one place. One account, from the first photo to the final
              sale.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href={signedIn ? "/dashboard" : "/signup"} className={BTN_SOLID}>
                {signedIn ? "Open dashboard" : "Start free"}
              </Link>
              <Link href="/pricing" className={BTN_OUTLINE}>
                See pricing
              </Link>
            </div>
            <p className="mt-6 text-xs text-zinc-500">
              Free to start. No card required. Grading fees are always shown at
              cost — no surprises.
            </p>
          </div>

          {/* HERO MOCKUP */}
          <div className="border border-black/10 bg-white dark:border-white/15 dark:bg-black">
            <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/15">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                Intake
              </span>
              <span className="font-mono text-[11px] text-zinc-500">
                SAC-000142
              </span>
            </div>
            <div className="space-y-4 p-5 text-sm">
              <div className="flex gap-2">
                <div className="flex h-20 w-14 items-center justify-center border border-black/10 text-[9px] uppercase tracking-widest text-zinc-400 dark:border-white/15">
                  Front
                </div>
                <div className="flex h-20 w-14 items-center justify-center border border-black/10 text-[9px] uppercase tracking-widest text-zinc-400 dark:border-white/15">
                  Back
                </div>
                <div className="ml-auto self-start border border-black/15 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] dark:border-white/20">
                  96% match
                </div>
              </div>
              <div className="border-t border-black/10 pt-3 dark:border-white/15">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                  Identified
                </p>
                <p className="mt-1 font-medium">
                  2018-19 Panini Prizm · Luka Dončić · #280
                </p>
                <p className="text-[12px] text-zinc-500">
                  Silver Prizm · Rookie · Basketball
                </p>
              </div>
              <div className="grid grid-cols-2 gap-px border border-black/10 bg-black/10 dark:border-white/15 dark:bg-white/15">
                <div className="bg-white p-3 dark:bg-black">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                    Grade
                  </p>
                  <p className="text-[15px] font-medium">PSA 10</p>
                </div>
                <div className="bg-white p-3 dark:bg-black">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                    FMV
                  </p>
                  <p className="text-[15px] font-medium tabular-nums">$1,650</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CAPABILITIES — the one-stop shop */}
      <section className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <div className="max-w-2xl">
            <p className={EYEBROW}>One platform</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Five things you used to need five sites for.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Stop juggling a grader, a marketplace, an auction house, and a
              spreadsheet. APEX TCG does the whole loop.
            </p>
          </div>

          <div className="mt-16 grid gap-px border border-black/10 bg-black/10 sm:grid-cols-2 lg:grid-cols-3 dark:border-white/15 dark:bg-white/15">
            <Capability
              n="01"
              title="Grade & identify"
              body="Photograph the front and back. Get the set, year, number, and variant with a match confidence — then serialize, value, and track every card."
            />
            <Capability
              n="02"
              title="Submit to graders"
              soon
              body="Send cards to PSA, TAG, and the majors without the paperwork. We handle intake, insured shipping, and tracking — you watch the status from your dashboard."
            />
            <Capability
              n="03"
              title="Buy cards & rips"
              body="Shop singles and live rips from the floor. Pull cards, send them straight to grading, or list them right back for sale."
            />
            <Capability
              n="04"
              title="Sell to us"
              body="Sell cards you own — or cards you just pulled — to APEX at fair market value, with a clean record of every transaction."
            />
            <Capability
              n="05"
              title="Auction"
              soon
              body="List your best cards to the highest bidder, or bid on cards other collectors put up. Settled and tracked inside the same account."
            />
            <Capability
              n="06"
              title="Track everything"
              body="Every card gets a serial and a status — received, grading, graded, listed, sold, or returned — with grade and confirmed value on file."
            />
          </div>
        </div>
      </section>

      {/* SUBMIT-TO-GRADERS / TRANSPARENT PRICING — trust */}
      <section className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto grid w-full max-w-6xl gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-20">
          <div>
            <p className={EYEBROW}>Submit to graders</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              The grading fee you see is the grading fee they charge.
            </h2>
            <p className="mt-6 max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
              When you submit through APEX, you pay the grading company&apos;s
              fee and insured shipping at cost — we never mark them up. We add one
              flat service fee for doing the work, and that&apos;s the only piece
              your membership ever discounts.
            </p>
            <p className="mt-4 max-w-md text-sm leading-6 text-zinc-500">
              No bundled costs, no padded shipping, no &ldquo;handling&rdquo;
              games. Just the grade, at cost, plus a service fee you can see
              before you commit.
            </p>
            <Link href="/pricing" className={`mt-10 ${BTN_OUTLINE}`}>
              See grading fees
            </Link>
          </div>

          {/* PRICE BREAKDOWN MOCKUP */}
          <div className="border border-black/10 bg-white dark:border-white/15 dark:bg-black">
            <div className="border-b border-black/10 px-5 py-3 dark:border-white/15">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                What you pay
              </span>
            </div>
            <div className="divide-y divide-black/10 text-sm dark:divide-white/15">
              <Line label="Grading company fee" value="at cost" />
              <Line label="Insured shipping, both ways" value="at cost" />
              <Line label="APEX service fee" value="$12.00" />
              <div className="flex items-center justify-between bg-black/[0.03] px-5 py-4 dark:bg-white/[0.04]">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                  Dealer member
                </span>
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  −20% service fee
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING TEASER — membership tiers */}
      <section className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <div className="max-w-2xl">
            <p className={EYEBROW}>Membership</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Grade more, pay less. Like the clubs you already know.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
              A membership bundles grading credits and trims our service fee — it
              never touches the grader&apos;s cost. Start free; upgrade when you
              submit enough to save.
            </p>
          </div>

          <div className="mt-16 grid gap-px border border-black/10 bg-black/10 lg:grid-cols-3 dark:border-white/15 dark:bg-white/15">
            <TeaserTier
              name="Free"
              price="$0"
              cadence="forever"
              points={[
                "Photo ID & serialized records",
                "Buy, sell & (soon) auction",
                "Submit at standard service fee",
              ]}
            />
            <TeaserTier
              name="Collector"
              price="$99"
              cadence="/year"
              points={[
                "3 grading credits / year",
                "10% off every service fee",
                "Priority ID & value estimates",
              ]}
            />
            <TeaserTier
              name="Dealer"
              price="$299"
              cadence="/year"
              featured
              points={[
                "12 grading credits / year",
                "20% off + bulk submission rates",
                "Unlimited cards & submitters",
              ]}
            />
          </div>
          <div className="mt-8">
            <Link href="/pricing" className={BTN_SOLID}>
              Compare plans
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <div className="max-w-2xl">
            <p className={EYEBROW}>How it works</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              From two photos to a graded, tracked asset.
            </h2>
          </div>

          <ol className="mt-16 grid gap-px border border-black/10 bg-black/10 sm:grid-cols-3 dark:border-white/15 dark:bg-white/15">
            <Step
              n="01"
              title="Photograph & identify"
              body="Front and back. Identification fills in the set, year, number, and variant with a confidence score — every field stays editable."
            />
            <Step
              n="02"
              title="Submit or list"
              body="Send it to a grading company at cost plus a flat service fee, or list it to buy, sell, or auction — all from the same record."
            />
            <Step
              n="03"
              title="Track to payout"
              body="Follow the card through grading, sale, or auction, with the grade and confirmed fair market value on file the whole way."
            />
          </ol>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-28">
        <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            One home for the whole hobby.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-zinc-600 dark:text-zinc-400">
            Grade it, submit it, buy it, sell it, auction it — and keep a clean
            record of every card from the first photo to the final payout.
          </p>
          <Link
            href={signedIn ? "/dashboard" : "/signup"}
            className={`mt-10 ${BTN_SOLID}`}
          >
            {signedIn ? "Open dashboard" : "Start free"}
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Capability({
  n,
  title,
  body,
  soon,
}: {
  n: string;
  title: string;
  body: string;
  soon?: boolean;
}) {
  return (
    <div className="bg-white p-8 dark:bg-black">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-zinc-400">{n}</span>
        {soon && (
          <span className="border border-black/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:border-white/20">
            Coming soon
          </span>
        )}
      </div>
      <h3 className="mt-3 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {body}
      </p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function TeaserTier({
  name,
  price,
  cadence,
  points,
  featured,
}: {
  name: string;
  price: string;
  cadence: string;
  points: string[];
  featured?: boolean;
}) {
  return (
    <div
      className={
        featured
          ? "bg-black p-10 text-white dark:bg-white dark:text-black"
          : "bg-white p-10 dark:bg-black"
      }
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.3em] ${
          featured ? "text-zinc-400" : "text-zinc-400"
        }`}
      >
        {name}
      </p>
      <p className="mt-4 text-4xl font-semibold tracking-tight">
        {price}
        <span
          className={`text-base font-normal ${
            featured ? "text-zinc-400" : "text-zinc-500"
          }`}
        >
          {" "}
          {cadence}
        </span>
      </p>
      <ul className="mt-8 space-y-3 text-sm">
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="bg-white p-8 dark:bg-black">
      <span className="font-mono text-xs text-zinc-400">{n}</span>
      <h3 className="mt-3 text-sm font-semibold uppercase tracking-[0.12em]">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {body}
      </p>
    </li>
  );
}
