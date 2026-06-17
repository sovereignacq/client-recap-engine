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
