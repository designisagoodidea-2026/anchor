# Layer 5 — Diff and memory

Stub. Week 1 outcome: state-per-leader schema written. Week 3: diff layer running against prior reads.

## Role

Make the report continuous. Each new digest anchors against the prior digest for this leader.

## Inputs

Per-container, per-signal records from [layer 4 translation](layer-4-translation.md). Prior-digest state from the leader's state store.

## Outputs

Diff records the rendering layer consumes:

```
{
  container_id:     stable id
  signal_kind:      "capacity" | "health_trend" | "drift" | ...
  prior_value:      what the leader saw last time
  current_value:    what's true now
  delta:            "no_change" | "changed" | "newly_appeared" | "resolved"
  delta_narrative:  one-line description of what moved (or "no change")
  prior_flags:      what the leader flagged on the prior digest
}
```

## State per leader

Stored in Coda or Airtable (dual adapter):

- What was the prior read? (Per signal, per container.)
- What did the leader flag? (Acknowledge, dismiss, watch.)
- What did the leader ask to keep watching?
- What has materially changed since the prior read?

## Output shape (per signal in the new digest)

The renderer composes from the diff record:

> *"Two weeks ago you flagged AI Search as health-eroding because the engineering partner was overloaded. This week the engineering load is back to baseline, but the trade-off doc has been edited four times without a decision — decision-rework signal climbing. Worth asking the team where the decision is stuck."*

## Hard rule

The leader never reads the same digest twice. If nothing has changed on a signal since the last read, the system says "no change" explicitly and moves on. Stillness is a signal too. Faking newness is worse than reporting silence.

Concretely: a signal with `delta == "no_change"` renders as a single line ("AI Search health-trend: no change since Friday"), not as a multi-paragraph re-explanation.

## What "anchored" means

Anchoring is the load-bearing differentiator (per [purpose](../docs/anchor-purpose.md)). Three properties:

1. **Continuity.** Each digest references the prior digest's framing where useful. The leader doesn't relearn yesterday's situation.
2. **Honesty about change.** A signal that hasn't moved gets named as such, not dressed up as new.
3. **Flag carryover.** If the leader flagged X as "watch" on the prior digest, the new digest opens by reporting on X — even if X is unchanged.

## Calibration loop (deferred to Stage 2)

The leader marks digest items right / wrong / noise; the system adjusts magnitude thresholds and signal weights per-leader. v0.1 is one-way (system → leader). See [open decisions](../docs/anchor-open-decisions.md).

## Related

- [layer 4 translation](layer-4-translation.md) — produces input.
- [layer 6 voice rendering](layer-6-voice-rendering.md) — consumes output.
- [architecture](../docs/anchor-architecture.md) — full spec.
- [purpose](../docs/anchor-purpose.md) — anchoring as differentiator.
- [open decisions](../docs/anchor-open-decisions.md) — calibration deferral.
