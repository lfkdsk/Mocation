// SQLite snapshot schema + helpers. Uses Node 22's built-in `node:sqlite`
// (no native build step). The DB is the single source of truth: every entity
// keeps both normalised columns (for querying) and the raw upstream JSON
// (for resilience — if we add fields later we re-derive from raw, no re-scrape).

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { DB_PATH } from "../config.mjs";

export function openDb(file = DB_PATH) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    -- One row per entity kind. 'fetched_detail' flips to 1 once the detail
    -- endpoint has been back-filled (Phase 2). Enumeration (Phase 1) only sets
    -- the list-level columns + raw_list.
    CREATE TABLE IF NOT EXISTS movie (
      id            INTEGER PRIMARY KEY,
      cname         TEXT,
      ename         TEXT,
      year          INTEGER,
      type          INTEGER,
      country_id    INTEGER,
      country_cname TEXT,
      cover_path    TEXT,
      initial       TEXT,
      raw_list      TEXT,
      raw_detail    TEXT,
      fetched_detail INTEGER NOT NULL DEFAULT 0,
      detail_at     INTEGER,
      enum_at       INTEGER
    );

    CREATE TABLE IF NOT EXISTS place (
      id            INTEGER PRIMARY KEY,
      cname         TEXT,
      ename         TEXT,
      cover_path    TEXT,
      lat           REAL,
      lng           REAL,
      ass_type      INTEGER,
      area_id       INTEGER,
      area_cname    TEXT,
      level1_id     INTEGER,
      level1_cname  TEXT,
      raw_list      TEXT,
      raw_detail    TEXT,
      fetched_detail INTEGER NOT NULL DEFAULT 0,
      detail_at     INTEGER,
      enum_at       INTEGER
    );

    CREATE TABLE IF NOT EXISTS area (
      id            INTEGER PRIMARY KEY,
      cname         TEXT,
      ename         TEXT,
      cover_path    TEXT,
      lat           REAL,
      lng           REAL,
      level         INTEGER,
      level1_cname  TEXT,
      raw_detail    TEXT,
      fetched_detail INTEGER NOT NULL DEFAULT 0,
      detail_at     INTEGER,
      enum_at       INTEGER
    );

    CREATE TABLE IF NOT EXISTS person (
      id            INTEGER PRIMARY KEY,
      cname         TEXT,
      ename         TEXT,
      cover_path    TEXT,
      raw_detail    TEXT,
      fetched_detail INTEGER NOT NULL DEFAULT 0,
      detail_at     INTEGER,
      enum_at       INTEGER
    );

    -- Movie <-> Place edges, harvested from movie list/detail payloads.
    CREATE TABLE IF NOT EXISTS movie_place (
      movie_id INTEGER NOT NULL,
      place_id INTEGER NOT NULL,
      PRIMARY KEY (movie_id, place_id)
    );

    -- Every distinct image URL we ever see, with download bookkeeping (Phase 3).
    -- 'file' is the content-addressed path on the assets branch once stored.
    CREATE TABLE IF NOT EXISTS image (
      url          TEXT PRIMARY KEY,
      file         TEXT,
      content_type TEXT,
      bytes        INTEGER,
      status       INTEGER NOT NULL DEFAULT 0,  -- 0=pending 1=ok 2=failed
      seen_in      TEXT,                          -- e.g. 'movie.cover','plot'
      downloaded_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS comment (
      id          INTEGER PRIMARY KEY,
      target_type TEXT,
      target_id   INTEGER,
      content     TEXT,
      user_name   TEXT,
      raw         TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_movie_detail ON movie(fetched_detail);
    CREATE INDEX IF NOT EXISTS idx_place_detail ON place(fetched_detail);
    CREATE INDEX IF NOT EXISTS idx_place_area   ON place(area_id);
    CREATE INDEX IF NOT EXISTS idx_image_status ON image(status);
    CREATE INDEX IF NOT EXISTS idx_mp_place     ON movie_place(place_id);
    CREATE INDEX IF NOT EXISTS idx_comment_tgt  ON comment(target_type, target_id);
  `);
}

export function setMeta(db, key, value) {
  db.prepare("INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(key, String(value));
}

export function getMeta(db, key) {
  return db.prepare("SELECT value FROM meta WHERE key=?").get(key)?.value;
}

/** Record an image URL the first time we see it (no-op if already tracked). */
export function trackImage(db, url, seenIn) {
  if (!url) return;
  db.prepare("INSERT INTO image(url, seen_in) VALUES(?,?) ON CONFLICT(url) DO NOTHING")
    .run(url, seenIn || null);
}

const FOTOPLACE_HOST_RE = /(^|\.)fotoplace\.cc$/i;

/**
 * Walk an arbitrary JSON value and track every fotoplace.cc image URL found.
 * Used on raw detail payloads so we never miss a field (cover, plot scene
 * shots, mapPath, staticMapUrl, satellitePath, imgInfos, …) — and stay
 * future-proof if the upstream adds new image-bearing keys.
 * @returns number of distinct new+existing URLs seen in this payload
 */
export function harvestImages(db, node, seenIn) {
  const stmt = db.prepare("INSERT INTO image(url, seen_in) VALUES(?,?) ON CONFLICT(url) DO NOTHING");
  const seen = new Set();
  (function walk(v) {
    if (!v) return;
    if (typeof v === "string") {
      if (/^https?:\/\//i.test(v) && !seen.has(v)) {
        try {
          if (FOTOPLACE_HOST_RE.test(new URL(v).hostname)) {
            seen.add(v);
            stmt.run(v, seenIn || null);
          }
        } catch { /* not a URL */ }
      }
      return;
    }
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    if (typeof v === "object") { for (const k of Object.keys(v)) walk(v[k]); }
  })(node);
  return seen.size;
}
