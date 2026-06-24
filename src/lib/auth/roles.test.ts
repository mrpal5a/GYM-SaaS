import { describe, it, expect } from "vitest";
import { homePathForRole, canManageGym } from "./roles";

describe("role helpers", () => {
  it("routes super_admin to /admin", () => {
    expect(homePathForRole("super_admin")).toBe("/admin");
  });
  it("routes owner and staff to /dashboard", () => {
    expect(homePathForRole("gym_owner")).toBe("/dashboard");
    expect(homePathForRole("staff")).toBe("/dashboard");
  });
  it("only owner/super_admin can manage the gym", () => {
    expect(canManageGym("gym_owner")).toBe(true);
    expect(canManageGym("super_admin")).toBe(true);
    expect(canManageGym("staff")).toBe(false);
  });
});
