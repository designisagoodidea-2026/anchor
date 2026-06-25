#!/usr/bin/env node
//
// anchor-seed-generator — generate.js
//
// Composes the planned timeline → calls the right emitter per event →
// writes:
//   - Real Airtable rows for each project (so Layer 3 resolves)
//   - Real cowork files under demo/seed-data/projects/<slug>/ at their
//     planned timestamps (the live watcher catches each one)
//   - Synthetic Figma + Slack change_events as NDJSON files under
//     demo/seed-data/synthetic-events/{figma,slack}.ndjson
//
// Modes:
//   --realtime         Default. Sleep between events so the watcher
//                      catches them as filesystem changes in time order.
//   --backfill         Write everything immediately with planned
//                      timestamps. Cowork files land in past timestamps;
//                      watcher may not catch them (its file event time
//                      is now). Useful for fixture-style runs.
//
// Configuration (env or flags; flags win):
//   --duration <min>   Length of the simulated window. Default 60.
//   --start <iso>      Start time. Default: now.
//   --skip-airtable    Don't write real Airtable rows (for dry runs).
//   --skip-cowork      Don't write real cowork files.
//   --skip-figma       Don't write the Figma NDJSON.
//   --skip-slack       Don't write the Slack NDJSON.
//
// Writes a manifest at demo/seed-data/synthetic-events/manifest.json so
// reset.js knows what to undo.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadDotEnv } from "./env.js";
import { PROJECTS, getProject } from "./projects.js";
import { getPersona } from "./personas.js";
import { composeTimeline } from "./timeline.js";
import { createProjectRows } from "./airtable.js";
import {
  emitFigmaComment,
  emitFigmaVersion,
  emitSlackMessage,
  emitCoworkFile,
} from "./event-emitters.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ANCHOR_ROOT = path.resolve(__dirname, "../../../..");

// Auto-load /Anchor/.env so `node src/generate.js` works in any shell —
// matches the runner script's behavior so the two entrypoints stay symmetric.
loadDotEnv(path.join(ANCHOR_ROOT, ".env"));

const SYNTH_DIR = path.join(ANCHOR_ROOT, "demo", "seed-data", "synthetic-events");
const MANIFEST = path.join(SYNTH_DIR, "manifest.json");
const FIGMA_NDJSON = path.join(SYNTH_DIR, "figma.ndjson");
const SLACK_NDJSON = path.join(SYNTH_DIR, "slack.ndjson");

const args = parseArgs(process.argv.slice(2));

const DURATION_MIN = parseInt(args["duration"] ?? "60", 10);
const START_ISO = args["start"] ?? new Date().toISOString();
const REALTIME = !args["backfill"];

const SKIP_AIRTABLE = !!args["skip-airtable"];
const SKIP_COWORK = !!args["skip-cowork"];
const SKIP_FIGMA = !!args["skip-figma"];
const SKIP_SLACK = !!args["skip-slack"];

fs.mkdirSync(SYNTH_DIR, { recursive: true });

// ─── 1. Build the timeline ────────────────────────────────────────────────

console.log(
  `anchor-seed: composing timeline — start=${START_ISO}, duration=${DURATION_MIN}min, realtime=${REALTIME}`
);
const planned = composeTimeline({
  start_iso: START_ISO,
  duration_minutes: DURATION_MIN,
});
console.log(`anchor-seed: ${planned.length} events planned across ${PROJECTS.length} projects.`);

// ─── 2. Write real Airtable rows ─────────────────────────────────────────

const manifest = {
  generated_at: new Date().toISOString(),
  start_iso: START_ISO,
  duration_minutes: DURATION_MIN,
  airtable_rows: /** @type {{project_slug: string, airtable_id: string}[]} */ ([]),
  cowork_files: /** @type {string[]} */ ([]),
  figma_ndjson_path: SKIP_FIGMA ? null : FIGMA_NDJSON,
  slack_ndjson_path: SKIP_SLACK ? null : SLACK_NDJSON,
  total_events: planned.length,
};

if (!SKIP_AIRTABLE) {
  console.log("anchor-seed: creating Airtable rows…");
  try {
    manifest.airtable_rows = await createProjectRows({
      projects: PROJECTS,
      absoluteSeedRoot: path.join(ANCHOR_ROOT, "demo", "seed-data"),
    });
    console.log(`anchor-seed: ${manifest.airtable_rows.length} Airtable rows created.`);
  } catch (e) {
    console.error(
      `anchor-seed: Airtable write failed — ${e instanceof Error ? e.message : String(e)}`
    );
    console.error(
      `anchor-seed: aborting before any other side effects. Source /Anchor/.env if you haven't.`
    );
    process.exit(1);
  }
} else {
  console.log("anchor-seed: skipping Airtable (--skip-airtable).");
}

// ─── 3. Fire each planned event at its scheduled time ────────────────────

if (!SKIP_FIGMA) fs.writeFileSync(FIGMA_NDJSON, "", "utf8");
if (!SKIP_SLACK) fs.writeFileSync(SLACK_NDJSON, "", "utf8");

const startMs = new Date(START_ISO).getTime();
const wallStart = Date.now();
let fired = 0;

for (const ev of planned) {
  if (REALTIME) {
    const targetWall = wallStart + (new Date(ev.fire_at).getTime() - startMs);
    const wait = targetWall - Date.now();
    if (wait > 0) await sleep(wait);
  }

  await fireOne(ev);
  fired++;
  if (fired % 10 === 0) {
    console.log(`anchor-seed: ${fired}/${planned.length} fired.`);
  }
}

// ─── 4. Persist the manifest ─────────────────────────────────────────────

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`anchor-seed: done. Manifest: ${MANIFEST}`);
console.log(
  `anchor-seed: cowork files: ${manifest.cowork_files.length}; ` +
    `figma NDJSON: ${SKIP_FIGMA ? "skipped" : FIGMA_NDJSON}; ` +
    `slack NDJSON: ${SKIP_SLACK ? "skipped" : SLACK_NDJSON}.`
);

// ─── Internals ───────────────────────────────────────────────────────────

async function fireOne(ev) {
  const persona = getPersona(ev.persona_id);
  const project = getProject(ev.project_slug);

  if (ev.kind === "figma_comment" && !SKIP_FIGMA) {
    const event = emitFigmaComment({ persona, project, decision: ev.decision, fire_at: ev.fire_at });
    appendNdjson(FIGMA_NDJSON, event);
    return;
  }
  if (ev.kind === "figma_version" && !SKIP_FIGMA) {
    const event = emitFigmaVersion({ persona, project, decision: ev.decision, fire_at: ev.fire_at });
    appendNdjson(FIGMA_NDJSON, event);
    return;
  }
  if ((ev.kind === "slack_message" || ev.kind === "slack_thread_reply") && !SKIP_SLACK) {
    const event = emitSlackMessage({ persona, project, decision: ev.decision, fire_at: ev.fire_at });
    appendNdjson(SLACK_NDJSON, event);
    return;
  }

  if (SKIP_COWORK) return;
  const subKind = ev.kind === "cowork_decision" ? "decision"
                : ev.kind === "cowork_prototype" ? "prototype"
                : ev.kind === "cowork_crit"      ? "crit"
                : "doc";
  const out = emitCoworkFile({
    persona,
    project,
    kind: subKind,
    decision: ev.decision,
    fire_at: ev.fire_at,
    anchorRoot: ANCHOR_ROOT,
  });
  manifest.cowork_files.push(out.created_path);
}

function appendNdjson(file, event) {
  fs.appendFileSync(file, JSON.stringify(event) + "\n", "utf8");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = "true";
    }
  }
  return out;
}
