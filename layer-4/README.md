# Layer 4 — Translation

Converts container-resolved `change_event` records into the three v0.1 leadable signals: **capacity**, **health-trend**, **drift**. Every signal carries a `because` field with the events that produced it — the architecture's load-bearing honesty rule.

## v0.1 status

Shipped against [`shared/change-event.ts`](../shared/change-event.ts). Refactored 2026-06-02 per [ADR-02](../architecture/adr-02-event-kind-and-decision-split.md): events now carry `kind` (scope-only enum) and `tags: string[]` (open vocabulary, v0.1 emits `"decision"`), and `change_kind` renamed to `action`. Twenty-four fixture assertions pass — six capacity paths (surge / sustained / slack / no-signal / per-person split + because ranking with decision-tag boost + by_kind / decision_count split), five health-trend paths (no-signal / eroding / improving / weight constants / decision-tag weight without structural-share contamination), eight drift paths (compliant / drifting / no-signal / text-presence + tags_include trigger paths + matcher unit tests), two translator orchestration tests. Rule-based only at v0.1; LLM judgment is the architecturally-acknowledged gap and will land behind the same `because` contract.

## Setup status

| Step | State | Notes |
|---|---|---|
| `npm install` | **done** (2026-05-30) | tsx, typescript, @types/node, js-yaml installed. |
| `npm test` passing | **done** (2026-06-02) | 24/24 after ADR-02 refactor. |
| `npm run typecheck` clean | **done** (2026-06-02) | Strict tsc, no errors. |
| `/principles/jason.yaml` populated with starter rules | **done** (2026-05-30) | Five principles. `decisions-are-written-down` migrated to `tags_include: decision` on 2026-06-02. |
| Wired into the renderer | **done** (2026-05-30) | [`/renderer/src/digest.ts`](../renderer/src/digest.ts) calls `computeSignals()` directly. |
| LLM judgment for drift | **deferred to Stage 2** | Rule-engine v0.1 ships. LLM fills the gap when the rules can't cover a principle. Both routes will share the same `because` contract. |
| Calibration loop (per-leader threshold tuning) | **deferred to Stage 2** | Kind weights, decision-tag boost, surge factor, share-delta threshold all live in code; per-leader override comes with the calibration story. |

## Files

- [`src/types.ts`](src/types.ts) — `Signal`, `EventRef`, `Principle`, `EventMatcher`, `SnippetMatcher`. The `EventMatcher` grammar gained `kind` and `tags_include` per ADR-02.
- [`src/capacity.ts`](src/capacity.ts) — per-person × per-container event counts. `because` ranking by kind weight × recency, plus an additive boost for events carrying the `decision` tag.
- [`src/health-trend.ts`](src/health-trend.ts) — week-over-week composition (kind-weighted plus decision-tag weight) with structural-share delta. Structural share reads `kind === "structural"` only — decision-tag weight does not contaminate it.
- [`src/drift.ts`](src/drift.ts) — per-principle compliance via trigger / compliance rule engine.
- [`src/principles.ts`](src/principles.ts) — YAML loader + substring matchers used by drift. Matcher supports `kind`, `tags_include`, plus the entity_id substring family.
- [`src/translator.ts`](src/translator.ts) — `computeSignals()` orchestrator. Single call from the renderer.
- [`src/test-translator.ts`](src/test-translator.ts) — fixture-based assertions.

## Signal contracts

Each signal kind's `value` shape is in [`src/types.ts`](src/types.ts). The contracts honor the refused patterns per [`signal-spec/`](../signal-spec/):

- **Capacity** — always per-person. No aggregate "the team is overloaded" — that's a refused pattern. State is one of `surge` / `sustained` / `slack` / `no_signal`. `value.by_kind` counts scope; `value.decision_count` counts decision-tagged events independently. Default fallback baseline is 5 events/window when no rolling-median history exists.
- **Health-trend** — always differential. No absolute "Project X is healthy" — that's a refused pattern. State is one of `improving` / `plateaued` / `eroding` / `no_signal`. Trend is computed against the immediately prior window; `because` surfaces the most-important events that drove the read.
- **Drift** — always per-principle, per-container. No aggregate drift score — that's a refused pattern. State is one of `compliant` / `drifting` / `no_signal`. `no_signal` returns when zero trigger events fired (the system doesn't fake compliance against an empty check).

## Principle rule engine

v0.1 supports two check kinds in [`/principles/<leader>.yaml`](../principles/jason.yaml):

`trigger_then_compliance` — a trigger event must match (substring rules over `source`, `kind`, `tags_include`, `entity_id`); within `window_hours`, a compliance event in the same container must also match. Missing compliance produces drift.

`text_presence` — a trigger event must match; the trigger's own `snippet` (when `window_hours: 0`) or another event's snippet (when `> 0`) must contain a compliance phrase.

The matcher grammar is deliberately small: AND across fields, OR within `_any_of` arrays. Substring, case-sensitive on `entity_id`, case-insensitive on `snippet`. `tags_include` matches when the event's `tags` array contains the literal value. When the rules can't express a principle, LLM judgment fills the gap; same `because` contract on the way out.

## Develop

```bash
cd "layer-4"
npm test            # 24 fixture assertions, no network, no API tokens
npm run typecheck   # strict tsc against the library
npm run replay      # deterministic golden replay check
npm run check:strict # strict-mode contract check over replay fixture
```

## Rigor controls (2026-06-21)

Layer 4 now mirrors the ingest hardening model with five concrete controls:

1. Contract checks on translation inputs and outputs (`src/contracts.ts`).
2. Deterministic replay fixture and script (`fixtures/golden/`, `scripts/replay-layer4.ts`).
3. Structured diagnostics emitted by translator (`src/diagnostics.ts`).
4. Policy-driven strict/permissive behavior (`src/policy.ts`, `policy/layer4-policy.json`).
5. Governance gate execution via repository translation check (`scripts/check-translation-governance.mjs`).

Default mode is permissive. Strict mode blocks configured critical contract violations.

## Related

- [`/architecture/layer-4-translation.md`](../architecture/layer-4-translation.md) — the spec this layer implements.
- [`/architecture/adr-02-event-kind-and-decision-split.md`](../architecture/adr-02-event-kind-and-decision-split.md) — the rename and split that shaped the current types and matcher grammar.
- [`/signal-spec/capacity.md`](../signal-spec/capacity.md), [`/signal-spec/health-trend.md`](../signal-spec/health-trend.md), [`/signal-spec/drift.md`](../signal-spec/drift.md) — per-signal contracts and refused patterns.
- [`/principles/jason.yaml`](../principles/jason.yaml) — Jason's leader-defined principles.
- [`/layer-3/README.md`](../layer-3/README.md) — produces the container_id Layer 4 reads.
- [`/shared/change-event.ts`](../shared/change-event.ts) — canonical event shape.
- [`/renderer/src/digest.ts`](../renderer/src/digest.ts) — calls `computeSignals()` directly.
