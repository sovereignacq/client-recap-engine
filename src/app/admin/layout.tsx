import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole, isStaff } from "@/lib/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getRole();
  if (!isStaff(role)) redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-baseline gap-3">
            <Link href="/admin" className="text-base font-bold uppercase tracking-[0.25em]">
              APEX&nbsp;TCG
            </Link>
            <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
              Back office
            </span>
          </div>
          <nav className="flex items-center gap-4 text-[11px] font-medium uppercase tracking-[0.15em]">
            <Link href="/admin" className="text-zinc-500 hover:text-black dark:hover:text-white">
              Overview
            </Link>
            <Link href="/admin/cards" className="text-zinc-500 hover:text-black dark:hover:text-white">
              Submissions
            </Link>
            <Link href="/admin/offers" className="text-zinc-500 hover:text-black dark:hover:text-white">
              Sell offers
            </Link>
            <Link
              href="/dashboard"
              className="rounded-none border border-black/20 px-3 py-1.5 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
            >
              My collection
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
