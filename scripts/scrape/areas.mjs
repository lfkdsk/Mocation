// Phase 2b — back-fill area detail. Area IDs aren't enumerable via a list
// endpoint, so we derive them from the level0-3 / areaId fields already stored
// in place & movie raw detail, seed the `area` table, then fetch area/{id}.
// Resumable via fetched_detail, same as details.mjs.
//
//   node scripts/scrape/areas.mjs
//
// (person/{id} is intentionally NOT scraped: movie detail carries no cast, and
//  the only person source is the signature-gated search — no reliable feed.)

import { openDb, harvestImages } from "./lib/db.mjs";
import { apiGet } from "./lib/client.mjs";
import { CONCURRENCY } from "./config.mjs";

const now = () => Math.floor(Date.now() / 1000);

function seedAreaIds(db) {
  const ids = new Set();
  for (const { raw_detail } of db.prepare("SELECT raw_detail FROM place WHERE raw_detail IS NOT NULL").all()) {
    let d; try { d = JSON.parse(raw_detail).place; } catch { continue; }
    for (const k of ["areaId", "level0Id", "level1Id", "level2Id", "level3Id"]) if (d?.[k]) ids.add(d[k]);
  }
  for (const { raw_detail } of db.prepare("SELECT raw_detail FROM movie WHERE raw_detail IS NOT NULL").all()) {
    let m; try { m = JSON.parse(raw_detail).movie; } catch { continue; }
    for (const a of m?.areas || []) if (a.areaId) ids.add(a.areaId);
  }
  const ins = db.prepare("INSERT INTO area(id) VALUES(?) ON CONFLICT(id) DO NOTHING");
  db.prepare("BEGIN").run();
  for (const id of ids) ins.run(id);
  db.prepare("COMMIT").run();
  return ids.size;
}

async function main() {
  const db = openDb();
  const seeded = seedAreaIds(db);
  const ids = db.prepare("SELECT id FROM area WHERE fetched_detail=0 ORDER BY id").all().map((r) => r.id);
  console.log(`area ids seeded=${seeded}, pending detail=${ids.length}`);
  if (!ids.length) { db.close(); return; }

  const markOk = db.prepare("UPDATE area SET cname=?, ename=?, cover_path=?, lat=?, lng=?, level=?, level1_cname=?, raw_detail=?, fetched_detail=1, detail_at=? WHERE id=?");
  const markGone = db.prepare("UPDATE area SET fetched_detail=2, detail_at=? WHERE id=?");
  let ok = 0, gone = 0, cursor = 0;
  const t0 = Date.now();

  async function lane() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        const data = await apiGet(`area/${id}`);
        const a = data?.area ?? data;
        if (!a) { markGone.run(now(), id); gone++; continue; }
        markOk.run(a.cname ?? null, a.ename ?? null, a.coverPath ?? null, a.lat ?? null, a.lng ?? null,
          a.level ?? null, a.level1Cname ?? null, JSON.stringify(data), now(), id);
        harvestImages(db, data, "area.detail");
        ok++;
      } catch (err) {
        if (err.apiCode != null) { markGone.run(now(), id); gone++; continue; }
        throw err;
      }
      const done = ok + gone;
      if (done % 50 === 0 || done === ids.length) {
        const rate = (done / ((Date.now() - t0) / 1000)).toFixed(1);
        process.stdout.write(`\rarea ${done}/${ids.length}  ok=${ok} gone=${gone}  ${rate}/s   `);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, lane));
  process.stdout.write("\n");
  console.log(`areas done: ${ok} ok, ${gone} gone`);
  db.close();
}

main().catch((e) => { console.error("\nareas failed:", e); process.exit(1); });
