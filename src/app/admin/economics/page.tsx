import { createClient } from "@/lib/supabase/server";
import { EconomicsTuner, type TunerTier, type TunerMode } from "./tuner";
import { PoolEconomics } from "./pool-economics";
import { PoolDedupe } from "./pool-dedupe";
import { EconomicsAutoFix } from "./economics-autofix";
import {
  getPoolEconomicsAction,
  getStockingPlanAction,
  getDedupePreviewAction,
  getEconomicsFixPlansAction,
} from "./actions";

export default async function AdminEconomicsPage() {
  const supabase = await createClient();

  const { data: tierRows } = await supabase
    .from("pack_tiers")
    .select("key, name, price_cents, odds, pity_threshold, pity_min_mult, pity_max_mult")
    .order("sort_order", { ascending: true });

  const { data: modeRows } = await supabase
    .from("pack_modes")
    .select("key, name, weight_mults")
    .order("sort_order", { ascending: true });

  const tiers: TunerTier[] = (tierRows ?? []).map((t) => ({
    key: t.key,
    name: t.name,
    priceCents: t.price_cents,
    pityThreshold: t.pity_threshold,
    pityMinMult: Number(t.pity_min_mult),
    pityMaxMult: Number(t.pity_max_mult),
    odds: (t.odds as TunerTier["odds"]) ?? [],
  }));

  const modes: TunerMode[] = (modeRows ?? []).map((m) => ({
    key: m.key,
    name: m.name,
    weightMults: (m.weight_mults as Record<string, number>) ?? {},
  }));

  const [poolEcon, stockingPlan, dedupe, fixPlans] = await Promise.all([
    getPoolEconomicsAction(),
    getStockingPlanAction(),
    getDedupePreviewAction(),
    getEconomicsFixPlansAction(),
  ]);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Economics</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Tune prices, pity, and odds levels. House edge previews live before
            you save. Positive = the house keeps that share long-run.
          </p>
        </div>
        <PoolEconomics initial={poolEcon} initialPlan={stockingPlan} />

        <EconomicsAutoFix initial={fixPlans} />

        <PoolDedupe initial={dedupe} />

        <EconomicsTuner tiers={tiers} modes={modes} buybackPct={0.8} />
      </div>
    </main>
  );
}
