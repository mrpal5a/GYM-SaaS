import "server-only";

/**
 * Shorten a URL via is.gd's free, keyless API so it reads cleanly in a WhatsApp
 * message. On ANY failure (network, timeout, rate-limit, unexpected body) it
 * returns the original URL unchanged — the caller always ends up with a link that
 * works, just a longer one.
 */
export async function shortenUrl(longUrl: string): Promise<string> {
  try {
    const endpoint = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`;
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return longUrl;
    // `format=simple` returns just the short URL, or an "Error: ..." string.
    const body = (await res.text()).trim();
    return /^https:\/\/is\.gd\/\S+$/.test(body) ? body : longUrl;
  } catch {
    return longUrl;
  }
}
