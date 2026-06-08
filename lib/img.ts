// Build a URL that routes an upstream image through our /api/img proxy.
// The proxy fixes three problems with hotlinking cache.fotoplace.cc directly:
//   1) images are http:// (mixed-content blocked on our https site)
//   2) the CDN 403s any request that carries a Referer header
//   3) lets us add long-lived edge caching (anti-ban + speed)

const ALLOWED_HOST_RE = /(^|\.)fotoplace\.cc$/i;

export function proxied(url?: string | null): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (!ALLOWED_HOST_RE.test(u.hostname)) return url; // leave foreign hosts alone
    return `/api/img?u=${encodeURIComponent(url)}`;
  } catch {
    return "";
  }
}

/** Optional: request a resized variant if the CDN supports query sizing. */
export function proxiedSized(url?: string | null, _w?: number): string {
  return proxied(url);
}
