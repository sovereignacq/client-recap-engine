/**
 * Plain HTML email templates. Tiny, dependency-free, and safe to render in
 * Gmail/Outlook/Apple Mail. Upgrade to React Email later if richer layouts
 * are needed.
 */

const BASE_STYLE = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fafafa; margin: 0; padding: 24px; color: #18181b; }
  .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e4e4e7; }
  h1 { font-size: 20px; margin: 0 0 16px 0; }
  p { font-size: 15px; line-height: 1.6; margin: 0 0 16px 0; color: #3f3f46; }
  .btn { display: inline-block; background: #18181b; color: #ffffff !important; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 500; }
  .footer { font-size: 12px; color: #71717a; margin-top: 24px; text-align: center; }
  .muted { color: #71717a; font-size: 13px; }
`;

function wrap(inner: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head><body><div class="container">${inner}</div><div class="footer">client-recap-engine</div></body></html>`;
}

// ---------- Welcome ----------

export function welcomeEmail(opts: { name?: string | null; appUrl: string }) {
  const greeting = opts.name ? `Hi ${escapeHtml(opts.name)},` : "Welcome,";
  const html = wrap(`
    <h1>Welcome to client-recap-engine</h1>
    <p>${greeting}</p>
    <p>Thanks for signing up. You're ready to turn client conversations into ready-to-send recaps.</p>
    <p><a class="btn" href="${opts.appUrl}/dashboard">Open your dashboard</a></p>
    <p class="muted">Need help getting started? Just reply to this email.</p>
  `);
  const text = `Welcome to client-recap-engine\n\n${greeting}\n\nThanks for signing up. You're ready to turn client conversations into ready-to-send recaps.\n\nOpen your dashboard: ${opts.appUrl}/dashboard\n\nNeed help getting started? Just reply to this email.`;
  return {
    subject: "Welcome to client-recap-engine",
    html,
    text,
  };
}

// ---------- Trial ending ----------

export function trialEndingEmail(opts: {
  name?: string | null;
  trialEndsAt: Date;
  appUrl: string;
}) {
  const ends = opts.trialEndsAt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const greeting = opts.name ? `Hi ${escapeHtml(opts.name)},` : "Hi,";
  const html = wrap(`
    <h1>Your trial ends ${ends}</h1>
    <p>${greeting}</p>
    <p>Your 14-day client-recap-engine Pro trial ends on <strong>${ends}</strong>. After that, your card on file will be charged for the plan you selected.</p>
    <p>No action needed if you'd like to keep going. You can change plans or cancel anytime from the billing portal.</p>
    <p><a class="btn" href="${opts.appUrl}/dashboard">Manage billing</a></p>
  `);
  const text = `Your trial ends ${ends}\n\n${greeting}\n\nYour 14-day Pro trial ends on ${ends}. After that, your card on file will be charged.\n\nNo action needed to keep going. You can change plans or cancel anytime from the billing portal.\n\nManage billing: ${opts.appUrl}/dashboard`;
  return {
    subject: `Your client-recap-engine trial ends ${ends}`,
    html,
    text,
  };
}

// ---------- Payment failed ----------

export function paymentFailedEmail(opts: {
  name?: string | null;
  appUrl: string;
}) {
  const greeting = opts.name ? `Hi ${escapeHtml(opts.name)},` : "Hi,";
  const html = wrap(`
    <h1>We couldn't process your payment</h1>
    <p>${greeting}</p>
    <p>Your latest payment for client-recap-engine Pro didn't go through. This usually means the card on file expired, was replaced, or doesn't have available funds.</p>
    <p>To avoid losing access, please update your payment method:</p>
    <p><a class="btn" href="${opts.appUrl}/dashboard">Update payment method</a></p>
    <p class="muted">We'll retry the charge automatically. You can also cancel from the same screen if you no longer need the subscription.</p>
  `);
  const text = `We couldn't process your payment\n\n${greeting}\n\nYour latest payment for client-recap-engine Pro didn't go through.\n\nTo avoid losing access, please update your payment method:\n${opts.appUrl}/dashboard\n\nWe'll retry the charge automatically.`;
  return {
    subject: "Payment failed — please update your card",
    html,
    text,
  };
}

// ---------- Subscription canceled ----------

export function subscriptionCanceledEmail(opts: {
  name?: string | null;
  endsAt: Date;
  appUrl: string;
}) {
  const ends = opts.endsAt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const greeting = opts.name ? `Hi ${escapeHtml(opts.name)},` : "Hi,";
  const html = wrap(`
    <h1>Your subscription has been canceled</h1>
    <p>${greeting}</p>
    <p>Your client-recap-engine Pro subscription has been canceled. You'll continue to have Pro access until <strong>${ends}</strong>; after that, your account will switch to the Free plan.</p>
    <p>Changed your mind? You can resubscribe anytime — your data stays with us.</p>
    <p><a class="btn" href="${opts.appUrl}/pricing">View plans</a></p>
    <p class="muted">We'd love to hear what didn't work. Just reply to this email.</p>
  `);
  const text = `Your subscription has been canceled\n\n${greeting}\n\nYour Pro subscription has been canceled. You'll keep Pro access until ${ends}, then switch to Free.\n\nChanged your mind? Resubscribe anytime: ${opts.appUrl}/pricing\n\nWe'd love to hear what didn't work. Just reply to this email.`;
  return {
    subject: "Your client-recap-engine subscription has been canceled",
    html,
    text,
  };
}

// ---------- helpers ----------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
