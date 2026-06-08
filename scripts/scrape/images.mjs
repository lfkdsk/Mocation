// Phase 3 — download every tracked image into a content-addressed tree, ready
// to publish to the mocation-assets repo (served via jsDelivr). Best run on a
// real machine (MacBook), not the ephemeral cloud container: it's a multi-hour,
// ~10-15GB job. Fully resumable via image.status (0=pending 1=ok 2=failed).
//
// Pipeline per URL:  fetch (http, no Referer) -> optional WebP transcode (sharp)
//   -> write data/assets/<ab>/<sha1>.<ext>  -> mark status=1 + file + bytes.
// Pre-rendered static maps (/staticmap/) are skipped — the site renders its own
// Leaflet map from coordinates, so they're redundant.
//
// WebP needs `sharp` (npm i -D sharp). If it's not installed we store originals
// and warn, so the download still works end-to-end.
//
// Usage:
//   npm i -D sharp
//   node scripts/scrape/images.mjs                 # download everything pending
//   node scripts/scrape/images.mjs --limit=200     # validation batch
//   node scripts/scrape/images.mjs --no-webp       # keep original bytes

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { openDb } from "./lib/db.mjs";
import { ASSETS_DIR, IMG_CONCURRENCY, IMG_TIMEOUT_MS, IMG_WEBP_QUALITY, IMG_MAX_EDGE } from "./config.mjs";

const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || 0);
const noWebp = process.argv.includes("--no-webp") || IMG_WEBP_QUALITY <= 0;

// Optional WebP transcoder. Absent → store originals (still resumable/usable).
let sharp = null;
if (!noWebp) {
  try { sharp = (await import("sharp")).default; }
  catch { console.warn("⚠ sharp not installed — storing ORIGINAL bytes. `npm i -D sharp` for WebP."); }
}

const sha1 = (s) => createHash("sha1").update(s).digest("hex");
const extFromCT = (ct) =>
  ct?.includes("png") ? "png" : ct?.includes("webp") ? "webp" :
  ct?.includes("gif") ? "gif" : ct?.includes("avif") ? "avif" : "jpg";

async function fetchImage(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), IMG_TIMEOUT_MS);
  try {
    // The CDN serves over http and 403s any request carrying a Referer.
    const res = await fetch(url.replace(/^https:/, "http:"), {
      headers: {
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; mocation-archive/1.0)",
      },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return { buf, ct: res.headers.get("content-type") || "" };
  } finally { clearTimeout(timer); }
}

async function processOne(db, row, stats) {
  const upd = db.prepare("UPDATE image SET status=?, file=?, bytes=?, content_type=?, downloaded_at=? WHERE url=?");
  try {
    let { buf, ct } = await fetchImage(row.url);
    let ext = extFromCT(ct) || row.url.split(".").pop()?.toLowerCase() || "jpg";
    if (sharp && ext !== "gif") {
      let img = sharp(buf, { failOn: "none" });
      if (IMG_MAX_EDGE > 0) img = img.resize(IMG_MAX_EDGE, IMG_MAX_EDGE, { fit: "inside", withoutEnlargement: true });
      buf = await img.webp({ quality: IMG_WEBP_QUALITY }).toBuffer();
      ext = "webp"; ct = "image/webp";
    }
    const h = sha1(row.url);
    const rel = path.join(h.slice(0, 2), `${h}.${ext}`);
    const abs = path.join(ASSETS_DIR, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
    upd.run(1, rel, buf.length, ct, Math.floor(Date.now() / 1000), row.url);
    stats.ok++; stats.bytes += buf.length;
  } catch {
    upd.run(2, null, null, null, Math.floor(Date.now() / 1000), row.url);
    stats.fail++;
  }
}

async function main() {
  const db = openDb();
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  let rows = db.prepare(
    "SELECT url FROM image WHERE status=0 AND url NOT LIKE '%/staticmap/%' ORDER BY url",
  ).all();
  if (limit) rows = rows.slice(0, limit);
  const total = rows.length;
  console.log(`pending images: ${total}  (webp=${sharp ? "on" : "off"}, conc=${IMG_CONCURRENCY}) -> ${ASSETS_DIR}`);
  if (!total) return;

  const stats = { ok: 0, fail: 0, bytes: 0 };
  const t0 = Date.now();
  let cursor = 0;
  async function lane() {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      await processOne(db, row, stats);
      const done = stats.ok + stats.fail;
      if (done % 100 === 0 || done === total) {
        const rate = (done / ((Date.now() - t0) / 1000)).toFixed(1);
        const gb = (stats.bytes / 1e9).toFixed(2);
        const eta = ((total - done) / Math.max(0.1, done / ((Date.now() - t0) / 1000)) / 60).toFixed(0);
        process.stdout.write(`\r${done}/${total}  ok=${stats.ok} fail=${stats.fail}  ${gb}GB  ${rate}/s  ETA~${eta}m   `);
      }
    }
  }
  await Promise.all(Array.from({ length: IMG_CONCURRENCY }, lane));
  process.stdout.write("\n");
  console.log(`done: ${stats.ok} stored, ${stats.fail} failed, ${(stats.bytes / 1e9).toFixed(2)} GB on disk`);
  db.close();
}

main().catch((e) => { console.error("\nimages failed:", e); process.exit(1); });
