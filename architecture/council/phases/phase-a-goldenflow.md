# Phase A - GoldenFlow-Inspired Ingest Controls

## Specific source

GoldenFlow

## Impacted layer

Layer 1 ingest boundary in renderer, plus append-only connector envelope metadata.

## Borrowed pattern

- strict/permissive ingest mode
- minimal contract validation
- run manifest and profile counts

## Keep native to Anchor guardrails

- no Translation Engine semantic changes
- no ontology changes
- append-only metadata only
- deterministic counting semantics

## Initial implementation proposal

- Add `ANCHOR_INGEST_MODE` with values `permissive` (default) and `strict`.
- Validate a minimal event contract at ingest boundary.
- Permissive mode: keep run alive and drop invalid events with classified warnings.
- Strict mode: fail run when violations exist.
- Emit run manifest: run id, mode, contract version, source counts, violation summary.

## Council review

See:

- `../reviews/phase-a/anchor-advocate.md`
- `../reviews/phase-a/goldenflow-advocate.md`
- `../reviews/phase-a/contentrain-advocate.md`
- `../reviews/phase-a/moderator-decision.md`

## Revised implementation proposal

- Ship Gate 1 only in this phase:
  - renderer ingest validation + strict/permissive + manifest
  - minimal append-only metadata in connector responses
- Freeze violation taxonomy to 5 codes.
- Add anti-masking rule: in strict mode, fail if a configured source has inbound events but zero accepted events.
- Keep strict mode behind env toggle for rollout safety.

## Change execution

Status: executed in this phase.

Changed areas:

- renderer ingest pipeline
- digest mode handling and manifest logging
- connector envelope metadata (append-only)

## Cleanup before next phase

- Confirm no-violation semantic parity.
- Freeze contract version for this phase.
- Keep only active toggles and remove dead branches.
