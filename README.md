# Anchor

An MCP-based operating-sense system for design and product leaders running embedded teams.

Anchor ingests change signal from the tools a team actually uses — Figma, Cowork, Slack at v0.1; more later — resolves that signal to the projects it belongs to, and renders the result as an anchored narrative in the leader's voice. *Here's what was true the last time you read this. Here's what's moved. Here's the question worth asking.*

Not a dashboard. A report a leader will read.

## Why

Existing operations-reporting tools render state. They surface tickets, capture meetings, run quarterly surveys, or aggregate a single tool's snapshots. None of them treat the leader's report as a craft artifact. None ingest across tool boundaries. None know the leader's principles. None render in the leader's voice.

Design teams hate logging effort. Leaders need to know who's overloaded, what's at risk, where the team is drifting from the principles the leader set, and which trade-offs are being relitigated week after week. Self-report produces data that's wrong by Wednesday. Single-source dashboards miss what crosses tool boundaries. Anchor closes the gap by treating activity as the input and the leader's voice as the output.

## What it does

Six layers, each with a clean contract:

1. **Source connectors** — MCP servers per tool emit a uniform `change_event`.
2. **Normalization** — every event reduced to a canonical shape with a computed `kind` (scope) and `tags` (open vocabulary).
3. **Container resolution** — each event mapped to the body of work it belongs to.
4. **Translation** — activity becomes a leadable signal (capacity, health, drift, decision rework).
5. **Diff + memory** — each new report anchors against the prior read.
6. **Voice + rendering** — output in the leader's preferred register, across prose, tables, and reporting visualizations. The renderer refuses words the leader doesn't want and follows the leader's visual register (chart types, density, styling).

Architecture details live in `/architecture/layer-1-connectors.md` through `/architecture/layer-6-voice-rendering.md`.

## v0.1 scope

Three connectors (Figma, Cowork, Slack). Declared containers (a Coda or Airtable table mapping projects to files, channels, threads). Three signals (capacity, health-trend, drift against principles). One voice profile (Jason's). Daily Coda/Airtable digest plus a Friday narrative summary.

POC scope details live in `/memory/anchor-poc-scope.md`. The path to scaled scope lives in `/memory/anchor-scaling-path.md`.

## Status

Layers 1 through 4 are shipped end-to-end. Three connectors emit the canonical `change_event` shape onto the bus, Layer 3 resolves each event to its container, and Layer 4 produces the three v0.1 signals:

- **Cowork** — local Node watcher against a project folder. Filesystem changes render to NDJSON on stdout. Decision tokens in filenames or first lines emit a `decision` tag alongside the scope-based `kind`. Runs against its own working folder.
- **Figma** — Cloudflare Worker polling Figma's REST API with a personal access token. Cursor-based dedup in KV. `kind` classifies on version labels and comment threads; the `[decision]` token surfaces as a tag, independent of scope. Tested live against a real Figma file.
- **Slack** — Cloudflare Worker receiving Events API webhooks. HMAC-SHA256 signature verification with a five-minute replay window. Events deduped by Slack event id and stored in KV for retrieval. Tested live against a dedicated workspace.

The bus contract held across three very different connector shapes — local file watcher, cloud polling, cloud webhook receiver — without compromise. Same `change_event`, same `kind` and `tags` grammar, same downstream contract. That was the whole point of the abstraction; it survived first contact.

Per [ADR-02](architecture/adr-02-event-kind-and-decision-split.md) (2026-06-02), the original `magnitude` field was split into `kind` (scope-only) and `tags` (open vocabulary; v0.1 emits `decision`), and `change_kind` was renamed to `action`. The "computed at Layer 2" rule held; the split made the downstream signals more honest.

Layer 5 (diff + memory) starts next.

## Demo data

Synthetic and own-generated only. Figma designs Jason creates and edits, Figma Make and Claude Cowork prototypes Jason builds, a dedicated Slack workspace Jason owns. Anything beyond that scope is AI-generated. No real-org data; no past-employer artifacts; no transcripts.

The reasoning lives in `/memory/anchor-airgap-rules.md`.

## Repo

This folder is the working project. The public repo is `github.com/<handle>/anchor` — public, MIT licensed, README in voice. The personal substrate (memory files, voice profile, demo seed data, build scaffolding) stays private. The line between public and personal is the same line `/memory/anchor-airgap-rules.md` draws.

## Project orientation

Start here:

- `/memory/MEMORY.md` — index over the project's substrate.
- `/memory/anchor-purpose.md` — one-paragraph product purpose plus differentiation signal.
- `/memory/anchor-architecture.md` — the six layers plus the canonical event shape.
- `/memory/anchor-poc-scope.md` — what v0.1 builds and what it deliberately leaves out.
- `/memory/anchor-airgap-rules.md` — load-bearing; read before adding any external data.
- `/memory/anchor-sprints-week-1-3.md` — the first three sprints' outcomes and defining ships.
- `/memory/anchor-open-decisions.md` — decisions made and decisions deferred.
