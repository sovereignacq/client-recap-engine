import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole, isStaff } from "@/lib/roles";
import { NavMenu } from "@/components/nav-menu";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getRole();
  if (!isStaff(role)) redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white/85 backdrop-blur dark:border-white/15 dark:bg-black/85">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:h-16 sm:flex-nowrap sm:py-0 sm:px-6">
          <div className="flex shrink-0 items-baseline gap-3">
            <Link href="/admin" className="text-base font-bold uppercase tracking-[0.25em]">
              APEX&nbsp;TCG
            </Link>
            <span className="hidden text-[11px] uppercase tracking-[0.2em] text-zinc-400 sm:inline">
              Back office
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <NavMenu
              links={[{ label: "Overview", href: "/admin" }]}
              groups={[
                { label: "People", items: [{ label: "Users", href: "/admin/users" }] },
                {
                  label: "Cards",
                  items: [
                    { label: "Submissions", href: "/admin/cards" },
                    { label: "Inventory", href: "/admin/inventory" },
                    { label: "Slabs", href: "/admin/slabs" },
                    { label: "Archive", href: "/admin/archive" },
                  ],
                },
                {
                  label: "Orders",
                  items: [
                    { label: "Sell offers", href: "/admin/offers" },
                    { label: "Withdrawals", href: "/admin/withdrawals" },
                    { label: "Grading", href: "/admin/grading" },
                    { label: "Shipments", href: "/admin/shipments" },
                  ],
                },
                {
                  label: "Settings",
                  items: [{ label: "Economics", href: "/admin/economics" }],
                },
              ]}
            />
            <Link
              href="/dashboard"
              className="rounded-none border border-black/20 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.15em] hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
            >
              My collection
            </Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
