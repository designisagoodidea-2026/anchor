# Jira connector (starter scaffold)

Layer 1 connector starter for Jira, aligned to the plugin blueprint contract.

This scaffold is intentionally minimal and deterministic so we can begin fixture-first development quickly.

## Included

- src/classify.ts: Jira -> canonical change_event mapping helpers
- src/index.ts: worker endpoints for health and classification smoke tests
- src/test-classify.ts: fixture tests for decision tag, structural transition, and moderate update
- wrangler.toml, package.json, tsconfig.json

## Current endpoints

- GET /healthz
- POST /classify

## Next implementation steps

1. Add OAuth token and workspace pin validation.
2. Add Jira event ingestion path (poll/webhook hybrid).
3. Add cursor + dedupe persistence strategy.
4. Add replay fixtures and strict/permissive gate scripts.
5. Promote plugin status from candidate to active when checklist passes.

## Run locally

1. Install dependencies:

   npm install

2. Run fixture tests:

   npm test

3. Run worker locally:

   npm run dev
