import { describe, it, expect } from "vitest";
import { signupSchema, loginSchema, inviteSchema, slugify } from "./auth";

describe("auth validations", () => {
  it("accepts a valid signup", () => {
    const r = signupSchema.safeParse({
      fullName: "Asha Rao", gymName: "Iron Temple",
      email: "a@b.com", password: "Str0ngPass!",
    });
    expect(r.success).toBe(true);
  });
  it("rejects short passwords", () => {
    const r = signupSchema.safeParse({
      fullName: "A", gymName: "G", email: "a@b.com", password: "short",
    });
    expect(r.success).toBe(false);
  });
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
