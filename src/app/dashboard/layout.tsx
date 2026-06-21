import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { getRole, isStaff } from "@/lib/roles";
import { NavMenu } from "@/components/nav-menu";
import { WarningBanner } from "./warning-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const staff = isStaff(await getRole());

  const { data: profile } = await supabase
    .from("profiles")
    .select("suspended_at, suspended_reason")
    .eq("id", user.id)
    .maybeSingle();

  const { data: warnings } = await supabase
    .from("user_warnings")
    .select("reason")
    .eq("user_id", user.id)
    .is("acknowledged_at", null)
    .order("created_at", { ascending: false });

  const suspended = !!profile?.suspended_at;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white/85 backdrop-blur dark:border-white/15 dark:bg-black/85">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:h-16 sm:flex-nowrap sm:py-0 sm:px-6">
          <Link
            href="/dashboard"
            className="shrink-0 text-base font-bold uppercase tracking-[0.25em]"
          >
            APEX&nbsp;TCG
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <NavMenu
              links={[{ label: "Home", href: "/dashboard" }]}
              groups={[
                {
                  label: "Collection",
                  items: [
                    { label: "My cards", href: "/dashboard/cards" },
                    { label: "Submitters", href: "/dashboard/submitters" },
                  ],
                },
                {
                  label: "Play & shop",
                  items: [
                    { label: "Apex Play", href: "/dashboard/buy" },
                    { label: "Sell to us", href: "/dashboard/offers" },
                  ],
                },
                {
                  label: "Account",
                  items: [{ label: "Plan & pricing", href: "/pricing" }],
                },
              ]}
            />
            <Link
              href="/dashboard/cards/new"
              className="hidden rounded-none bg-black px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition hover:bg-zinc-800 sm:inline-block dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Intake a card
            </Link>
            {staff && (
              <Link
                href="/admin"
                className="rounded-none border border-black/20 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.15em] hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
              >
                Back office
              </Link>
            )}
            <form action={logout}>
              <button
                type="submit"
                className="rounded-none border border-black/20 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.15em] transition hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {(suspended || (warnings && warnings.length > 0)) && (
        <div className="mx-auto w-full max-w-6xl space-y-3 px-4 pt-6 sm:px-6">
          {suspended && (
            <div className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
              <p className="font-semibold">Your account is suspended.</p>
              <p className="mt-1">
                You can view your collection, but buying, spinning, withdrawing,
                and shipping are paused
                {profile?.suspended_reason ? `: ${profile.suspended_reason}` : "."}
              </p>
            </div>
          )}
          <WarningBanner reasons={(warnings ?? []).map((w) => w.reason)} />
        </div>
      )}

      {children}
    </div>
  );
}
