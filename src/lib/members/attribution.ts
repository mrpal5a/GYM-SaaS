import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { MemberSource, PaymentSource } from "@/types/db";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface Actor {
  id: string;
  full_name: string | null;
  email: string;
  role: "super_admin" | "gym_owner" | "staff";
}

/**
 * Resolve a set of profile ids (created_by / reviewed_by) to their names + roles
 * in one query, so pages can label "who did this" without an N+1. Same-gym
 * profiles are readable under RLS, so this works for owner and staff callers
 * alike. Returns a Map keyed by profile id; unknown/null ids are simply absent.
 */
export async function loadActors(
  supabase: ServerClient,
  ids: (string | null | undefined)[],
): Promise<Map<string, Actor>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map();

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .in("id", unique);

  return new Map((data ?? []).map((a) => [a.id, a as Actor]));
}

/** Friendly role suffix for an attribution line. */
export function roleLabel(role: Actor["role"]): string {
  if (role === "gym_owner") return "owner";
  if (role === "super_admin") return "admin";
  return "staff";
}

/**
 * "Ramesh (owner)" / "Priya (staff)". Falls back to the email when a name is
 * missing, and to a neutral placeholder when the actor is unknown (e.g. a legacy
 * row, or the profile was deleted).
 */
export function actorLabel(actor: Actor | null | undefined): string {
  if (!actor) return "Unknown";
  const name = actor.full_name?.trim() || actor.email;
  return `${name} (${roleLabel(actor.role)})`;
}

/** How a payment was recorded — the "how" in the attribution line. */
export function paymentSourceLabel(source: PaymentSource): string {
  switch (source) {
    case "plan":
      return "Recorded with plan";
    case "join_approval":
      return "On request approval";
    default:
      return "Recorded manually";
  }
}

/** How a member row came to exist. */
export function memberSourceLabel(source: MemberSource): string {
  return source === "join_approval" ? "Approved from join request" : "Added manually";
}
