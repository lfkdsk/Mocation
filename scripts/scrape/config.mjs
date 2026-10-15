// Central config for the Mocation scraper.
// Everything is env-overridable so the same scripts run locally and in CI.

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repo root, derived from this file's location (scripts/scrape/). */
export const ROOT = path.resolve(__dirname, "..", "..");

/** Upstream API origin (reverse-engineered from the official Android app). */
export const API_ORIGIN = process.env.MOCATION_API_ORIGIN || "https://www.mocation.cc";
export const API_BASE = `${API_ORIGIN}/api`;

/** User-Agent presented to the upstream — mirrors the official app. */
export const UA = process.env.MOCATION_UA || "Mocation/5.5.23 (Android; web-mirror)";

/** SQLite file that is the single source of truth for the snapshot. */
export const DB_PATH = process.env.MOCATION_DB || path.join(ROOT, "data", "mocation.sqlite");

/** Where downloaded images land (Phase 3). One file per image, content-addressed. */
export const ASSETS_DIR = process.env.MOCATION_ASSETS || path.join(ROOT, "data", "assets");

/* --------------------------- politeness / pacing -------------------------- */

/** Minimum delay between upstream requests, per worker (ms). Be gentle. */
export const THROTTLE_MS = Number(process.env.SCRAPE_THROTTLE_MS || 300);
/** Parallel workers for detail back-fill. Keep low to stay under the radar. */
export const CONCURRENCY = Number(process.env.SCRAPE_CONCURRENCY || 4);
/** Per-request timeout (ms). */
export const TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS || 15000);
/** Retry attempts on network error / 5xx before giving up on a row. */
export const RETRIES = Number(process.env.SCRAPE_RETRIES || 4);
/** Page size for list enumeration. Upstream caps this at 500 regardless. */
export const PAGE_SIZE = Number(process.env.SCRAPE_PAGE_SIZE || 500);

/* ------------------------------ Phase 3: images --------------------------- */

/** Image download concurrency. The CDN (cache.fotoplace.cc) tolerates more
 *  parallelism than the API, and it's a different host, so this is separate. */
export const IMG_CONCURRENCY = Number(process.env.IMG_CONCURRENCY || 16);
/** Per-image fetch timeout (ms). */
export const IMG_TIMEOUT_MS = Number(process.env.IMG_TIMEOUT_MS || 30000);
/** Transcode downloaded images to WebP at this quality (0 disables → keep original). */
export const IMG_WEBP_QUALITY = Number(process.env.IMG_WEBP_QUALITY || 82);
/** Optional max edge (px) to downscale very large images; 0 = keep original size. */
export const IMG_MAX_EDGE = Number(process.env.IMG_MAX_EDGE || 0);
