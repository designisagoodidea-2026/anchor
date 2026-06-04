# Layer 2 — Normalization

Per [te composition](../docs/anchor-te-composition.md) (2026-06-03), the canonical normalization pass is Translation Engine's. Anchor's Layer 2 references TE's canonical record shape and documents any Anchor-specific extensions at the bus boundary.

Schema history: per ADR-02 (2026-06-02), the original `magnitude` field was split into `kind` (scope-only enum: `polish | moderate | structural | unknown`) and `tags: string[]` (open vocabulary, v0.1 emits `"decision"`). The previous `change_kind` field was renamed to `action`. The "computed at Layer 2" rule still applies to `kind` and `tags` — connectors and the normalizer are the only layers with the source knowledge to make these calls honestly.

## Role

Reduce every event to the canonical shape so downstream layers don't care which tool it came from. With TE in place, the bulk of normalization (canonical record shape, source-agnostic fields, loss-surface manifest) is TE's. Anchor extends TE's output with the signal-tuned fields downstream layers depend on — `kind` and `tags`.

## Inputs

TE's canonical record stream, surfaced on Anchor's bus by [layer 1 connectors](layer-1-connectors.md).

## Outputs

`change_event` records on the bus, each carrying TE's canonical fields plus Anchor's computed `kind` and `tags`. Anything that can't compute `kind` emits `"unknown"` and gets filtered downstream. `tags` defaults to `[]`.

## Canonical shape

See [architecture](../docs/anchor-architecture.md) for the full schema. Reconciliation against TE's canonical record is the open work; deltas get documented as they surface.

## Reconciliation with TE's canonical record

TE's canonical record covers actor, timestamp, source, entity identity, action, snippet, and raw reference. Anchor's `change_event` covers the same plus `kind` and `tags`. Where the fields align, Anchor consumes TE's values directly. Where they diverge, the resolution path is:

- **Default — upstream contribution.** If the delta is context-agnostic (e.g., a new `entity_type` value Figma's adapter should emit), the patch lands in TE. Anchor consumes the next TE release.
- **Fallback — Anchor-side wrap at the bus boundary.** If the delta is signal-tuned to Anchor (e.g., anchored-diff metadata only Anchor uses), the bus adapter wraps TE's output. The wrap is documented; no quiet renames.

## Kind — the load-bearing computed field

Not "edited" but "polish-touched" versus "core component restructured." Per-source heuristics decide what counts as polish, moderate, structural, or (when the source genuinely can't tell) unknown. `kind` is scope of change — three polishes don't add up to a structural; they're categories, not a scale.

`kind` is Anchor-side. The heuristics are tuned to Anchor's signal layer, not generic to translation. They live in Anchor on top of TE's normalized output. If a `kind` heuristic later proves to be context-agnostic (useful to any consumer of TE), it migrates upstream to TE.

### Figma kind heuristics (draft)

Polish — color tweak, small text change, single-property edit on an existing instance. Also: unlabeled autosave versions (system-attributed).

Moderate — new frame added to a file; ~5–20 frame edits in a session; comment thread of substance; resolved comment thread.

Structural — new component published to the library; mass replacement of an existing component; component-library variable change.

(All draft. Refine during Week 2 against real Jason-generated Figma activity flowing through TE's Figma adapter.)

#### Signal-lane reality at Stage 1

Per [figma signal shape](../docs/anchor-figma-signal-shape.md): designers do not manually label versions. The Figma version stream will be dominated by `polish`-kind autosaves attributed to `Figma` (system), not to humans. The classifier's job here is honest classification of each event; the signal lane that carries the digest is comments, not version labels.

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

`tags` is Anchor-side for the same reason as `kind`: the vocabulary is tuned to Anchor's signal layer. Future tag values (Stage 2 candidates): `question`, `experiment`, `regression`, `proposal`. Adding tag values doesn't require a schema change; the field is open by design.

## Hard rule

`kind` is computed at this layer, not at translation. Downstream signals depend on it being honest. If a source can't compute `kind`, it emits `"unknown"` and gets filtered. No defaults to "moderate" to avoid honest gaps. The same locality applies to `tags` — the layer that sees the source content (TE adapter or Anchor bus adapter, depending on the heuristic) decides whether a tag fires; translation never reaches back to make that call.

## Related

- [te composition](../docs/anchor-te-composition.md) — the decision that turned the canonical pass into a TE dependency.
- [layer 1 connectors](layer-1-connectors.md) — produces input via TE adapters.
- [layer 3 container resolution](layer-3-container-resolution.md) — consumes output.
- [architecture](../docs/anchor-architecture.md) — canonical shape spec.
- [figma signal shape](../docs/anchor-figma-signal-shape.md) — load-bearing assumption about how the Figma signal-lane distribution skews at Stage 1.
- [adr 02 event kind and decision split](adr-02-event-kind-and-decision-split.md) — the rename and split this file reflects.
