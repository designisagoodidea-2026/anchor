# Phase D - GoldenFlow-Inspired Scale and Backfill Readiness

## Specific source

GoldenFlow

## Impacted layer

Phase 4 scale/backfill readiness at ingest boundary.

## Borrowed pattern

- chunk/stream style processing for large inputs
- bounded ingest checkpoints using deterministic caps

## Keep native to Anchor guardrails

- no translation or ontology changes
- default behavior unchanged when cap is unset
- cap-hit runs marked degraded (never silent success)

## Initial implementation proposal

- Stream cowork NDJSON line-by-line in optional parser mode.
- Add optional `ANCHOR_INGEST_MAX_EVENTS` cap on cowork received lines.
- Emit warning + manifest degraded state when cap is reached.

## Council review

See:

- `../reviews/phase-d/anchor-advocate.md`
- `../reviews/phase-d/goldenflow-advocate.md`
- `../reviews/phase-d/contentrain-advocate.md`
- `../reviews/phase-d/moderator-decision.md`

## Revised implementation proposal

- Keep narrow slice to cowork lane only.
- Cap on received lines (deterministic), not accepted events.
- Add observability fields to ingest manifest:
  - parser mode, cap value, received lines, cap hit, degraded, stop reason.
- Preserve full parser as default for parity; stream mode available via env toggle.

## Change execution

Status: executed in this phase.

Changed areas:

- renderer ingest cowork path with stream parser mode
- deterministic cap handling and degraded signaling
- digest wiring for parser/cap diagnostics

## Cleanup before next phase

- monitor cap-hit warnings to confirm no silent truncation
- keep emergency parser mode toggle while rollout settles
- defer any cross-source scale work until needed
