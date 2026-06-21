import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/roles";
import { formatMoneyCents, cardStatusLabel } from "@/lib/cards";
import { UserControls } from "./user-controls";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const isOwner = (await getRole()) === "owner";

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, role, balance_cents, withdrawable_cents, created_at, suspended_at, suspended_reason, deleted_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!profile) notFound();

  const [{ data: warnings }, { data: txns }, { count: cardCount }] =
    await Promise.all([
      supabase
        .from("user_warnings")
        .select("id, reason, created_at, acknowledged_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("wallet_transactions")
        .select("id, amount_cents, kind, balance_after, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("cards")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", id)
        .is("archived_at", null),
    ]);

  const suspended = !!profile.suspended_at;

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-4xl space-y-8">
        <div>
          <Link
            href="/admin/users"
            className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 hover:text-black dark:hover:text-white"
          >
            ← Users
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {profile.email ?? "—"}
            </h1>
            <span className="border border-black/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:border-white/20">
              {profile.role}
            </span>
            {suspended && (
              <span className="border border-amber-500/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-600 dark:text-amber-400">
                Suspended
              </span>
            )}
            {profile.deleted_at && (
              <span className="border border-red-500/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-red-600 dark:text-red-400">
                Deleted
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {profile.full_name ? `${profile.full_name} · ` : ""}
            joined {new Date(profile.created_at).toLocaleDateString()}
            {suspended && profile.suspended_reason
              ? ` · suspended: ${profile.suspended_reason}`
              : ""}
          </p>
        </div>

        <section className="grid grid-cols-2 gap-px border border-black/10 bg-black/10 sm:grid-cols-4 dark:border-white/15 dark:bg-white/15">
          <Stat label="Wallet" value={formatMoneyCents(profile.balance_cents ?? 0)} />
          <Stat
            label="Withdrawable"
            value={formatMoneyCents(profile.withdrawable_cents ?? 0)}
          />
          <Stat label="Cards" value={String(cardCount ?? 0)} />
          <Stat label="Warnings" value={String(warnings?.length ?? 0)} />
        </section>

        <UserControls
          userId={profile.id}
          suspended={suspended}
          role={profile.role}
          isOwner={isOwner}
        />

        {/* Warnings log */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Warning history
          </h2>
          {warnings && warnings.length > 0 ? (
            <ul className="mt-3 divide-y divide-black/10 border border-black/10 dark:divide-white/15 dark:border-white/15">
              {warnings.map((w) => (
                <li key={w.id} className="flex justify-between gap-4 px-4 py-3 text-sm">
                  <span>{w.reason}</span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {new Date(w.created_at).toLocaleDateString()}
                    {w.acknowledged_at ? " · acknowledged" : " · unread"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">No warnings.</p>
          )}
        </section>

        {/* Recent wallet activity */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Recent wallet activity
          </h2>
          {txns && txns.length > 0 ? (
            <ul className="mt-3 divide-y divide-black/10 border border-black/10 dark:divide-white/15 dark:border-white/15">
              {txns.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
                >
                  <span className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                    {t.kind}
                  </span>
                  <span
                    className={`tabular-nums ${
                      t.amount_cents < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {t.amount_cents < 0 ? "−" : "+"}
                    {formatMoneyCents(Math.abs(t.amount_cents))}
                  </span>
                  <span className="w-24 text-right text-xs tabular-nums text-zinc-500">
                    {formatMoneyCents(t.balance_after)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">No transactions.</p>
          )}
        </section>

        <p className="text-xs text-zinc-500">
          Card statuses include {cardStatusLabel("shipping")} and{" "}
          {cardStatusLabel("shipped")} once a customer requests delivery.
        </p>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4 dark:bg-black">
      <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
