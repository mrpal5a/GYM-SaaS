export type Role = "super_admin" | "gym_owner" | "staff";

export function homePathForRole(role: Role): string {
  return role === "super_admin" ? "/admin" : "/dashboard";
}

export function canManageGym(role: Role): boolean {
  return role === "super_admin" || role === "gym_owner";
}

// Reviewing (approving/rejecting) join requests is an operational task open to
// staff too — unlike gym management (settings, deleting members) which stays
// owner-only. Every decision is stamped with the actor, so the owner can always
// see who approved or rejected a request.
export function canReviewRequests(role: Role): boolean {
  return role === "super_admin" || role === "gym_owner" || role === "staff";
}
