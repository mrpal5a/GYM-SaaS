import "server-only";

/**
 * Canonical, scheme-qualified base URL for this deployment, no trailing slash.
 * Used for public-facing links (join URLs, invite redirects) that must point at
 * the real domain — never `localhost` in production.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL      — explicit override; set this to your custom
 *      domain once you have one (it's the canonical source of truth).
 *   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel auto-injects your project's stable
 *      production domain (e.g. saasgymmanagement.vercel.app) at build/run time, so
 *      deploys "just work" even before the env var is set. Bare host → prefix https.
 *   3. http://localhost:3000     — local dev fallback only.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const raw = explicit || (vercel ? `https://${vercel}` : "http://localhost:3000");
  return raw.replace(/\/+$/, "");
}
