import type { SubStatus } from "@/types/db";

/** Days before expiry at which we start nudging the owner to renew. */
export const PLAN_EXPIRY_WARN_DAYS = 15;

export type PlanBannerSeverity = "expiring" | "expired";

export interface PlanBanner {
  severity: PlanBannerSeverity;
  /** Whole days until the period ends; <= 0 once lapsed. */
  days: number;
}

/** Whole calendar days from `now` until `isoDate` (accepts date-only or full ISO). */
function daysBetween(isoDate: string, now: Date): number {
  const end = new Date(isoDate.slice(0, 10) + "T00:00:00");
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Decide whether the gym owner's SaaS subscription warrants a dashboard banner.
 * Pure + deterministic (inject `now` in tests). Returns null when no banner is due.
 *
 * - `past_due`/`canceled` are always expired, regardless of the period end.
 * - Otherwise the period end drives it: today-or-past = expired, within the warn
 *   window = expiring, beyond it (or no period end) = no banner.
 */
export function getPlanBanner(
  sub: { status: SubStatus | null; currentPeriodEnd: string | null },
  now: Date = new Date(),
): PlanBanner | null {
  if (sub.status === "past_due" || sub.status === "canceled") {
    const days = sub.currentPeriodEnd ? daysBetween(sub.currentPeriodEnd, now) : 0;
    return { severity: "expired", days };
  }

  if (!sub.currentPeriodEnd) return null;

  const days = daysBetween(sub.currentPeriodEnd, now);
  if (days <= 0) return { severity: "expired", days };
  if (days <= PLAN_EXPIRY_WARN_DAYS) return { severity: "expiring", days };
  return null;
}
