/**
 * Cross-reference a suspected Pokémon card against the public Pokémon TCG
 * database (https://pokemontcg.io). Given a name + collector number (and
 * optionally a set), it returns the canonical card — exact set, number, rarity,
 * image, and a real USD market price — which we use to confirm/correct the
 * vision read and surface a reference value.
 *
 * Best-effort: any failure (network, no match, timeout) returns null and the
 * caller falls back to the vision result alone.
 *
 * An optional POKEMON_TCG_API_KEY raises rate limits but is not required.
 */

export type PokemonMatch = {
  name: string;
  setName: string;
  number: string; // e.g. "4/102"
  rarity: string;
  imageUrl: string | null;
  marketPriceCents: number | null; // USD (TCGplayer), null if unavailable
  url: string | null;
};

type ApiCard = {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  set?: { name?: string; printedTotal?: number };
  images?: { small?: string; large?: string };
  tcgplayer?: {
    url?: string;
    prices?: Record<string, { market?: number | null; mid?: number | null }>;
  };
};

/** Pull the most relevant USD market price out of the TCGplayer price block. */
function tcgplayerUsdCents(card: ApiCard): number | null {
  const prices = card.tcgplayer?.prices;
  if (!prices) return null;
  // Prefer holofoil, then normal, then reverse, then anything with a value.
  const order = ["holofoil", "normal", "reverseHolofoil", "1stEditionHolofoil"];
  const keys = [...order, ...Object.keys(prices).filter((k) => !order.includes(k))];
  for (const k of keys) {
    const v = prices[k];
    const usd = v?.market ?? v?.mid ?? null;
    if (typeof usd === "number" && usd > 0) return Math.round(usd * 100);
  }
  return null;
}

/** Strip a collector number to the API's `number` form ("4/102" -> "4"). */
function numberToken(raw: string): string {
  const first = raw.split("/")[0]?.trim() ?? "";
  return first.replace(/[^a-z0-9]/gi, "");
}

async function queryApi(q: string, signal: AbortSignal): Promise<ApiCard[]> {
  const headers: Record<string, string> = {};
  if (process.env.POKEMON_TCG_API_KEY) {
    headers["X-Api-Key"] = process.env.POKEMON_TCG_API_KEY;
  }
  const url =
    "https://api.pokemontcg.io/v2/cards?pageSize=12&q=" + encodeURIComponent(q);
  const res = await fetch(url, { headers, signal });
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: ApiCard[] };
  return json.data ?? [];
}

export type PokemonSearchResult = {
  id: string;
  name: string;
  setName: string;
  number: string; // e.g. "4/102"
  rarity: string;
  imageUrl: string | null;
  marketPriceCents: number | null;
  language: string; // "en" | "ja" | …
};

function toSearchResult(c: ApiCard): PokemonSearchResult {
  const printedTotal = c.set?.printedTotal;
  return {
    id: c.id,
    name: c.name,
    setName: c.set?.name ?? "",
    number: printedTotal ? `${c.number}/${printedTotal}` : c.number,
    rarity: c.rarity ?? "",
    imageUrl: c.images?.large ?? c.images?.small ?? null,
    marketPriceCents: tcgplayerUsdCents(c),
    language: "en",
  };
}

/**
 * Free-text search of the Pokémon card database for the "search & add" flow.
 * Each token is matched as a name prefix, so "char" or "charizard ex" both work.
 * Returns up to ~12 candidates with image + real market price.
 */
export async function searchPokemonCards(
  query: string,
): Promise<PokemonSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const tokens = q
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean);
  if (!tokens.length) return [];
  const nameQ = tokens.map((t) => `name:${t}*`).join(" ");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const cards = await queryApi(nameQ, controller.signal);
    return cards.map(toSearchResult);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupPokemonCard(input: {
  name: string;
  number: string | null;
  setName: string | null;
}): Promise<PokemonMatch | null> {
  const name = input.name.trim();
  if (!name) return null;
  const num = input.number ? numberToken(input.number) : "";
  const setName = input.setName?.trim() ?? "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    // Build progressively looser queries; first hit wins.
    const namePart = `name:"${name.replace(/"/g, "")}"`;
    const attempts: string[] = [];
    if (num && setName)
      attempts.push(`${namePart} number:${num} set.name:"${setName.replace(/"/g, "")}"`);
    if (num) attempts.push(`${namePart} number:${num}`);
    if (setName) attempts.push(`${namePart} set.name:"${setName.replace(/"/g, "")}"`);
    attempts.push(namePart);

    let cards: ApiCard[] = [];
    for (const q of attempts) {
      cards = await queryApi(q, controller.signal);
      if (cards.length) break;
    }
    if (!cards.length) return null;

    // Prefer an exact collector-number match when we have one.
    const best =
      (num && cards.find((c) => numberToken(c.number) === num)) || cards[0];

    const printedTotal = best.set?.printedTotal;
    const number = printedTotal ? `${best.number}/${printedTotal}` : best.number;

    return {
      name: best.name,
      setName: best.set?.name ?? "",
      number,
      rarity: best.rarity ?? "",
      imageUrl: best.images?.large ?? best.images?.small ?? null,
      marketPriceCents: tcgplayerUsdCents(best),
      url: best.tcgplayer?.url ?? null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
