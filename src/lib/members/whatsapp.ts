import type { MembershipStatus } from "@/types/db";
import { formatDate } from "@/lib/members/metrics";

/**
 * Normalize an India-first phone number into the digits-only, country-coded form
 * that wa.me expects (e.g. "919876543210"). Returns null when there aren't
 * enough digits to form a dialable number.
 *
 * Handles the common shapes gyms enter by hand: "98765 43210", "+91 98765-43210",
 * "09876543210", "919876543210".
 */
export function normalizePhone(
  phone: string | null | undefined,
  defaultCountryCode = "91",
): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  // Drop a single leading trunk "0" (e.g. "09876543210").
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Bare 10-digit local number -> prepend the default country code.
  if (digits.length === 10) {
    digits = defaultCountryCode + digits;
  }

  // Anything shorter than a plausible national number is unusable.
  return digits.length >= 11 ? digits : null;
}

/** Build the pre-filled reminder text, tailored to whether the plan is expiring or already expired. */
export function buildRenewalMessage(opts: {
  memberName: string;
  planName: string | null;
  gymName: string;
  endDate: string | null;
  status: MembershipStatus;
}): string {
  const { memberName, planName, gymName, endDate, status } = opts;
  const firstName = memberName.trim().split(/\s+/)[0] || memberName;
  const plan = planName ? `${planName} membership` : "membership";
  const when = formatDate(endDate);

  const line =
    status === "expired"
      ? `your ${plan} at ${gymName} expired on ${when}.`
      : `your ${plan} at ${gymName} is expiring on ${when}.`;

  return `Hi ${firstName}, ${line} Renew now to keep training with us! 💪`;
}

/**
 * Build a click-to-chat wa.me link with a pre-filled message. Returns null when
 * the phone can't be normalized, so callers can disable the button gracefully.
 * Uses the free WhatsApp link scheme — no API, no per-message cost.
 */
export function buildWhatsAppLink(
  phone: string | null | undefined,
  message: string,
): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
