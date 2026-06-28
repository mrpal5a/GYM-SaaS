// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import { buildSupportWhatsappLink } from "./support-link";

describe("buildSupportWhatsappLink", () => {
  const orig = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP = orig;
  });

  it("builds a wa.me URL with the encoded prefilled message", () => {
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP = "919812345678";
    expect(buildSupportWhatsappLink("Hi there")).toBe(
      "https://wa.me/919812345678?text=Hi%20there",
    );
  });

  it("strips spaces, plus signs and dashes from the number", () => {
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP = "+91 98123-45678";
    expect(buildSupportWhatsappLink("hello")).toBe("https://wa.me/919812345678?text=hello");
  });

  it("returns null when the env var is unset", () => {
    delete process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
    expect(buildSupportWhatsappLink("hello")).toBeNull();
  });

  it("returns null when the env var is blank", () => {
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP = "   ";
    expect(buildSupportWhatsappLink("hello")).toBeNull();
  });
});
