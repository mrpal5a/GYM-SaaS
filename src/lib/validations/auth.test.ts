import { describe, it, expect } from "vitest";
import { changePasswordSchema, loginSchema, inviteSchema, slugify } from "./auth";

describe("auth validations", () => {
  it("rejects bad email on login", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
  it("invite requires a valid email", () => {
    expect(inviteSchema.safeParse({ email: "staff@gym.com" }).success).toBe(true);
  });
  it("slugify produces url-safe slugs", () => {
    expect(slugify("Iron Temple Gym!")).toBe("iron-temple-gym");
  });
});

describe("changePasswordSchema", () => {
  const base = { currentPassword: "oldpass12", newPassword: "newpass12", confirmPassword: "newpass12" };
  it("accepts a valid change", () => {
    expect(changePasswordSchema.safeParse(base).success).toBe(true);
  });
  it("rejects a short new password", () => {
    expect(changePasswordSchema.safeParse({ ...base, newPassword: "short", confirmPassword: "short" }).success).toBe(false);
  });
  it("rejects a mismatched confirmation", () => {
    expect(changePasswordSchema.safeParse({ ...base, confirmPassword: "different1" }).success).toBe(false);
  });
  it("rejects a new password equal to the current", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "samepass1", newPassword: "samepass1", confirmPassword: "samepass1" }).success).toBe(false);
  });
});
