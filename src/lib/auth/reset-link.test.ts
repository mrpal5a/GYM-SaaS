import { describe, it, expect } from "vitest";
import { buildResetConfirmUrl } from "./reset-link";

describe("buildResetConfirmUrl", () => {
  it("builds the confirm URL with recovery type and the reset-password next path", () => {
    expect(buildResetConfirmUrl("https://app.example.com", "abc123")).toBe(
      "https://app.example.com/auth/confirm?token_hash=abc123&type=recovery&next=%2Freset-password",
    );
  });

  it("strips a trailing slash from the base URL", () => {
    expect(buildResetConfirmUrl("https://app.example.com/", "tok")).toBe(
      "https://app.example.com/auth/confirm?token_hash=tok&type=recovery&next=%2Freset-password",
    );
  });

  it("url-encodes special characters in the token hash (round-trippable)", () => {
    const url = buildResetConfirmUrl("https://x.com", "a b/c+d");
    expect(url).toContain("token_hash=a+b%2Fc%2Bd");
    // The encoded value decodes back to the original.
    expect(new URL(url).searchParams.get("token_hash")).toBe("a b/c+d");
  });
});
