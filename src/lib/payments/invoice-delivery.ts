import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderInvoicePdf } from "@/lib/payments/invoice-pdf";
import { buildInvoiceShareText, buildWelcomeMessage } from "@/lib/payments/invoice";
import { buildWhatsAppLink, normalizePhone } from "@/lib/members/whatsapp";
import { sendInvoiceEmail, type SendResult } from "@/lib/email/resend";
import { shortenUrl } from "@/lib/url/shorten";
import type { InvoiceData } from "@/lib/payments/invoice-data";

const INVOICE_BUCKET = "invoices";

/** The message variant: a generic payment receipt vs. a new-member welcome. */
type Tone = "receipt" | "welcome";

function shareText(data: InvoiceData, tone: Tone, pdfUrl?: string): string {
  if (tone === "welcome") {
    return buildWelcomeMessage({
      memberName: data.memberName,
      gymName: data.gymName,
      planName: data.planName,
      validUntil: data.validUntil,
      amount: data.amount,
      invoiceNumber: data.invoiceNumber,
      date: data.date,
      pdfUrl,
    });
  }
  return buildInvoiceShareText({
    memberName: data.memberName,
    gymName: data.gymName,
    amount: data.amount,
    invoiceNumber: data.invoiceNumber,
    date: data.date,
    pdfUrl,
  });
}

/** Render the invoice to a PDF Buffer, or null if rendering fails. */
export async function renderInvoice(data: InvoiceData): Promise<Buffer | null> {
  try {
    return await renderInvoicePdf(data);
  } catch {
    return null;
  }
}

/**
 * Store the PDF in the (public, gym-scoped) `invoices` bucket and return a wa.me
 * click-to-chat link whose pre-filled message carries the share text plus a
 * download link to that PDF. Returns null when the member has no usable phone or
 * the upload fails — WhatsApp can't attach files, so the hosted link is how the
 * member gets the PDF. Re-sending upserts to the same path.
 */
export async function prepareWhatsApp(
  data: InvoiceData,
  pdf: Buffer,
  tone: Tone = "receipt",
): Promise<string | null> {
  if (!normalizePhone(data.memberPhone)) return null;

  const admin = createAdminClient();
  const path = `${data.gymId}/${data.paymentId}.pdf`;
  const { error } = await admin.storage
    .from(INVOICE_BUCKET)
    .upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (error) return null;

  const { data: pub } = admin.storage.from(INVOICE_BUCKET).getPublicUrl(path);
  const shortUrl = await shortenUrl(pub.publicUrl);
  return buildWhatsAppLink(data.memberPhone, shareText(data, tone, shortUrl));
}

/**
 * Build a welcome WhatsApp link WITHOUT rendering the PDF. The invoice PDF has a
 * deterministic public path, so we can shorten its eventual download URL up front
 * and let the actual render + upload happen in the background (e.g. via `after()`).
 * By the time the member taps the link, the upload has populated that path. Used
 * on approval to keep the response fast while still handing the owner a one-tap
 * WhatsApp message that includes the download link. Returns null when the member
 * has no usable phone.
 */
export async function prepareWelcomeWhatsApp(data: InvoiceData): Promise<string | null> {
  if (!normalizePhone(data.memberPhone)) return null;
  const admin = createAdminClient();
  const path = `${data.gymId}/${data.paymentId}.pdf`;
  const { data: pub } = admin.storage.from(INVOICE_BUCKET).getPublicUrl(path);
  const shortUrl = await shortenUrl(pub.publicUrl);
  return buildWhatsAppLink(data.memberPhone, shareText(data, "welcome", shortUrl));
}

/** Email the invoice PDF as a real attachment. Caller guarantees `memberEmail`. */
export async function emailInvoice(
  data: InvoiceData,
  pdf: Buffer,
  tone: Tone = "receipt",
): Promise<SendResult> {
  if (!data.memberEmail) return { ok: false, error: "This member doesn't have an email address." };
  const subject =
    tone === "welcome"
      ? `Welcome to ${data.gymName} · Invoice ${data.invoiceNumber}`
      : `Invoice ${data.invoiceNumber} · ${data.gymName}`;
  return sendInvoiceEmail({
    to: data.memberEmail,
    gymName: data.gymName,
    subject,
    text: shareText(data, tone),
    pdf,
    filename: `Invoice-${data.invoiceNumber}.pdf`,
  });
}

/** Outcome of an auto-delivery attempt, surfaced to the owner after approval. */
export interface InvoiceDelivery {
  paymentId: string;
  /** A wa.me link the owner taps to send, or null when there's no usable phone. */
  whatsappUrl: string | null;
  emailSent: boolean;
  /** Set only when the member HAS an email but the send failed. */
  emailError: string | null;
}

/**
 * Render the invoice once and fan it out: email it (if the member has an email)
 * and prepare a WhatsApp link (if they have a phone). Every step is best-effort —
 * a delivery hiccup must never undo an approval that already committed. The
 * caller passes a `ctx` already scoped to the payment's gym.
 */
export async function deliverInvoice(
  data: InvoiceData,
): Promise<InvoiceDelivery> {
  const pdf = await renderInvoice(data);
  if (!pdf) {
    return { paymentId: data.paymentId, whatsappUrl: null, emailSent: false, emailError: null };
  }

  const [whatsappUrl, emailResult] = await Promise.all([
    prepareWhatsApp(data, pdf, "welcome"),
    data.memberEmail ? emailInvoice(data, pdf, "welcome") : Promise.resolve(null),
  ]);

  return {
    paymentId: data.paymentId,
    whatsappUrl,
    emailSent: emailResult?.ok ?? false,
    emailError: emailResult && !emailResult.ok ? emailResult.error : null,
  };
}
