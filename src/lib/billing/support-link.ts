/**
 * Build a WhatsApp deep link (https://wa.me/<number>?text=...) to the SaaS
 * provider's support number, with a prefilled message. The number comes from
 * NEXT_PUBLIC_SUPPORT_WHATSAPP (international format; non-digits are stripped).
 * Returns null when the env var is unset/blank so callers can hide the button.
 */
export function buildSupportWhatsappLink(message: string): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.trim();
  if (!raw) return null;
  const number = raw.replace(/\D/g, "");
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
