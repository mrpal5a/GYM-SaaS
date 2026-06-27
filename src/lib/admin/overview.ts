import "server-only";
import type { SubPlan, SubStatus } from "@/types/db";
import { getAdminContext } from "@/lib/auth/admin-context";

export interface GymOverviewRow {
  gym_id: string;
  name: string;
  slug: string;
  owner_name: string | null;
  owner_email: string | null;
  member_count: number;
  revenue_total: number;
  revenue_this_month: number;
  plan: SubPlan | null;
  status: SubStatus | null;
  current_period_end: string | null;
  created_at: string;
}

/**
 * Cross-tenant gym overview for the admin dashboard. Returns null when the caller
 * is not a super_admin (the RPC also self-guards). Numerics arrive as strings
 * from PostgREST, so coerce them to numbers here.
 */
export async function getGymOverview(): Promise<GymOverviewRow[] | null> {
  const ctx = await getAdminContext();
  if (!ctx) return null;
  const { data, error } = await ctx.supabase.rpc("admin_gym_overview");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: GymOverviewRow) => ({
    ...r,
    member_count: Number(r.member_count),
    revenue_total: Number(r.revenue_total),
    revenue_this_month: Number(r.revenue_this_month),
  }));
}
