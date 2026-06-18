import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
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

  const { count: clientsCount } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true });

  const { count: recapsCount } = await supabase
    .from("recaps")
    .select("id", { count: "exact", head: true });

  const { count: cardsCount } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true });

  const { count: submittersCount } = await supabase
    .from("submitters")
    .select("id", { count: "exact", head: true });

  const planLabel = subscription
    ? subscription.plan === "pro_annual"
      ? "Pro (annual)"
      : subscription.plan === "pro_monthly"
        ? "Pro (monthly)"
        : "Pro"
    : "Free";

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16">
      <div className="w-full max-w-3xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Signed in as{" "}
              <span className="font-medium">
                {profile?.full_name || profile?.email || user.email}
              </span>
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Sign out
            </button>
          </form>
        </header>

        {params.checkout === "success" && (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Thanks for subscribing. Your trial has started.
          </div>
        )}

        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Link
            href="/dashboard/cards"
            className="rounded-lg border border-zinc-200 p-6 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
          >
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Cards</p>
            <p className="mt-2 text-3xl font-semibold">{cardsCount ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-500">Intake & grade →</p>
          </Link>
          <Link
            href="/dashboard/submitters"
            className="rounded-lg border border-zinc-200 p-6 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
          >
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Submitters
            </p>
            <p className="mt-2 text-3xl font-semibold">{submittersCount ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-500">Record log →</p>
          </Link>
          <Link
            href="/dashboard/clients"
            className="rounded-lg border border-zinc-200 p-6 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
          >
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Clients</p>
            <p className="mt-2 text-3xl font-semibold">{clientsCount ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-500">Manage →</p>
          </Link>
          <Link
            href="/dashboard/recaps"
            className="rounded-lg border border-zinc-200 p-6 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
          >
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Recaps</p>
            <p className="mt-2 text-3xl font-semibold">{recapsCount ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-500">View all →</p>
          </Link>
        </section>

        <section className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Current plan
              </p>
              <p className="mt-1 text-xl font-semibold">{planLabel}</p>
              {subscription && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
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
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
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
