import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/roles";

export interface GymContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  gymId: string;
  role: Role;
}

/**
 * Resolve the authenticated caller's gym + role from the verified JWT.
 * Returns null when there is no session or no gym claim (e.g. an unprovisioned
 * super_admin). Server actions use this as their first line of defense — RLS is
 * the real boundary, this is belt-and-suspenders + a friendly error.
 */
export async function getGymContext(): Promise<GymContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const gymId = claims?.gym_id as string | undefined;
  const role = claims?.user_role as Role | undefined;
  if (!gymId || !role) return null;

  return { supabase, userId: user.id, gymId, role };
}
