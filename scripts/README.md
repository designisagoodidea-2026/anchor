# Anchor operational scripts

## Translation rigor scripts

- `check-translation-governance.mjs`
  - Enforces governance scope for translation-sensitive changes.
  - Runs Layer 4 replay + strict checks when Layer 4 files change.

## Onboarding scripts

- `onboard-leader.sh <leader-slug> [leader-display-name]`
  - Scaffolds leader-specific principles, voice profile, and initial state file.
  - Does not modify renderer defaults; use env vars when running digest.

- `onboard-source.sh <source-slug> [worker|local]`
  - Scaffolds a new connector directory and baseline files.
  - Does not auto-activate the source in shared contracts or ingest.
  - Prints required follow-up checklist.

## Live run scripts

- `anchor-live-run.sh`
  - Starts/stops watcher, renders digest/friday, and runs governance checks.
