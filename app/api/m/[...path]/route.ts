// Read-only JSON proxy for client-side calls (search-as-you-type, etc.).
// Server Components fetch upstream directly; this route only exists for the
// few interactive client features. It is deliberately locked down:
//   - GET only
//   - strict allowlist of read endpoints (no auth/user/write/pay routes)
//   - per-IP rate limiting
//   - short edge cache + UA spoofing + retry
// so it can never be turned into an open relay that hammers (and gets us
// banned from) the upstream.

import { NextRequest, NextResponse } from "next/server";
import { API_BASE, UPSTREAM_UA, UPSTREAM_TIMEOUT_MS } from "@/lib/config";

// Edge runtime so this also runs on Cloudflare Pages/Workers (and Vercel Edge).
export const runtime = "edge";

/** Allowlisted upstream paths (regex, no leading slash). Read-only surface. */
const ALLOW: RegExp[] = [
  /^home\/data$/,
  /^coopen\/data$/,
  /^keyword$/,
  /^version\/android$/,
  /^movie\/(hot|latest|hot-and-default|subject)$/,
  /^movie\/\d+$/,
  /^movie\/\d+\/route$/,
  /^place\/(hot|hot-and-default|subject|nearby)$/,
  /^place\/\d+$/,
  /^place\/\d+\/ass$/,
  /^area\/(home|hot-and-default|nearby|location)$/,
  /^area\/\d+$/,
  /^area\/\d+\/(movie|route)$/,
  /^route\/(hot|rmm)$/,
  /^route\/\d+\/map$/,
  /^article(\/home)?$/,
  /^article\/\d+$/,
  /^person\/\d+$/,
  /^search(\/(movie|place|area|route|article|person))?$/,
  /^comment\/list$/,
];

// ---- naive per-IP rate limiter (best-effort; use Upstash/Redis in prod) ----
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear(); // crude memory guard
  return arr.length > MAX_PER_WINDOW;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const joined = (path || []).join("/");

  if (!ALLOW.some((re) => re.test(joined))) {
    return NextResponse.json({ code: 403, msg: "endpoint not allowed", data: null }, { status: 403 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";
  if (rateLimited(ip)) {
    return NextResponse.json({ code: 429, msg: "rate limited", data: null }, { status: 429 });
  }

  const qs = req.nextUrl.search; // pass through ?keyword= etc.
  const url = `${API_BASE}/${joined}${qs}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": UPSTREAM_UA, Accept: "application/json" },
      signal: ctrl.signal,
      // Cache the upstream fetch (Next Data Cache) — content is near-static.
      next: { revalidate: 1800 },
    });
    clearTimeout(timer);
    const body = await upstream.text();
    // Only cache real successes; never cache errors (would pin a bad result).
    let ok = upstream.ok;
    try {
      ok = ok && JSON.parse(body)?.code === 0;
    } catch {
      ok = false;
    }
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // 30 min fresh at the edge, serve-stale up to a day while revalidating.
        "Cache-Control": ok
          ? "public, s-maxage=1800, stale-while-revalidate=86400"
          : "no-store",
      },
    });
  } catch {
    clearTimeout(timer);
    return NextResponse.json({ code: 504, msg: "upstream timeout", data: null }, { status: 504 });
  }
}
