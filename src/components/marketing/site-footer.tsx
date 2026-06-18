import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 py-10 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
        <p>
          © {new Date().getFullYear()} Sovereign Grading. All rights reserved.
        </p>
        <nav className="flex items-center gap-6">
          <Link href="/pricing" className="hover:text-zinc-900 dark:hover:text-zinc-50">
            Pricing
          </Link>
          <Link href="/login" className="hover:text-zinc-900 dark:hover:text-zinc-50">
            Sign in
          </Link>
          <Link href="/signup" className="hover:text-zinc-900 dark:hover:text-zinc-50">
            Get started
          </Link>
        </nav>
      </div>
    </footer>
  );
}
