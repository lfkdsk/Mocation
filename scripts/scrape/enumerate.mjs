// Phase 1 — enumerate the full catalog.
//
// The list endpoints (`movie/hot-and-default`, `place/hot-and-default`) expose
// a `total` and paginate; `size` is capped at 500 upstream. IDs are returned by
// popularity (not contiguous), so paging is the only complete enumeration path.
// We harvest list-level fields, cover-image URLs, and movie<->place edges here;
// per-id detail back-fill is Phase 2.
//
// Idempotent + resumable: re-running upserts and continues. Pass `--from=N` to
// resume at a page, or rely on the fact that completed pages just re-upsert.

import { openDb, setMeta, trackImage } from "./lib/db.mjs";
import { apiGet } from "./lib/client.mjs";
import { PAGE_SIZE } from "./config.mjs";

const now = () => Math.floor(Date.now() / 1000);

const argFrom = Number(
  process.argv.find((a) => a.startsWith("--from="))?.split("=")[1] || 0,
);
const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1]; // movie|place

function upsertMovie(db, m) {
  db.prepare(`
    INSERT INTO movie(id,cname,ename,year,type,country_id,country_cname,cover_path,initial,raw_list,enum_at)
    VALUES(@id,@cname,@ename,@year,@type,@country_id,@country_cname,@cover_path,@initial,@raw_list,@enum_at)
    ON CONFLICT(id) DO UPDATE SET
      cname=excluded.cname, ename=excluded.ename, year=excluded.year, type=excluded.type,
      country_id=excluded.country_id, country_cname=excluded.country_cname,
      cover_path=excluded.cover_path, initial=excluded.initial,
      raw_list=excluded.raw_list, enum_at=excluded.enum_at
  `).run({
    id: m.id, cname: m.cname ?? null, ename: m.ename ?? null, year: m.year ?? null,
    type: m.type ?? null, country_id: m.countryId ?? null, country_cname: m.countryCname ?? null,
    cover_path: m.coverPath ?? null, initial: m.initial ?? null,
    raw_list: JSON.stringify(m), enum_at: now(),
  });
  trackImage(db, m.coverPath, "movie.cover");
  const edge = db.prepare("INSERT INTO movie_place(movie_id,place_id) VALUES(?,?) ON CONFLICT DO NOTHING");
  for (const pid of m.placeIds || []) edge.run(m.id, pid);
}

function upsertPlace(db, p) {
  db.prepare(`
    INSERT INTO place(id,cname,ename,cover_path,lat,lng,ass_type,area_id,area_cname,level1_id,level1_cname,raw_list,enum_at)
    VALUES(@id,@cname,@ename,@cover_path,@lat,@lng,@ass_type,@area_id,@area_cname,@level1_id,@level1_cname,@raw_list,@enum_at)
    ON CONFLICT(id) DO UPDATE SET
      cname=excluded.cname, ename=excluded.ename, cover_path=excluded.cover_path,
      lat=excluded.lat, lng=excluded.lng, ass_type=excluded.ass_type,
      area_id=excluded.area_id, area_cname=excluded.area_cname,
      level1_id=excluded.level1_id, level1_cname=excluded.level1_cname,
      raw_list=excluded.raw_list, enum_at=excluded.enum_at
  `).run({
    id: p.id, cname: p.cname ?? null, ename: p.ename ?? null, cover_path: p.coverPath ?? null,
    lat: p.lat ?? null, lng: p.lng ?? null, ass_type: p.assType ?? null,
    area_id: p.areaId ?? null, area_cname: p.areaCname ?? null,
    level1_id: p.level1Id ?? null, level1_cname: p.level1Cname ?? null,
    raw_list: JSON.stringify(p), enum_at: now(),
  });
  trackImage(db, p.coverPath, "place.cover");
  const edge = db.prepare("INSERT INTO movie_place(movie_id,place_id) VALUES(?,?) ON CONFLICT DO NOTHING");
  for (const mv of p.movies || []) edge.run(mv.id, p.id);
}

/** Page through a list endpoint until we've covered `total` rows. */
async function paginate(db, kind, endpoint, key, upsert) {
  const first = await apiGet(`${endpoint}?page=0&size=${PAGE_SIZE}`);
  const total = first.total ?? (first[key] || []).length;
  const pages = Math.ceil(total / PAGE_SIZE);
  console.log(`[${kind}] total=${total} -> ${pages} pages of ${PAGE_SIZE}`);

  let seen = 0;
  for (let page = argFrom; page < pages; page++) {
    const data = page === 0 ? first : await apiGet(`${endpoint}?page=${page}&size=${PAGE_SIZE}`);
    const rows = data[key] || [];
    const tx = db.prepare("BEGIN");
    try {
      tx.run();
      for (const r of rows) upsert(db, r);
      db.prepare("COMMIT").run();
    } catch (e) {
      db.prepare("ROLLBACK").run();
      throw e;
    }
    seen += rows.length;
    setMeta(db, `enum.${kind}.page`, page);
    setMeta(db, `enum.${kind}.total`, total);
    process.stdout.write(`\r[${kind}] page ${page + 1}/${pages}  rows ${seen}/${total}   `);
    if (rows.length === 0) break; // defensive: ragged tail
  }
  process.stdout.write("\n");
  setMeta(db, `enum.${kind}.done_at`, now());
  return { total, seen };
}

async function main() {
  const db = openDb();
  setMeta(db, "enum.started_at", now());

  if (!only || only === "movie") {
    await paginate(db, "movie", "movie/hot-and-default", "movies", upsertMovie);
  }
  if (!only || only === "place") {
    await paginate(db, "place", "place/hot-and-default", "places", upsertPlace);
  }

  const c = (t) => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
  console.log(
    `\nEnumerated: movie=${c("movie")} place=${c("place")} ` +
    `edges=${c("movie_place")} images=${c("image")}`,
  );
  db.close();
}

main().catch((e) => { console.error("\nenumerate failed:", e); process.exit(1); });
