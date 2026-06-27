import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface AdminContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}

/**
 * Resolve the caller as a super_admin from the verified JWT. Returns null for
 * anyone else (or no session). Middleware already blocks non-admins from /admin;
 * this is the in-process belt-and-suspenders and yields the Supabase client.
 * RLS / SECURITY DEFINER guards remain the real boundary.
 */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub as string | undefined;
  const role = claims?.user_role as string | undefined;
  if (!userId || role !== "super_admin") return null;
  return { supabase, userId };
});
