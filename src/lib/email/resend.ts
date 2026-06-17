import { Resend } from "resend";

/**
 * Lazily-initialized Resend client. Avoids crashing at build time when
 * RESEND_API_KEY is unset; only required at runtime.
 *
 * Server-only — never import from a Client Component.
 */
let _resend: Resend | null = null;

export function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  _resend = new Resend(key);
  return _resend;
}

export function getFromAddress(): string {
  // Default to Resend's sandbox sender for dev. In production set RESEND_FROM_EMAIL
  // to a verified domain address like "client-recap-engine <hello@yourdomain.com>".
  return (
    process.env.RESEND_FROM_EMAIL ??
    "client-recap-engine <onboarding@resend.dev>"
  );
}

/**
 * Whether Resend is configured. Lets callers gracefully no-op in environments
 * without a key (e.g., local dev without secrets) instead of throwing.
 */
export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Stripe event id or user id; helps debugging in Resend dashboard */
  tags?: Array<{ name: string; value: string }>;
};

/**
 * Thin wrapper around Resend's send that swallows errors and logs them.
 * Email failures should NEVER take down a webhook handler or a server action.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  tags,
}: SendArgs): Promise<{ id: string | null; error: string | null }> {
  if (!isResendConfigured()) {
    console.warn("[email] RESEND_API_KEY not set — skipping send", { to, subject });
    return { id: null, error: "RESEND_API_KEY not set" };
  }

  try {
    const { data, error } = await getResend().emails.send({
      from: getFromAddress(),
      to,
      subject,
      html,
      text,
      tags,
    });
    if (error) {
      console.error("[email] Resend error", error);
      return { id: null, error: error.message };
    }
    return { id: data?.id ?? null, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown send error";
    console.error("[email] send threw", msg);
    return { id: null, error: msg };
  }
}
