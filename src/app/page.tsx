import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = !!user;

  return (
    <div className="flex flex-1 flex-col bg-white text-zinc-900 dark:bg-black dark:text-zinc-50">
      <SiteHeader signedIn={signedIn} />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(120,120,255,0.08),transparent_60%),radial-gradient(circle_at_70%_100%,rgba(255,180,120,0.06),transparent_60%)]"
        />
        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Powered by Gemini 2.5
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Know exactly what card{" "}
              <span className="bg-gradient-to-r from-zinc-900 to-zinc-500 bg-clip-text text-transparent dark:from-white dark:to-zinc-400">
                you&apos;re holding.
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              Snap a photo and AI identifies the set, year, number, and variant —
              no guesswork. Then serialize it, value it, and track every card from
              intake to payout.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={signedIn ? "/dashboard" : "/signup"}
                className="rounded-md bg-zinc-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              >
                {signedIn ? "Open dashboard" : "Start free — no card needed"}
              </Link>
              <Link
                href="/pricing"
                className="rounded-md border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                See pricing
              </Link>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              Identification never guesses a price — value is confirmed by you, on
              a card you&apos;ve verified.
            </p>
          </div>

          {/* HERO MOCKUP */}
          <div className="relative">
            <div className="rounded-xl border border-zinc-200 bg-white p-1 shadow-2xl shadow-zinc-300/50 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/50">
              <div className="flex items-center gap-1.5 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <span className="ml-3 text-[11px] text-zinc-500">
                  Intake · SAC-000142
                </span>
              </div>
              <div className="space-y-3 p-4 text-sm">
                <div>
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Uploaded photo
                  </p>
                  <div className="flex items-center gap-3 rounded-md bg-zinc-100 p-2 dark:bg-zinc-900">
                    <span
                      aria-hidden
                      className="h-12 w-9 shrink-0 rounded bg-gradient-to-br from-amber-300 via-zinc-200 to-sky-300 dark:from-amber-500/70 dark:via-zinc-600 dark:to-sky-500/70"
                    />
                    <span className="text-[12px] text-zinc-600 dark:text-zinc-400">
                      front_2018_prizm.jpg
                    </span>
                    <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      96% match
                    </span>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Identified
                  </p>
                  <p className="font-medium">
                    2018-19 Panini Prizm · Luka Dončić · #280
                  </p>
                  <p className="text-[12px] text-zinc-600 dark:text-zinc-400">
                    Silver Prizm · Rookie · Basketball
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                      Grade
                    </p>
                    <p className="text-[13px] font-medium">PSA 10</p>
                  </div>
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                      FMV (confirmed)
                    </p>
                    <p className="text-[13px] font-medium tabular-nums">$1,650</p>
                  </div>
                </div>
              </div>
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-6 -bottom-6 -z-10 h-32 bg-gradient-to-t from-zinc-200/60 to-transparent blur-2xl dark:from-zinc-800/40"
            />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="border-b border-zinc-200 bg-zinc-50 py-20 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
              Built for card intake
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Right card. Right value. Every time.
            </h2>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              title="AI identification from a photo"
              body="Gemini reads the card and returns the category, player/character, year, set, number, and parallel — sports cards and TCG alike — with a confidence score."
            />
            <FeatureCard
              title="No wrong-card, wrong-price"
              body="Identification never returns a price. Value is a separate step, locked until you confirm the card — so a misread never carries a bad number."
            />
            <FeatureCard
              title="Automatic serialization"
              body="Every saved card gets a unique, sequential serial like SAC-000142 — your own cert number to track it through grading and sale."
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
              body="Built on Supabase with row-level security and a private photo store. Your cards, submitters, and records are visible only to you."
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-b border-zinc-200 py-20 dark:border-zinc-800">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
              How it works
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              From a photo to a serialized record in three steps.
            </h2>
          </div>

          <ol className="mt-12 grid gap-8 sm:grid-cols-3">
            <Step
              n={1}
              title="Upload a photo"
              body="Snap the front of the card. AI fills in the set, year, number, and variant with a confidence score — every field stays editable."
            />
            <Step
              n={2}
              title="Confirm & value"
              body="Verify the identification against the card, then set a fair market value — with an optional AI ballpark for reference."
            />
            <Step
              n={3}
              title="Serialize & track"
              body="Save to assign a unique serial, link the submitter, and follow the card from intake through grading to payout."
            />
          </ol>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section className="border-b border-zinc-200 py-20 dark:border-zinc-800">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 p-8 dark:border-zinc-800">
              <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                Free
              </p>
              <p className="mt-2 text-4xl font-semibold">$0</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Try it before you commit.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                <li>✓ AI photo identification</li>
                <li>✓ Serialized card records</li>
                <li>✓ Submitter log</li>
              </ul>
              <Link
                href="/signup"
                className="mt-6 inline-block rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Start free
              </Link>
            </div>

            <div className="rounded-xl border-2 border-zinc-900 bg-zinc-900 p-8 text-white dark:border-white dark:bg-white dark:text-zinc-900">
              <p className="text-sm font-medium uppercase tracking-wide opacity-70">
                Pro
              </p>
              <p className="mt-2 text-4xl font-semibold">
                $29
                <span className="text-base font-normal opacity-70">/mo</span>
              </p>
              <p className="mt-1 text-sm opacity-70">
                Or $290/yr — save ~17%. 14-day free trial.
              </p>
              <ul className="mt-6 space-y-2 text-sm">
                <li>✓ Unlimited cards &amp; submitters</li>
                <li>✓ Priority AI identification</li>
                <li>✓ AI value estimates</li>
                <li>✓ Email support</li>
              </ul>
              <Link
                href="/pricing"
                className="mt-6 inline-block rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
              >
                Start 14-day trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24">
        <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Stop second-guessing what&apos;s in the stack.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
            Identify it, serialize it, and keep a clean record of every card and
            every submitter — from the first photo to the final payout.
          </p>
          <Link
            href={signedIn ? "/dashboard" : "/signup"}
            className="mt-8 inline-block rounded-md bg-zinc-900 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            {signedIn ? "Open dashboard" : "Get started — free"}
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-black">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {body}
      </p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="relative rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <span className="absolute -top-3 left-6 inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900">
        {n}
      </span>
      <h3 className="mt-2 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {body}
      </p>
    </li>
  );
}
