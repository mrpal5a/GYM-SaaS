import "server-only";
import { getGymContext } from "@/lib/auth/context";
import type { Gym } from "@/types/db";

export interface GymBranding {
  id: string;
  name: string;
  logoUrl: string | null;
  address: string | null;
  rules: string[];
}

/**
 * The caller's gym name + logo, used for app chrome and invoices. Returns null
 * when there's no gym context (e.g. an unprovisioned super_admin). RLS confines
 * the read to the caller's own gym.
 */
export async function getGymBranding(): Promise<GymBranding | null> {
  const ctx = await getGymContext();
  if (!ctx) return null;

  const { data } = await ctx.supabase
    .from("gyms")
    .select("id, name, logo_url, address, rules")
    .eq("id", ctx.gymId)
    .single<Pick<Gym, "id" | "name" | "logo_url" | "address" | "rules">>();
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    logoUrl: data.logo_url,
    address: data.address,
    rules: Array.isArray(data.rules) ? data.rules : [],
  };
}
