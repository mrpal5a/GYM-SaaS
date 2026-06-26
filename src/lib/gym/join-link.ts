import "server-only";
import QRCode from "qrcode";
import { siteUrl } from "@/lib/site-url";

/** Public join URL for a gym, e.g. https://app.example.com/join/<token>. */
export function buildJoinUrl(token: string): string {
  return `${siteUrl()}/join/${token}`;
}

/**
 * UPI scan-to-pay deep link (opens BHIM/GPay/PhonePe/etc.). `am` pre-fills the
 * exact amount. Values are %20-encoded (not "+") since some UPI apps mishandle "+".
 */
export function buildUpiUri(opts: {
  vpa: string;
  name?: string | null;
  amount?: number | null;
}): string {
  const parts = [`pa=${encodeURIComponent(opts.vpa)}`, "cu=INR"];
  if (opts.name) parts.push(`pn=${encodeURIComponent(opts.name)}`);
  if (opts.amount != null && opts.amount > 0) parts.push(`am=${opts.amount}`);
  return `upi://pay?${parts.join("&")}`;
}

/** Render text/URL to a PNG data-URL QR code for embedding in an <img>. */
export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 320, margin: 1, errorCorrectionLevel: "M" });
}
