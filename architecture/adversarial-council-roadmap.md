# Anchor Adversarial Council and Integration Roadmap

## Purpose

Create a formal multi-agent council that stress-tests integration proposals before implementation. The council exists to improve Anchor while preserving its unique differentiation.

## Council members

- `anchor-advocate`: defends Anchor mission and translation semantics.
- `goldenflow-advocate`: proposes selective normalization and manifest patterns.
- `contentrain-advocate`: proposes governance and explainability controls.
- `council-moderator`: arbitrates with weighted scoring and final recommendation.

## Scope of authority

The council can:

- Approve or reject integration slices.
- Require guardrails, tests, and rollout constraints.
- Trigger rollback if acceptance criteria regress.

The council cannot:

- Change Anchor's core mission.
- Replace Translation Engine semantics with generic transforms.
- Force broad rewrites without phased evidence.

## Evaluation criteria (MECE)

1. Mission preservation.
2. Signal fidelity impact.
3. Explainability and auditability impact.
4. Implementation complexity.
5. Operational risk.
6. Reversibility.

## Phase roadmap

### Phase 0: Council bootstrap (now)

Goal: establish governance before code changes.

Deliverables:

- Agent definitions in `agents/`.
- This roadmap document.
- Standard memo template and decision log format.

Exit criteria:

- One dry-run council review completed on current proposal.
- Moderator decision package accepted.

### Phase 1: Low-risk observability imports

Goal: improve transparency with minimal architectural risk.

Candidate work:

- Run-level transform manifest.
- Pipeline profile report pre-translation.
- Strict/permissive mode toggles.

Guardrails:

- No Translation Engine logic changes.
- Feature flags for all new behavior.

Exit criteria:

- Deterministic rerun behavior verified.
- Debuggability improved in at least two real incident scenarios.

### Phase 2: Structured normalization boundary

Goal: improve input quality before resolver/translation.

Candidate work:

- Named normalization transform registry.
- Config-driven rules for source-specific cleanup.
- Contract tests at ingest boundary.

Guardrails:

- Resolver and translation APIs remain stable.
- One-connector pilot first (recommend Slack).

Exit criteria:

- Reduction in malformed/unresolved events.
- No degradation in signal precision/recall for pilot fixtures.

### Phase 3: Governance hardening

Goal: reduce accidental semantic drift during rule changes.

Candidate work:

- Canonical serialization for rule artifacts.
- Review-required workflow for high-impact rule edits.
- Decision log for ontology and threshold changes.

Guardrails:

- Keep process lightweight for POC velocity.
- Emergency fast-path with post-hoc review allowed.

Exit criteria:

- Rule changes show clean diffs and clear rationale.
- Regression risk reduced without major cycle-time slowdown.

### Phase 4: Scale and backfill readiness (optional)

Goal: support larger historical reprocessing safely.

Candidate work:

- Chunked processing path.
- Backfill-specific quality checks and checkpoints.

Guardrails:

- Do not add scale complexity before Phase 1-3 wins are proven.

Exit criteria:

- Large backfill executes with bounded memory and clear checkpoints.

## Council operating cadence

- Design review: before each phase start.
- Change review: before each high-impact merge.
- Post-phase retrospective: after each phase exit.

## Required execution loop per phase

1. Initial implementation proposal.
2. Three advocate reviews (Anchor, GoldenFlow, Contentrain).
3. Moderator decision package.
4. Revised implementation proposal.
5. Change execution.
6. Cleanup and closeout before the next phase.

## Decision log template

For each council decision record:

- Proposal ID.
- Advocates' positions.
- Moderator weighted score.
- Decision (approve, approve-with-guardrails, defer, reject).
- Required tests.
- Rollback trigger.

## Initial recommendation

Start with Phase 1 and a narrow Phase 2 pilot. Avoid broad integration until evidence confirms measurable gains and no mission drift.

## Current execution state (2026-06-21)

- Phase A (GoldenFlow-inspired ingest controls): executed.
- Phase B (Contentrain-inspired governance controls): executed.
- Phase C (GoldenFlow-inspired structured normalization boundary, Slack pilot): executed.
- Phase D (GoldenFlow-inspired scale/backfill readiness at ingest): executed.
- Next checkpoint: monitor staged rollout metrics and decide whether to expand normalization profile scope beyond Slack pilot.

## Connector roadmap wishlist (candidate products)

This section captures product integrations we intend to evaluate and phase in. Placement below does not guarantee immediate build; each item still goes through council review and slice-based delivery.

### Priority wave 1 (highest immediate value)

- Claude Design
- Linear
- Microsoft Teams
- Zoom
- Notion
- Jira
- UserTesting
- Confluence
- Google Docs
- Google Drive
- Airtable
- Granola
- GitHub

### Priority wave 2 (Google stack expansion)

- Google Meet
- Google Chat
- Google Calendar
- Google Sheets
- Google Slides
- Google Antigravity (exploratory): verify exact product identity and API/event access before scoping.

### Priority wave 3 (Adobe ecosystem)

- Adobe XD (primary Adobe prototyping candidate)
- Adobe Express (secondary candidate for collaborative content workflows)

### Connector intake notes

- Prefer products with stable API/webhook support and event history access.
- For each candidate, define minimum viable event contract before implementation.
- Start with read-only ingestion and deterministic replay fixtures before enabling live writes or side effects.
