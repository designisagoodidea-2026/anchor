# Layer 2 — Normalization

Stub. Week 1 outcome: schema written, kind heuristics drafted for Figma, Cowork, Slack. Fleshed out as connectors stream real fixtures.

Schema history: per ADR-02 (2026-06-02), the original `magnitude` field was split into `kind` (scope-only enum: `polish | moderate | structural | unknown`) and `tags: string[]` (open vocabulary, v0.1 emits `"decision"`). The previous `change_kind` field was renamed to `action`. The "computed at Layer 2" rule still applies to `kind` and `tags` — connectors and the normalizer are the only layers with the source knowledge to make these calls honestly.

## Role

Reduce every `change_event` to the canonical shape so downstream layers don't care which tool it came from.

## Inputs

Stream of `change_event` records from [layer 1 connectors](layer-1-connectors.md).

## Outputs

Normalized `change_event` records, each carrying a computed `kind` and `tags` array. Anything that can't compute `kind` emits `"unknown"` and gets filtered downstream. `tags` defaults to `[]`.

## Canonical shape

See [architecture](../docs/anchor-architecture.md) for the full schema.

## Kind — the load-bearing computed field

Not "edited" but "polish-touched" versus "core component restructured." Per-source heuristics decide what counts as polish, moderate, structural, or (when the connector genuinely can't tell) unknown. `kind` is scope of change — three polishes don't add up to a structural; they're categories, not a scale.

### Figma kind heuristics (draft)

Polish — color tweak, small text change, single-property edit on an existing instance. Also: unlabeled autosave versions (system-attributed).

Moderate — new frame added to a file; ~5–20 frame edits in a session; comment thread of substance; resolved comment thread.

Structural — new component published to the library; mass replacement of an existing component; component-library variable change.

(All draft. Refine during Week 2 against real Jason-generated Figma activity.)

#### Signal-lane reality at Stage 1

Per [figma signal shape](../docs/anchor-figma-signal-shape.md): designers do not manually label versions. The Figma version stream will be dominated by `polish`-kind autosaves attributed to `Figma` (system), not to humans. The classifier's job here is honest classification of each event; the *signal lane* that carries the digest is comments, not version labels.

Autosaves are activity-floor signal. Useful as a denominator ("this file is being edited"); not a numerator. Layer 4 filters them out of the digest by default and resurfaces them only as background rate.

Comments are the gold signal. Real authors, real timestamps, real text. This is the spine of the Figma digest at Stage 1.

Labeled versions are rare but valuable. When a designer does use them, treat them as a deliberate checkpoint and surface accordingly.

Stage 3 webhooks rebalance this — file-edit events become user-attributed and the autosave/label distinction matters less. Re-evaluate then.

### Cowork kind heuristics (draft)

Polish — conversation activity inside an existing skill; small artifact edit.

Moderate — new artifact created; skill run that produced a meaningful new memory entry.

Structural — new skill installed; voice-profile update; substantial memory restructure.

### Slack kind heuristics (draft)

Polish — single-message replies; reactions.

Moderate — new thread with >3 substantive replies; channel topic change.

Structural — new channel created with project-tagged name; channel-purpose change.

## Tags — open-vocabulary markers

`tags` is a string array carried alongside `kind`. The v0.1 classifiers emit one tag value: `"decision"`, when a `[decision]` token appears in source content (Figma version labels and comments, Slack messages, Cowork filenames or first lines). Tags are orthogonal to kind — a polish-scoped comment can carry a decision tag, and Layer 4 treats those as two independent facts.

Future tag values (Stage 2 candidates): `question`, `experiment`, `regression`, `proposal`. Adding tag values doesn't require a schema change; the field is open by design.

## Hard rule

`kind` is computed at this layer, not at translation. Downstream signals depend on it being honest. If a connector can't compute `kind`, it emits `"unknown"` and gets filtered. No defaults to "moderate" to avoid honest gaps. The same locality applies to `tags` — the connector that sees the source content decides whether a tag fires; translation never reaches back to make that call.

## Related

- [layer 1 connectors](layer-1-connectors.md) — produces input.
- [layer 3 container resolution](layer-3-container-resolution.md) — consumes output.
- [architecture](../docs/anchor-architecture.md) — canonical shape spec.
- [figma signal shape](../docs/anchor-figma-signal-shape.md) — load-bearing assumption about how the Figma signal-lane distribution skews at Stage 1.
- [adr 02 event kind and decision split](adr-02-event-kind-and-decision-split.md) — the rename and split this file now reflects.
