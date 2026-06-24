export type Role = "super_admin" | "gym_owner" | "staff";

export function homePathForRole(role: Role): string {
  return role === "super_admin" ? "/admin" : "/dashboard";
}

export function canManageGym(role: Role): boolean {
  return role === "super_admin" || role === "gym_owner";
}
