import "server-only";

/**
 * Fetch an image URL and inline it as a data URI so a react-pdf render never
 * depends on a live network image (a flaky URL would otherwise reject the whole
 * render). react-pdf only decodes PNG/JPEG, so anything else is skipped gracefully.
 */
export async function fetchPdfImageDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!/^image\/(png|jpe?g)$/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
