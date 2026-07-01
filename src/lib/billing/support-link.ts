/**
 * The SaaS provider's support number as digits only, or null when unset.
 * Read from NEXT_PUBLIC_SUPPORT_WHATSAPP (canonical), falling back to
 * NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER. Non-digits are stripped.
 */
function supportDigits(): string | null {
  const raw = (
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ??
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER
  )?.trim();
  if (!raw) return null;
  const number = raw.replace(/\D/g, "");
  return number || null;
}

/**
 * Build a WhatsApp deep link (https://wa.me/<number>?text=...) to the support
 * number, with a prefilled message. Returns null when no number is configured so
 * callers can hide the button.
 */
export function buildSupportWhatsappLink(message: string): string | null {
  const number = supportDigits();
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** The support number for display / tel: links (e.g. "+919812345678"), or null. */
export function supportPhone(): string | null {
  const number = supportDigits();
  return number ? `+${number}` : null;
}
