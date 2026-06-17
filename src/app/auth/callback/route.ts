import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { welcomeEmail } from "@/lib/email/templates";

/**
 * Email-confirmation / OAuth callback handler.
 * Exchanges the `code` query param for a session, sends a welcome email
 * (once per user), and redirects to `next` (defaults to /dashboard).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Missing auth code.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Fire-and-forget welcome email (idempotent: gated on welcome_email_sent_at).
  // Failures are logged but never block the redirect.
  await maybeSendWelcomeEmail(origin).catch((e) =>
    console.error("[welcome-email]", e),
  );

  return NextResponse.redirect(`${origin}${next}`);
}

async function maybeSendWelcomeEmail(appUrl: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return;

  // Use admin client so we can update the row regardless of RLS update policy.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, welcome_email_sent_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.welcome_email_sent_at) return;

  const { html, text, subject } = welcomeEmail({
    name: profile.full_name,
    appUrl,
  });

  const { id, error: sendError } = await sendEmail({
    to: user.email,
    subject,
    html,
    text,
    tags: [
      { name: "type", value: "welcome" },
      { name: "user_id", value: user.id },
    ],
  });

  if (id && !sendError) {
    await admin
      .from("profiles")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", user.id);
  }
}
