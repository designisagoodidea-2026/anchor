# Anchor Integration Blueprint v1

## Objective

Adopt high-leverage patterns from GoldenFlow and Contentrain without weakening Anchor's unique mission: stateful, leader-readable signal translation.

## Hard guardrails (Anchor-native)

- Translation semantics remain Anchor-owned.
- Signal ontology remains Anchor-owned.
- New metadata is append-only.
- Behavior is feature-flagged and reversible.
- Any no-violation run must preserve semantic parity with pre-integration behavior.

## Phase map

| Phase | Source | Impacted layer | Borrowed pattern | Keep native to Anchor |
|---|---|---|---|---|
| A | GoldenFlow | Layer 1 ingest boundary (renderer + connector envelopes) | strict/permissive ingest mode, contract validation, run manifest/profile counts | no translation or ontology changes |
| B | Contentrain | Governance and explainability plane | rules-as-code style decision records, canonical schema, review validation | no CMS runtime scope; lightweight process |
| C | GoldenFlow | Structured normalization boundary (Slack pilot) | named transform registry, profile-driven rules, per-transform counters | no translation or ontology changes; one-connector pilot |
| D | GoldenFlow | Scale/backfill readiness at ingest | optional stream parser mode, deterministic cap checkpointing, degraded-state signaling | no translation or ontology changes; parity when cap unset |

## Council execution loop (required for each phase)

1. Initial implementation proposal.
2. Advocate memos: Anchor, GoldenFlow, Contentrain.
3. Moderator decision package.
4. Revised implementation proposal.
5. Change execution.
6. Cleanup and phase closeout.

## Entry criteria for implementation

- Moderator decision is approve or approve-with-guardrails.
- Required acceptance tests are defined.
- Rollback trigger and kill switch are defined.

## Exit criteria for a phase

- Guardrails proven by tests.
- Cleanup complete and documented.
- Next-phase readiness checklist completed.
