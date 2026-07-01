"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCurrentUserPassword } from "@/lib/auth/verify-password";
import { sendStaffInviteEmail } from "@/lib/email/smtp";
import { buildInviteConfirmUrl } from "@/lib/auth/reset-link";
import { loginSchema, inviteSchema, changePasswordSchema } from "@/lib/validations/auth";
import { homePathForRole, type Role } from "@/lib/auth/roles";
import { siteUrl } from "@/lib/site-url";

type ActionResult = { ok: false; error: string } | { ok: true };

export async function loginAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: error.message };

  const { data: claims } = await supabase.auth.getClaims();
  const role = (claims?.claims?.user_role as Role) ?? "staff";
  redirect(homePathForRole(role));
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function inviteStaffAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const role = claims?.claims?.user_role as Role | undefined;
  const gymId = claims?.claims?.gym_id as string | undefined;
  if (!gymId || (role !== "gym_owner" && role !== "super_admin")) {
    return { ok: false, error: "Not authorized to invite staff" };
  }

  // Mint the invite token ourselves (Supabase sends no email) and deliver our own
  // /auth/confirm link via SMTP — the same reliable server-side flow as password
  // reset. This is what makes /auth/confirm establish the session before the
  // invitee reaches /accept-invite; the default Supabase invite link doesn't.
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: parsed.data.email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !data?.user || !tokenHash) {
    return { ok: false, error: error?.message ?? "Could not create the invite." };
  }

  // Carry the invite context in app_metadata (admin-only, NOT user-mutable).
  // accept_staff_invite reads gym_id from app_metadata; user_metadata cannot
  // be trusted because the user can change it via auth.updateUser.
  const { error: metaErr } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { gym_id: gymId, invited_role: "staff" },
  });
  if (metaErr) return { ok: false, error: metaErr.message };

  const { data: gym } = await admin.from("gyms").select("name").eq("id", gymId).maybeSingle();
  const inviteUrl = buildInviteConfirmUrl(siteUrl(), tokenHash);
  const sent = await sendStaffInviteEmail({
    to: parsed.data.email,
    inviteUrl,
    gymName: (gym as { name?: string } | null)?.name ?? "the gym",
  });
  if (!sent.ok) {
    return { ok: false, error: `Invite created, but the email couldn't be sent: ${sent.error}` };
  }
  return { ok: true };
}

/**
 * Remove a staff member from the caller's gym: deletes their auth account, which
 * cascades their profile and revokes all access. Owner/super-admin only, and the
 * target must be a `staff` profile in the caller's own gym (never another owner
 * or a different gym). The `userId` is the staff member's auth/profile id.
 */
export async function removeStaffAction(userId: string): Promise<ActionResult> {
  if (!userId) return { ok: false, error: "Missing staff member." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const role = claims?.claims?.user_role as Role | undefined;
  const gymId = claims?.claims?.gym_id as string | undefined;
  if (!gymId || (role !== "gym_owner" && role !== "super_admin")) {
    return { ok: false, error: "Not authorized to manage staff" };
  }

  // Confirm the target is a staff member of this gym before deleting (RLS scopes
  // the read to the caller's gym; the checks guard against removing an owner).
  const { data: target } = await supabase
    .from("profiles")
    .select("id, role, gym_id")
    .eq("id", userId)
    .maybeSingle();
  if (!target || target.gym_id !== gymId || target.role !== "staff") {
    return { ok: false, error: "That staff member isn't part of your gym." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}

export async function changePasswordAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { currentPassword, newPassword } = parsed.data;

  if (!(await verifyCurrentUserPassword(currentPassword))) {
    return { ok: false, error: "Current password is incorrect" };
  }

  const supabase = await createClient();
  const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true };
}
