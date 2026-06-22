"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole, isStaff } from "@/lib/roles";

export async function adminUpdateTier(
  key: string,
  priceCents: number,
  pityThreshold: number,
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    return { error: "Price must be greater than 0." };
  }
  if (!Number.isInteger(pityThreshold) || pityThreshold < 1) {
    return { error: "Pity threshold must be a whole number ≥ 1." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("pack_tiers")
    .update({ price_cents: Math.round(priceCents), pity_threshold: pityThreshold })
    .eq("key", key);
  if (error) return { error: error.message };
  revalidatePath("/admin/economics");
  revalidatePath("/dashboard/buy");
}

// Suggested number of distinct cards a full tier should hold, spread across
// bands by their odds so frequently-hit bands have variety.
const TARGET_POOL_PER_TIER = 30;
const MIN_PER_BAND = 2;

type EconBand = {
  label: string;
  loCents: number;
  hiCents: number;
  weight: number;
  probPct: number; // chance of this band given current stock (0 if empty)
  poolCnt: number;
  avgFmvCents: number;
  targetCnt: number; // suggested copies for this band
};

type PoolEconRow = {
  tierKey: string;
  name: string;
  priceCents: number;
  evCents: number;
  marginCents: number;
  marginPct: number;
  poolCards: number;
  status: "positive" | "negative" | "empty";
  advice: string;
  bands: EconBand[];
};

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function stockingNote(bands: EconBand[]): string {
  const short = bands
    .filter((b) => b.poolCnt < b.targetCnt)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2);
  if (short.length === 0) return " Stocking levels look good across the bands.";
  return (
    " Under-stocked: " +
    short
      .map((b) => `${b.label} (have ${b.poolCnt}, aim for ${b.targetCnt})`)
      .join(", ") +
    "."
  );
}

function buildAdvice(
  status: PoolEconRow["status"],
  priceCents: number,
  marginCents: number,
  bands: EconBand[],
): string {
  if (status === "empty") {
    return (
      "No cards stocked in this tier's value range yet — add cards in the bands below so it can be pulled." +
      stockingNote(bands)
    );
  }
  const live = bands.filter((b) => b.poolCnt > 0);
  // Band contributing the most to the payout (probability × average value).
  const topDrag = [...live].sort(
    (a, b) => (b.probPct / 100) * b.avgFmvCents - (a.probPct / 100) * a.avgFmvCents,
  )[0];
  // Bands paying out above the pack price (where pricey stock hurts).
  const overpaying = live.filter((b) => b.avgFmvCents > priceCents);

  if (status === "negative") {
    let s = `Losing ${money(Math.abs(marginCents))} per pull. `;
    if (topDrag) {
      s += `Biggest drag: the ${topDrag.label} band (${topDrag.probPct.toFixed(0)}% of pulls, averaging ${money(topDrag.avgFmvCents)} across ${topDrag.poolCnt} card${topDrag.poolCnt === 1 ? "" : "s"}). `;
    }
    if (overpaying.length) {
      s += `Stock cheaper cards (or remove the priciest) in ${overpaying.map((b) => b.label).join(", ")}, and add more cards under ${money(priceCents)}.`;
    } else {
      s += `Add more low-value cards (under ${money(priceCents)}) to bring the average pull below the pack price.`;
    }
    return s + stockingNote(bands);
  }
  // positive
  let s = `Healthy — keeping ${money(marginCents)} per pull. `;
  if (overpaying.length) {
    s += `Watch ${overpaying.map((b) => b.label).join(", ")}: adding pricey cards there will erode the margin. `;
  }
  s += `Keep most inventory in the lower bands to stay positive.`;
  return s + stockingNote(bands);
}

/** Live per-tier + per-band house economics, computed from the current pool. */
export async function getPoolEconomicsAction(): Promise<PoolEconRow[]> {
  if (!isStaff(await getRole())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tier_pull_economics_bands");
  if (error || !Array.isArray(data)) return [];

  const rows = data as {
    tier_key: string;
    name: string;
    price_cents: number;
    band_label: string;
    lo_cents: number;
    hi_cents: number;
    weight: number;
    pool_cnt: number;
    avg_fmv_cents: number;
  }[];

  // Group bands by tier (RPC already returns them in order).
  const byTier = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byTier.get(r.tier_key) ?? [];
    arr.push(r);
    byTier.set(r.tier_key, arr);
  }

  const out: PoolEconRow[] = [];
  for (const [tierKey, tierRows] of byTier) {
    const priceCents = tierRows[0].price_cents;
    // Only bands with stock can be pulled; their weights renormalize (matches open_pack).
    const liveWeight = tierRows
      .filter((r) => r.pool_cnt > 0)
      .reduce((s, r) => s + Number(r.weight), 0);
    const totalWeight = tierRows.reduce((s, r) => s + Number(r.weight), 0) || 1;

    const bands: EconBand[] = tierRows.map((r) => ({
      label: r.band_label,
      loCents: r.lo_cents,
      hiCents: r.hi_cents,
      weight: Number(r.weight),
      probPct: r.pool_cnt > 0 && liveWeight > 0 ? (Number(r.weight) / liveWeight) * 100 : 0,
      poolCnt: r.pool_cnt,
      avgFmvCents: r.avg_fmv_cents,
      targetCnt: Math.max(
        MIN_PER_BAND,
        Math.round((Number(r.weight) / totalWeight) * TARGET_POOL_PER_TIER),
      ),
    }));

    const poolCards = bands.reduce((s, b) => s + b.poolCnt, 0);
    const evCents =
      liveWeight > 0
        ? Math.round(
            bands.reduce((s, b) => s + (b.probPct / 100) * b.avgFmvCents, 0),
          )
        : 0;
    const marginCents = poolCards > 0 ? priceCents - evCents : 0;
    const marginPct =
      poolCards > 0 && priceCents > 0
        ? Math.round((marginCents / priceCents) * 1000) / 10
        : 0;
    const status: PoolEconRow["status"] =
      poolCards === 0 ? "empty" : marginCents >= 0 ? "positive" : "negative";

    out.push({
      tierKey,
      name: tierRows[0].name,
      priceCents,
      evCents,
      marginCents,
      marginPct,
      poolCards,
      status,
      advice: buildAdvice(status, priceCents, marginCents, bands),
      bands,
    });
  }
  return out;
}

type StockSegment = {
  loCents: number;
  hiCents: number;
  poolCnt: number;
  tiers: string[];
  targetCnt: number;
};

/**
 * Consolidated stocking plan: tiers share one pool, so their value bands
 * overlap. This merges them into unified price segments — a card in a segment
 * counts for every tier listed — so inventory is planned once, by value.
 */
export async function getStockingPlanAction(): Promise<StockSegment[]> {
  if (!isStaff(await getRole())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pool_stocking_plan");
  if (error || !Array.isArray(data)) return [];
  return (
    data as {
      lo_cents: number;
      hi_cents: number;
      pool_cnt: number;
      tiers: string[];
      tier_count: number;
      max_weight: number;
    }[]
  ).map((s) => ({
    loCents: s.lo_cents,
    hiCents: s.hi_cents,
    poolCnt: s.pool_cnt,
    tiers: s.tiers ?? [],
    // Hotter value ranges (higher band weight) and more tiers depending on them
    // want more variety; shared, so this is a single target for the segment.
    targetCnt: Math.max(
      2,
      Math.min(20, Math.round((Number(s.max_weight) / 100) * 18)),
    ),
  }));
}

type DedupeSegment = {
  loCents: number;
  hiCents: number;
  target: number;
  poolCnt: number;
  distinctCnt: number;
  dupCnt: number;
  removableCnt: number;
};

/**
 * Preview of the de-duplication pass: per value segment, how many surplus
 * duplicate copies can be trimmed while still meeting the number of cards the
 * odds require (the target). Only segments that actually hold duplicates appear.
 */
export async function getDedupePreviewAction(): Promise<DedupeSegment[]> {
  if (!isStaff(await getRole())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pool_dedupe_preview");
  if (error || !Array.isArray(data)) return [];
  return (
    data as {
      lo_cents: number;
      hi_cents: number;
      target: number;
      pool_cnt: number;
      distinct_cnt: number;
      dup_cnt: number;
      removable_cnt: number;
    }[]
  ).map((s) => ({
    loCents: s.lo_cents,
    hiCents: s.hi_cents,
    target: s.target,
    poolCnt: s.pool_cnt,
    distinctCnt: s.distinct_cnt,
    dupCnt: s.dup_cnt,
    removableCnt: s.removable_cnt,
  }));
}

/**
 * Run the de-duplication pass: archive surplus duplicate copies out of the pool
 * for every band that already meets its required card count. Distinct variety
 * is preserved and no band drops below its target. Returns how many were removed.
 */
export async function dedupePoolAction(): Promise<{
  ok: boolean;
  removed?: number;
  error?: string;
}> {
  if (!isStaff(await getRole())) return { ok: false, error: "Not authorized." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pool_dedupe_overstocked");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/economics");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  return { ok: true, removed: typeof data === "number" ? data : 0 };
}

// ============ Auto-correct negative pull economics ============

// Target house edge we restore a losing tier to.
const FIX_TARGET_MARGIN = 0.1;

type OddsBucket = {
  key?: string;
  label: string;
  weight: number;
  min_mult: number;
  max_mult: number;
  [k: string]: unknown;
};

type FixChange = { label: string; from: string; to: string };

type EconFixPlan = {
  tierKey: string;
  tierName: string;
  kind: "reweight" | "price";
  priceCents: number;
  evCents: number; // average payout before the fix
  marginCents: number; // house margin before (negative)
  afterEvCents: number;
  afterMarginCents: number;
  afterMarginPct: number;
  why: string;
  what: string;
  changes: FixChange[];
};

type FixBand = {
  bandOrd: number;
  label: string;
  weight: number;
  poolCnt: number;
  avgFmvCents: number;
};

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

/**
 * Pure planner: given a tier's price, odds buckets and live band stats, work out
 * how to bring a money-losing tier back to a healthy margin — by reweighting the
 * odds toward cheaper bands where that's enough, otherwise by raising the price.
 * Returns the human explanation plus the concrete payload to persist.
 */
function buildTierFix(
  tier: { key: string; name: string; priceCents: number; odds: OddsBucket[] },
  bands: FixBand[],
): { plan: EconFixPlan; newOdds?: OddsBucket[]; newPriceCents?: number } | null {
  const price = tier.priceCents;
  const stocked = bands.filter((b) => b.poolCnt > 0);
  if (price <= 0 || stocked.length === 0) return null;

  const W = stocked.reduce((s, b) => s + b.weight, 0);
  if (W <= 0) return null;
  const ev0 = stocked.reduce((s, b) => s + (b.weight / W) * b.avgFmvCents, 0);
  const margin0 = price - ev0;
  if (margin0 >= 0) return null; // only correct tiers that actually lose money

  const target = price * (1 - FIX_TARGET_MARGIN);
  const cheapest = stocked.reduce((a, b) => (b.avgFmvCents < a.avgFmvCents ? b : a));
  const drag = stocked.reduce((a, b) =>
    (b.weight / W) * b.avgFmvCents > (a.weight / W) * a.avgFmvCents ? b : a,
  );

  const whyBase =
    `${tier.name} loses ${money(Math.round(Math.abs(margin0)))} per pull: the ` +
    `average payout (${money(Math.round(ev0))}) is above the ${money(price)} ` +
    `pack price. Biggest drag is the ${drag.label} band — ` +
    `${pct(drag.weight, W).toFixed(0)}% of pulls at ${money(drag.avgFmvCents)}.`;

  // Reweighting can only help if the cheapest stocked band sits at/below target
  // and there's more than one band to move probability between.
  if (cheapest.avgFmvCents <= target && stocked.length >= 2) {
    const pMin = cheapest.weight / W;
    let f = (ev0 - target) / (ev0 - cheapest.avgFmvCents);
    f = Math.max(0, Math.min(1, f));

    const newWeightByOrd = new Map<number, number>();
    for (const b of stocked) {
      const p =
        b.bandOrd === cheapest.bandOrd
          ? pMin + f * (1 - pMin)
          : (b.weight / W) * (1 - f);
      // Preserve the stocked weight sum so empty bands and renormalization are
      // undisturbed; keep at least weight 1 so a band never fully disappears.
      newWeightByOrd.set(b.bandOrd, Math.max(1, Math.round(p * W)));
    }

    const sumNew = [...newWeightByOrd.values()].reduce((s, w) => s + w, 0);
    const afterEv = stocked.reduce(
      (s, b) => s + ((newWeightByOrd.get(b.bandOrd) ?? b.weight) / sumNew) * b.avgFmvCents,
      0,
    );
    const afterMargin = price - afterEv;

    // If rounding left it still negative, fall through to the price fix below.
    if (afterMargin >= 0) {
      const changes: FixChange[] = stocked
        .filter((b) => (newWeightByOrd.get(b.bandOrd) ?? b.weight) !== b.weight)
        .map((b) => ({
          label: `${b.label} band odds`,
          from: `${b.weight}%`,
          to: `${newWeightByOrd.get(b.bandOrd)}%`,
        }));

      const newOdds = tier.odds.map((bucket, i) => {
        const w = newWeightByOrd.get(i + 1);
        return w !== undefined ? { ...bucket, weight: w } : bucket;
      });

      const plan: EconFixPlan = {
        tierKey: tier.key,
        tierName: tier.name,
        kind: "reweight",
        priceCents: price,
        evCents: Math.round(ev0),
        marginCents: Math.round(margin0),
        afterEvCents: Math.round(afterEv),
        afterMarginCents: Math.round(afterMargin),
        afterMarginPct: pct(afterMargin, price),
        why: whyBase,
        what:
          `Shift pull odds toward the cheaper ${cheapest.label} band so the ` +
          `average payout falls to ~${money(Math.round(afterEv))} and the house ` +
          `keeps ${money(Math.round(afterMargin))} (+${pct(afterMargin, price)}%) ` +
          `per pull. Pack price is unchanged.`,
        changes,
      };
      return { plan, newOdds };
    }
  }

  // Price fix: even the cheapest stocked band pays above a healthy price.
  const newPrice = Math.ceil(ev0 / (1 - FIX_TARGET_MARGIN));
  const afterMargin = newPrice - ev0;
  const plan: EconFixPlan = {
    tierKey: tier.key,
    tierName: tier.name,
    kind: "price",
    priceCents: price,
    evCents: Math.round(ev0),
    marginCents: Math.round(margin0),
    afterEvCents: Math.round(ev0),
    afterMarginCents: Math.round(afterMargin),
    afterMarginPct: pct(afterMargin, newPrice),
    why: whyBase,
    what:
      `Raise the pack price from ${money(price)} to ${money(newPrice)} so the ` +
      `${money(Math.round(ev0))} average payout leaves a ${money(Math.round(afterMargin))} ` +
      `(+${FIX_TARGET_MARGIN * 100}%) margin. Odds can't fix this alone — even the ` +
      `cheapest stocked band (${cheapest.label} at ${money(cheapest.avgFmvCents)}) pays ` +
      `above a healthy price.`,
    changes: [{ label: "Pack price", from: money(price), to: money(newPrice) }],
  };
  return { plan, newPriceCents: newPrice };
}

/** Load per-tier fix payloads from the live pool + odds (shared by get/apply). */
async function loadTierFixes(): Promise<
  ReturnType<typeof buildTierFix>[]
> {
  const supabase = await createClient();
  const [{ data: bandData }, { data: tierData }] = await Promise.all([
    supabase.rpc("tier_pull_economics_bands"),
    supabase.from("pack_tiers").select("key, name, price_cents, odds, sort_order"),
  ]);
  if (!Array.isArray(bandData) || !Array.isArray(tierData)) return [];

  const bandsByTier = new Map<string, FixBand[]>();
  for (const r of bandData as {
    tier_key: string;
    band_ord: number;
    band_label: string;
    weight: number;
    pool_cnt: number;
    avg_fmv_cents: number;
  }[]) {
    const arr = bandsByTier.get(r.tier_key) ?? [];
    arr.push({
      bandOrd: r.band_ord,
      label: r.band_label,
      weight: Number(r.weight),
      poolCnt: r.pool_cnt,
      avgFmvCents: r.avg_fmv_cents,
    });
    bandsByTier.set(r.tier_key, arr);
  }

  const tiers = (tierData as {
    key: string;
    name: string;
    price_cents: number;
    odds: OddsBucket[];
    sort_order: number;
  }[]).sort((a, b) => a.sort_order - b.sort_order);

  const out: ReturnType<typeof buildTierFix>[] = [];
  for (const t of tiers) {
    const fix = buildTierFix(
      { key: t.key, name: t.name, priceCents: t.price_cents, odds: t.odds ?? [] },
      bandsByTier.get(t.key) ?? [],
    );
    if (fix) out.push(fix);
  }
  return out;
}

/** Fix plans for every tier that is currently losing money on a pull. */
export async function getEconomicsFixPlansAction(): Promise<EconFixPlan[]> {
  if (!isStaff(await getRole())) return [];
  const fixes = await loadTierFixes();
  return fixes.flatMap((f) => (f ? [f.plan] : []));
}

/**
 * Apply the auto-correction for one tier (or all). Recomputes server-side so it
 * always acts on the current pool, never on a stale client payload.
 */
export async function applyEconomicsFixAction(
  tierKey?: string,
): Promise<{ ok: boolean; applied: number; error?: string }> {
  if (!isStaff(await getRole())) return { ok: false, applied: 0, error: "Not authorized." };
  const supabase = await createClient();
  const fixes = await loadTierFixes();
  const targets = fixes.filter(
    (f): f is NonNullable<typeof f> => !!f && (!tierKey || f.plan.tierKey === tierKey),
  );
  if (targets.length === 0) {
    return { ok: false, applied: 0, error: "Nothing to fix — no tier is losing money." };
  }

  let applied = 0;
  for (const f of targets) {
    const patch =
      f.newOdds !== undefined
        ? { odds: f.newOdds }
        : f.newPriceCents !== undefined
          ? { price_cents: f.newPriceCents }
          : null;
    if (!patch) continue;
    const { error } = await supabase
      .from("pack_tiers")
      .update(patch)
      .eq("key", f.plan.tierKey);
    if (error) return { ok: false, applied, error: error.message };
    applied += 1;
  }

  revalidatePath("/admin/economics");
  revalidatePath("/dashboard/buy");
  return { ok: true, applied };
}

export async function adminUpdateMode(
  key: string,
  weightMults: { below: number; even: number; above: number; jackpot: number },
): Promise<{ error?: string } | void> {
  if (!isStaff(await getRole())) return { error: "Not authorized." };
  for (const v of Object.values(weightMults)) {
    if (!Number.isFinite(v) || v < 0) return { error: "Multipliers must be ≥ 0." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("pack_modes")
    .update({ weight_mults: weightMults })
    .eq("key", key);
  if (error) return { error: error.message };
  revalidatePath("/admin/economics");
  revalidatePath("/dashboard/buy");
}
