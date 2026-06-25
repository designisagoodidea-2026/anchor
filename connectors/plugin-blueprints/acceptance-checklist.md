# Connector acceptance checklist (v1)

Use this checklist before promoting any connector from candidate to active.

## A. Contract and schema

- [ ] Connector emits canonical `change_event` shape exactly.
- [ ] `source` value is valid and registered in shared source enum.
- [ ] `kind` mapping is deterministic and documented (`polish|moderate|structural|unknown`).
- [ ] `tags` mapping is deterministic and includes decision-token behavior.
- [ ] `raw_ref` can be traced to source record for audit.

## B. Auth and security

- [ ] Auth model is documented (OAuth, PAT, webhook signing, etc.).
- [ ] Required scopes are listed and least-privilege reviewed.
- [ ] Workspace/tenant pinning behavior is explicit.
- [ ] Admin/debug endpoints are guarded and rate-limited.
- [ ] Secret rotation procedure is documented.

## C. Ingest runtime

- [ ] Ingest mode is explicit (poll/webhook/hybrid).
- [ ] Cursor/checkpoint key strategy is explicit and idempotent.
- [ ] Dedupe key strategy and TTL are explicit.
- [ ] Retry behavior and failure handling are documented.
- [ ] Backfill behavior and limits are documented.

## D. Test and replay gates

- [ ] Fixture pack includes: happy path, empty window, dedupe/retry, decision-tag, structural-kind.
- [ ] Strict mode replay passes.
- [ ] Permissive mode replay passes.
- [ ] Classifier tests run without network dependencies.
- [ ] At least one end-to-end smoke endpoint test is documented.

## E. Ops readiness

- [ ] Health endpoint reports binding/auth/config status.
- [ ] Logging includes source, action, outcome, and reason on failures.
- [ ] Known gaps and risk flags are documented.
- [ ] Runbook/setup steps are present and copy-paste runnable.
- [ ] Rollback path is documented (disable source, revert version, clear cursor if needed).

## Promotion rule

A connector is `active` only when all A-E checklist items are complete or an explicit waiver is recorded in its plugin blueprint notes.
