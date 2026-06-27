export type ExpiryStatus = "expired" | "expiring_soon" | "active" | "none";

const SOON_DAYS = 14;
const DAY_MS = 86_400_000;

/**
 * Classify a gym's SaaS subscription period-end relative to `now`.
 * - expired:       period end already passed
 * - expiring_soon: within SOON_DAYS (inclusive)
 * - active:        further out
 * - none:          no period end recorded
 */
export function subscriptionExpiryStatus(
  periodEnd: string | null | undefined,
  now: Date = new Date(),
): ExpiryStatus {
  if (!periodEnd) return "none";
  const end = new Date(periodEnd).getTime();
  const diffDays = (end - now.getTime()) / DAY_MS;
  if (diffDays < 0) return "expired";
  if (diffDays <= SOON_DAYS) return "expiring_soon";
  return "active";
}
