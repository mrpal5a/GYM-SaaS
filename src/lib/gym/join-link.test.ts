// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
const { buildJoinUrl, buildUpiUri } = await import("./join-link");

describe("buildJoinUrl", () => {
  const origSite = process.env.NEXT_PUBLIC_SITE_URL;
  const origVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = origSite;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = origVercel;
  });

  it("builds from NEXT_PUBLIC_SITE_URL and strips trailing slashes", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com/";
    expect(buildJoinUrl("abc123")).toBe("https://app.example.com/join/abc123");
  });

  it("uses the Vercel production domain (https-prefixed) when no explicit URL is set", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "saasgymmanagement.vercel.app";
    expect(buildJoinUrl("tok")).toBe("https://saasgymmanagement.vercel.app/join/tok");
  });

  it("prefers an explicit NEXT_PUBLIC_SITE_URL over the Vercel domain", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://gym.com";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "saasgymmanagement.vercel.app";
    expect(buildJoinUrl("tok")).toBe("https://gym.com/join/tok");
  });

  it("falls back to localhost when neither is set", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
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
