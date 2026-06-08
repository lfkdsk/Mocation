// Persist a consistent, compressed snapshot of the working DB so progress
// survives the (ephemeral) container being reclaimed. Uses `VACUUM INTO` for a
// transactionally-consistent copy even while the scraper is mid-write (WAL),
// then gzips it to data/mocation.sqlite.gz (committable; the raw .sqlite is
// gitignored). Resume in a fresh container with `restore` below.
//
//   node scripts/scrape/snapshot.mjs           # write data/mocation.sqlite.gz
//   node scripts/scrape/snapshot.mjs --restore # rebuild data/mocation.sqlite from the .gz

import { DatabaseSync } from "node:sqlite";
import { createGzip, createGunzip } from "node:zlib";
import { createReadStream, createWriteStream, existsSync, rmSync, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { DB_PATH } from "./config.mjs";

const GZ = `${DB_PATH}.gz`;
const TMP = `${DB_PATH}.snap`;

async function snapshot() {
  if (existsSync(TMP)) rmSync(TMP);
  const db = new DatabaseSync(DB_PATH);
  db.exec(`VACUUM INTO '${TMP.replace(/'/g, "''")}'`); // consistent copy
  db.close();
  await pipeline(createReadStream(TMP), createGzip({ level: 9 }), createWriteStream(GZ));
  rmSync(TMP);
  console.log(`snapshot -> ${GZ}  (${(statSync(GZ).size / 1e6).toFixed(1)} MB gz)`);
}

async function restore() {
  if (!existsSync(GZ)) { console.error(`no snapshot at ${GZ}`); process.exit(1); }
  await pipeline(createReadStream(GZ), createGunzip(), createWriteStream(DB_PATH));
  console.log(`restored ${DB_PATH} from ${GZ}  (${(statSync(DB_PATH).size / 1e6).toFixed(1)} MB)`);
}

(process.argv.includes("--restore") ? restore() : snapshot())
  .catch((e) => { console.error(e); process.exit(1); });
