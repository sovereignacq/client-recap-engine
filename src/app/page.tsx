import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { HoloCard } from "@/components/marketing/holo-card";

const BTN_SOLID =
  "inline-flex items-center justify-center rounded-none bg-black px-6 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200";
const BTN_OUTLINE =
  "inline-flex items-center justify-center rounded-none border border-black/20 px-6 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-black transition hover:bg-black/5 dark:border-white/25 dark:text-white dark:hover:bg-white/10";
const BTN_GLOW =
  "inline-flex items-center justify-center rounded-none bg-white px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-zinc-200";
const EYEBROW =
  "text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-400";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = !!user;
  const playHref = signedIn ? "/dashboard/buy" : "/signup";

  return (
    <div className="flex flex-1 flex-col bg-white text-black dark:bg-black dark:text-white">
      <SiteHeader signedIn={signedIn} />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-black/10 dark:border-white/15">
        <div className="pointer-events-none absolute -right-32 -top-24 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-fuchsia-500/20 via-cyan-400/10 to-transparent blur-3xl" />
        <div className="mx-auto grid w-full max-w-6xl gap-14 px-4 py-24 sm:px-6 sm:py-28 lg:grid-cols-2 lg:items-center lg:gap-12">
          <div className="relative">
            <p className={EYEBROW}>Rip · Win · Grade · Buy · Sell</p>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.03] tracking-tight sm:text-6xl lg:text-7xl">
              Feel the
              <br />
              <span className="bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-500 bg-clip-text text-transparent">
                pull.
              </span>
            </h1>
            <p className="mt-8 max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Rip digital packs and pull <strong>real, gradeable cards</strong>{" "}
              — keep them, cash them out, or have them shipped to your door. Then
              grade, submit to all major card graders, buy, and sell, all in
              one account.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href={playHref} className={BTN_SOLID}>
                {signedIn ? "Open a pack" : "Start ripping free"}
              </Link>
              <Link href="/pricing" className={BTN_OUTLINE}>
                See pricing
              </Link>
            </div>
            <p className="mt-6 text-xs text-zinc-500">
              Free to start · published odds &amp; pity timer · win-rate you can
              actually see.
            </p>
          </div>

          {/* HERO CARD FAN */}
          <div className="relative flex h-80 items-center justify-center sm:h-96">
            <HoloCard
              rarity="Rare"
              label="Pull value"
              value="$420"
              tilt="-12deg"
              className="absolute left-4 top-10 z-10 opacity-90 sm:left-12"
            />
            <HoloCard
              rarity="Apex Ultra"
              label="Pull value"
              value="$1,650"
              tilt="0deg"
              className="relative z-20 scale-110"
            />
            <HoloCard
              rarity="Elite"
              label="Pull value"
              value="$960"
              tilt="12deg"
              className="absolute right-4 top-10 z-10 opacity-90 sm:right-12"
            />
          </div>
        </div>
      </section>

      {/* THE GAME — the headline act */}
      <section className="border-b border-black/10 bg-zinc-950 text-white dark:border-white/15">
        <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-fuchsia-400">
              Apex Play · the main event
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
              Every pack is a shot at a grail.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-zinc-400">
              Pick a tier, choose your odds, and rip. The reveal counts up live —
              and what you pull is a real card with a real market value. Bank it
              in your collection, sell it back instantly, or ship it home.
            </p>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            <GameCell title="Rip live" body="A charge-up, then the card drops and the value counts up. The dopamine moment, every time." />
            <GameCell title="Win real cards" body="Pulls are genuine cards from the pool — yours to keep, grade, sell, or ship." />
            <GameCell title="Cash out winnings" body="Sell pulls back at fair value and withdraw real money, with sensible limits." />
            <GameCell title="Daily spins & streaks" body="Free spins, check-in streaks, and trade-ups keep the collection growing." />
          </div>

          <div className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-sm text-zinc-400">
              Published odds, a pity timer that guarantees a hit, and 18+
              responsible-play controls baked in. No mystery math.
            </p>
            <Link href={playHref} className={BTN_GLOW}>
              {signedIn ? "Open your next pack" : "Open your first pack"}
            </Link>
          </div>
        </div>
      </section>

      {/* PLATFORM CAPABILITIES */}
      <section className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <div className="max-w-2xl">
            <p className={EYEBROW}>The whole platform</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Love what you pull? Do everything with it here.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
              The game gets you the card. The platform does the rest — no second
              site, no spreadsheet.
            </p>
          </div>

          <div className="mt-16 grid gap-px border border-black/10 bg-black/10 sm:grid-cols-2 lg:grid-cols-3 dark:border-white/15 dark:bg-white/15">
            <Capability n="01" title="Grade & identify" body="Photograph front and back. Get the set, year, number, and variant with a confidence score, then serialize and value it." />
            <Capability n="02" title="Submit to graders" soon body="Send cards to all the major grading companies — we handle intake, insured shipping, and tracking. Pick whichever grader is open." />
            <Capability n="03" title="Buy cards & rips" body="Shop singles and packs from the floor, then keep, grade, or list what you pull." />
            <Capability n="04" title="Sell to us" body="Sell cards you own — or just pulled — back to APEX at fair market value." />
            <Capability n="05" title="Ship it home" body="Want the physical card? Have any pull mailed to you, insured and fully tracked, for a flat fee." />
            <Capability n="06" title="Track everything" body="Every card gets a serial and a live status — from pull or intake through grading, sale, or your mailbox." />
          </div>
        </div>
      </section>

      {/* GRADING PASS-THROUGH — trust */}
      <section className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto grid w-full max-w-6xl gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-20">
          <div>
            <p className={EYEBROW}>Submit to graders</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              The grading fee you see is the grading fee they charge.
            </h2>
            <p className="mt-6 max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Submit through APEX and you pay the grading company&apos;s fee and
              insured shipping at cost — never marked up. We add one flat service
              fee, and that&apos;s the only piece your membership discounts.
            </p>
            <Link href="/pricing" className={`mt-10 ${BTN_OUTLINE}`}>
              See grading fees
            </Link>
          </div>
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

      {/* MEMBERSHIP TEASER */}
      <section className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <div className="max-w-2xl">
            <p className={EYEBROW}>Membership</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Grade more, pay less.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Memberships bundle grading credits and trim our service fee — never
              the grader&apos;s cost. Start free; upgrade when you submit enough
              to save.
            </p>
          </div>

          <div className="mt-16 grid gap-px border border-black/10 bg-black/10 lg:grid-cols-3 dark:border-white/15 dark:bg-white/15">
            <TeaserTier name="Free" price="$0" cadence="forever" points={["Photo ID & serialized records", "Buy & sell on one platform", "Submit at standard service fee"]} />
            <TeaserTier name="Collector" price="$99" cadence="/year" points={["3 grading credits / year", "10% off every service fee", "Priority ID & value estimates"]} />
            <TeaserTier name="Dealer" price="$299" cadence="/year" featured points={["12 grading credits / year", "20% off + bulk submission rates", "Unlimited cards & submitters"]} />
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
              From a pack to a graded, tracked asset.
            </h2>
          </div>
          <ol className="mt-16 grid gap-px border border-black/10 bg-black/10 sm:grid-cols-3 dark:border-white/15 dark:bg-white/15">
            <Step n="01" title="Rip or intake" body="Open a pack and pull a real card — or photograph one you already own to identify and serialize it." />
            <Step n="02" title="Decide its fate" body="Keep it, sell it back, submit it to a grader at cost plus a flat fee, or have it shipped to your door." />
            <Step n="03" title="Track to payout" body="Follow every card through grading, sale, or delivery, with grade and confirmed value on file." />
          </ol>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden py-28">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-fuchsia-500/15 via-cyan-400/10 to-transparent blur-3xl" />
        <div className="relative mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Your next grail is one rip away.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-zinc-600 dark:text-zinc-400">
            Open a pack, pull a real card, and do everything with it — grade,
            sell, ship, or cash out — without leaving APEX.
          </p>
          <Link href={playHref} className={`mt-10 ${BTN_SOLID}`}>
            {signedIn ? "Open a pack" : "Start ripping free"}
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function GameCell({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-zinc-950 p-6">
      <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-400">
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
