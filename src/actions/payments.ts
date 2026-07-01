"use server";
import { revalidatePath } from "next/cache";
import { getGymContext } from "@/lib/auth/context";
import { currentGymPaused } from "@/lib/billing/pause";
import { paymentSchema } from "@/lib/validations/payment";
import { generateInvoiceNumber } from "@/lib/payments/invoice";
import { scheduleInvoiceEmail } from "@/lib/payments/auto-invoice";

export type ActionResult = { ok: false; error: string } | { ok: true };

const PAUSED_ERROR = "Your gym's service is paused. Please renew to continue.";

export async function recordPaymentAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized" };
  if (await currentGymPaused()) return { ok: false, error: PAUSED_ERROR };

  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { member_id, amount, method, note, paid_at } = parsed.data;

  // Snapshot the member name onto the payment so the ledger survives deletion.
  const { data: member } = await ctx.supabase
    .from("members")
    .select("full_name")
    .eq("id", member_id)
    .eq("gym_id", ctx.gymId)
    .single();
  if (!member) return { ok: false, error: "Member not found" };

  const { data: payment, error } = await ctx.supabase
    .from("payments")
    .insert({
      gym_id: ctx.gymId,
      member_id,
      member_name: member.full_name,
      amount,
      method,
      note: note ?? null,
      paid_at: paid_at ? new Date(paid_at + "T12:00:00").toISOString() : new Date().toISOString(),
      invoice_number: generateInvoiceNumber(),
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  // Auto-email the invoice to the member (best-effort, in the background).
  await scheduleInvoiceEmail(payment.id, ctx, "receipt");

  revalidatePath("/payments");
  revalidatePath(`/members/${member_id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
