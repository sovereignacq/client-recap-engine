import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cardTitle, formatMoneyCents } from "@/lib/cards";
import { getRole, isStaff } from "@/lib/roles";
import { siteUrl } from "@/lib/site-url";
import {
  BuyClient,
  type Tier,
  type Mode,
  type Category,
  type OwnedCard,
  type PackCredit,
  type SpinPrize,
} from "./buy-client";

export const maxDuration = 30;

/** Privacy: show only the first 2 letters of a pull handle, mask the rest. */
function maskHandle(name: string): string {
  const n = (name ?? "").trim();
  if (!n) return "Someone";
  const keep = n.slice(0, 2);
  const masked = "•".repeat(Math.max(2, n.length - keep.length));
  return keep + masked;
}

type OpeningRow = {
  id: string;
  tier_key: string;
  price_cents: number;
  card_fmv_cents: number | null;
  outcome: string | null;
  profit_cents: number | null;
  created_at: string;
};

export default async function BuyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tierRows } = await supabase
    .from("pack_tiers")
    .select("key, name, price_cents, odds, pity_threshold, pull_min_cents, pull_max_cents")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const tiers: Tier[] = (tierRows ?? []).map((t) => ({
    key: t.key,
    name: t.name,
    priceCents: t.price_cents,
    odds: (t.odds as Tier["odds"]) ?? [],
    pityThreshold: t.pity_threshold ?? 10,
    pullMinCents: t.pull_min_cents ?? null,
    pullMaxCents: t.pull_max_cents ?? null,
  }));

  const { data: modeRows } = await supabase
    .from("pack_modes")
    .select("key, name, price_mult, weight_mults")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const modes: Mode[] = (modeRows ?? []).map((m) => ({
    key: m.key,
    name: m.name,
    priceMult: Number(m.price_mult),
    weightMults: (m.weight_mults as Record<string, number>) ?? {},
  }));

  const { data: catRows } = await supabase
    .from("pack_categories")
    .select("key, name, active, price_mult")
    .order("sort_order", { ascending: true });
  const categories: Category[] = (catRows ?? []).map((c) => ({
    key: c.key,
    name: c.name,
    active: c.active,
    priceMult: Number(c.price_mult),
  }));
  const activeCategory = categories.find((c) => c.active)?.key ?? "pokemon";

  // Pool size for the active category via a definer function (customers can't
  // read house inventory rows directly).
  const { data: poolCount } = await supabase.rpc("pack_pool_count", {
    p_category: activeCategory,
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "balance_cents, withdrawable_cents, age_confirmed_at, play_paused_until, daily_spend_limit_cents, daily_deposit_limit_cents, referral_code, checkin_streak, checkin_total, last_checkin_at, last_spin_at",
    )
    .eq("id", user.id)
    .maybeSingle();
  const balance = profile?.balance_cents ?? 0;
  const withdrawable = profile?.withdrawable_cents ?? 0;
  const ageConfirmed = !!profile?.age_confirmed_at;
  const emailVerified = !!user.email_confirmed_at;
  const pausedUntil =
    profile?.play_paused_until &&
    new Date(profile.play_paused_until) > new Date()
      ? profile.play_paused_until
      : null;

  // Rewards reset on a rolling 24h cooldown (closes the midnight double-claim).
  const COOLDOWN_MS = 24 * 60 * 60 * 1000;
  const nowMs = new Date().getTime();
  const checkinClaimable =
    !profile?.last_checkin_at ||
    nowMs - new Date(profile.last_checkin_at).getTime() >= COOLDOWN_MS;
  const spinClaimable =
    !profile?.last_spin_at ||
    nowMs - new Date(profile.last_spin_at).getTime() >= COOLDOWN_MS;
  // When each reward unlocks again (ISO), or null if it's claimable now.
  const checkinNextAt =
    !checkinClaimable && profile?.last_checkin_at
      ? new Date(
          new Date(profile.last_checkin_at).getTime() + COOLDOWN_MS,
        ).toISOString()
      : null;
  const spinNextAt =
    !spinClaimable && profile?.last_spin_at
      ? new Date(
          new Date(profile.last_spin_at).getTime() + COOLDOWN_MS,
        ).toISOString()
      : null;

  // Referral identity + share link, plus how many referrals have paid off.
  const referralCode = profile?.referral_code ?? "";
  const referralUrl = referralCode
    ? `${siteUrl()}/signup?ref=${referralCode}`
    : "";
  const [{ count: refQualified }, { count: refPending }] = await Promise.all([
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", user.id)
      .eq("status", "qualified"),
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", user.id)
      .eq("status", "pending"),
  ]);

  // Odds modes unlock only after the buyer's first completed withdrawal.
  const { count: paidWithdrawals } = await supabase
    .from("withdrawal_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "paid");
  const canChangeOdds = (paidWithdrawals ?? 0) > 0;

  // Unredeemed free-pack credits.
  const { data: creditRows } = await supabase
    .from("pack_credits")
    .select("id, tier_key, mystery, source, created_at")
    .eq("user_id", user.id)
    .is("consumed_at", null)
    .order("created_at", { ascending: true });
  const credits: PackCredit[] = (creditRows ?? []).map((c) => ({
    id: c.id,
    tierKey: c.tier_key,
    mystery: c.mystery,
    source: c.source,
  }));

  // Daily-spin prize faces (for the wheel display).
  const { data: prizeRows } = await supabase
    .from("spin_prizes")
    .select("key, label, kind, amount_cents, tier_key, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  const spinPrizes: SpinPrize[] = (prizeRows ?? []).map((p) => ({
    key: p.key,
    label: p.label,
    kind: p.kind as SpinPrize["kind"],
    amountCents: p.amount_cents,
    tierKey: p.tier_key,
  }));

  const { data: pityRows } = await supabase
    .from("pack_pity")
    .select("tier_key, category_key, count")
    .eq("buyer_id", user.id);
  const pityByTier: Record<string, number> = {};
  (pityRows ?? []).forEach((p) => {
    pityByTier[`${p.category_key}:${p.tier_key}`] = p.count;
  });

  // Cards the player owns and can consolidate via trade-up — pulls and
  // collected/intaked cards alike (anything not in the house pool).
  const { data: ownedRows } = await supabase
    .from("cards")
    .select(
      "id, serial, fmv_cents, auto_grade_label, image_url, card_year, manufacturer, set_name, player_or_character, card_number, variant",
    )
    .eq("owner_id", user.id)
    .in("status", ["won", "received", "identified", "graded"])
    .eq("in_inventory", false)
    .is("archived_at", null)
    .not("fmv_cents", "is", null)
    .gt("fmv_cents", 0)
    .order("fmv_cents", { ascending: false })
    .limit(60);

  const ownedCards: OwnedCard[] = (ownedRows ?? []).map((c) => ({
    id: c.id,
    serial: c.serial,
    fmvCents: c.fmv_cents ?? 0,
    grade: c.auto_grade_label ?? null,
    title: cardTitle(c),
    imageUrl: c.image_url ?? null,
  }));

  const { data: openings } = await supabase
    .from("pack_openings")
    .select("id, tier_key, price_cents, card_fmv_cents, outcome, profit_cents, created_at")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const history = (openings ?? []) as OpeningRow[];
  const net = history.reduce((sum, o) => sum + (o.profit_cents ?? 0), 0);

  const { data: feedRows } = await supabase.rpc("recent_pulls", { p_limit: 15 });
  const tierName = new Map(tiers.map((t) => [t.key, t.name]));
  const feed = (feedRows ?? []) as {
    tier_key: string;
    fmv_cents: number | null;
    price_cents: number;
    outcome: string | null;
    created_at: string;
    handle: string;
    card_name: string | null;
    image_url: string | null;
  }[];

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-4xl space-y-10">
        <header>
          <Link
            href="/dashboard"
            className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 hover:text-black dark:hover:text-white"
          >
            ← My collection
          </Link>
          <h1 className="mt-2 text-3xl font-bold uppercase tracking-[0.1em]">
            Apex Play
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Pick a tier, open a pack, get one random card. You might land below,
            around, or above what you paid — the odds are on every tier. Play for fun.
          </p>
        </header>

        <BuyClient
          tiers={tiers}
          modes={modes}
          canChangeOdds={canChangeOdds}
          categories={categories}
          activeCategory={activeCategory}
          poolAvailable={((poolCount as number) ?? 0) > 0}
          ownedCards={ownedCards}
          balance={balance}
          withdrawable={withdrawable}
          pityByTier={pityByTier}
          credits={credits}
          spinPrizes={spinPrizes}
          checkin={{
            claimable: checkinClaimable,
            streak: profile?.checkin_streak ?? 0,
            total: profile?.checkin_total ?? 0,
          }}
          spinClaimable={spinClaimable}
          checkinNextAt={checkinNextAt}
          spinNextAt={spinNextAt}
          emailVerified={emailVerified}
          referralCode={referralCode}
          referralUrl={referralUrl}
          referralQualified={refQualified ?? 0}
          referralPending={refPending ?? 0}
          staff={isStaff(await getRole())}
          ageConfirmed={ageConfirmed}
          pausedUntil={pausedUntil}
          spendLimitCents={profile?.daily_spend_limit_cents ?? null}
          depositLimitCents={profile?.daily_deposit_limit_cents ?? null}
        />

        {feed.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Live pulls
            </h2>
            <ul className="divide-y divide-black/10 border border-black/10 dark:divide-white/15 dark:border-white/15">
              {feed.map((f, i) => {
                const win = f.outcome === "above";
                return (
                  <li
                    key={i}
                    className="flex items-center gap-3 px-5 py-2.5 text-sm"
                  >
                    {f.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.image_url}
                        alt=""
                        loading="lazy"
                        className="h-10 w-7 shrink-0 rounded-sm border border-black/10 bg-white object-contain dark:border-white/15 dark:bg-black"
                      />
                    ) : (
                      <div className="h-10 w-7 shrink-0 rounded-sm border border-dashed border-black/15 dark:border-white/20" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{maskHandle(f.handle)}</span>
                      <span className="text-zinc-500">
                        {" "}
                        pulled{" "}
                      </span>
                      <span className="font-medium">{f.card_name ?? "a card"}</span>
                      <span className="text-zinc-500">
                        {" "}
                        · {tierName.get(f.tier_key) ?? f.tier_key}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 tabular-nums ${
                        win ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-zinc-500"
                      }`}
                    >
                      {formatMoneyCents(f.fmv_cents)}
                      {win ? " ↑" : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Your rips
            </h2>
            {history.length > 0 && (
              <span className="text-sm">
                Net{" "}
                <span
                  className={`font-semibold tabular-nums ${
                    net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {net >= 0 ? "+" : "−"}
                  {formatMoneyCents(Math.abs(net))}
                </span>
              </span>
            )}
          </div>
          {history.length > 0 ? (
            <ul className="border border-black/10 dark:border-white/15">
              {history.map((o) => {
                const profit = o.profit_cents ?? 0;
                return (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-3 text-sm last:border-0 dark:border-white/15"
                  >
                    <span className="capitalize">{o.tier_key}</span>
                    <span className="text-zinc-500">
                      paid {formatMoneyCents(o.price_cents)} · got{" "}
                      {formatMoneyCents(o.card_fmv_cents)}
                    </span>
                    <span
                      className={`font-medium tabular-nums ${
                        profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {profit >= 0 ? "+" : "−"}
                      {formatMoneyCents(Math.abs(profit))}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="border border-dashed border-black/20 p-8 text-center text-sm text-zinc-500 dark:border-white/20">
              No rips yet. Open a pack above.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
