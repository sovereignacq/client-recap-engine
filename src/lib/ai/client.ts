import { GoogleGenAI } from "@google/genai";

/**
 * Lazy-initialized AI client. Today: Gemini. The exported `generateRecap`
 * function is the only call site the rest of the app uses, so swapping to
 * Claude or OpenAI later is a single-file change.
 *
 * Server-only — never import from a Client Component.
 */
let _genai: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (_genai) return _genai;
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it at https://aistudio.google.com/apikey",
    );
  }
  _genai = new GoogleGenAI({ apiKey });
  return _genai;
}

export function isAIConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY);
}

export type RecapTone = "professional" | "friendly" | "brief";

const TONE_GUIDANCE: Record<RecapTone, string> = {
  professional:
    "Polished, confident, business-formal. Short sentences. No slang.",
  friendly:
    "Warm, conversational, but still concise. Light personality, no exclamation overload.",
  brief:
    "Maximum brevity. Bullet points or 2–3 sentence paragraphs. Cut every filler word.",
};

export type GenerateRecapInput = {
  clientName: string;
  clientCompany?: string | null;
  senderName?: string | null;
  rawNotes: string;
  tone: RecapTone;
  callToAction?: string | null;
  meetingDate?: string | null; // ISO date string
};

export type GenerateRecapResult = {
  subject: string;
  body: string;
  model: string;
};

const MODEL = "gemini-2.5-flash";

/**
 * Turn raw meeting notes / transcript into a client-ready recap email.
 * Returns subject line + body. Body is plain text (newline-separated paragraphs)
 * so we can show it in a textarea for editing and ship via mailto: links.
 */
export async function generateRecap(
  input: GenerateRecapInput,
): Promise<GenerateRecapResult> {
  const ai = getGenAI();

  const senderLine = input.senderName ? `From: ${input.senderName}` : "";
  const companyLine = input.clientCompany
    ? `Client company: ${input.clientCompany}`
    : "";
  const dateLine = input.meetingDate
    ? `Meeting date: ${input.meetingDate}`
    : "";
  const ctaLine = input.callToAction
    ? `Required call-to-action to include near the end: ${input.callToAction}`
    : "No specific call-to-action provided — close with a natural next step.";

  const prompt = `You are an expert client communication writer. Turn the raw notes below into a ready-to-send recap email that the sender will paste into their email client.

WRITING STYLE
${TONE_GUIDANCE[input.tone]}

CONTEXT
Client name: ${input.clientName}
${companyLine}
${dateLine}
${senderLine}

${ctaLine}

RAW NOTES (verbatim from the sender — may be messy, fragmented, or include shorthand)
"""
${input.rawNotes.trim()}
"""

OUTPUT REQUIREMENTS
- Respond with ONLY a single JSON object on one line, no markdown, no code fences, no commentary.
- Schema: {"subject":"<email subject line, <= 80 chars, no quotes>", "body":"<email body, plain text, no greeting line containing 'Subject:', use \\n for line breaks>"}
- Body MUST start with a greeting addressing the client by first name only.
- Body MUST end with a sign-off ("Best," / "Talk soon," / etc.) followed by the sender's name on the next line. If senderName is missing, just use "Best," with no name line.
- DO NOT invent facts not in the raw notes. If something is unclear, omit it.
- DO NOT include any placeholders like [name] or [date] — if you don't have the info, leave the line out.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.6,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["subject", "body"],
      },
    },
  });

  const text = response.text ?? "";
  let parsed: { subject?: string; body?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`AI returned non-JSON output: ${text.slice(0, 200)}`);
  }

  const subject = (parsed.subject ?? "").trim();
  const body = (parsed.body ?? "").trim();
  if (!subject || !body) {
    throw new Error("AI returned empty subject or body");
  }

  return { subject, body, model: MODEL };
}

// ============================================================
// Card identification (vision) + value estimation
//
// Accuracy guardrails baked into the prompts:
//   - The model must NEVER guess a field it cannot read; an illegible field
//     comes back as "" and drags confidence down.
//   - Identification NEVER returns a price. Value is a separate call that only
//     runs after the operator confirms the identification, so a misread card
//     can't silently carry a wrong FMV.
// ============================================================

export type CardCategory = "sports" | "tcg" | "other";

export type CardIdentification = {
  category: CardCategory | "";
  sportOrGame: string;
  playerOrCharacter: string;
  cardYear: string;
  manufacturer: string;
  setName: string;
  cardNumber: string;
  variant: string;
  confidence: number; // 0..1
  notes: string;
};

export type IdentifyCardResult = CardIdentification & { model: string };

/**
 * Identify a trading card from photos. `images` carries the raw base64 payloads
 * (no `data:` prefix) — the front first, optionally the back second. Returns
 * structured identification fields plus a 0–1 confidence. Deliberately returns
 * NO valuation — see `estimateCardValue`.
 */
export async function identifyCard(input: {
  images: { base64: string; mimeType: string }[];
  hint?: string | null;
}): Promise<IdentifyCardResult> {
  const ai = getGenAI();

  const hintLine = input.hint?.trim()
    ? `The submitter said this about the card (treat as a hint only, verify against the image): "${input.hint.trim()}"`
    : "No operator hint provided.";

  const imageNote =
    input.images.length > 1
      ? "Two photos are provided: the FIRST is the front of the card, the SECOND is the back. Use the front to identify the card and the back to confirm the set, card number, and condition."
      : "One photo is provided: the front of the card.";

  const prompt = `You are a meticulous trading-card identification expert. In practice the cards you see are USUALLY sports cards (Topps, Panini, Bowman, Upper Deck, Donruss, Fleer, etc.) or Pokémon, with the occasional One Piece or other TCG. Identify the card in the image(s) as precisely as the image allows.

${imageNote}

${hintLine}

HOW TO IDENTIFY (cross-reference every visible cue, don't rely on one)
1. Decide the type first:
   - Pokémon: energy symbols, HP in the top corner, attacks/abilities, a set symbol + a collector number like "4/102" (often bottom-left/right of the front), and a copyright line on the front bottom edge.
   - One Piece TCG: "ONE PIECE CARD GAME" wording, a cost/power layout, card code like "OP01-001".
   - Sports: a real athlete photo, a team, a league logo (NBA/NFL/MLB/etc.). The BACK usually prints the set name, a card number (e.g. "No. 280"), the year/season, stats, and copyright — READ THE BACK for these.
2. Player/character: the athlete's name (sports) or the Pokémon/character name (TCG), exactly as printed.
3. card_year: the copyright/season year as printed (season form like "2020-21" when shown).
4. set_name: the printed set/product name (e.g. "Prizm", "Base Set", "Topps Chrome", "Scarlet & Violet 151").
5. card_number: the collector number EXACTLY as printed ("280", "4/102", "OP01-001").
6. variant: any parallel / insert / edition / finish (e.g. "Silver Prizm", "Refractor", "Reverse Holo", "1st Edition", "Illustration Rare", "/99" serial-numbered). Empty if it's a plain base card.
7. sport_or_game: the specific game or sport spelled out — "Pokémon", "One Piece", "Basketball", "Baseball", "Football", "Soccer", etc.
8. category: "sports" for athlete cards, "tcg" for Pokémon/One Piece/Magic/Yu-Gi-Oh!, otherwise "other".

CRITICAL ACCURACY RULES
- Read ONLY what is actually visible. NEVER invent a value you cannot read. If a field isn't legible or present, return "" for it.
- Use BOTH photos when two are given — the back frequently carries the set, number, and year that the front omits.
- "confidence" is your honest probability (0.0–1.0) that the WHOLE identification is correct together. Crisp photo of a clearly-marked card ≈ 0.9+; blurry, cropped, or ambiguous parallel ≤ 0.5.
- Put anything uncertain, unreadable, or any visible condition issue (front or back) in "notes".

OUTPUT
Respond with ONLY one JSON object, no markdown, no commentary.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      ...input.images.map((img) => ({
        inlineData: { mimeType: img.mimeType, data: img.base64 },
      })),
      { text: prompt },
    ],
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["sports", "tcg", "other"] },
          sport_or_game: { type: "string" },
          player_or_character: { type: "string" },
          card_year: { type: "string" },
          manufacturer: { type: "string" },
          set_name: { type: "string" },
          card_number: { type: "string" },
          variant: { type: "string" },
          confidence: { type: "number" },
          notes: { type: "string" },
        },
        required: [
          "category",
          "sport_or_game",
          "player_or_character",
          "card_year",
          "manufacturer",
          "set_name",
          "card_number",
          "variant",
          "confidence",
          "notes",
        ],
      },
    },
  });

  const text = response.text ?? "";
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(text);
  } catch {
    throw new Error(`AI returned non-JSON output: ${text.slice(0, 200)}`);
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const categoryRaw = str(p.category).toLowerCase();
  const category = (["sports", "tcg", "other"].includes(categoryRaw)
    ? categoryRaw
    : "") as CardCategory | "";
  let confidence =
    typeof p.confidence === "number" ? p.confidence : Number(p.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.min(1, Math.max(0, confidence));

  return {
    category,
    sportOrGame: str(p.sport_or_game),
    playerOrCharacter: str(p.player_or_character),
    cardYear: str(p.card_year),
    manufacturer: str(p.manufacturer),
    setName: str(p.set_name),
    cardNumber: str(p.card_number),
    variant: str(p.variant),
    confidence,
    notes: str(p.notes),
    model: MODEL,
  };
}

export type CardValueEstimate = {
  lowCents: number;
  highCents: number;
  confidence: number; // 0..1
  rationale: string;
  model: string;
};

/**
 * Ballpark a card's value from a CONFIRMED identification. This is an estimate
 * from the model's general knowledge (not a live market feed) and is always
 * surfaced to the operator as a labeled estimate they must approve — it is
 * never written to a card's FMV automatically.
 */
export async function estimateCardValue(input: {
  category: CardCategory | "";
  sportOrGame: string;
  playerOrCharacter: string;
  cardYear: string;
  manufacturer: string;
  setName: string;
  cardNumber: string;
  variant: string;
  grade?: string | null;
}): Promise<CardValueEstimate> {
  const ai = getGenAI();

  const gradeLine = input.grade?.trim()
    ? `Condition / grade: ${input.grade.trim()}`
    : "Condition / grade: unknown (assume raw, ungraded, near-mint).";

  const prompt = `You are a trading-card market analyst. Give a rough fair-market-value RANGE in US dollars for the following card, based on your general knowledge of recent sold prices. This is an ESTIMATE, not a live quote.

CARD
Category: ${input.category || "unknown"}
Sport/Game: ${input.sportOrGame || "unknown"}
Player/Character: ${input.playerOrCharacter || "unknown"}
Year: ${input.cardYear || "unknown"}
Manufacturer: ${input.manufacturer || "unknown"}
Set: ${input.setName || "unknown"}
Card number: ${input.cardNumber || "unknown"}
Variant/parallel: ${input.variant || "base"}
${gradeLine}

RULES
- Return whole-dollar low and high bounds for a typical recent sale of THIS card in THIS condition.
- If you genuinely don't have enough information to estimate, return low=0, high=0 and explain why in "rationale".
- Be conservative; a wide range is fine when uncertain. Set "confidence" (0.0–1.0) accordingly.
- In "rationale", note the key drivers (player, scarcity, grade) and remind that this is an estimate, not a live market price.

OUTPUT
Respond with ONLY one JSON object, no markdown.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          low_usd: { type: "number" },
          high_usd: { type: "number" },
          confidence: { type: "number" },
          rationale: { type: "string" },
        },
        required: ["low_usd", "high_usd", "confidence", "rationale"],
      },
    },
  });

  const text = response.text ?? "";
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(text);
  } catch {
    throw new Error(`AI returned non-JSON output: ${text.slice(0, 200)}`);
  }

  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  let low = num(p.low_usd);
  let high = num(p.high_usd);
  if (high < low) [low, high] = [high, low];
  let confidence = num(p.confidence);
  confidence = Math.min(1, Math.max(0, confidence));

  return {
    lowCents: Math.round(low * 100),
    highCents: Math.round(high * 100),
    confidence,
    rationale: typeof p.rationale === "string" ? p.rationale.trim() : "",
    model: MODEL,
  };
}
