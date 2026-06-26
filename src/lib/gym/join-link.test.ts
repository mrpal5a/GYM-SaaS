// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
const { buildJoinUrl, buildUpiUri } = await import("./join-link");

describe("buildJoinUrl", () => {
  const orig = process.env.NEXT_PUBLIC_SITE_URL;
  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = orig;
  });

  it("builds from NEXT_PUBLIC_SITE_URL and strips trailing slashes", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com/";
    expect(buildJoinUrl("abc123")).toBe("https://app.example.com/join/abc123");
  });

  it("falls back to localhost when the env var is unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(buildJoinUrl("tok")).toBe("http://localhost:3000/join/tok");
  });
});

describe("buildUpiUri", () => {
  it("encodes vpa, payee, and amount (spaces as %20, not +)", () => {
    expect(buildUpiUri({ vpa: "gym@okhdfc", name: "Iron Paradise", amount: 1500 })).toBe(
      "upi://pay?pa=gym%40okhdfc&cu=INR&pn=Iron%20Paradise&am=1500",
    );
  });

  it("omits payee and amount when absent", () => {
    expect(buildUpiUri({ vpa: "gym@okhdfc" })).toBe("upi://pay?pa=gym%40okhdfc&cu=INR");
  });

  it("omits a non-positive amount", () => {
    expect(buildUpiUri({ vpa: "x@y", amount: 0 })).toBe("upi://pay?pa=x%40y&cu=INR");
  });
});
