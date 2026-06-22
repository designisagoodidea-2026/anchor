# Anchor adversarial council runbook

## Files

- `anchor-advocate.md`
- `goldenflow-advocate.md`
- `contentrain-advocate.md`
- `council-moderator.md`
- roadmap: `../architecture/adversarial-council-roadmap.md`

## How to run one council session

1. Define one proposal only.
   - Example: "Add transform manifest and strict/permissive mode to ingest pipeline."

2. Request three advocate memos in parallel.
   - Anchor advocate: risks and guardrails.
   - GoldenFlow advocate: integration slice and metrics.
   - Contentrain advocate: governance controls and process cost.

3. Hand all three memos to the moderator.
   - Moderator applies weighted decision policy.
   - Output must include: decision, boundaries, acceptance tests, rollback conditions, phase assignment.

4. Record the decision.
   - Store in a decision log entry in architecture docs or ADR stream.

## Session output contract

Each session should end with:

- Decision: approve, approve-with-guardrails, defer, reject.
- Scope: explicit in/out boundaries.
- Tests: minimum acceptance tests before merge.
- Safety: feature flags and rollback trigger.
- Roadmap placement: phase number.

## Suggested prompt skeleton

Use the same proposal text for all advocates:

"Evaluate this proposal for Anchor: <proposal>. Provide a concise memo following your role rules, including recommendation, risks, required guardrails, and measurable success criteria."

Then to moderator:

"Given these three memos, run the council moderation policy and return one final decision package with weighted scoring and phase assignment."
