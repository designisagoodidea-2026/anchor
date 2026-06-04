# ADR 04 — Dashboard target pivot: Jira for pilot 1, Coda removed

**Status:** decided 2026-06-04. Implementation follows.

**Decision:** Jira becomes the container source for pilot #1. Coda is removed from the architecture — adapter, references, env config. Airtable container path stays (fixture and self-hosted fallback). Digest rendering target is deferred to pilot #2; pilot #1 reads the renderer's existing markdown output.

## Context

The 2026-05-29 decision named Coda + Airtable as the dual-adapter dashboard target. Coda was attractive then because it blended container mapping (table-shaped) and digest rendering (document-shaped) in one tool. Clean for a demo against synthetic data.

It doesn't survive contact with the audience. Senior design / DPM leaders running embedded teams across business units work in Jira (enterprise / product-org default) or Asana (cross-functional default). Coda is a niche power-user tool. Asking a pilot leader to stand up a Coda workspace to evaluate Anchor is asking them to adopt a new tool before they've decided whether Anchor is worth their time. Wrong order.

The original decision also packaged two questions into one: *where do bodies of work get declared*, and *where does the leader read the digest*. Coda answered both because it does both. Jira answers only the first. Removing Coda forces the split — which sharpens the two questions into sovereign decisions instead of one bundled one.

## Decision

### 1. Container source — Jira for pilot 1

Jira is the v0.2 container source. The leader doesn't hand-map containers; they pick which Jira projects (and / or epics) Anchor watches. The Jira project hierarchy IS the leader's declared bodies of work — they declared it when they set up the tracker.

This also shrinks the deferred container-inference layer down a level. The v0.2 inference problem moves from "learn the org's vocabulary via embeddings" to "let the leader pick projects to watch." Much smaller, much earlier. Embedding-based inference becomes a Stage 3 problem at earliest.

Asana is the most likely next adapter (cross-functional default); the call lands when pilot #2 surfaces. The dual-adapter abstraction stays — `ContainerSource` interface is the right shape; Jira slots in as a third implementation alongside Airtable and fixture.

### 2. Coda removed — adapter, references, env

- `layer-3/src/coda-source.ts` — removed.
- `ANCHOR_CONTAINER_SOURCE=coda` path in `renderer/src/resolve.ts` — removed; valid values become `airtable | jira | fixture`.
- `CODA_API_TOKEN` removed from `.env.example` and documented setup.
- `layer-3/package.json` — Coda SDK dependency removed.
- Layer 5 storage and renderer references to Coda — pruned.
- `STATUS.md`, `README.md`, subpackage READMEs — references swept.

Airtable adapter stays. It carries the live demo path, the seed-generator substrate, and the self-hosted fallback for prospects who'd rather not connect Jira during evaluation.

### 3. Digest rendering target — deferred to pilot 2

Pilot #1 is a 1:1 walkthrough; markdown rendered locally is enough. Pilot #2 forces the rendering-target call. Options to weigh then: hosted web view at `anchor.app/digest/<tenant>`, email push, Slack canvas, Notion. Don't build before pilot #2 is on the table — same logic as the calibration loop and container inference deferrals.

The renderer's existing markdown output is the pilot #1 path. No new build required.

### 4. TE composition — Jira is the first-import trigger

`anchor-open-decisions.md` Decision 6 (lazy add): the TE dependency lands when the first package in Anchor needs to import from it. The Jira adapter is that moment.

TE was built for Jira-shaped schema translation; its Jira grammar exists today. Anchor's Jira adapter wraps TE's Jira grammar. Anchor's `kind` heuristics stay Anchor-side (per the upstream-queue pattern — kind heuristics are tuned to Anchor's signal layer, not generic to translation). TE handles fetch, auth, and canonical record shape; Anchor handles the translation to `change_event`.

`package.json` gets a `translation-engine: file:../Translation Engine` dependency in `layer-3/`. Pin discipline per Decision 5 (^0.x.0 under 0.x, MINOR-can-break accepted, read TE's CHANGELOG before bumps, dedicated commit). Coordinate the CHANGELOG entry with TE's owner before the first bump.

This first-import moment is also a plausible re-evaluation trigger for the upstream-contribution-queue deferral (Figma / Cowork / Slack migrating upstream to TE). Decision deferred to a separate ADR; flagged here.

## Trade-offs

For Jira as container source:

- Matches what target pilot leaders already use. Lower friction.
- Project hierarchy is declared structure; no manual mapping.
- TE's Jira grammar exists — composition substrate is real, not hypothetical.

Against:

- Jira's API has rate limits and an OAuth dance. Worker work to handle correctly.
- Jira project structure varies wildly across orgs (Kanban / Scrum / hybrid / portfolio). The container resolver must handle the variability without leaking it into Layer 4.

For removing Coda:

- Less surface area. Less code. Less maintenance.
- Cleaner story for prospect leaders: three connectors, one container source (Jira), one digest path (markdown for now). Less to explain.

Against:

- Sunk-cost on the Coda adapter build. Real but small — the abstraction stays; only the implementation goes.
- A future Coda-using prospect has no path. Accepted.

For deferring the digest rendering target:

- Pilot #1 doesn't need it.
- Avoids picking a rendering target without pilot data.

Against:

- Pilot #2 readiness blocks on the rendering decision; can't lazy-defer past then.

## Implementation plan

One branch, in order. Each step independently testable.

1. **Remove Coda surface.** Delete `coda-source.ts`, prune the `ANCHOR_CONTAINER_SOURCE=coda` path, sweep doc references. Verify: existing Airtable path still works end-to-end.
2. **Add Jira ContainerSource.** New `layer-3/src/jira-source.ts` implementing the existing `ContainerSource` interface. Auth via Jira PAT for v0.2 (OAuth deferred; same staging as ADR-01 Figma).
3. **Wire TE for Jira.** Add the TE dependency at `layer-3/package.json` (`file:../Translation Engine`). Import TE's Jira grammar. Map TE's canonical Jira record to Anchor's `change_event`. Pin TE per VERSIONING.md.
4. **Update env + docs.** `.env.example` gains `JIRA_*` vars and loses `CODA_*`. README, STATUS, setup docs updated. Subpackage READMEs swept.
5. **End-to-end smoke** against a Jira sandbox (Atlassian free tier).

Verification at the end: existing renderer smoke suite runs against `ANCHOR_CONTAINER_SOURCE=jira` and produces a digest matching the synthetic-event baseline.

## What this ADR is not changing

- Airtable container source. Stays.
- Layer 4 (signal computation), Layer 5 (state + diff), Layer 6 (voice rendering). Unchanged. Layer 3 is the only layer touched.
- The `change_event` shape. The Jira adapter emits the same canonical shape every other adapter emits.
- The voice profile, vocabulary refusal, or anchored-opening contract.
- The air-gap rules. Jira is a generic enterprise tool with no air-gap implication; no named target companies referenced.

## Related

- [adr 01 figma authorization](adr-01-figma-authorization.md) — same staged-auth pattern (PAT for first pilot; service account / OAuth at later stages).
- [open decisions](../docs/anchor-open-decisions.md) — supersedes the 2026-05-29 "Dashboard target — Coda and Airtable, dual adapter" decision; activates Decision 6 (lazy add).
- [poc scope](../docs/anchor-poc-scope.md) — updated to reflect the swap.
- [te composition](../docs/anchor-te-composition.md) — composition activates here; this is the first-import moment.
- [upstream contribution queue](../docs/anchor-upstream-contribution-queue.md) — re-eval trigger plausibly firing; separate ADR will judge.
- [layer 3 container resolution](layer-3-container-resolution.md) — the layer this ADR reshapes.
- [scaling path](../docs/anchor-scaling-path.md) — Stage 2 container expansion (Asana) follows here.
