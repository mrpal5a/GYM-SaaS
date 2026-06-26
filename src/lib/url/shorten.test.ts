// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { shortenUrl } = await import("./shorten");

const LONG = "https://x.supabase.co/storage/v1/object/public/invoices/g/p.pdf";

afterEach(() => vi.unstubAllGlobals());

describe("shortenUrl", () => {
  it("returns the short URL on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("https://is.gd/Ab3kP9", { status: 200 })));
    expect(await shortenUrl(LONG)).toBe("https://is.gd/Ab3kP9");
  });

  it("falls back to the original URL when is.gd returns an error string", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Error: malformed url", { status: 200 })));
    expect(await shortenUrl(LONG)).toBe(LONG);
  });

  it("falls back on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 502 })));
    expect(await shortenUrl(LONG)).toBe(LONG);
  });

  it("falls back when the request throws (network/timeout)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    expect(await shortenUrl(LONG)).toBe(LONG);
  });
});
