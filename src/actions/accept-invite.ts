"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: false; error: string } | { ok: true };

// Invited user arrives authenticated via the magic link; they set a password,
// then the accept_staff_invite RPC creates their staff profile (gym + role come
// from server-side invite metadata, never from the client).
export async function acceptInviteAction(_prev: unknown, formData: FormData): Promise<Result> {
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "");
  if (password.length < 8) return { ok: false, error: "Min 8 characters" };

  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return { ok: false, error: "Invite link invalid or expired" };

  const { error: pwErr } = await supabase.auth.updateUser({ password });
  if (pwErr) return { ok: false, error: pwErr.message };

  const { error: rpcErr } = await supabase.rpc("accept_staff_invite", { p_full_name: fullName });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  await supabase.auth.refreshSession();
  redirect("/dashboard");
}
