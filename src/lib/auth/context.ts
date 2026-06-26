import "server-only";
import { cache } from "react";
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
export const getGymContext = cache(async (): Promise<GymContext | null> => {
  const supabase = await createClient();

  // Verify the caller from the JWT locally (no network round-trip when Supabase
  // JWT signing keys are enabled). middleware.ts already runs the authoritative
  // getUser() on every request, and RLS is the real boundary — this stays as
  // belt-and-suspenders + a friendly error.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub as string | undefined;
  const gymId = claims?.gym_id as string | undefined;
  const role = claims?.user_role as Role | undefined;
  if (!userId || !gymId || !role) return null;

  return { supabase, userId, gymId, role };
});
