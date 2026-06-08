// Polite HTTP client for the Mocation API: shared UA, per-request timeout,
// retry/backoff, and a global throttle so we never burst the upstream.

import { API_BASE, UA, TIMEOUT_MS, RETRIES, THROTTLE_MS } from "../config.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Serialise the *minimum spacing* between requests across all workers.
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + THROTTLE_MS;
  if (wait) await sleep(wait);
}

/**
 * GET an /api path and return the unwrapped `data` (throws on code!=0).
 * @param {string} apiPath  path after /api/ (e.g. "place/1234")
 */
export async function apiGet(apiPath) {
  const url = `${API_BASE}/${apiPath.replace(/^\//, "")}`;
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    await throttle();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // code 0 = ok. Some "not found" rows come back non-zero; surface them
      // as a typed miss so callers can mark the row done instead of retrying.
      if (json.code !== 0) {
        const e = new Error(`API ${json.code}: ${json.msg || "error"}`);
        e.apiCode = json.code;
        throw e;
      }
      return json.data;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      // Genuine API-level errors (not found / bad params) won't fix on retry.
      if (err.apiCode != null) throw err;
      if (attempt < RETRIES) await sleep(600 * 2 ** attempt); // 0.6,1.2,2.4,4.8s
    }
  }
  throw lastErr;
}

/** Same as apiGet but returns null on an API-level miss instead of throwing. */
export async function apiGetOrNull(apiPath) {
  try {
    return await apiGet(apiPath);
  } catch (err) {
    if (err.apiCode != null) return null;
    throw err;
  }
}
