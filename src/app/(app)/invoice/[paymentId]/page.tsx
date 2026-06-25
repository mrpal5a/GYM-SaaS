import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { InvoiceActions } from "@/components/invoice/invoice-actions";
import { getGymBranding } from "@/lib/gym/branding";
import { formatDate, formatMoney } from "@/lib/members/metrics";
import { buildInvoiceShareText } from "@/lib/payments/invoice";
import { buildWhatsAppLink } from "@/lib/members/whatsapp";
import type { Payment, Member, MemberSubscription } from "@/types/db";

export const dynamic = "force-dynamic";

function methodLabel(method: string): string {
  if (method === "bank_transfer") return "Bank transfer";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const supabase = await createClient();

  const [{ data: paymentRow }, branding] = await Promise.all([
    supabase.from("payments").select("*").eq("id", paymentId).single(),
    getGymBranding(),
  ]);
  if (!paymentRow) notFound();
  const payment = paymentRow as Payment;

  // Member contact + the plan this payment was for (best-effort; both optional).
  const [{ data: memberRow }, { data: subRow }] = await Promise.all([
    payment.member_id
      ? supabase.from("members").select("full_name, phone, email").eq("id", payment.member_id).single()
      : Promise.resolve({ data: null }),
    payment.subscription_id
      ? supabase.from("member_subscriptions").select("plan_name").eq("id", payment.subscription_id).single()
      : Promise.resolve({ data: null }),
  ]);
  const member = memberRow as Pick<Member, "full_name" | "phone" | "email"> | null;
  const sub = subRow as Pick<MemberSubscription, "plan_name"> | null;

  const gymName = branding?.name ?? "Your Gym";
  const memberName = member?.full_name ?? payment.member_name ?? "Member";
  const amount = formatMoney(Number(payment.amount));
  const date = formatDate(payment.paid_at.slice(0, 10));
  const lineItem = sub?.plan_name ? `${sub.plan_name} membership` : "Membership payment";
  const invoiceNo = payment.invoice_number ?? payment.id.slice(0, 8).toUpperCase();

  const shareText = buildInvoiceShareText({
    memberName,
    gymName,
    amount,
    invoiceNumber: invoiceNo,
    date,
  });
  const whatsappLink = buildWhatsAppLink(member?.phone, shareText);
  const emailHref = member?.email
    ? `mailto:${member.email}?subject=${encodeURIComponent(`Invoice ${invoiceNo} · ${gymName}`)}&body=${encodeURIComponent(shareText)}`
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={payment.member_id ? `/members/${payment.member_id}` : "/payments"}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" /> Back
        </Link>
        <InvoiceActions whatsappLink={whatsappLink} emailHref={emailHref} />
      </div>

      <Card className="glass space-y-8 p-8 print:border-0 print:shadow-none">
        {/* Header: branding + invoice meta */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {branding?.logoUrl ? (
              <Image
                src={branding.logoUrl}
                alt={`${gymName} logo`}
                width={48}
                height={48}
                className="size-12 rounded-md object-cover"
                unoptimized
              />
            ) : null}
            <div>
              <h1 className="text-xl font-semibold">{gymName}</h1>
              <p className="text-xs text-muted-foreground">Payment receipt</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoice</p>
            <p className="font-mono text-sm font-medium">{invoiceNo}</p>
            <p className="mt-1 text-xs text-muted-foreground">{date}</p>
          </div>
        </div>

        {/* Bill to */}
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Bill to</p>
          <p className="font-medium">{memberName}</p>
          {member?.phone && <p className="text-sm text-muted-foreground">{member.phone}</p>}
          {member?.email && <p className="text-sm text-muted-foreground">{member.email}</p>}
        </div>

        {/* Line items */}
        <div>
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/40">
                <td className="py-3">
                  {lineItem}
                  {payment.note && (
                    <span className="block text-xs text-muted-foreground">{payment.note}</span>
                  )}
                </td>
                <td className="py-3 text-right font-medium">{amount}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="py-3 text-right font-medium">Total</td>
                <td className="py-3 text-right text-lg font-semibold">{amount}</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">Paid via {methodLabel(payment.method)}</p>
        </div>

        <p className="border-t border-border/40 pt-4 text-center text-xs text-muted-foreground">
          Thank you for being a member of {gymName}.
        </p>
      </Card>
    </div>
  );
}
