// Central config for the Mocation web client.

/** Upstream API origin (reverse-engineered from the official Android app). */
export const API_ORIGIN = process.env.MOCATION_API_ORIGIN || "https://www.mocation.cc";
export const API_BASE = `${API_ORIGIN}/api`;

/** User-Agent we present to the upstream — mirrors the official app. */
export const UPSTREAM_UA =
  process.env.MOCATION_UA || "Mocation/5.5.23 (Android; web-mirror)";

/**
 * ISR revalidation windows (seconds). Because pages are rendered on the server
 * and cached, the upstream is hit at most once per window per unique page —
 * this is the primary anti-ban mechanism (gentle, cache-first traffic).
 */
export const REVALIDATE = {
  home: 60 * 30, // 30 min
  list: 60 * 60, // 1 h
  detail: 60 * 60 * 12, // 12 h (detail content rarely changes)
  search: 60 * 10, // 10 min
} as const;

/** Upstream request timeout (ms) — fail fast so a flaky origin doesn't hang pages. */
export const UPSTREAM_TIMEOUT_MS = 7000;
/** Retry attempts on network error / timeout; caches absorb most transient misses. */
export const UPSTREAM_RETRIES = 1;

/**
 * Coordinate datum of the upstream lat/lng. Chinese map data is GCJ-02
 * ("Mars coordinates"). We convert to WGS-84 for Leaflet + OSM tiles.
 * Override to "bd09" or "wgs84" via env if alignment ever looks off.
 */
export const COORD_DATUM = (process.env.NEXT_PUBLIC_COORD_DATUM || "gcj02") as
  | "gcj02"
  | "bd09"
  | "wgs84";

/**
 * Leaflet basemap. CARTO's basemaps now return an "API KEY REQUIRED" tile for
 * keyless requests, so default to the standard OpenStreetMap tiles (free, no
 * key; see https://operations.osmfoundation.org/policies/tiles/). Override via
 * env to point at another provider.
 */
export const MAP_TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const MAP_TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
