import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GymExportData } from "@/lib/admin/export-workbook";

/**
 * Load one gym's full dataset (info, plans, members, subscriptions, payments)
 * for an Excel export. Shared by the on-demand admin download route and the
 * weekly backup job. `client` must be able to read the gym's rows — the admin
 * download passes the super-admin SSR client, the cron passes the service-role
 * client. Returns null when the gym doesn't exist.
 */
export async function loadGymExportData(
  client: SupabaseClient,
  gymId: string,
): Promise<GymExportData | null> {
  const [{ data: gym }, { data: sub }, { data: members }, { data: plans }, { data: subs }, { data: payments }] =
    await Promise.all([
      client.from("gyms").select("name, slug, created_at").eq("id", gymId).maybeSingle(),
      client.from("subscriptions").select("plan, status, current_period_end").eq("gym_id", gymId).maybeSingle(),
      client.from("members")
        .select("full_name, email, phone, gender, date_of_birth, joined_at, is_active, created_at").eq("gym_id", gymId),
      client.from("membership_plans")
        .select("name, description, price, duration_days, is_active, created_at").eq("gym_id", gymId),
      client.from("member_subscriptions")
        .select("plan_name, start_date, end_date, status, members(full_name)").eq("gym_id", gymId),
      client.from("payments")
        .select("member_name, amount, method, invoice_number, paid_at, note").eq("gym_id", gymId),
    ]);

  if (!gym) return null;

  return {
    gym: gym as GymExportData["gym"],
    subscription: (sub as GymExportData["subscription"]) ?? null,
    members: (members ?? []) as GymExportData["members"],
    plans: (plans ?? []) as GymExportData["plans"],
    subscriptions: (subs ?? []).map(
      (s: {
        plan_name: string;
        start_date: string;
        end_date: string;
        status: string;
        members: { full_name: string } | { full_name: string }[] | null;
      }) => {
        // PostgREST returns a to-one embed as an object; older type inference widens
        // it to an array. Handle both so member_name is never silently dropped.
        const member = Array.isArray(s.members) ? s.members[0] : s.members;
        return {
          member_name: member?.full_name ?? null,
          plan_name: s.plan_name,
          start_date: s.start_date,
          end_date: s.end_date,
          status: s.status,
        };
      },
    ),
    payments: (payments ?? []) as GymExportData["payments"],
  };
}
