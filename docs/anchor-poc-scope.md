---
name: anchor-poc-scope
description: v0.1 build scope — three connectors, three signals, one voice profile, declared containers, two output channels. Plus hard constraints.
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

A mapping table in Coda or Airtable (dual adapter — see [[anchor-open-decisions]]). The leader sets up:

- 3 projects
- File, channel, and thread attachments per project

~10 minutes of setup. No inference yet; the inference layer is a Stage 2 story.

## Signals (three)

1. **Capacity** — per person, per project.
2. **Health-trend** — per project, week over week.
3. **Drift against leader-defined principles** — the leader registers 3-5 principles; the system checks deltas.

Cross-BU coordination cost, schedule reality, and decision rework are all out of scope for v0.1. They each need richer container data and longer signal history than two to three weeks gives.

## Voice profile (one)

Jason's. Drawn from `[[anchor-feedback-disliked-words]]`, `[[anchor-feedback-curious-not-credentialing]]`, `[[anchor-feedback-no-company-attribution]]`, `[[anchor-feedback-paragraph-spacing]]`, and the `jason-writing-style` skill. The profile refuses the banned vocabulary out of the box.

The profile lives in this folder as `[[anchor-voice-profile-jason]]`. The schema lives as `[[anchor-voice-profile-schema]]`. Future leader profiles are siblings, not children — flat structure.

## Output (two channels)

- **Daily digest** — short, ~6 lines per signal. Anchored against yesterday's read. Click any signal to see the events that produced it (drill-through via the `because` field).
- **Friday narrative summary** — longer, prose form. Anchored against last Friday's read. Renders in the voice profile. Sendable as email through the existing `cowork-http-mcp` plus Apps Script pipeline.

Both render against a Coda surface in the primary case and an Airtable surface in the second case, via the dual-adapter layer.

## Demo scenario

**Synthetic and own-generated data only.**

- Jason creates Figma designs and edits them. Real changes; real signal.
- Jason builds Figma Make and Claude Cowork prototypes. Same.
- Jason instantiates a dedicated Slack workspace. Real channels, real messages, real activity.
- Beyond what Jason can plausibly produce by hand, the system uses AI-generated synthetic data — written to match the rough shape and rhythm of activity a real design team produces.

The reasoning lives in [[anchor-airgap-rules]]. Real-org data does not enter the demo.

## Hard constraints

- **No real-org instrumentation.** The POC does not point at any target company, current employer, or past employer. Jason-and-synthetic only.
- **No employer-named principles in the demo.** Principles in the demo are generic-shaped — "every component must have a contribution doc" is fine; "per [name]'s criterion #3" is not.
- **No transcripts.** Otter is a Stage 2 connector at earliest. Demos do not include captured meeting content.

## Related

- [[anchor-architecture]] — the six layers v0.1 partially exercises.
- [[anchor-airgap-rules]] — load-bearing; demo data must comply.
- [[anchor-scaling-path]] — what gets added in Stage 2 and beyond.
- [[anchor-sprints-week-1-3]] — week-by-week build plan for v0.1.
- [[anchor-open-decisions]] — open decisions resolved during scoping.
