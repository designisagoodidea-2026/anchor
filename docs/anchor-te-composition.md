---
name: anchor-te-composition
description: Anchor imports Translation Engine as a library for Layers 1–2 rather than reimplementing them. Build focus stays on Layers 3–6 — container resolution, signal translation, diff/memory, voice rendering.
publish: true
metadata:
  type: project
---

## Date

2026-06-03

## Decision context

Considered merging Anchor and Translation Engine (TE) into a single project. Rejected the merger in favor of composition. This note brings Anchor into alignment.

## What changed

Anchor imports Translation Engine as a library rather than reimplementing Layers 1–2 (source connectors and normalization). TE already does what those two layers do: ingest from heterogeneous sources, normalize to a canonical shape, name the loss surface in a manifest. Reimplementing inside Anchor would duplicate doctrine work and create two places to maintain the same adapters.

TE is the substrate. Anchor's value-add starts at Layer 3 and goes up.

## What this means for Anchor's architecture

**Layers 1–2 (connectors + normalization)** become "TE + thin Anchor-specific adapters."

- Anchor depends on the TE package.
- The `change_event` shape Anchor defined gets reconciled against TE's canonical record shape. Where they diverge, Anchor either contributes the delta upstream to TE or wraps TE's output at the bus boundary. Default is upstream contribution; wrapping is the fallback when the delta is Anchor-specific (e.g. anchored-diff metadata).
- When Anchor needs a new connector (Figma, Cowork, Slack, future Coda or GitHub or other), the connector is built inside TE and Anchor imports it. Anchor doesn't fork.
- Per-source `kind` heuristics live in TE if they're context-agnostic, in Anchor if they're tuned to Anchor's signal layer.

**Layers 3–6 (container resolution, signal translation, diff/memory, voice rendering)** are unchanged. These are Anchor's load-bearing differentiators. Composition sharpens the differentiation argument: TE does the translation pass; Anchor does the leader's report.

## What this means for the sprint plan

Week 1 (foundation) and Week 2 (connectors + signals) get light revision. The connector-build work scoped to Week 2 becomes "consume TE; build the three connectors as TE adapters." Faster than reimplementing — likely shortens Week 2 by 2–3 days, which can either pull Week 3 (anchored narrative + demo) forward or buy slack for the voice layer.

Specific edits to make:

- `architecture/layer-1-connectors.md` — replace the from-scratch connector spec with a "Anchor depends on TE; here's how the bus interfaces with TE's output" section.
- `architecture/layer-2-normalization.md` — reference TE's canonical record shape; document any Anchor-specific extensions at the bus boundary.
- `memory/anchor-sprints-week-1-3.md` — adjust Week 2 outcomes; pull voice-rendering work earlier if the connector shortcut frees time.
- `package.json` (when initialized) — pin TE as a dependency. Semver discipline: pin to a minor version, upgrade deliberately.
- `MEMORY.md` — add a pointer entry for the composition relationship, mirroring this file's slug.

## What does NOT change

- **Air-gap rules.** All exclusions in [airgap rules](anchor-airgap-rules.md) still hold. TE is a public, attributed library; importing it doesn't cross the air-gap because TE doesn't carry private memory traces. Anchor's prospect-facing artifacts remain clean.
- **Attribution posture.** Anchor stays air-gapped from its parent personal-workstation context; TE stays publicly attributed to Jason. The two postures coexist because composition keeps the artifacts separate at the publish boundary.
- **Voice profile, signal layer, differentiation argument.** Anchor's defensibility is the combination of MCP bus + leader-defined principles + voice profile + anchored diff. The translation pass is one ingredient, not the headline. Composition makes this more legible, not less.
- **Doctrine.** Both projects continue to inherit from the translation doctrine via the parent workstation that holds it.
- **Six-layer architecture.** Layers 1–6 still describe Anchor end-to-end. The substrate for 1–2 is sourced rather than built.

## Cross-project memory rules

- Status updates that affect both projects (e.g. "TE shipped a new adapter Anchor needs") get written into both project memories, deliberately, with a note that the write is a cross-project status update.
- Doctrine or pattern memory continues to live in the parent workstation; both projects reference it.
- Don't infer Anchor architecture decisions from TE's roadmap, or vice versa. Each project's decisions stay sovereign; the composition is the contract, not a coupling.

## Why this is the right move

Merging would have collapsed two distinct portfolio artifacts into one, sacrificed TE's already-shipped public state, and forced an attribution conflict. Composition preserves both artifacts, sharpens Anchor's differentiation, shortens Anchor's build by removing Layer 1–2 reimplementation, and produces a stronger portfolio story: shipped the doctrine as a library, built a leader-facing product on top of it.

## Next action

A new open decision is filed in [open decisions](anchor-open-decisions.md): TE composition — confirm package import path, version pin, and upstream-contribution policy. Resolve before Week 1 close. Coordinate the answer with the parallel decision being surfaced on the TE side.

## Related

- [architecture](anchor-architecture.md) — the six layers; the substrate for 1–2 is now sourced from TE.
- [layer 1 connectors](../architecture/layer-1-connectors.md) — updated to reflect TE composition.
- [layer 2 normalization](../architecture/layer-2-normalization.md) — updated to reference TE's canonical record.
- [sprints week 1–3](anchor-sprints-week-1-3.md) — Week 2 outcomes adjusted for the TE shortcut.
- [open decisions](anchor-open-decisions.md) — the new TE-composition decision is filed here.
- [airgap rules](anchor-airgap-rules.md) — unchanged by composition; called out here for the record.
