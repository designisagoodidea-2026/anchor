# ADR 02 — Event kind rename and decision split

**Status:** decided 2026-06-02. Migration tracked in the task list for this session; layer-by-layer changes land as the refactor proceeds.

**Decision:** rename `magnitude` to `kind`, rename `change_kind` to `action`, and pull `decision` out of the scope enum into a separate `tags` field.

## Context

The canonical `change_event` shape ([`shared/change-event.ts`](../shared/change-event.ts)) carries a field named `magnitude` with five values: `polish | moderate | structural | decision | unknown`. The field is computed at Layer 2 (normalization) per the architecture's load-bearing rule, and it's consumed by Layer 4 (translation) to weight events for capacity, compute structural-share for health-trend, and trigger drift rules.

Two problems with the current shape, surfaced in conversation 2026-06-02.

**The name implies scale.** "Magnitude" reads as size or effort, which suggests a number on a linear axis. But the field is a category — three polishes don't add up to a moderate, a structural change isn't "twice as big" as a moderate one. The name leaks the wrong mental model into every consumer, and every new reader of the architecture has to be told "it's not actually a scale."

**The field is doing two jobs.** Three of its values (`polish`, `moderate`, `structural`) describe scope of change. One value (`decision`) describes kind of change — it's orthogonal to scope. A `[decision]`-tagged polish edit and a `[decision]`-tagged structural change are both scoped differently AND both marked as decisions, but the classifier collapses them into the single `decision` bucket by "picking the highest applicable." The scope information disappears from the bus, and downstream signals can't recover it.

The consequences of the collapse are not theoretical:

- **Health-trend.** `structuralShare(events)` in [`layer-4/src/health-trend.ts`](../layer-4/src/health-trend.ts) counts `structural` + `decision` events as the "heavy" share. A `[decision]`-tagged polish edit currently boosts structural-share — which is wrong. The signal claims a project is shipping structural work when what it's actually shipping is a labeled polish.
- **Capacity.** The `by_magnitude` count on `CapacityValue` in [`layer-4/src/types.ts`](../layer-4/src/types.ts) shows a person's load by bin. A person who shipped three `[decision]`-tagged polish edits and one structural change reads as 1 structural + 3 decision in the bin distribution. The leader's read can't tell whether the work was lightweight or heavyweight.
- **Drift.** The principles engine in [`layer-4/src/drift.ts`](../layer-4/src/drift.ts) matches on `magnitude: decision` or `magnitude: structural` as a trigger. That works today, but only because the classifier picks the highest applicable — a polish edit with a decision tag fires the decision trigger but never the polish reality. If the leader wanted a rule that fires on "structural work that wasn't called out as a decision," there's no way to express it.

Naming and shape are entangled here. Renaming the field without splitting it leaves the two-jobs problem in place. Splitting without renaming leaves the wrong mental model in place. Both moves are needed, and both are mechanical in a system this small.

## Decision

Three changes to the canonical shape, applied together as one migration.

### 1. Rename `magnitude` → `kind`

The field becomes `event.kind` with values `polish | moderate | structural | unknown`. The `decision` value is removed from this enum (see change 3). `kind` reads naturally in code (`event.kind === "polish"`) and in prose ("kind of change"). It doesn't carry the linear-scale baggage that "magnitude" carries.

Alternatives considered and set aside:

- `class` — accurate but carries OOP baggage in TypeScript code, and `event.class` reads awkwardly.
- `category` — accurate but flat, and over-formal for the voice register the project writes in.
- `tier`, `band`, `grade` — all imply hierarchy or ranking, which is exactly the misread the rename is trying to fix.
- `weight`, `significance` — both still imply a measurement.

`kind` is the plain word.

### 2. Rename `change_kind` → `action`

`change_kind` was a verb the whole time. Its values are `create | edit | delete | comment | reply | resolve | reaction | review | approve | mention` — actions taken on the source entity. Renaming to `action` frees `kind` for change 1 and makes the schema honest about what each field carries: `event.action` is what happened, `event.kind` is the scope of what happened.

### 3. Pull `decision` out as a tag

The canonical shape gains a `tags: string[]` field. The `[decision]` token across Figma comments, Slack messages, and cowork files now maps to `tags: ["decision"]` instead of folding into `magnitude`. Scope-of-change and decision-ness become independent. A `[decision]`-tagged polish edit emits as `kind: "polish", tags: ["decision"]`, and downstream signals see both facts honestly.

`tags` is a deliberately open shape. It starts with `decision` as the only tag the v0.1 classifiers emit. Stage 2 may add more (`question`, `experiment`, `regression`, etc.) without another schema change.

### Canonical shape after migration

```typescript
export type EventKind = "polish" | "moderate" | "structural" | "unknown";

export interface ChangeEvent {
  actor: Actor;
  timestamp: string;
  source: Source;
  entity_id: string;
  entity_type: string;
  parent_id: string | null;
  action: string;        // was change_kind
  kind: EventKind;       // was magnitude (with "decision" removed)
  tags: string[];        // new — open vocabulary, v0.1 emits "decision"
  snippet: string;
  raw_ref: string;
  container_id?: string | null;
}
```

## Downstream consequences

Per layer, what the migration actually touches.

**Layer 1 — connectors.** Each classifier writes `kind` (scope) and `tags` (decision when applicable) instead of folding the decision tag into a single `magnitude`. The Figma classifier's `DECISION_TAG` regex no longer returns `"decision"` from `classifyVersionMagnitude` — instead, the caller checks the regex and emits `tags: ["decision"]` independently. Same pattern in the Slack message classifier and the cowork `hasDecisionTag` function. `change_kind` rename is mechanical.

**Layer 2 — normalization.** [`architecture/layer-2-normalization.md`](layer-2-normalization.md) gets a new heuristics table for `kind` (the three real values) and a short section on `tags` (what counts as a `decision` tag per source). The "unknown → filter" rule still applies to `kind`. `tags` defaults to `[]` when no tags apply.

**Layer 3 — container resolution.** The resolver doesn't read either field, so the logic is untouched. Fixtures and tests get a mechanical rename pass.

**Layer 4 — translation.** Three real changes:

- *Capacity* — `by_magnitude` becomes `by_kind` over the three-value enum. `RECENCY_MAG_WEIGHT` becomes `KIND_WEIGHT` over the three values. Events with `tags: ["decision"]` get an additive promotion in the ranker (decision events sort to the top of `because` regardless of scope).
- *Health-trend* — `MAGNITUDE_WEIGHTS` becomes `KIND_WEIGHT` over `polish | moderate | structural | unknown`. `structuralShare` reads only `kind === "structural"` (no longer contaminated by decision-tagged polishes). A separate `decisionShare` computation lands alongside if it earns its keep; not required at v0.1.
- *Drift* — the `EventMatcher` gets a new field, `tags_include?: string`, which matches when the event's `tags` array contains the value. The `magnitude` field on `EventMatcher` becomes `kind`. Rules in `principles/jason.yaml` that currently use `magnitude: decision` migrate to `tags_include: decision`.

**Layer 5 — diff and memory.** Not yet built. The migration lands before Layer 5 starts so the state schema reads against the new shape directly.

**Layer 6 — renderer.** [`renderer/src/digest.ts`](../renderer/src/digest.ts) prints `ref.magnitude` in several `because` lines. Becomes `ref.kind`. Where the renderer wants to surface decision-ness, it reads `ref.tags?.includes("decision")` and renders a `[decision]` marker after the entity label. The voice-profile vocabulary check is unaffected — magnitude was never in the vocabulary.

**Principles file.** [`principles/jason.yaml`](../principles/jason.yaml) has two principles that match on `magnitude`. `decisions-are-written-down` migrates to `tags_include: decision`. `design-system-changes-surface-in-writing` migrates to `kind: structural`. The text of the principles doesn't change.

## Trade-offs

For the migration:

- Forces the schema to match the design. The two-jobs problem disappears and the bus contract honestly carries both facts.
- Cheap now, expensive later. The system has three connectors and three signals. Three more connectors and one Stage-2 pilot from now, the same migration touches more code and a downstream leader's calibration.
- Makes future tag-like extensions (`experiment`, `regression`) trivial — they're new tag values, not schema changes.

Against:

- One day of mostly-mechanical refactor across about 40 files. Tests and fixtures are the bulk of it.
- Breaks the snapshot of the README's "Layer 1 shipped" claim — the shape it shipped against is no longer the canonical shape. The README's status block needs to acknowledge the migration.
- A public commit history that already has `magnitude` in it. Future readers of the early commits will see a different shape. ADR 02 is the answer to "why does this look different now."

## Migration plan

The migration is one branch, not a series. Five steps in order:

1. **Canonical shape.** Update [`shared/change-event.ts`](../shared/change-event.ts) and [`shared/change-event.mjs`](../shared/change-event.mjs). Export the new `EventKind` type and a `KINDS` constant. Remove `Magnitude` and `MAGNITUDES`. Keep the `container_id` semantics unchanged.
2. **Connectors.** Update each connector's classifier and tests. Figma first (the most complex classifier), then Slack, then Cowork. After all three: `npm test` in each connector passes.
3. **Layer 3.** Mechanical rename in fixtures and test-resolver. 15/15 tests pass.
4. **Layer 4.** The substantive changes are here. Types update. Capacity, health-trend, drift updated. Principle matcher grammar gains `kind` and `tags_include`. Principles YAML migrated. 18/18 tests pass after fixture updates.
5. **Renderer + docs.** Renderer updated; smoke test passes. Architecture docs, signal specs, memory files, README — all updated. MEMORY.md indexes ADR 02.

The verification step at the end greps the project for any remaining live reference to `magnitude` or `change_kind`. Anything found should either be a historical mention in an ADR (this one), a memory file describing an older state, or a node_modules artifact. No live code or live docs.

## What this ADR is not changing

Not changing:

- The "magnitude lives in normalization" architectural principle. The renamed field still lives where it always lived. The decision that source-specific classification belongs to the layer that knows the source is unchanged; this ADR refines the *expression* of that classification, not its *location*.
- The "unknown → filter" rule. `kind: "unknown"` still drops the event downstream.
- The `because` contract. Layer 4 still attaches evidence to every signal.
- The container-resolution layer's input. `container_id` semantics and the resolver algorithm are untouched.
- The voice profile schema or the rendering contract. Voice and rendering operate over signals, not over raw events.

## Related

- [layer 2 normalization](layer-2-normalization.md) — where `kind` is computed.
- [layer 4 translation](layer-4-translation.md) — primary consumer; the place where the two-jobs problem actually hurts.
- [anchor-architecture](../docs/anchor-architecture.md) — canonical shape spec; this ADR updates it.
- [open decisions](../docs/anchor-open-decisions.md) — the deferred items this migration leaves alone.
