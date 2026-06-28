import "server-only";
import { getGymContext, type GymContext } from "@/lib/auth/context";
import { formatDate, formatSerial } from "@/lib/members/metrics";
import type { Gym, MemberWithStatus } from "@/types/db";

export interface JoiningFormData {
  gymName: string;
  logoUrl: string | null;
  gymAddress: string | null;
  rules: string[];
  member: {
    fullName: string;
    serial: string;
    photoUrl: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    phone: string | null;
    emergencyPhone: string | null;
    email: string | null;
    address: string | null;
    height: string | null;
    weight: string | null;
    joinedAt: string | null;
  };
  membership: {
    planName: string;
    startDate: string | null;
    endDate: string | null;
    status: string;
  } | null;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Everything needed to render a member's joining form PDF. Strings are
 * pre-formatted here so the document never re-derives them. RLS confines every
 * read to the caller's own gym; returns null when there's no context or the
 * member isn't visible to the caller.
 */
export async function loadJoiningFormData(
  memberId: string,
  ctx?: GymContext,
): Promise<JoiningFormData | null> {
  const context = ctx ?? (await getGymContext());
  if (!context) return null;
  const { supabase, gymId } = context;

  const [{ data: memberRow }, { data: gymRow }] = await Promise.all([
    supabase.from("member_with_status").select("*").eq("id", memberId).single(),
    supabase
      .from("gyms")
      .select("name, logo_url, address, rules")
      .eq("id", gymId)
      .single<Pick<Gym, "name" | "logo_url" | "address" | "rules">>(),
  ]);
  if (!memberRow) return null;
  const m = memberRow as MemberWithStatus;

  const hasMembership = Boolean(m.subscription_id) && m.membership_status !== "none";

  return {
    gymName: gymRow?.name ?? "Your Gym",
    logoUrl: gymRow?.logo_url ?? null,
    gymAddress: gymRow?.address ?? null,
    rules: Array.isArray(gymRow?.rules) ? gymRow!.rules : [],
    member: {
      fullName: m.full_name,
      serial: formatSerial(m.serial),
      photoUrl: m.photo_url,
      gender: m.gender ? cap(m.gender) : null,
      dateOfBirth: m.date_of_birth ? formatDate(m.date_of_birth) : null,
      phone: m.phone,
      emergencyPhone: m.emergency_phone,
      email: m.email,
      address: m.address,
      height: m.height_cm ? `${m.height_cm} cm` : null,
      weight: m.weight_kg ? `${m.weight_kg} kg` : null,
      joinedAt: m.joined_at ? formatDate(m.joined_at) : null,
    },
    membership: hasMembership
      ? {
          planName: m.plan_name ?? "Membership",
          startDate: m.start_date ? formatDate(m.start_date) : null,
          endDate: m.end_date ? formatDate(m.end_date) : null,
          status: cap(m.membership_status),
        }
      : null,
  };
}
