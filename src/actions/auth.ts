"use server";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const admin = createAdminClient();
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/accept-invite`,
  });
  if (error) return { ok: false, error: error.message };

  // Carry the invite context in app_metadata (admin-only, NOT user-mutable).
  // accept_staff_invite reads gym_id from app_metadata; user_metadata cannot
  // be trusted because the user can change it via auth.updateUser.
  const { error: metaErr } = await admin.auth.admin.updateUserById(invited.user.id, {
    app_metadata: { gym_id: gymId, invited_role: "staff" },
  });
  if (metaErr) return { ok: false, error: metaErr.message };
  return { ok: true };
}

export async function changePasswordAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { currentPassword, newPassword } = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "You are not signed in" };

  // Verify the current password without disturbing the live session: a throwaway
  // client that neither persists nor writes the verified session to cookies.
  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: verifyErr } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyErr) return { ok: false, error: "Current password is incorrect" };

  const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true };
}
