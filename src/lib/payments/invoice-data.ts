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
  /** The gym's member rules, included in the new-member welcome email. */
  gymRules: string[];
  memberName: string;
  memberPhone: string | null;
  memberEmail: string | null;
  amount: string;
  lineItem: string;
  /** Raw plan name (null for ad-hoc payments) — used in the welcome message. */
  planName: string | null;
  /** Pre-formatted membership end date, when this payment is tied to a subscription. */
  validUntil: string | null;
  /** What this invoice is for: "New membership" | "Membership renewal" |
   *  "Personal training" | "Payment received". */
  purpose: string;
  /** Pre-formatted coverage window ("1 Jul 2026 – 1 Aug 2026"), when known. */
  period: string | null;
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
    supabase.from("gyms").select("name, logo_url, rules").eq("id", gymId).single<Pick<Gym, "name" | "logo_url" | "rules">>(),
  ]);
  if (!paymentRow) return null;
  const payment = paymentRow as Payment;

  // Member contact + the plan this payment was for (both best-effort/optional).
  const [{ data: memberRow }, { data: subRow }] = await Promise.all([
    payment.member_id
      ? supabase.from("members").select("full_name, phone, email").eq("id", payment.member_id).single()
      : Promise.resolve({ data: null }),
    payment.subscription_id
      ? supabase
          .from("member_subscriptions")
          .select("plan_name, start_date, end_date, kind")
          .eq("id", payment.subscription_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);
  const member = memberRow as Pick<Member, "full_name" | "phone" | "email"> | null;
  const sub = subRow as Pick<
    MemberSubscription,
    "plan_name" | "start_date" | "end_date" | "kind"
  > | null;

  // Derive what the invoice is for (new vs renewal vs PT vs ad-hoc) and its
  // coverage window, so the invoice reads clearly to whoever opens it.
  let purpose = "Payment received";
  let period: string | null = null;
  if (sub) {
    period =
      sub.start_date && sub.end_date
        ? `${formatDate(sub.start_date)} – ${formatDate(sub.end_date)}`
        : sub.end_date
          ? `Valid until ${formatDate(sub.end_date)}`
          : null;
    if (sub.kind === "personal_trainer") {
      purpose = "Personal training";
    } else {
      // Renewal if the member already had an earlier membership subscription.
      let prior = 0;
      if (payment.member_id && sub.start_date) {
        const { count } = await supabase
          .from("member_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("member_id", payment.member_id)
          .eq("kind", "membership")
          .lt("start_date", sub.start_date);
        prior = count ?? 0;
      }
      purpose = prior > 0 ? "Membership renewal" : "New membership";
    }
  }

  return {
    paymentId: payment.id,
    gymId,
    memberId: payment.member_id,
    invoiceNumber: payment.invoice_number ?? payment.id.slice(0, 8).toUpperCase(),
    date: formatDate(payment.paid_at.slice(0, 10)),
    gymName: gymRow?.name ?? "Your Gym",
    logoUrl: gymRow?.logo_url ?? null,
    gymRules: gymRow?.rules ?? [],
    memberName: member?.full_name ?? payment.member_name ?? "Member",
    memberPhone: member?.phone ?? null,
    memberEmail: member?.email ?? null,
    amount: formatMoney(Number(payment.amount)),
    lineItem: sub?.plan_name ? `${sub.plan_name} membership` : "Membership payment",
    planName: sub?.plan_name ?? null,
    validUntil: sub?.end_date ? formatDate(sub.end_date) : null,
    purpose,
    period,
    note: payment.note,
    methodLabel: methodLabel(payment.method),
  };
}
