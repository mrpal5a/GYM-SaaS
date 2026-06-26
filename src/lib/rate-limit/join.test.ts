// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
const { parseClientIp } = await import("./join");

describe("parseClientIp", () => {
  it("takes the left-most entry of x-forwarded-for", () => {
    expect(parseClientIp("203.0.113.7, 10.0.0.1, 10.0.0.2", null)).toBe("203.0.113.7");
  });

  it("trims surrounding whitespace", () => {
    expect(parseClientIp("  203.0.113.7  ", null)).toBe("203.0.113.7");
  });

  it("handles a single-IP forwarded-for", () => {
    expect(parseClientIp("203.0.113.7", null)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip when forwarded-for is absent", () => {
    expect(parseClientIp(null, "198.51.100.4")).toBe("198.51.100.4");
  });

  it("falls back to x-real-ip when forwarded-for is empty/whitespace", () => {
    expect(parseClientIp("   ", "198.51.100.4")).toBe("198.51.100.4");
  });

  it("returns 'unknown' when no IP header is present", () => {
    expect(parseClientIp(null, null)).toBe("unknown");
  });
});
