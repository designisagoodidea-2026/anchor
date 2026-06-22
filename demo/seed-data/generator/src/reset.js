#!/usr/bin/env node
//
// anchor-seed-generator — reset.js
//
// Reads the manifest written by generate.js, removes everything it
// created:
//   - DELETE every Airtable row whose id is in the manifest
//   - rm every cowork file the generator wrote
//   - mv the Figma + Slack NDJSON files to an archive folder so previous
//     runs are preserved
//
// Idempotent — running reset twice with the same manifest is harmless.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadDotEnv } from "./env.js";
import { deleteProjectRows } from "./airtable.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ANCHOR_ROOT = path.resolve(__dirname, "../../../..");

// Same .env auto-load as generate.js — reset hits Airtable too.
loadDotEnv(path.join(ANCHOR_ROOT, ".env"));
const SYNTH_DIR = path.join(ANCHOR_ROOT, "demo", "seed-data", "synthetic-events");
const MANIFEST = path.join(SYNTH_DIR, "manifest.json");
const ARCHIVE = path.join(SYNTH_DIR, "archive");

if (!fs.existsSync(MANIFEST)) {
  console.error(`anchor-seed-reset: no manifest at ${MANIFEST}. Nothing to reset.`);
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
fs.mkdirSync(ARCHIVE, { recursive: true });

// ─── 1. Delete Airtable rows ─────────────────────────────────────────────

if (manifest.airtable_rows?.length) {
  console.log(`anchor-seed-reset: deleting ${manifest.airtable_rows.length} Airtable rows…`);
  try {
    const result = await deleteProjectRows({ rows: manifest.airtable_rows });
    console.log(
      `anchor-seed-reset: ${result.deleted} deleted, ${result.failed.length} failed.`
    );
    for (const f of result.failed) console.warn(`  ! ${f}`);
  } catch (e) {
    console.error(
      `anchor-seed-reset: Airtable delete error — ${e instanceof Error ? e.message : String(e)}`
    );
  }
} else {
  console.log("anchor-seed-reset: no Airtable rows in manifest.");
}

// ─── 2. Remove cowork files ──────────────────────────────────────────────

if (manifest.cowork_files?.length) {
  let removed = 0;
  for (const fp of manifest.cowork_files) {
    try {
      if (fs.existsSync(fp)) {
        fs.unlinkSync(fp);
        removed++;
      }
    } catch (e) {
      console.warn(`  ! could not remove ${fp}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`anchor-seed-reset: removed ${removed} cowork files.`);

  // Clean empty project directories.
  const projectsDir = path.join(ANCHOR_ROOT, "demo", "seed-data", "projects");
  if (fs.existsSync(projectsDir)) {
    for (const sub of fs.readdirSync(projectsDir)) {
      const subDir = path.join(projectsDir, sub);
      try {
        if (fs.statSync(subDir).isDirectory() && fs.readdirSync(subDir).length === 0) {
          fs.rmdirSync(subDir);
        }
      } catch {
        // best-effort
      }
    }
  }
}

// ─── 3. Archive Figma + Slack NDJSON ────────────────────────────────────

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
for (const which of ["figma", "slack"]) {
  const src = path.join(SYNTH_DIR, `${which}.ndjson`);
  if (fs.existsSync(src) && fs.statSync(src).size > 0) {
    const dest = path.join(ARCHIVE, `${which}-${stamp}.ndjson`);
    fs.renameSync(src, dest);
    console.log(`anchor-seed-reset: archived ${which}.ndjson → ${dest}`);
  }
}

// ─── 4. Archive the manifest ─────────────────────────────────────────────

const archivedManifest = path.join(ARCHIVE, `manifest-${stamp}.json`);
fs.renameSync(MANIFEST, archivedManifest);
console.log(`anchor-seed-reset: manifest archived → ${archivedManifest}`);
console.log("anchor-seed-reset: done.");
