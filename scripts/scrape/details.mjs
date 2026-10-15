// Phase 2 — back-fill per-id detail for every enumerated movie & place.
//
// Reads rows with fetched_detail=0, hits movie/{id} or place/{id}, stores the
// full raw detail JSON (resilience: re-derive any field later without rescrape),
// recursively harvests EVERY fotoplace image URL it contains (cover, plot scene
// shots, mapPath, staticMapUrl, satellitePath, imgInfos, …), and marks the row
// done. Resumable: re-running only picks up rows still at fetched_detail=0.
// Missing rows (API not-found) are parked at fetched_detail=2 so we don't retry
// them forever.
//
// Usage:
//   node scripts/scrape/details.mjs            # both movie + place
//   node scripts/scrape/details.mjs --only=movie
//   node scripts/scrape/details.mjs --limit=50 # smoke test

import { openDb, setMeta, harvestImages } from "./lib/db.mjs";
import { apiGet } from "./lib/client.mjs";
import { CONCURRENCY } from "./config.mjs";

const now = () => Math.floor(Date.now() / 1000);
const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || 0);

const KINDS = {
  movie: { table: "movie", endpoint: (id) => `movie/${id}`, key: "movie" },
  place: { table: "place", endpoint: (id) => `place/${id}`, key: "place" },
};

/** Drain a list of ids through `worker` with a bounded pool + periodic onTick. */
async function runPool(ids, concurrency, worker, onTick) {
  let cursor = 0, done = 0;
  async function lane() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      await worker(id);
      if (++done % 25 === 0) onTick(done);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, lane));
  onTick(done);
}

async function backfill(db, kind) {
  const { table, endpoint, key } = KINDS[kind];
  let ids = db.prepare(`SELECT id FROM ${table} WHERE fetched_detail=0 ORDER BY id`).all().map((r) => r.id);
  if (limit) ids = ids.slice(0, limit);
  const totalPending = ids.length;
  const already = db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE fetched_detail=1`).get().n;
  console.log(`[${kind}] pending=${totalPending} (already done=${already})`);
  if (!totalPending) return;

  const markOk = db.prepare(`UPDATE ${table} SET raw_detail=?, fetched_detail=1, detail_at=? WHERE id=?`);
  const markGone = db.prepare(`UPDATE ${table} SET fetched_detail=2, detail_at=? WHERE id=?`);
  let ok = 0, gone = 0, imgs = 0;
  const t0 = Date.now();

  await runPool(ids, CONCURRENCY, async (id) => {
    try {
      const data = await apiGet(endpoint(id));
      const entity = data?.[key] ?? data;
      if (!entity) { markGone.run(now(), id); gone++; return; }
      // Persist the WHOLE envelope (entity + imgInfos etc.) for completeness.
      markOk.run(JSON.stringify(data), now(), id);
      imgs += harvestImages(db, data, `${kind}.detail`);
      ok++;
    } catch (err) {
      if (err.apiCode != null) { markGone.run(now(), id); gone++; return; }
      throw err; // network/5xx already retried in client; surface to stop & resume
    }
  }, (done) => {
    const rate = (done / ((Date.now() - t0) / 1000)).toFixed(1);
    const eta = ((totalPending - done) / Math.max(0.1, done / ((Date.now() - t0) / 1000)) / 60).toFixed(0);
    setMeta(db, `detail.${kind}.done`, ok + gone);
    process.stdout.write(`\r[${kind}] ${done}/${totalPending}  ok=${ok} gone=${gone} imgs+=${imgs}  ${rate}/s  ETA~${eta}m   `);
  });

  process.stdout.write("\n");
  setMeta(db, `detail.${kind}.done_at`, now());
}

async function main() {
  const db = openDb();
  for (const kind of Object.keys(KINDS)) {
    if (only && only !== kind) continue;
    await backfill(db, kind);
  }
  const img = db.prepare("SELECT COUNT(*) n FROM image").get().n;
  console.log(`\nDistinct image URLs now tracked: ${img}`);
  db.close();
}

main().catch((e) => { console.error("\ndetails failed:", e); process.exit(1); });
