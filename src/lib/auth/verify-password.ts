import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Re-verify the currently signed-in user's password.
 *
 * Uses a throwaway client that neither persists nor writes the verified session
 * to cookies, so checking the password never disturbs the live session. Returns
 * true only when the password matches the signed-in user's account.
 */
export async function verifyCurrentUserPassword(password: string): Promise<boolean> {
  if (!password) return false;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;

  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await verifier.auth.signInWithPassword({ email: user.email, password });
  return !error;
}
