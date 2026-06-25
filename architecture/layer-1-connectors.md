# Layer 1 — Source connectors (Translation Engine adapters)

Per [te composition](../docs/anchor-te-composition.md) (2026-06-03), Anchor does not build connectors from scratch. Layer 1 is Translation Engine plus a thin bus adapter inside Anchor.

## Role

Convert each tool's native activity into a uniform `change_event` on a shared bus. The translation pass itself — API calls, webhook handling, canonical-record emission, loss-surface manifest — is TE's job. Anchor's job at this layer is to consume TE's output and make it available on the bus the downstream layers read from.

## Inputs

TE's canonical record stream. Anchor doesn't talk to Figma, Cowork, or Slack directly; it talks to TE adapters that talk to those tools.

## Outputs

Stream of `change_event` records on the bus. Shape locked in [architecture](../docs/anchor-architecture.md) and reconciled against TE's canonical record shape per [layer 2 normalization](layer-2-normalization.md).

## Connector set for v1

Each is a TE adapter Anchor depends on. Where the adapter exists in TE, Anchor imports. Where it doesn't, the default is upstream contribution before consumption.

- **Figma** — file activity, comment threads, component-library changes.
- **Cowork** — skill runs, artifact updates, conversation activity per project.
- **Slack** — thread density, channel-tagged activity (workspace-restricted, OAuth-scoped).

## Decision 4 ratification — v0.1 local-wrap exception (Weeks 1–3)

Per [te composition](../docs/anchor-te-composition.md) Decision 4 option (b) ratified 2026-06-03: TE does not yet ship Figma, Cowork, or Slack adapters. The default "upstream-first" rule is suspended for these three for Weeks 1–3 only. Anchor's connector packages (`/connectors/figma`, `/connectors/cowork`, `/connectors/slack`) handle auth, event sources, and fetch directly during the POC window. Post-Week-3 ship, each implementation is extracted into a TE adapter and contributed upstream via TE's breaking-change protocol (CHANGELOG entry + Anchor moves pin in a dedicated commit). Tracked in [upstream contribution queue](../docs/anchor-upstream-contribution-queue.md).

The Jira adapter (and the Airtable destination adapter) **do** ship in TE at `0.1.0` — Anchor imports those directly per TE's [PUBLIC_API.md](/Documents/Claude/Projects/Translation Engine/PUBLIC_API.md). The per-connector design notes below describe the **target** state (post-Week-3); v0.1 reality is the local-wrap pattern.

## Future connectors (Stage 2+)

Claude API, Codex, Make, Otter, GitHub, Asana, Linear. Each gets built as a TE adapter; Anchor imports as needed. The Jira issue-event connector is the first Stage 2 connector, per [adr 04](adr-04-jira-pilot-1-coda-removed.md).

## Hard rule

Every connector emits the same event shape on Anchor's bus. No connector-specific fields downstream. Tool-specific nuance lives in the `snippet` field as text, not as schema. If a connector starts caring about voice rendering or container resolution, the architecture has leaked.

The rule applies across the TE boundary too. TE's canonical record shape and Anchor's `change_event` shape are reconciled deliberately; ad-hoc mapping at the bus is not allowed. Where they diverge, the divergence is documented and the resolution path (upstream contribution to TE, or Anchor-specific wrap at the bus boundary) is explicit.

## Per-connector design notes

The original v0.1 design notes (auth model, event sources, magnitude heuristics) shift in scope. Items context-agnostic to Anchor — authentication, polling vs. webhook strategy, rate-limit handling — live in TE's adapter. Items tuned to Anchor's signal layer — `kind` heuristics, decision-tag detection — live in Anchor on top of TE's output.

### Figma

- **Auth.** TE adapter handles. Stage 1 uses Jason's personal access token; target architecture is a service account with email-mediated invites — see [adr 01 figma authorization](adr-01-figma-authorization.md). OAuth coexists as a fallback for individual leaders.
- **Event sources.** TE adapter handles. Polling at v0.1; webhooks v2 at Stage 3 once the service account has team membership.
- **`kind` heuristics.** Anchor-side, on top of TE's normalized output. Detailed in [layer 2 normalization](layer-2-normalization.md).

### Cowork

- **Auth.** TE adapter handles. Session-scoped at v0.1.
- **Event sources.** TE adapter handles. Skill run events, artifact create/update, conversation activity per project folder.
- **`kind` heuristics.** Anchor-side. Detailed in [layer 2 normalization](layer-2-normalization.md).

### Slack

- **Auth.** TE adapter handles. Workspace-restricted OAuth app.
- **Event sources.** TE adapter handles. Events API webhooks (message, reaction, channel_created, thread_reply).
- **`kind` heuristics.** Anchor-side. Detailed in [layer 2 normalization](layer-2-normalization.md).

## Hosting

TE adapters live in TE's deployment surface. Anchor's bus adapter runs on Cloudflare Workers (per [open decisions](../docs/anchor-open-decisions.md)) and reuses the `cowork-http-mcp` pattern. Anchor does not host TE; it consumes TE.

## Related

- [te composition](../docs/anchor-te-composition.md) — the decision that turned this layer into a thin adapter.
- [layer 2 normalization](layer-2-normalization.md) — consumes this layer's output; references TE's canonical record shape.
- [architecture](../docs/anchor-architecture.md) — the canonical `change_event` shape.
- [poc scope](../docs/anchor-poc-scope.md) — v0.1 connector set.
- [open decisions](../docs/anchor-open-decisions.md) — TE-composition open decision (package import path, version pin, upstream-contribution policy).
