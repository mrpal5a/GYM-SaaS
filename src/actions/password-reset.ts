"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPasswordResetEmail } from "@/lib/email/smtp";
import { buildResetConfirmUrl } from "@/lib/auth/reset-link";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { siteUrl } from "@/lib/site-url";

type ActionResult = { ok: false; error: string } | { ok: true };

/**
 * Request a password-reset link. Always reports success (even for an unknown
 * email) so the form can't be used to discover which addresses are registered.
 * The recovery token is minted with the admin client (no email sent by Supabase);
 * we email our own /auth/confirm link via SMTP.
 */
export async function requestPasswordResetAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { email } = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });

  // Unknown email (or any gener_link failure) → still show success (anti-enumeration).
  const tokenHash = data?.properties?.hashed_token;
  if (!error && tokenHash) {
    const resetUrl = buildResetConfirmUrl(siteUrl(), tokenHash);
    // Best-effort send; we don't surface delivery failures to avoid leaking whether
    // the address exists. Server logs capture real SMTP errors for debugging.
    const sent = await sendPasswordResetEmail({ to: email, resetUrl });
    if (!sent.ok) console.error("password reset email failed:", sent.error);
  }

  return { ok: true };
}

/**
 * Set a new password. Runs after /auth/confirm has established the recovery
 * session from the emailed token; updateUser then changes the password.
 */
export async function resetPasswordAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "This reset link is invalid or has expired. Please request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: error.message };

  await supabase.auth.signOut();
  redirect("/login?reset=done");
}
