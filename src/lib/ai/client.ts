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
      temperature: 0,
      seed: 7,
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
      temperature: 0,
      seed: 7,
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

// ============================================================
// Photo-based grading
//
// Produces a strict 1–10 grade with centering / corners / edges / surface
// subgrades, an itemized flaw list (area + where + severity), and a written
// rationale. Honest about photo limits — poor photos cap the grade and are
// called out in the summary.
// ============================================================

export type FlawBox = { x: number; y: number; w: number; h: number };

export type GradeFlaw = {
  area: "centering" | "corners" | "edges" | "surface" | "print" | "other";
  location: string; // e.g. "top-right corner (front)"
  description: string;
  severity: "minor" | "moderate" | "major";
  side: "front" | "back";
  box: FlawBox | null; // normalized 0..1 bounding box on that side's photo
};

/** PSA-style grade qualifier codes. */
export type GradeQualifier = "OC" | "ST" | "PD" | "OF" | "MC" | "MK";

export type GradeResult = {
  overall: number; // 1–10, .5 steps
  label: string; // e.g. "MINT 9"
  centering: number;
  corners: number;
  edges: number;
  surface: number;
  centeringMeasurement: string; // e.g. "55/45 L-R · 60/40 T-B" or ""
  qualifiers: GradeQualifier[];
  flaws: GradeFlaw[];
  summary: string;
  photoQuality: "good" | "fair" | "poor";
  model: string;
};

// Encodes PSA's published grading standards (centering tolerances + condition
// criteria per grade). Be strict and consistent: the overall is holistic and
// capped by the weakest attribute and by the centering tolerance for that grade.
const GRADE_SCALE = `PSA GRADING STANDARDS — apply them strictly and consistently. Centering tolerances are HARD CAPS: if front/back centering is worse than a grade allows, the card CANNOT receive that grade (drop it, or apply an OC qualifier).

- 10 GEM-MT (Gem Mint): four perfectly sharp corners, sharp focus, full original gloss, no staining (a tiny printing imperfection is allowed if it doesn't impair appeal). Centering up to 55/45–60/40 on the FRONT and 75/25 on the BACK.
- 9 MINT: only ONE minor flaw — a slight wax/print imperfection or slightly off-white borders. Centering up to 60/40 FRONT, 90/10 BACK.
- 8 NM-MT (Near Mint-Mint): slight fraying on a corner, slight surface/print flaw, or slightly off-white borders. Centering up to 65/35 FRONT, 90/10 BACK.
- 7 NM (Near Mint): slight surface wear on close inspection; slight fraying at corners; minor off-centering. Centering up to 70/30 FRONT, 90/10 BACK.
- 6 EX-MT (Excellent-Mint): visible surface wear or a light scratch; slight corner fraying. Centering up to 80/20 FRONT.
- 5 EX (Excellent): minor corner rounding; more visible surface wear; minor edge chipping. Centering up to 85/15 FRONT.
- 4 VG-EX: corners slightly rounded; noticeable but modest surface wear; light scuffing; some gloss loss. Centering up to 85/15 FRONT.
- 3 VG (Very Good): accelerated corner rounding/layering; obvious surface wear, scratching, scuffing; possible light staining or a minor crease. Centering up to 90/10.
- 2 GOOD: corners rounded well beyond fraying; heavy surface wear, scuffing, staining; edge chipping; possible crease(s).
- 1 PR (Poor): major creasing, heavy staining, paper loss, destroyed corners; possible writing/tape/holes/miscut.

GRADE QUALIFIERS (apply only when an otherwise higher-grade card is held back by a SINGLE specific defect):
- OC = Off-Center (centering beyond the grade's tolerance)
- ST = Staining
- PD = Print Defect (spot, line, or snow)
- OF = Out of Focus (image printed out of register/blurry)
- MC = Miscut (card cut so the image/border is into the design)
- MK = Marks (pen, pencil, or other handling marks)`;

/** Grade a card strictly from its photos. */
export async function gradeCard(input: {
  images: { base64: string; mimeType: string }[];
}): Promise<GradeResult> {
  const ai = getGenAI();

  const imageNote =
    input.images.length > 1
      ? "Two photos are provided: the FIRST is the front, the SECOND is the back. Grade BOTH sides — a flaw on either side counts."
      : "Only the front photo is provided. Grade what you can and note in the summary that the back was not assessed (this caps the grade).";

  const prompt = `You are a PSA-trained professional card grader doing a strict, condition-only assessment from photos. Be critical, conservative, and CONSISTENT — apply the PSA standards below exactly. When in doubt, grade DOWN. Most raw cards are 7–9, not 10.

${imageNote}

${GRADE_SCALE}

ASSESS FOUR ATTRIBUTES, each 1–10, the PSA way:
- centering: read the border ratios left/right and top/bottom on BOTH sides; the front tolerance is the binding one. Worse than the grade's cap = lower grade or an OC qualifier.
- corners: all four, front and back — sharp vs. fraying, rounding, dings, layering.
- edges: all four, front and back — chipping, whitening, roughness.
- surface: scratches, print lines/dots/snow, scuffs, indentations, gloss loss, stains, creases, focus/registration.

RULES
- OVERALL is HOLISTIC and capped by (a) the weakest attribute and (b) the centering tolerance for that grade — it is NOT an average. A single major flaw caps it low.
- "label" must be the PSA label for the overall, e.g. "GEM-MT 10", "MINT 9", "NM-MT 8", "NM 7", "EX-MT 6", "EX 5", "VG-EX 4", "VG 3", "GOOD 2", "PR 1".
- "qualifiers": list any PSA qualifier codes (OC, ST, PD, OF, MC, MK) that apply; empty array if none.
- List EVERY flaw you can actually see in "flaws". For EACH flaw give:
  - area, severity (minor/moderate/major), a short description,
  - "side": "front" or "back" (which photo it is on),
  - "location": human text like "top-right corner (front)",
  - "box": a TIGHT bounding box around the flaw as NORMALIZED coordinates on THAT side's photo, where x,y is the top-left and w,h the size, each 0.0–1.0 (origin = top-left of the image). Make the box small and precise so it can be drawn on the photo. If you truly cannot localize it, set "box" to null.
  If the card looks clean, return an empty list.
- Judge ONLY condition, never identity or value.
- "centering_measurement": your best read like "55/45 L-R · 60/40 T-B", or "".
- "photo_quality": good / fair / poor. If poor (blurry, low-res, glare, cropped), say so and do NOT award a high grade you can't justify.
- "summary": 2–4 sentences citing the PSA factors that set this grade.

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
      temperature: 0,
      seed: 7,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          overall: { type: "number" },
          label: { type: "string" },
          centering: { type: "number" },
          corners: { type: "number" },
          edges: { type: "number" },
          surface: { type: "number" },
          centering_measurement: { type: "string" },
          photo_quality: { type: "string", enum: ["good", "fair", "poor"] },
          qualifiers: {
            type: "array",
            items: {
              type: "string",
              enum: ["OC", "ST", "PD", "OF", "MC", "MK"],
            },
          },
          flaws: {
            type: "array",
            items: {
              type: "object",
              properties: {
                area: {
                  type: "string",
                  enum: ["centering", "corners", "edges", "surface", "print", "other"],
                },
                location: { type: "string" },
                description: { type: "string" },
                severity: { type: "string", enum: ["minor", "moderate", "major"] },
                side: { type: "string", enum: ["front", "back"] },
                box: {
                  type: "object",
                  properties: {
                    x: { type: "number" },
                    y: { type: "number" },
                    w: { type: "number" },
                    h: { type: "number" },
                  },
                  required: ["x", "y", "w", "h"],
                },
              },
              required: ["area", "location", "description", "severity", "side"],
            },
          },
          summary: { type: "string" },
        },
        required: [
          "overall",
          "label",
          "centering",
          "corners",
          "edges",
          "surface",
          "centering_measurement",
          "photo_quality",
          "qualifiers",
          "flaws",
          "summary",
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

  const clampGrade = (v: unknown) => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.min(10, Math.max(1, Math.round(n * 2) / 2));
  };
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const unit = (v: unknown) => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.min(1, Math.max(0, n));
  };
  const parseBox = (v: unknown): FlawBox | null => {
    if (!v || typeof v !== "object") return null;
    const b = v as Record<string, unknown>;
    const x = unit(b.x);
    const y = unit(b.y);
    let w = unit(b.w);
    let h = unit(b.h);
    if (x === null || y === null || w === null || h === null) return null;
    // Keep the box inside the image.
    w = Math.min(w, 1 - x);
    h = Math.min(h, 1 - y);
    if (w <= 0 || h <= 0) return null;
    return { x, y, w, h };
  };

  const flawsRaw = Array.isArray(p.flaws) ? p.flaws : [];
  const flaws: GradeFlaw[] = flawsRaw
    .map((f) => f as Record<string, unknown>)
    .map((f) => ({
      area: ["centering", "corners", "edges", "surface", "print", "other"].includes(
        str(f.area),
      )
        ? (str(f.area) as GradeFlaw["area"])
        : "other",
      location: str(f.location),
      description: str(f.description),
      severity: ["minor", "moderate", "major"].includes(str(f.severity))
        ? (str(f.severity) as GradeFlaw["severity"])
        : "minor",
      side: (str(f.side) === "back" ? "back" : "front") as "front" | "back",
      box: parseBox(f.box),
    }))
    .filter((f) => f.description || f.location);

  const validQualifiers = ["OC", "ST", "PD", "OF", "MC", "MK"];
  const qualifiers = (Array.isArray(p.qualifiers) ? p.qualifiers : [])
    .map((q) => str(q).toUpperCase())
    .filter((q): q is GradeQualifier => validQualifiers.includes(q));

  const pq = str(p.photo_quality);

  return {
    overall: clampGrade(p.overall),
    label: str(p.label),
    centering: clampGrade(p.centering),
    corners: clampGrade(p.corners),
    edges: clampGrade(p.edges),
    surface: clampGrade(p.surface),
    centeringMeasurement: str(p.centering_measurement),
    qualifiers: Array.from(new Set(qualifiers)),
    flaws,
    summary: str(p.summary),
    photoQuality: (["good", "fair", "poor"].includes(pq) ? pq : "fair") as GradeResult["photoQuality"],
    model: MODEL,
  };
}
