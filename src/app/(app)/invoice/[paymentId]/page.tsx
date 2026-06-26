import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { InvoiceActions } from "@/components/invoice/invoice-actions";
import { loadInvoiceData } from "@/lib/payments/invoice-data";
import { normalizePhone } from "@/lib/members/whatsapp";

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const data = await loadInvoiceData(paymentId);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={data.memberId ? `/members/${data.memberId}` : "/payments"}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" /> Back
        </Link>
        <InvoiceActions
          paymentId={data.paymentId}
          hasPhone={Boolean(normalizePhone(data.memberPhone))}
          hasEmail={Boolean(data.memberEmail)}
        />
      </div>

      <Card className="glass space-y-8 p-8 print:border-0 print:shadow-none">
        {/* Header: branding + invoice meta */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {data.logoUrl ? (
              <Image
                src={data.logoUrl}
                alt={`${data.gymName} logo`}
                width={48}
                height={48}
                className="size-12 rounded-md object-cover"
                unoptimized
              />
            ) : null}
            <div>
              <h1 className="text-xl font-semibold">{data.gymName}</h1>
              <p className="text-xs text-muted-foreground">Payment receipt</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoice</p>
            <p className="font-mono text-sm font-medium">{data.invoiceNumber}</p>
            <p className="mt-1 text-xs text-muted-foreground">{data.date}</p>
          </div>
        </div>

        {/* Bill to */}
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Bill to</p>
          <p className="font-medium">{data.memberName}</p>
          {data.memberPhone && <p className="text-sm text-muted-foreground">{data.memberPhone}</p>}
          {data.memberEmail && <p className="text-sm text-muted-foreground">{data.memberEmail}</p>}
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
                  {data.lineItem}
                  {data.note && (
                    <span className="block text-xs text-muted-foreground">{data.note}</span>
                  )}
                </td>
                <td className="py-3 text-right font-medium">{data.amount}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="py-3 text-right font-medium">Total</td>
                <td className="py-3 text-right text-lg font-semibold">{data.amount}</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">Paid via {data.methodLabel}</p>
        </div>

        <p className="border-t border-border/40 pt-4 text-center text-xs text-muted-foreground">
          Thank you for being a member of {data.gymName}.
        </p>
      </Card>
    </div>
  );
}
