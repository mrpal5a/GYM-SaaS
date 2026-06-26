"use server";
import { getGymContext } from "@/lib/auth/context";
import { loadInvoiceData } from "@/lib/payments/invoice-data";
import { renderInvoice, prepareWhatsApp, emailInvoice } from "@/lib/payments/invoice-delivery";
import { normalizePhone } from "@/lib/members/whatsapp";

export type WhatsAppResult = { ok: true; url: string } | { ok: false; error: string };
export type EmailResult = { ok: true } | { ok: false; error: string };

/**
 * Generate the invoice PDF, store it in the (public, gym-scoped) `invoices`
 * bucket, and return a wa.me link whose pre-filled message carries the thank-you
 * text plus a download link to that PDF. WhatsApp click-to-chat can't attach
 * files, so the hosted-link approach is how the member gets the PDF.
 */
export async function prepareInvoiceWhatsAppAction(paymentId: string): Promise<WhatsAppResult> {
  if (!paymentId) return { ok: false, error: "Missing invoice." };
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized." };

  const data = await loadInvoiceData(paymentId, ctx);
  if (!data) return { ok: false, error: "Invoice not found." };
  if (!normalizePhone(data.memberPhone)) {
    return { ok: false, error: "This member doesn't have a valid phone number." };
  }

  const pdf = await renderInvoice(data);
  if (!pdf) return { ok: false, error: "Could not generate the invoice PDF." };

  // prepareWhatsApp uploads the PDF with the service-role client (the path is fixed
  // server-side to the caller's own gym folder) and returns the pre-filled link.
  const url = await prepareWhatsApp(data, pdf);
  if (!url) return { ok: false, error: "Could not prepare the WhatsApp message." };
  return { ok: true, url };
}

/**
 * Generate the invoice PDF and email it to the member as a real attachment via
 * Resend, with the thank-you note as the body. Surfaces a friendly message when
 * the member has no email or Resend isn't configured yet.
 */
export async function sendInvoiceEmailAction(paymentId: string): Promise<EmailResult> {
  if (!paymentId) return { ok: false, error: "Missing invoice." };
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized." };

  const data = await loadInvoiceData(paymentId, ctx);
  if (!data) return { ok: false, error: "Invoice not found." };
  if (!data.memberEmail) return { ok: false, error: "This member doesn't have an email address." };

  const pdf = await renderInvoice(data);
  if (!pdf) return { ok: false, error: "Could not generate the invoice PDF." };

  return emailInvoice(data, pdf);
}
