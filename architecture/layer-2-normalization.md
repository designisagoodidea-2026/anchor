# Layer 2 — Normalization

Stub. Week 1 outcome: schema written, magnitude heuristics drafted for Figma, Cowork, Slack. Fleshed out as connectors stream real fixtures.

## Role

Reduce every `change_event` to the canonical shape so downstream layers don't care which tool it came from.

## Inputs

Stream of `change_event` records from [[layer-1-connectors]].

## Outputs

Normalized `change_event` records, each carrying a computed `magnitude`. Anything that can't compute magnitude emits `"unknown"` and gets filtered.

## Canonical shape

See [[../memory/anchor-architecture]] for the full schema.

## Magnitude — the load-bearing computed field

Not "edited" but "polish-touched" versus "core component restructured." Per-source heuristics decide what counts as low, medium, high, or structural.

### Figma magnitude heuristics (draft)

- **polish.** Color tweak, small text change, single-property edit on an existing instance.
- **moderate.** New frame added to a file; ~5–20 frame edits in a session; comment thread of substance.
- **structural.** New component published to the library; mass replacement of an existing component; component-library variable change.
- **decision.** A frame with a `[decision]` tag in its name, or a comment thread marked resolved on a trade-off.

(All draft. Refine during Week 2 against real Jason-generated Figma activity.)

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

- [[layer-1-connectors]] — produces input.
- [[layer-3-container-resolution]] — consumes output.
- [[../memory/anchor-architecture]] — canonical shape spec.
