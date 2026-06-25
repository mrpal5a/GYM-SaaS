"use server";
import { revalidatePath } from "next/cache";
import { getGymContext } from "@/lib/auth/context";
import { paymentSchema } from "@/lib/validations/payment";
import { generateInvoiceNumber } from "@/lib/payments/invoice";

export type ActionResult = { ok: false; error: string } | { ok: true };

export async function recordPaymentAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized" };

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

  const { error } = await ctx.supabase.from("payments").insert({
    gym_id: ctx.gymId,
    member_id,
    member_name: member.full_name,
    amount,
    method,
    note: note ?? null,
    paid_at: paid_at ? new Date(paid_at + "T12:00:00").toISOString() : new Date().toISOString(),
    invoice_number: generateInvoiceNumber(),
    created_by: ctx.userId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/payments");
  revalidatePath(`/members/${member_id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
