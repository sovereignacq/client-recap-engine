import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-black/10 py-12 text-sm text-zinc-500 dark:border-white/15">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
        <p className="text-[11px] uppercase tracking-[0.2em]">
          © {new Date().getFullYear()} APEX TCG
        </p>
        <nav className="flex items-center gap-6 text-[11px] uppercase tracking-[0.15em]">
          <Link href="/pricing" className="transition hover:text-black dark:hover:text-white">
            Pricing
          </Link>
          <Link href="/login" className="transition hover:text-black dark:hover:text-white">
            Sign in
          </Link>
          <Link href="/signup" className="transition hover:text-black dark:hover:text-white">
            Get started
          </Link>
        </nav>
      </div>
    </footer>
  );
}
