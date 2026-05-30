# Layer 2 — Normalization

Stub. Week 1 outcome: schema written, magnitude heuristics drafted for Figma, Cowork, Slack. Fleshed out as connectors stream real fixtures.

## Role

Reduce every `change_event` to the canonical shape so downstream layers don't care which tool it came from.

## Inputs

Stream of `change_event` records from [layer 1 connectors](layer-1-connectors.md).

## Outputs

Normalized `change_event` records, each carrying a computed `magnitude`. Anything that can't compute magnitude emits `"unknown"` and gets filtered.

## Canonical shape

See [architecture](../docs/anchor-architecture.md) for the full schema.

## Magnitude — the load-bearing computed field

Not "edited" but "polish-touched" versus "core component restructured." Per-source heuristics decide what counts as low, medium, high, or structural.

### Figma magnitude heuristics (draft)

- **polish.** Color tweak, small text change, single-property edit on an existing instance. Also: unlabeled autosave versions (system-attributed).
- **moderate.** New frame added to a file; ~5–20 frame edits in a session; comment thread of substance; resolved comment thread.
- **structural.** New component published to the library; mass replacement of an existing component; component-library variable change.
- **decision.** A frame with a `[decision]` tag in its name; a comment containing `[decision]`; or a comment thread marked resolved on a trade-off.

(All draft. Refine during Week 2 against real Jason-generated Figma activity.)

#### Signal-lane reality at Stage 1

Per [figma signal shape](../docs/anchor-figma-signal-shape.md): designers do not manually label versions. The Figma version stream will be dominated by `polish`-magnitude autosaves attributed to `Figma` (system), not to humans. The classifier's job here is honest classification of each event; the *signal lane* that carries the digest is comments, not version labels.

- **Autosaves** = activity-floor signal. Useful as a denominator ("this file is being edited"); not a numerator. Layer 4 should filter them out of the digest by default and resurface them only as background rate.
- **Comments** = gold signal. Real authors, real timestamps, real text. This is the spine of the Figma digest at Stage 1.
- **Labeled versions** = rare but valuable. When a designer does use them, treat them as a deliberate checkpoint and surface accordingly.
- **Stage 3 webhooks** rebalance this — file-edit events become user-attributed and the autosave/label distinction matters less. Re-evaluate then.

### Cowork magnitude heuristics (draft)

- **polish.** Conversation activity inside an existing skill; small artifact edit.
- **moderate.** New artifact created; skill run that produced a meaningful new memory entry.
- **structural.** New skill installed; voice-profile update; substantial memory restructure.
- **decision.** Decision-tagged artifact or memory entry.

### Slack magnitude heuristics (draft)

- **polish.** Single-message replies; reactions.
- **moderate.** New thread with >3 substantive replies; channel topic change.
- **structural.** New channel created with project-tagged name; channel-purpose change.
- **decision.** Thread containing a posted decision artifact (Coda link, attached PDF with `[decision]` in title, or specific `[DECISION]` tag).

## Hard rule

`magnitude` is computed at this layer, not at translation. Downstream signals depend on it being honest. If a connector can't compute magnitude, it emits `"unknown"` and gets filtered. No defaults to "moderate" to avoid honest gaps.

## Related

- [layer 1 connectors](layer-1-connectors.md) — produces input.
- [layer 3 container resolution](layer-3-container-resolution.md) — consumes output.
- [architecture](../docs/anchor-architecture.md) — canonical shape spec.
- [figma signal shape](../docs/anchor-figma-signal-shape.md) — load-bearing assumption about how the Figma signal-lane distribution skews at Stage 1.
