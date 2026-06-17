import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PricingButtons } from "./pricing-buttons";

export const metadata = {
  title: "Pricing — client-recap-engine",
};

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16">
      <div className="w-full max-w-4xl space-y-12">
        <header className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Simple, transparent pricing
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Start free. Upgrade when you outgrow it.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Free */}
          <div className="rounded-2xl border border-zinc-200 p-8 dark:border-zinc-800">
            <h2 className="text-lg font-semibold">Free</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              For trying it out.
            </p>
            <p className="mt-6 text-4xl font-semibold">$0</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">forever</p>

            <ul className="mt-6 space-y-2 text-sm">
              <li>• 1 client</li>
              <li>• 3 recaps per month</li>
              <li>• Email support</li>
            </ul>

            <div className="mt-8">
              {user ? (
                <Link
                  href="/dashboard"
                  className="block w-full rounded-md border border-zinc-300 px-4 py-2 text-center text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Current plan
                </Link>
              ) : (
                <Link
                  href="/signup"
                  className="block w-full rounded-md border border-zinc-300 px-4 py-2 text-center text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Get started
                </Link>
              )}
            </div>
          </div>

          {/* Pro */}
          <div className="relative rounded-2xl border-2 border-zinc-900 p-8 dark:border-white">
            <span className="absolute -top-3 left-8 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-zinc-900">
              14-day free trial
            </span>
            <h2 className="text-lg font-semibold">Pro</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              For client-facing professionals.
            </p>
            <p className="mt-6 text-4xl font-semibold">
              $29
              <span className="text-base font-normal text-zinc-600 dark:text-zinc-400">
                {" "}
                /month
              </span>
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              or $290/yr — save $58
            </p>

            <ul className="mt-6 space-y-2 text-sm">
              <li>• Unlimited clients</li>
              <li>• Unlimited recaps</li>
              <li>• Priority support</li>
              <li>• 14-day free trial, no card holds</li>
            </ul>

            <div className="mt-8">
              {user ? (
                <PricingButtons />
              ) : (
                <Link
                  href="/signup?next=/pricing"
                  className="block w-full rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  Sign up to start trial
                </Link>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-500 dark:text-zinc-500">
          Prices in USD. Cancel anytime in your billing portal.
        </p>
      </div>
    </main>
  );
}
