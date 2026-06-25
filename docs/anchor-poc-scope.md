---
name: anchor-poc-scope
description: v0.1 build scope — three connectors, three signals, one voice profile, declared containers, two output channels. Plus hard constraints.
publish: true
metadata:
  type: project
---

## Why this exists

v0.1 is shippable in two to three weeks of focused build. The point is to prove the architecture end-to-end against real signal flowing through a real bus into a real anchored narrative — not to build feature coverage. Anything not needed to demonstrate the architecture stays out.

## Sources (three connectors)

1. **Figma** — file activity, comment threads, component-library changes.
2. **Cowork** — skill runs, artifact updates, conversation activity per project.
3. **Slack** — thread density, channel-tagged activity (workspace-restricted, OAuth-scoped).

Three is the minimum to prove the bus plus the normalization layer. Adding a fourth tool to v1 adds risk without proving anything new.

## Containers (declared)

Per [adr 04](../architecture/adr-04-jira-pilot-1-coda-removed.md): Jira projects (and / or epics) for pilot #1; Airtable mapping table retained for fixture / self-hosted fallback. Coda removed. The leader picks which Jira projects Anchor watches — the Jira hierarchy IS the leader's declared bodies of work, no separate mapping setup needed.

Asana follows for pilot #2 (cross-functional default). Embedding-based inference deferred to Stage 3.

## Signals (three)

1. **Capacity** — per person, per project.
2. **Health-trend** — per project, week over week.
3. **Drift against leader-defined principles** — the leader registers 3-5 principles; the system checks deltas.

Cross-BU coordination cost, schedule reality, and decision rework are all out of scope for v0.1. They each need richer container data and longer signal history than two to three weeks gives.

## Voice profile (one)

Jason's. Drawn from [feedback disliked words](anchor-feedback-disliked-words.md), [feedback curious not credentialing](anchor-feedback-curious-not-credentialing.md), [feedback no company attribution](anchor-feedback-no-company-attribution.md), [feedback paragraph spacing](anchor-feedback-paragraph-spacing.md), and the `jason-writing-style` skill. The profile refuses the banned vocabulary out of the box.

The profile lives in this folder as [voice profile jason](anchor-voice-profile-jason.md). The schema lives as [voice profile schema](anchor-voice-profile-schema.md). Future leader profiles are siblings, not children — flat structure.

## Output (two channels)

- **Daily digest** — short, ~6 lines per signal. Anchored against yesterday's read. Click any signal to see the events that produced it (drill-through via the `because` field).
- **Friday narrative summary** — longer, prose form. Anchored against last Friday's read. Renders in the voice profile. Sendable as email through the existing `cowork-http-mcp` plus Apps Script pipeline.

Both render to local markdown for pilot #1's 1:1 walkthrough. The hosted rendering target (web view, email push, Slack canvas, Notion) is deferred to pilot #2 per [adr 04](../architecture/adr-04-jira-pilot-1-coda-removed.md).

## Demo scenario

**Synthetic and own-generated data only.**

- Jason creates Figma designs and edits them. **Primary signal lane: comments on his own frames** (treating them as if reviewing his own work — flagging issues, resolving threads, occasional `[decision]`-tagged comments). Per [figma signal shape](anchor-figma-signal-shape.md), designers don't manually label versions in practice, so the version stream will be dominated by `polish` autosaves attributed to `Figma` (system). Autosaves are useful as an activity-floor denominator but not as the spine of the digest.
- Jason builds Figma Make and Claude Cowork prototypes. Real changes flow through the cowork connector's filesystem watcher.
- Jason instantiates a dedicated Slack workspace. Real channels, real messages, real threads — focus on threads-of-substance and resolutions, not raw message volume.
- Beyond what Jason can plausibly produce by hand, the system uses AI-generated synthetic data — written to match the rough shape and rhythm of activity a real design team produces, weighted to the signal lanes that matter (comments, threads, resolutions) rather than to noise floors (autosaves, single-message chatter).

The reasoning lives in [airgap rules](anchor-airgap-rules.md). Real-org data does not enter the demo.

## Hard constraints

- **No real-org instrumentation.** The POC does not point at any target company, current employer, or past employer. Jason-and-synthetic only.
- **No employer-named principles in the demo.** Principles in the demo are generic-shaped — "every component must have a contribution doc" is fine; "per [name]'s criterion #3" is not.
- **No transcripts.** Otter is a Stage 2 connector at earliest. Demos do not include captured meeting content.

## Related

- [architecture](anchor-architecture.md) — the six layers v0.1 partially exercises.
- [airgap rules](anchor-airgap-rules.md) — load-bearing; demo data must comply.
- [scaling path](anchor-scaling-path.md) — what gets added in Stage 2 and beyond.
- [sprints week 1 3](anchor-sprints-week-1-3.md) — week-by-week build plan for v0.1.
- [open decisions](anchor-open-decisions.md) — open decisions resolved during scoping.
- [figma signal shape](anchor-figma-signal-shape.md) — why the demo's Figma activity leads with comments, not labeled saves.



