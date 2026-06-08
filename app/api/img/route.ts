// Image proxy for cache.fotoplace.cc.
// Fixes: (1) http -> https (mixed content), (2) the CDN 403s any request with
// a Referer header (server-side fetch sends none), (3) caches each image at the
// edge so it's pulled from the (China-hosted) origin at most once.

import { NextRequest, NextResponse, after } from "next/server";

// Edge runtime so this also runs on Cloudflare Pages/Workers (and Vercel Edge).
export const runtime = "edge";
// Run in Hong Kong — closest Vercel region to the Guangzhou image CDN
// (cache.fotoplace.cc) and the China-hosted API, cutting cross-border latency.
export const preferredRegion = "hkg1";

const ALLOWED_HOST_RE = /(^|\.)fotoplace\.cc$/i;

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return new NextResponse("missing u", { status: 400 });

  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return new NextResponse("bad url", { status: 400 });
  }
  if (!ALLOWED_HOST_RE.test(target.hostname)) {
    return new NextResponse("host not allowed", { status: 403 });
  }
  // Always fetch over http per the CDN; we re-serve over our https origin.
  target.protocol = "http:";

  // Cloudflare does NOT auto-cache Function responses by Cache-Control, so cache
  // explicitly via the Cache API. No-op where `caches.default` is absent (e.g.
  // Vercel Edge — there the CDN honours Cache-Control automatically).
  const edgeCache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = new Request(req.nextUrl.toString());
  if (edgeCache) {
    const hit = await edgeCache.match(cacheKey);
    if (hit) return hit;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 24000);
  try {
    const upstream = await fetch(target.toString(), {
      // No Referer header on purpose — the CDN 403s requests that carry one.
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; mocation-web/1.0)",
      },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!upstream.ok) {
      return new NextResponse("upstream " + upstream.status, { status: 502 });
    }
    const ct = upstream.headers.get("content-type") || "image/jpeg";
    const res = new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
    // Store at the edge (non-blocking) so subsequent hits skip the origin.
    if (edgeCache) {
      try {
        after(() => edgeCache.put(cacheKey, res.clone()));
      } catch {
        /* `after` unavailable — skip caching, still serve the image */
      }
    }
    return res;
  } catch {
    clearTimeout(timer);
    return new NextResponse("proxy error", { status: 504 });
  }
}
