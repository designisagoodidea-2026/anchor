# Layer 4 — Translation (activity → leadable signal)

Shipped as of 2026-05-30. The library lives at [`/layer-4/`](../layer-4/README.md): pure `computeSignals(events, containers, principles, window)` orchestrator over `capacity`, `health_trend`, and `drift`. Eighteen fixture assertions cover all three signals' main paths (surge / sustained / slack, improving / plateaued / eroding, compliant / drifting / no_signal) plus the refused-pattern enforcement. Rule-based only at v0.1; LLM judgment is the architecturally-acknowledged gap that ships behind the same `because` contract when it lands.

## Role

Convert resolved activity into signals a leader can act on.

## Inputs

Container-tagged `change_event` records from [layer 3 container resolution](layer-3-container-resolution.md). Leader-defined principles from the voice profile and from the principles file.

## Outputs

Per-container, per-signal records:

```
{
  container_id:     stable id
  signal_kind:      "capacity" | "health_trend" | "drift" | ...
  value:            structured value (e.g., {load: "high"}, {trend: "eroding"})
  because:          [list of event references that produced this value]
  computed_at:      ISO 8601
}
```

## v0.1 signal set

See [capacity](../signal-spec/capacity.md), [health trend](../signal-spec/health-trend.md), [drift](../signal-spec/drift.md). (Files to be created.)

- **Capacity.** Per person, per container. Surge / sustained-load / slack.
- **Health-trend.** Per container, week over week. Improving / plateaued / eroding.
- **Drift against leader-defined principles.** Per container, per principle. Compliant / drifting / violating.

## Out of scope for v0.1 (Stage 2)

- Cross-BU coordination cost.
- Decision rework.
- Schedule reality.

Each needs richer container data and longer signal history than two to three weeks gives.

## Construction — rules plus LLM judgment

- **Rules.** Leader-defined principles and source-specific heuristics. Cheap, deterministic, auditable. First-pass on every signal.
- **LLM.** Fills the gaps for cases the rules don't cover. Judgment shows its work via the `because` field.

## Hard rule

Every signal carries a `because` field — the evidence that produced it. No black-box surfacing. If the leader can't see why the system says "AI Search is health-eroding," the signal doesn't render.

This is the architecture's load-bearing honesty rule. It binds across rules-based and LLM-based judgment alike. An LLM judgment without a `because` is no different from a black-box dashboard.

## Principles file (leader-defined)

Per leader: 3-5 principles registered as text rules. Examples:

- *"Every component shipped to the design system must have a contribution doc."*
- *"Every research-backed roadmap item must link the underlying customer evidence."*

The translation layer checks each principle against each container's activity. A principle that hasn't been checked against any event in the digest window renders as "no signal" (not "compliant" — the system doesn't fake an answer).

## Related

- [layer 3 container resolution](layer-3-container-resolution.md) — produces input.
- [layer 5 diff memory](layer-5-diff-memory.md) — consumes output.
- [architecture](../docs/anchor-architecture.md) — full spec.
- [poc scope](../docs/anchor-poc-scope.md) — v0.1 signal set.
- [capacity](../signal-spec/capacity.md) — capacity spec.
- [health trend](../signal-spec/health-trend.md) — health-trend spec.
- [drift](../signal-spec/drift.md) — drift spec.
- [`/layer-4/README.md`](../layer-4/README.md) — implementation, setup status, and rule-engine reference.
- [`/principles/jason.yaml`](../principles/jason.yaml) — Jason's leader-defined principles (the input for drift).
