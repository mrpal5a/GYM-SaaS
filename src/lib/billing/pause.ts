import "server-only";
import { cache } from "react";
import { getGymContext } from "@/lib/auth/context";

/**
 * Whether the caller's gym has been paused by the platform. Cached per request so
 * the layout, dashboard, and any guarded action share a single query. Reads via
 * the caller's own client (RLS scopes it to their gym). Fails open (false) if the
 * read errors — e.g. before the `paused_at` migration is applied.
 */
export const currentGymPaused = cache(async (): Promise<boolean> => {
  const ctx = await getGymContext();
  if (!ctx) return false;
  const { data } = await ctx.supabase
    .from("subscriptions")
    .select("paused_at")
    .eq("gym_id", ctx.gymId)
    .maybeSingle();
  return Boolean(data?.paused_at);
});
