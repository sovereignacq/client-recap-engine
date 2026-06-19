import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { getRole, isStaff } from "@/lib/roles";
import { ManageBillingButton } from "./billing-button";

type SubRow = {
  status: string;
  plan: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_end: string | null;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data: subscription } = (await supabase
    .from("subscriptions")
    .select(
      "status, plan, current_period_end, cancel_at_period_end, trial_end",
    )
    .eq("user_id", user.id)
    .in("status", ["trialing", "active", "past_due", "incomplete"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: SubRow | null };

  const { count: cardsCount } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  const { count: submittersCount } = await supabase
    .from("submitters")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  const { count: offersCount } = await supabase
    .from("offers")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  const staff = isStaff(await getRole());

  const planLabel = subscription
    ? subscription.plan === "pro_annual"
      ? "Pro (annual)"
      : subscription.plan === "pro_monthly"
        ? "Pro (monthly)"
        : "Pro"
    : "Free";

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16">
      <div className="w-full max-w-3xl space-y-10">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold uppercase tracking-[0.25em]">
              APEX&nbsp;TCG
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              My collection · {profile?.full_name || profile?.email || user.email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {staff && (
              <Link
                href="/admin"
                className="rounded-none bg-black px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                Back office
              </Link>
            )}
            <form action={logout}>
              <button
                type="submit"
                className="rounded-none border border-black/20 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] transition hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        {params.checkout === "success" && (
          <div className="border-l-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            Thanks for subscribing. Your trial has started.
          </div>
        )}

        <Link
          href="/dashboard/cards/new"
          className="flex items-center justify-between rounded-none bg-black px-6 py-5 text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          <span className="text-sm font-medium uppercase tracking-[0.18em]">
            Intake a card
          </span>
          <span aria-hidden className="text-lg">→</span>
        </Link>

        <section className="grid grid-cols-1 gap-px border border-black/10 bg-black/10 sm:grid-cols-3 dark:border-white/15 dark:bg-white/15">
          <Link
            href="/dashboard/cards"
            className="bg-white p-8 transition hover:bg-zinc-50 dark:bg-black dark:hover:bg-zinc-950"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Cards
            </p>
            <p className="mt-3 text-4xl font-semibold tabular-nums">
              {cardsCount ?? 0}
            </p>
            <p className="mt-2 text-xs text-zinc-500">Intake &amp; grade →</p>
          </Link>
          <Link
            href="/dashboard/offers"
            className="bg-white p-8 transition hover:bg-zinc-50 dark:bg-black dark:hover:bg-zinc-950"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Sell-to-us
            </p>
            <p className="mt-3 text-4xl font-semibold tabular-nums">
              {offersCount ?? 0}
            </p>
            <p className="mt-2 text-xs text-zinc-500">Offers →</p>
          </Link>
          <Link
            href="/dashboard/submitters"
            className="bg-white p-8 transition hover:bg-zinc-50 dark:bg-black dark:hover:bg-zinc-950"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Submitters
            </p>
            <p className="mt-3 text-4xl font-semibold tabular-nums">
              {submittersCount ?? 0}
            </p>
            <p className="mt-2 text-xs text-zinc-500">Record log →</p>
          </Link>
        </section>

        <section className="border border-black/10 p-6 dark:border-white/15">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                Current plan
              </p>
              <p className="mt-2 text-xl font-semibold">{planLabel}</p>
              {subscription && (
                <p className="mt-1 text-sm text-zinc-500">
                  Status: <span className="font-medium">{subscription.status}</span>
                  {subscription.cancel_at_period_end && " · cancels at period end"}
                  {subscription.trial_end &&
                  new Date(subscription.trial_end) > new Date()
                    ? ` · trial ends ${new Date(subscription.trial_end).toLocaleDateString()}`
                    : subscription.current_period_end
                      ? ` · renews ${new Date(subscription.current_period_end).toLocaleDateString()}`
                      : null}
                </p>
              )}
            </div>
            <div>
              {subscription && profile?.stripe_customer_id ? (
                <ManageBillingButton />
              ) : (
                <Link
                  href="/pricing"
                  className="rounded-none bg-black px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  Upgrade
                </Link>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
