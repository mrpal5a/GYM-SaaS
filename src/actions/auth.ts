"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signupSchema, loginSchema, inviteSchema, slugify } from "@/lib/validations/auth";
import { homePathForRole, type Role } from "@/lib/auth/roles";

type ActionResult = { ok: false; error: string } | { ok: true };

export async function signupAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { fullName, gymName, email, password } = parsed.data;

  const supabase = await createClient();
  const { data: signUp, error: signErr } = await supabase.auth.signUp({ email, password });
  if (signErr || !signUp.user) return { ok: false, error: signErr?.message ?? "Sign up failed" };

  const slug = `${slugify(gymName)}-${signUp.user.id.slice(0, 6)}`;
  const { error: rpcErr } = await supabase.rpc("create_gym_with_owner", {
    p_user_id: signUp.user.id, p_email: email, p_full_name: fullName,
    p_gym_name: gymName, p_slug: slug,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  // refresh session so the new JWT carries gym_id + role claims
  await supabase.auth.refreshSession();
  redirect("/dashboard");
}

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
  const { error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { gym_id: gymId, invited_role: "staff" },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/accept-invite`,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
