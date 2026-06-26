import "server-only";
import { getGymContext, type GymContext } from "@/lib/auth/context";
import { formatDate, formatMoney } from "@/lib/members/metrics";
import { methodLabel } from "@/lib/payments/invoice";
import type { Gym, Member, MemberSubscription, Payment } from "@/types/db";

/**
 * Everything needed to render an invoice — on screen, as a PDF, and in the
 * WhatsApp/email share text. Strings are pre-formatted so the page, the PDF, and
 * the share message can never drift from one another.
 */
export interface InvoiceData {
  paymentId: string;
  gymId: string;
  memberId: string | null;
  invoiceNumber: string;
  date: string;
  gymName: string;
  logoUrl: string | null;
  memberName: string;
  memberPhone: string | null;
  memberEmail: string | null;
  amount: string;
  lineItem: string;
  /** Raw plan name (null for ad-hoc payments) — used in the welcome message. */
  planName: string | null;
  /** Pre-formatted membership end date, when this payment is tied to a subscription. */
  validUntil: string | null;
  note: string | null;
  methodLabel: string;
}

/**
 * Load + assemble an invoice for the caller's gym. Pass an already-resolved
 * `ctx` to avoid a second auth round-trip (the send actions do this); the page
 * omits it. Returns null when there's no gym context or the payment isn't
 * visible to the caller — RLS confines every read to the caller's own gym.
 */
export async function loadInvoiceData(
  paymentId: string,
  ctx?: GymContext,
): Promise<InvoiceData | null> {
  const context = ctx ?? (await getGymContext());
  if (!context) return null;
  const { supabase, gymId } = context;

  const [{ data: paymentRow }, { data: gymRow }] = await Promise.all([
    supabase.from("payments").select("*").eq("id", paymentId).single(),
    supabase.from("gyms").select("name, logo_url").eq("id", gymId).single<Pick<Gym, "name" | "logo_url">>(),
  ]);
  if (!paymentRow) return null;
  const payment = paymentRow as Payment;

  // Member contact + the plan this payment was for (both best-effort/optional).
  const [{ data: memberRow }, { data: subRow }] = await Promise.all([
    payment.member_id
      ? supabase.from("members").select("full_name, phone, email").eq("id", payment.member_id).single()
      : Promise.resolve({ data: null }),
    payment.subscription_id
      ? supabase.from("member_subscriptions").select("plan_name, end_date").eq("id", payment.subscription_id).single()
      : Promise.resolve({ data: null }),
  ]);
  const member = memberRow as Pick<Member, "full_name" | "phone" | "email"> | null;
  const sub = subRow as Pick<MemberSubscription, "plan_name" | "end_date"> | null;

  return {
    paymentId: payment.id,
    gymId,
    memberId: payment.member_id,
    invoiceNumber: payment.invoice_number ?? payment.id.slice(0, 8).toUpperCase(),
    date: formatDate(payment.paid_at.slice(0, 10)),
    gymName: gymRow?.name ?? "Your Gym",
    logoUrl: gymRow?.logo_url ?? null,
    memberName: member?.full_name ?? payment.member_name ?? "Member",
    memberPhone: member?.phone ?? null,
    memberEmail: member?.email ?? null,
    amount: formatMoney(Number(payment.amount)),
    lineItem: sub?.plan_name ? `${sub.plan_name} membership` : "Membership payment",
    planName: sub?.plan_name ?? null,
    validUntil: sub?.end_date ? formatDate(sub.end_date) : null,
    note: payment.note,
    methodLabel: methodLabel(payment.method),
  };
}
