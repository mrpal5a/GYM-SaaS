"use server";
import { revalidatePath } from "next/cache";
import { getGymContext } from "@/lib/auth/context";
import { assignMembershipSchema } from "@/lib/validations/payment";
import { generateInvoiceNumber } from "@/lib/payments/invoice";

export type ActionResult = { ok: false; error: string } | { ok: true };

export async function assignMembershipAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized" };

  const parsed = assignMembershipSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { member_id, plan_id, start_date, record_payment } = parsed.data;

  const { data: subId, error: rpcErr } = await ctx.supabase.rpc("assign_membership", {
    p_member_id: member_id,
    p_plan_id: plan_id,
    p_start_date: start_date ?? new Date().toISOString().slice(0, 10),
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  // Optionally record the plan price as a payment in the same step.
  if (record_payment) {
    const [{ data: plan }, { data: member }] = await Promise.all([
      ctx.supabase.from("membership_plans").select("price").eq("id", plan_id).single(),
      ctx.supabase.from("members").select("full_name").eq("id", member_id).single(),
    ]);
    if (plan && member) {
      await ctx.supabase.from("payments").insert({
        gym_id: ctx.gymId,
        member_id,
        member_name: member.full_name,
        subscription_id: subId as string,
        amount: plan.price,
        method: "cash",
        invoice_number: generateInvoiceNumber(),
        created_by: ctx.userId,
      });
    }
  }

  revalidatePath(`/members/${member_id}`);
  revalidatePath("/members");
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  return { ok: true };
}

export async function cancelMembershipAction(formData: FormData): Promise<void> {
  const ctx = await getGymContext();
  if (!ctx) return;
  const subId = String(formData.get("subscriptionId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  if (!subId) return;

  await ctx.supabase
    .from("member_subscriptions")
    .update({ status: "cancelled" })
    .eq("id", subId)
    .eq("gym_id", ctx.gymId);
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/members");
  revalidatePath("/dashboard");
}
