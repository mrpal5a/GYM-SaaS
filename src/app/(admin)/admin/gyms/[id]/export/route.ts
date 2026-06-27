import { getAdminContext } from "@/lib/auth/admin-context";
import { buildGymWorkbook, type GymExportData } from "@/lib/admin/export-workbook";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx) return new Response("Forbidden", { status: 403 });

  const [{ data: gym }, { data: sub }, { data: members }, { data: plans }, { data: subs }, { data: payments }] =
    await Promise.all([
      ctx.supabase.from("gyms").select("name, slug, created_at").eq("id", id).maybeSingle(),
      ctx.supabase.from("subscriptions").select("plan, status, current_period_end").eq("gym_id", id).maybeSingle(),
      ctx.supabase.from("members")
        .select("full_name, email, phone, gender, date_of_birth, joined_at, is_active, created_at").eq("gym_id", id),
      ctx.supabase.from("membership_plans")
        .select("name, description, price, duration_days, is_active, created_at").eq("gym_id", id),
      ctx.supabase.from("member_subscriptions")
        .select("plan_name, start_date, end_date, status, members(full_name)").eq("gym_id", id),
      ctx.supabase.from("payments")
        .select("member_name, amount, method, invoice_number, paid_at, note").eq("gym_id", id),
    ]);

  if (!gym) return new Response("Not found", { status: 404 });

  const data: GymExportData = {
    gym: gym as GymExportData["gym"],
    subscription: (sub as GymExportData["subscription"]) ?? null,
    members: (members ?? []) as GymExportData["members"],
    plans: (plans ?? []) as GymExportData["plans"],
    subscriptions: (subs ?? []).map((s: { plan_name: string; start_date: string; end_date: string; status: string; members: { full_name: string } | { full_name: string }[] | null }) => {
      // PostgREST returns a to-one embed as an object; older type inference widens
      // it to an array. Handle both so member_name is never silently dropped.
      const member = Array.isArray(s.members) ? s.members[0] : s.members;
      return {
        member_name: member?.full_name ?? null,
        plan_name: s.plan_name, start_date: s.start_date, end_date: s.end_date, status: s.status,
      };
    }),
    payments: (payments ?? []) as GymExportData["payments"],
  };

  const wb = buildGymWorkbook(data);
  const buffer = await wb.xlsx.writeBuffer();
  const today = new Date().toISOString().slice(0, 10);
  const filename = `${(gym as { slug: string }).slug}-export-${today}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
