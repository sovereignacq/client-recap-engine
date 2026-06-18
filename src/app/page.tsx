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
            <p className={EYEBROW}>Identification · Serialization · Grading</p>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Know exactly
              <br />
              what card
              <br />
              you&apos;re holding.
            </h1>
            <p className="mt-8 max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Photograph the front and back. Get the set, year, number, and
              variant — no guesswork. Then serialize it, value it, and track
              every card from intake to payout.
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
              Value is confirmed by you, on a card you&apos;ve verified — never
              guessed.
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

      {/* FEATURES */}
      <section className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <div className="max-w-2xl">
            <p className={EYEBROW}>Built for intake</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Right card. Right value. Every time.
            </h2>
          </div>

          <div className="mt-16 grid gap-px border border-black/10 bg-black/10 sm:grid-cols-2 lg:grid-cols-3 dark:border-white/15 dark:bg-white/15">
            <FeatureCard
              title="Front & back identification"
              body="Photograph both sides. The system reads the category, player or character, year, set, number, and parallel — sports and TCG alike — with a match confidence."
            />
            <FeatureCard
              title="No wrong card, wrong price"
              body="Identification never returns a price. Value is a separate step, locked until you confirm the card, so a misread never carries a bad number."
            />
            <FeatureCard
              title="Automatic serialization"
              body="Every saved card gets a unique, sequential serial — your own cert number to track it through grading and sale."
            />
            <FeatureCard
              title="Submitter record log"
              body="Keep a clean record of everyone who sends cards in to grade, consign, or sell — with each person's full submission history."
            />
            <FeatureCard
              title="Intake-to-payout tracking"
              body="Move each card through received, grading, graded, sold, or returned, with grade and confirmed fair market value on file."
            />
            <FeatureCard
              title="Yours, encrypted"
              body="Row-level security and a private photo store. Your cards, submitters, and records are visible only to you."
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <div className="max-w-2xl">
            <p className={EYEBROW}>How it works</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              From two photos to a serialized record.
            </h2>
          </div>

          <ol className="mt-16 grid gap-px border border-black/10 bg-black/10 sm:grid-cols-3 dark:border-white/15 dark:bg-white/15">
            <Step
              n="01"
              title="Photograph it"
              body="Front and back. Identification fills in the set, year, number, and variant with a confidence score — every field stays editable."
            />
            <Step
              n="02"
              title="Confirm & value"
              body="Verify the identification against the card, then set a fair market value — with an optional estimate for reference."
            />
            <Step
              n="03"
              title="Serialize & track"
              body="Save to assign a unique serial, link the submitter, and follow the card from intake through grading to payout."
            />
          </ol>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <div className="grid gap-px border border-black/10 bg-black/10 sm:grid-cols-2 dark:border-white/15 dark:bg-white/15">
            <div className="bg-white p-10 dark:bg-black">
              <p className={EYEBROW}>Free</p>
              <p className="mt-4 text-5xl font-semibold tracking-tight">$0</p>
              <p className="mt-2 text-sm text-zinc-500">Try it before you commit.</p>
              <ul className="mt-8 space-y-3 text-sm">
                <li>Photo identification</li>
                <li>Serialized card records</li>
                <li>Submitter log</li>
              </ul>
              <Link href="/signup" className={`mt-10 ${BTN_OUTLINE}`}>
                Start free
              </Link>
            </div>

            <div className="bg-black p-10 text-white dark:bg-white dark:text-black">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-400">
                Pro
              </p>
              <p className="mt-4 text-5xl font-semibold tracking-tight">
                $29
                <span className="text-base font-normal text-zinc-400"> /mo</span>
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                Or $290/yr — save ~17%. 14-day free trial.
              </p>
              <ul className="mt-8 space-y-3 text-sm">
                <li>Unlimited cards &amp; submitters</li>
                <li>Priority identification</li>
                <li>Value estimates</li>
                <li>Email support</li>
              </ul>
              <Link
                href="/pricing"
                className="mt-10 inline-flex items-center justify-center rounded-none bg-white px-6 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-black transition hover:bg-zinc-200 dark:bg-black dark:text-white dark:hover:bg-zinc-800"
              >
                Start 14-day trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-28">
        <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Stop second-guessing the stack.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-zinc-600 dark:text-zinc-400">
            Identify it, serialize it, and keep a clean record of every card and
            every submitter — from the first photo to the final payout.
          </p>
          <Link
            href={signedIn ? "/dashboard" : "/signup"}
            className={`mt-10 ${BTN_SOLID}`}
          >
            {signedIn ? "Open dashboard" : "Get started"}
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-white p-8 dark:bg-black">
      <h3 className="text-sm font-semibold uppercase tracking-[0.12em]">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {body}
      </p>
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
