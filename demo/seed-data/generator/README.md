# Anchor seed generator

A synthetic team-activity generator. Produces a believable hour of design / product team activity across five fake projects and five fake personas, with deliberate stressors woven through so every Anchor signal path gets exercised.

## What it produces

- **Real Airtable rows** in your configured Containers table — one per fake project, with the Aliases column populated so cross-tool name drift gets carried into the mapping the way a real org would maintain it.
- **Real cowork files** under `demo/seed-data/projects/<slug>/` so the live watcher catches them as filesystem events in real time.
- **Synthetic Figma `change_event` records** as NDJSON at `demo/seed-data/synthetic-events/figma.ndjson`. Figma's write API can't fake frame edits or version saves the way a real session does, so these events bypass the Figma worker entirely and feed the renderer directly.
- **Synthetic Slack `change_event` records** as NDJSON at `demo/seed-data/synthetic-events/slack.ndjson`. Same reason as Figma — the Slack worker reads real workspace events; synthetic Slack activity bypasses it.

The renderer picks all of this up via `ANCHOR_EVENTS_FILE` (the cowork lane reads any NDJSON, and per the latest `ingest.ts` it counts events by their own `source` field, so a mixed NDJSON reports honestly).

## What it does NOT do

- It does not touch your real Figma files or your real Slack workspace. The Cloudflare Workers stay idle during synthetic runs.
- It does not produce anything that names a real company, product, or person. All five personas and five projects are synthetic per the air-gap rules in `/CLAUDE.md`.
- It does not survive a `reset.js` call. The manifest is the source of truth for cleanup — anything not in the manifest is yours to clean.

## Setup status

| Step | State | Notes |
|---|---|---|
| Pure Node, no dependencies | **done** (2026-06-03) | Uses Node 18+ built-ins (`node:fetch`, `node:fs`, `node:path`). No `npm install` needed. |
| Sources `/Anchor/.env` via the runner | **done** (2026-06-03) | The runner already source-loads `.env` for the digest path; the generator inherits the same env. |
| First generate run | **pending** | Run from `/Anchor/demo/seed-data/generator` after a watcher has been started. |
| First reset run | **pending** | Verifies the manifest-driven cleanup deletes Airtable rows + removes files. |

## Personas

Five synthetic team members with different verbosity, typo rates, and focuses:

- **Maya** — Senior IC designer. Long-form, careful, prototype-heavy.
- **Reza** — Junior IC designer. Mid-verbosity, occasional typos, exploration burst at the end of the run (the capacity stressor).
- **Priya** — Product manager. Terse, decision-heavy, Slack-first.
- **Diego** — Engineering partner. Very terse, code-shaped. His activity feeds the `code-ships-with-tests` drift trigger.
- **Sam** — Design director. Low density, decision-heavy.

## Projects

Five synthetic bodies of work, each with 1–3 aliases (cross-tool name drift):

- **Search UX** — active. AKA "Search redesign", "Search 2026".
- **Onboarding redesign** — in review. AKA "Onboarding v2", "OB redesign".
- **Settings polish** — winding down. AKA "Settings cleanup". Goes silent in the back half.
- **Native mobile** — kickoff. AKA "Mobile app", "iOS / Android". Reza's surge target.
- **Q3 roadmap** — newly appearing. AKA "Q3 planning". Shows up at ~60% through the run.

## Stressors woven in

Each one lights up a different Anchor signal path:

- **Capacity surge** — Reza pushes ~18 events on Native mobile in the last 30% of the run.
- **Drift trigger** — Diego ships cowork files on Search UX with no paired test files (lights `code-ships-with-tests`).
- **Health-trend transition** — Settings polish fades to silence; Onboarding gets a heavy crit cluster.
- **Newly appeared** — Q3 roadmap appears partway through.
- **Resolved** — Settings polish drops off the read by run-end.

## How to run

Every command below assumes you've started by `cd`-ing into the generator folder. Also make sure your cowork watcher is running so it catches the real files (`./scripts/anchor-live-run.sh start` from the project root).

```bash
cd "/Users/jason/Documents/Claude/Projects/Anchor/demo/seed-data/generator"
node src/generate.js
```

Default duration is 60 minutes, real-time. To run a shorter or longer window:

```bash
cd "/Users/jason/Documents/Claude/Projects/Anchor/demo/seed-data/generator"
node src/generate.js --duration 30
```

To skip individual sinks (useful while iterating):

```bash
cd "/Users/jason/Documents/Claude/Projects/Anchor/demo/seed-data/generator"
node src/generate.js --skip-airtable --skip-figma
```

To dump everything immediately rather than in real time:

```bash
cd "/Users/jason/Documents/Claude/Projects/Anchor/demo/seed-data/generator"
node src/generate.js --backfill
```

## How to render the digest against synthetic events

After the generator has run, point the renderer at the synthetic NDJSONs:

```bash
cd "/Users/jason/Documents/Claude/Projects/Anchor/renderer"
ANCHOR_EVENTS_FILE="/Users/jason/Documents/Claude/Projects/Anchor/demo/seed-data/synthetic-events/figma.ndjson" \
  npx tsx src/digest.ts
```

(or the Slack NDJSON; or concatenate both with cowork.ndjson via `cat` if you want every lane in one read.)

If your cowork watcher caught the real files written by the generator, those are already in `state/live/cowork.ndjson` and the normal `./scripts/anchor-live-run.sh digest --commit` will pull them in.

## Reset

When you're done — or before re-running the generator — undo every side effect:

```bash
cd "/Users/jason/Documents/Claude/Projects/Anchor/demo/seed-data/generator"
node src/reset.js
```

This deletes the Airtable rows the manifest tracks, removes the cowork files the generator wrote, and archives the Figma + Slack NDJSON files under `synthetic-events/archive/`. The watcher's `cowork.ndjson` is untouched (it's yours, not the generator's).

## Files

- [`src/personas.js`](src/personas.js) — five synthetic team members with verbosity / typo / focus profiles.
- [`src/projects.js`](src/projects.js) — five synthetic projects with aliases and lifecycle states.
- [`src/content.js`](src/content.js) — phrase pools for Figma comments, Slack messages, cowork docs.
- [`src/typos.js`](src/typos.js) — probabilistic typo application; protects markdown structure and `[decision]` tokens.
- [`src/timeline.js`](src/timeline.js) — composes the five-phase arc + background hum + stressors.
- [`src/airtable.js`](src/airtable.js) — real Airtable CRUD for the project rows.
- [`src/event-emitters.js`](src/event-emitters.js) — change_event shapes for Figma + Slack; real file writes for cowork.
- [`src/generate.js`](src/generate.js) — CLI entry: composes timeline → fires events → writes manifest.
- [`src/reset.js`](src/reset.js) — CLI entry: reads manifest → undoes everything.
- [`src/shared.d.ts`](src/shared.d.ts) — JSDoc type declarations for editor support.
