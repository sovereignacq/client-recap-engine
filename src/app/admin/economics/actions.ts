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

type EconBand = {
  label: string;
  loCents: number;
  hiCents: number;
  weight: number;
  probPct: number; // chance of this band given current stock (0 if empty)
  poolCnt: number;
  avgFmvCents: number;
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

function buildAdvice(
  status: PoolEconRow["status"],
  priceCents: number,
  marginCents: number,
  bands: EconBand[],
): string {
  if (status === "empty") {
    return "No cards stocked in this tier's value range yet — add cards in the bands below so it can be pulled.";
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
    return s;
  }
  // positive
  let s = `Healthy — keeping ${money(marginCents)} per pull. `;
  if (overpaying.length) {
    s += `Watch ${overpaying.map((b) => b.label).join(", ")}: adding pricey cards there will erode the margin. `;
  }
  s += `Keep most inventory in the lower bands to stay positive.`;
  return s;
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

    const bands: EconBand[] = tierRows.map((r) => ({
      label: r.band_label,
      loCents: r.lo_cents,
      hiCents: r.hi_cents,
      weight: Number(r.weight),
      probPct: r.pool_cnt > 0 && liveWeight > 0 ? (Number(r.weight) / liveWeight) * 100 : 0,
      poolCnt: r.pool_cnt,
      avgFmvCents: r.avg_fmv_cents,
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
