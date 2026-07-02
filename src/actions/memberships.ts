"use server";
import { revalidatePath } from "next/cache";
import { getGymContext } from "@/lib/auth/context";
import { currentGymPaused } from "@/lib/billing/pause";
import { assignMembershipSchema } from "@/lib/validations/payment";
import { generateInvoiceNumber } from "@/lib/payments/invoice";
import { scheduleInvoiceEmail } from "@/lib/payments/auto-invoice";

export type ActionResult = { ok: false; error: string } | { ok: true };

const PAUSED_ERROR = "Your gym's service is paused. Please renew to continue.";

export async function assignMembershipAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized" };
  if (await currentGymPaused()) return { ok: false, error: PAUSED_ERROR };

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
      const { data: payment } = await ctx.supabase
        .from("payments")
        .insert({
          gym_id: ctx.gymId,
          member_id,
          member_name: member.full_name,
          subscription_id: subId as string,
          amount: plan.price,
          method: "cash",
          invoice_number: generateInvoiceNumber(),
          created_by: ctx.userId,
          source: "plan",
        })
        .select("id")
        .single();
      // Auto-email the invoice to the member (best-effort, in the background).
      if (payment) await scheduleInvoiceEmail(payment.id, ctx, "receipt");
    }
  }

  revalidatePath(`/members/${member_id}`);
  revalidatePath("/members");
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  return { ok: true };
}

/**
 * Assign a Personal Trainer plan to a member. Mirrors assignMembershipAction but
 * drives the assign_personal_trainer RPC, so it never disturbs the member's gym
 * membership. Shares the same form shape (assignMembershipSchema).
 */
export async function assignPersonalTrainerAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized" };
  if (await currentGymPaused()) return { ok: false, error: PAUSED_ERROR };

  const parsed = assignMembershipSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { member_id, plan_id, start_date, record_payment } = parsed.data;

  const { data: subId, error: rpcErr } = await ctx.supabase.rpc("assign_personal_trainer", {
    p_member_id: member_id,
    p_plan_id: plan_id,
    p_start_date: start_date ?? new Date().toISOString().slice(0, 10),
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  if (record_payment) {
    const [{ data: plan }, { data: member }] = await Promise.all([
      ctx.supabase.from("membership_plans").select("price").eq("id", plan_id).single(),
      ctx.supabase.from("members").select("full_name").eq("id", member_id).single(),
    ]);
    if (plan && member) {
      const { data: payment } = await ctx.supabase
        .from("payments")
        .insert({
          gym_id: ctx.gymId,
          member_id,
          member_name: member.full_name,
          subscription_id: subId as string,
          amount: plan.price,
          method: "cash",
          invoice_number: generateInvoiceNumber(),
          created_by: ctx.userId,
          source: "plan",
        })
        .select("id")
        .single();
      // Auto-email the invoice to the member (best-effort, in the background).
      if (payment) await scheduleInvoiceEmail(payment.id, ctx, "receipt");
    }
  }

  revalidatePath(`/members/${member_id}`);
  revalidatePath("/members");
  revalidatePath("/payments");
  return { ok: true };
}

/**
 * One-click renewal from the Renewals hub: re-assign the member's current plan
 * starting today and record the plan price as a cash payment. Reuses the
 * assign_membership RPC, which cancels the old subscription and computes the new
 * end date from the plan duration.
 */
export async function renewMembershipAction(formData: FormData): Promise<void> {
  const ctx = await getGymContext();
  if (!ctx) return;
  if (await currentGymPaused()) return;

  const memberId = String(formData.get("memberId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  if (!memberId || !planId) return;

  const today = new Date().toISOString().slice(0, 10);
  const { data: subId, error: rpcErr } = await ctx.supabase.rpc("assign_membership", {
    p_member_id: memberId,
    p_plan_id: planId,
    p_start_date: today,
  });
  if (rpcErr) return;

  const [{ data: plan }, { data: member }] = await Promise.all([
    ctx.supabase.from("membership_plans").select("price").eq("id", planId).single(),
    ctx.supabase.from("members").select("full_name").eq("id", memberId).single(),
  ]);
  if (plan && member) {
    const { data: payment } = await ctx.supabase
      .from("payments")
      .insert({
        gym_id: ctx.gymId,
        member_id: memberId,
        member_name: member.full_name,
        subscription_id: subId as string,
        amount: plan.price,
        method: "cash",
        invoice_number: generateInvoiceNumber(),
        created_by: ctx.userId,
        source: "plan",
      })
      .select("id")
      .single();
    // Auto-email the invoice to the member (best-effort, in the background).
    if (payment) await scheduleInvoiceEmail(payment.id, ctx, "receipt");
  }

  revalidatePath("/renewals");
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/members");
  revalidatePath("/dashboard");
  revalidatePath("/payments");
}

export async function cancelMembershipAction(formData: FormData): Promise<void> {
  const ctx = await getGymContext();
  if (!ctx) return;
  if (await currentGymPaused()) return;
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
