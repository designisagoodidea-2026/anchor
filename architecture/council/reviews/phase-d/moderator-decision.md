# Phase D Moderator Decision

## Decision

Approve with guardrails.

## Weighted ruling summary

- Mission protection: pass
- Reliability gain: high for backfill safety
- Governance gain: positive via degraded-state honesty
- Implementation risk: acceptable as narrow slice
- Reversibility: high via env toggles

## Required implementation boundaries

- cowork lane only in this phase
- cap on received lines
- explicit degraded state on cap-hit

## Required acceptance tests

- cap unset parity
- deterministic cap boundary
- degraded signaling and manifest fields present

## Rollback trigger

Any silent truncation behavior or unstable replay boundaries.
