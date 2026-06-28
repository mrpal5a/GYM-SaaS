import { describe, it, expect } from "vitest";
import { memberSchema } from "./member";

describe("memberSchema emergency_phone", () => {
  it("accepts a member with no emergency phone (optional for manual entry)", () => {
    const r = memberSchema.safeParse({ full_name: "Asha", emergency_phone: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.emergency_phone).toBeUndefined();
  });

  it("keeps a provided emergency phone (trimmed)", () => {
    const r = memberSchema.safeParse({ full_name: "Asha", emergency_phone: "  9123456780  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.emergency_phone).toBe("9123456780");
  });
});
