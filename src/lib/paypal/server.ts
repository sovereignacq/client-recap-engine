/**
 * Minimal PayPal Payouts client. Sends money to a recipient by their PayPal
 * email. Credentials come from env at runtime:
 *   PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_ENV ("live" | "sandbox")
 * Never import this from a Client Component.
 */
function paypalBase(): string {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function paypalConfigured(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET);
}

async function getAccessToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!id || !secret) throw new Error("PayPal credentials are not configured.");

  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PayPal auth failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("PayPal auth returned no token.");
  return json.access_token;
}

export type PayoutResult = {
  batchId: string;
  status: string;
};

/**
 * Send a single payout to a PayPal email. `batchKey` should be a stable, unique
 * id (e.g. the withdrawal request id) so retries don't double-pay.
 */
export async function sendPayout(opts: {
  email: string;
  amountCents: number;
  batchKey: string;
  note?: string;
}): Promise<PayoutResult> {
  const token = await getAccessToken();
  const value = (opts.amountCents / 100).toFixed(2);

  const res = await fetch(`${paypalBase()}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: `wd_${opts.batchKey}`,
        email_subject: "You have a payout from APEX TCG",
        email_message: "Your withdrawal has been sent. Thanks for playing!",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value, currency: "USD" },
          receiver: opts.email,
          sender_item_id: opts.batchKey,
          note: opts.note ?? "APEX TCG withdrawal",
        },
      ],
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    batch_header?: { payout_batch_id?: string; batch_status?: string };
    message?: string;
    name?: string;
  };
  if (!res.ok || !json.batch_header?.payout_batch_id) {
    const msg = json.message || json.name || `HTTP ${res.status}`;
    throw new Error(`PayPal payout failed: ${msg}`);
  }
  return {
    batchId: json.batch_header.payout_batch_id,
    status: json.batch_header.batch_status ?? "PENDING",
  };
}
