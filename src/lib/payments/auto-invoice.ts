import "server-only";
import { after } from "next/server";
import type { GymContext } from "@/lib/auth/context";
import { loadInvoiceData } from "@/lib/payments/invoice-data";
import { emailInvoiceIfPossible } from "@/lib/payments/invoice-delivery";

/**
 * Fire-and-forget: once the current response is sent, email the member the
 * invoice for `paymentId`. The invoice data is loaded now (still in request
 * scope, so `ctx` is valid), while the expensive PDF render + email send are
 * deferred to `after()` so the payment/renewal action stays snappy.
 *
 * Entirely best-effort: a delivery hiccup never affects the payment that just
 * committed, and the owner can always re-send from the invoice page.
 */
export async function scheduleInvoiceEmail(
  paymentId: string,
  ctx: GymContext,
  tone: "receipt" | "welcome" = "receipt",
): Promise<void> {
  let data: Awaited<ReturnType<typeof loadInvoiceData>> = null;
  try {
    data = await loadInvoiceData(paymentId, ctx);
  } catch {
    return;
  }
  if (!data || !data.memberEmail) return;

  after(async () => {
    try {
      await emailInvoiceIfPossible(data, tone);
    } catch {
      // Best-effort — the owner can re-send from the invoice page.
    }
  });
}
