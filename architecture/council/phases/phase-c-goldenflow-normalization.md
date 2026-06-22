# Phase C - GoldenFlow-Inspired Structured Normalization Boundary

## Specific source

GoldenFlow

## Impacted layer

Phase 2 structured normalization boundary at renderer ingest.

## Borrowed pattern

- named transform registry
- config-driven normalization profile
- transform-level observability counters

## Keep native to Anchor guardrails

- no translation or ontology changes
- Slack-only pilot in this phase
- reversible by env toggle (`ANCHOR_NORMALIZATION_PROFILE=none`)

## Initial implementation proposal

- Add normalization profile with named transforms:
  - `timestamp_iso`
  - `collapse_snippet_whitespace`
  - `trim_actor_display_name`
- Apply only to Slack events after contract validation.
- Record per-transform attempted/applied/noop/errored counts in manifest.

## Council review

See:

- `../reviews/phase-c/anchor-advocate.md`
- `../reviews/phase-c/goldenflow-advocate.md`
- `../reviews/phase-c/contentrain-advocate.md`
- `../reviews/phase-c/moderator-decision.md`

## Revised implementation proposal

- Ship Core-3 transform set only in v1.
- Keep transform order fixed and visible in manifest.
- Include profile name in manifest for replay diagnostics.
- Defer `normalize_tags` and `trim_ids` to later subphase after parity checks.

## Change execution

Status: executed in this phase.

Changed areas:

- renderer ingest normalization registry and profile toggle
- renderer manifest schema and counters
- digest wiring for profile diagnostics

## Cleanup before next phase

- verify strict/permissive parity still holds for no-violation runs
- keep only Core-3 transforms active
- record rollout notes and defer extended transform set
