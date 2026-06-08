// Image proxy for cache.fotoplace.cc.
// Fixes: (1) http -> https (mixed content), (2) the CDN 403s any request with
// a Referer header (server-side fetch sends none), (3) adds immutable edge
// caching so each image is pulled from origin at most once.

import { NextRequest, NextResponse } from "next/server";

// Edge runtime so this also runs on Cloudflare Pages/Workers (and Vercel Edge).
export const runtime = "edge";

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

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const upstream = await fetch(target.toString(), {
      // No Referer header on purpose — the CDN 403s requests that carry one.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; mocation-web/1.0)" },
      signal: ctrl.signal,
      cache: "force-cache",
    });
    clearTimeout(timer);
    if (!upstream.ok || !upstream.body) {
      return new NextResponse("upstream " + upstream.status, { status: 502 });
    }
    const ct = upstream.headers.get("content-type") || "image/jpeg";
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    clearTimeout(timer);
    return new NextResponse("proxy error", { status: 504 });
  }
}
