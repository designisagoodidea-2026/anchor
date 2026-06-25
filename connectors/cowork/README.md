# Cowork connector

Layer 1 connector for Cowork. Runs locally as a filesystem watcher and emits canonical change_event records (NDJSON) to stdout.

## Status

v0.1 connector scaffold is now present in-repo:

- src/index.js (watcher runtime)
- src/classify.js (canonical mapping)
- src/test-fixtures.js (fixture assertions)

This closes the prior implementation-footprint gap where only package metadata existed.

## Runtime model

- Deployment: local watcher
- Mode: event stream from file changes (watch)
- Output: one JSON line per event on stdout
- Source field: cowork

## Setup

1. Install dependencies:

   npm install

2. Run tests:

   npm test

3. Start watcher:

   npm run watch

## Environment variables

- COWORK_WATCH_PATH: directory to watch (default: current working directory)
- COWORK_ACTOR_ID: actor id emitted in events (default: local-cowork)
- COWORK_ACTOR_NAME: actor display name (default: Cowork)
- COWORK_INCLUDE_DOTFILES: set to 1 to include dotfiles (default: off)
- COWORK_DEDUPE_WINDOW_SEC: local dedupe window in seconds (default: 15)

## Mapping notes

- Decision tag: emitted when [decision] appears in filename or first line.
- Kind heuristics:
  - structural: skills/ and voice-profiles/ paths, schema-like files, folder add/delete
  - moderate: file create/delete, decision-tagged edits
  - polish: regular file edits
  - unknown: fallback only

## Contract

Events emitted by this connector follow shared canonical shape in:

- ../../shared/change-event.ts
