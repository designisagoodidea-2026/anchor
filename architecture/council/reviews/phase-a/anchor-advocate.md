# Phase A Review - Anchor Advocate

## Recommendation

Approve with guardrails.

## Main concerns

- mode drift into semantic logic
- silent data loss in permissive mode
- count semantics ambiguity

## Required guardrails

- validation only at ingest boundary
- frozen minimal contract
- append-only metadata
- deterministic received/accepted/dropped accounting

## Required tests

- strict vs permissive parity on valid-only inputs
- strict failure when violations are present
- metadata compatibility for existing consumers
