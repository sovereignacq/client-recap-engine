import type { PokemonSearchResult } from "./pokemon";

// TCGdex is more current than pokemontcg.io (carries the newest sets) and is
// multilingual. We use it as a live fallback for cards not in the local catalog.

const img = (base: string) => `${base}/high.webp`;

type Brief = { id: string; name: string; localId?: string; image?: string };

/** Search TCGdex English cards by (partial) name. */
export async function searchTcgdexEn(q: string): Promise<PokemonSearchResult[]> {
  const query = q.trim();
  if (!query) return [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(
      `https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(query)}`,
      { signal: ctrl.signal },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as Brief[];
    return data.slice(0, 30).map((c) => ({
      id: `tg:${c.id}`,
      name: c.name,
      setName: "",
      number: c.localId ?? "",
      rarity: "",
      imageUrl: c.image ? img(c.image) : null,
      marketPriceCents: null,
      language: "en",
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Detail lookup for a TCGdex card: market price (USD cents), set, rarity. */
export async function tcgdexDetail(
  realId: string,
): Promise<{ priceCents: number | null; setName: string; rarity: string }> {
  try {
    const res = await fetch(`https://api.tcgdex.net/v2/en/cards/${realId}`);
    if (!res.ok) return { priceCents: null, setName: "", rarity: "" };
    const d = await res.json();
    let priceCents: number | null = null;

    const tp = d?.pricing?.tcgplayer as
      | Record<string, { marketPrice?: number; market?: number }>
      | undefined;
    if (tp) {
      for (const k of Object.keys(tp)) {
        const v = tp[k];
        const m =
          v && typeof v === "object"
            ? (v.marketPrice ?? v.market ?? null)
            : null;
        if (typeof m === "number" && m > 0) {
          priceCents = Math.round(m * 100);
          break;
        }
      }
    }
    if (priceCents == null) {
      const cm = d?.pricing?.cardmarket as
        | { avg?: number; avg30?: number }
        | undefined;
      const avg = cm?.avg ?? cm?.avg30 ?? null;
      // cardmarket is EUR; rough EUR→USD so the FMV isn't blank.
      if (typeof avg === "number" && avg > 0) priceCents = Math.round(avg * 108);
    }
    return {
      priceCents,
      setName: d?.set?.name ?? "",
      rarity: d?.rarity ?? "",
    };
  } catch {
    return { priceCents: null, setName: "", rarity: "" };
  }
}
