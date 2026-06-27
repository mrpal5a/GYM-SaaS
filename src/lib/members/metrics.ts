import type { MembershipStatus } from "@/types/db";

export interface BmiResult {
  value: number;
  category: "Underweight" | "Normal" | "Overweight" | "Obese";
}

/** BMI from height in cm + weight in kg. Returns null if either is missing. */
export function calcBmi(
  heightCm: number | null | undefined,
  weightKg: number | null | undefined,
): BmiResult | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
  const m = heightCm / 100;
  const value = Math.round((weightKg / (m * m)) * 10) / 10;
  let category: BmiResult["category"];
  if (value < 18.5) category = "Underweight";
  else if (value < 25) category = "Normal";
  else if (value < 30) category = "Overweight";
  else category = "Obese";
  return { value, category };
}

export const MEMBERSHIP_STATUS_META: Record<
  MembershipStatus,
  { label: string; tone: "success" | "warning" | "danger" | "muted" }
> = {
  active: { label: "Active", tone: "success" },
  expiring: { label: "Expiring soon", tone: "warning" },
  expired: { label: "Expired", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "muted" },
  none: { label: "No plan", tone: "muted" },
};

/** Whole days until the given date (negative if already past). */
export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const end = new Date(date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

const CURRENCY = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Format a money amount. Centralized so currency can be made per-gym later. */
export function formatMoney(amount: number): string {
  return CURRENCY.format(amount);
}

/**
 * Per-gym serial number for display, e.g. 7 -> "#007". Zero-padded to 3 digits for
 * tidy alignment in lists; longer numbers render in full (#1234).
 */
export function formatSerial(serial: number | null | undefined): string {
  if (serial == null) return "—";
  return `#${String(serial).padStart(3, "0")}`;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date + (date.length === 10 ? "T00:00:00" : "")).toLocaleDateString(
    "en-IN",
    { day: "numeric", month: "short", year: "numeric" },
  );
}
