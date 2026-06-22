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

## Ranked connector order (impact vs effort)

Scoring scale:

- Impact: 1 (low) to 5 (high)
- Effort: 1 (low) to 5 (high)
- Priority score = Impact / Effort

| Rank | Product | Impact | Effort | Priority score | Why now |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | Jira | 5 | 2 | 2.50 | Core planning signal for delivery risk, ownership, and throughput; high structure and established API patterns. |
| 2 | GitHub | 5 | 2 | 2.50 | Strong downstream execution signal and issue/PR metadata; high value for decision-to-ship traceability. |
| 3 | Linear | 5 | 3 | 1.67 | High-quality issue lifecycle data in design-product teams; excellent signal fidelity for priority drift. |
| 4 | Notion | 4 | 3 | 1.33 | Decision memory and planning artifacts; broad adoption and meaningful docs/knowledge signal. |
| 5 | Microsoft Teams | 4 | 3 | 1.33 | Communication and coordination signal where Slack is not primary; useful for dependency health. |
| 6 | Confluence | 4 | 3 | 1.33 | Architecture and decision-document history; high explainability value in larger orgs. |
| 7 | Google Docs | 4 | 3 | 1.33 | Decision-content and collaboration trend data; complements ticket systems with rationale signal. |
| 8 | Google Drive | 3 | 3 | 1.00 | Asset movement and doc ownership context; useful but less semantically rich than docs/issues. |
| 9 | Zoom | 3 | 4 | 0.75 | Meeting-load and cadence signal; moderate value, but event semantics are weaker than work-item tools. |
| 10 | Airtable | 3 | 4 | 0.75 | Valuable in ops-heavy teams, but schema variability increases normalization effort. |
| 11 | UserTesting | 3 | 4 | 0.75 | Research signal quality can be high, but APIs and event granularity vary by workflow setup. |
| 12 | Claude Design | 3 | 4 | 0.75 | Potentially high design-intent signal, but integration surface and canonical event shape are still emerging. |
| 13 | Granola | 2 | 4 | 0.50 | Useful note-derived decision memory; integration/event access maturity uncertain for deterministic ingest. |
| 14 | Adobe XD | 2 | 4 | 0.50 | Relevant for some teams, but market adoption is lower and event depth is often limited. |
| 15 | Adobe Express | 2 | 4 | 0.50 | Secondary content workflow signal with lower direct value for product/design operations status. |
| 16 | Google Meet | 2 | 3 | 0.67 | Similar role to Zoom/Teams meetings; useful but usually lower impact than work-item systems. |
| 17 | Google Chat | 2 | 3 | 0.67 | Helpful where Teams/Slack absent; generally lower signal density for delivery metrics. |
| 18 | Google Calendar | 2 | 3 | 0.67 | Useful for capacity context and meeting load, but weak direct product-state signal. |
| 19 | Google Sheets | 2 | 3 | 0.67 | Common in ops reporting, but structure inconsistency increases semantic extraction effort. |
| 20 | Google Slides | 1 | 3 | 0.33 | Primarily presentation artifacts; low direct operational signal for continuous status sensing. |
| 21 | Google Antigravity (exploratory) | 1 | 5 | 0.20 | Product identity/API and event model still unverified; hold until interface is concrete. |

## How impact and effort estimates are produced

We use a two-pass estimate so rankings stay practical but auditable.

### Pass 1: fast prior estimate (planning)

Impact components (weighted):

- 35%: signal density (how many meaningful events/week).
- 30%: signal relevance (capacity, health-trend, drift, decision rework).
- 20%: cross-team coverage (design, product, engineering, leadership overlap).
- 15%: actionability (can the resulting signal drive concrete leader action).

Effort components (weighted):

- 30%: API/auth complexity (OAuth scopes, service accounts, token lifecycle).
- 25%: event model cleanliness (structured payloads vs free text).
- 20%: normalization burden (mapping into canonical `change_event` with low loss).
- 15%: operational load (rate limits, retries, webhooks, backfill mechanics).
- 10%: governance/test overhead (fixtures, replay determinism, policy checks).

### Pass 2: empirical recalibration (after connector spike)

Each connector gets a short spike that measures:

- Real event throughput from one representative workspace.
- Parse success rate and unresolved-event rate at ingest boundary.
- Replay determinism in permissive and strict modes.
- Time-to-first-useful-signal (days) and maintenance burden (ops incidents/week).

Then we re-score impact and effort and update rank before full implementation.

### Confidence handling

- High confidence: mature API, known event model, prior fixture success.
- Medium confidence: partial docs/access known, moderate unknowns.
- Low confidence: product/API unclear or highly variable data shape.

Low-confidence items can stay on roadmap but should not outrank medium/high-confidence items unless expected impact is materially higher.
