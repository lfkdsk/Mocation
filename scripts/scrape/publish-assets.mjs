// Publish the content-addressed image tree (data/assets) to the mocation-assets
// repo in size-bounded batches, so each push stays under GitHub's 2GB/push limit
// and jsDelivr can serve every file. Resumable: files already committed are
// skipped by git, so re-running just continues with what's left.
//
// Prereq: data/assets must be a clone of the assets repo, e.g.
//   git clone git@github.com:lfkdsk/mocation-assets.git data/assets
// (or set MOCATION_ASSETS to an existing clone). Then:
//   node scripts/scrape/images.mjs          # fills data/assets/**
//   node scripts/scrape/publish-assets.mjs   # commits + pushes in batches
//
// jsDelivr URL for a stored file `<ab>/<sha1>.webp`:
//   https://cdn.jsdelivr.net/gh/lfkdsk/mocation-assets@main/<ab>/<sha1>.webp

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ASSETS_DIR } from "./config.mjs";

const MAX_BATCH_BYTES = Number(process.env.PUSH_BATCH_BYTES || 1.5e9); // 1.5 GB/push
const MAX_BATCH_FILES = Number(process.env.PUSH_BATCH_FILES || 5000);

const git = (...args) => execFileSync("git", args, { cwd: ASSETS_DIR, stdio: ["ignore", "pipe", "inherit"] }).toString();

function ensureRepo() {
  if (!fs.existsSync(path.join(ASSETS_DIR, ".git"))) {
    console.error(`✗ ${ASSETS_DIR} is not a git repo. Clone the assets repo there first:\n` +
      `    git clone <mocation-assets-url> ${ASSETS_DIR}`);
    process.exit(1);
  }
}

/** All not-yet-committed image files (untracked, relative paths). */
function pendingFiles() {
  const out = git("status", "--porcelain", "--untracked-files=all", "--", ".");
  return out.split("\n").filter(Boolean)
    .map((l) => l.slice(3).replace(/^"|"$/g, ""))
    .filter((f) => /\.(webp|jpg|jpeg|png|gif|avif)$/i.test(f));
}

function main() {
  ensureRepo();
  const files = pendingFiles();
  if (!files.length) { console.log("nothing to publish — assets repo is up to date."); return; }
  console.log(`publishing ${files.length} new files from ${ASSETS_DIR} in <=${(MAX_BATCH_BYTES / 1e9).toFixed(1)}GB batches`);

  let batch = [], bytes = 0, n = 0, pushed = 0;
  const flush = () => {
    if (!batch.length) return;
    git("add", "--", ...batch);
    git("commit", "-q", "-m", `assets: +${batch.length} images (batch ${++n})`);
    for (let i = 1; i <= 4; i++) {
      try { git("push", "origin", "HEAD"); break; }
      catch (e) { if (i === 4) throw e; execFileSync("sleep", [String(2 ** i)]); }
    }
    pushed += batch.length;
    console.log(`  pushed batch ${n}: ${batch.length} files, ${(bytes / 1e9).toFixed(2)}GB  (${pushed}/${files.length})`);
    batch = []; bytes = 0;
  };

  for (const f of files) {
    const sz = fs.statSync(path.join(ASSETS_DIR, f)).size;
    if (batch.length && (bytes + sz > MAX_BATCH_BYTES || batch.length >= MAX_BATCH_FILES)) flush();
    batch.push(f); bytes += sz;
  }
  flush();
  console.log(`done: ${pushed} files published in ${n} batches.`);
}

main();
