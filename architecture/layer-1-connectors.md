# Layer 1 — Source connectors (MCP-based)

Stub. Week 1 outcome: locks the `change_event` shape and the per-connector contract. Fleshed out as connectors get built in Week 2.

## Role

Convert each tool's native activity into a uniform `change_event` on a shared bus.

## Inputs

Tool-native APIs and webhooks. Per-connector authentication and rate-limit handling.

## Outputs

Stream of `change_event` records on the bus. Shape locked in [[../memory/anchor-architecture]].

## Tool set for v1

- **Figma** — file activity, comment threads, component-library changes.
- **Cowork** — skill runs, artifact updates, conversation activity per project.
- **Slack** — thread density, channel-tagged activity (workspace-restricted, OAuth-scoped).

## Future tools (Stage 2+)

Claude API, Codex, Make, Coda, Otter, GitHub, Asana, Linear. Each gets its own MCP server.

## Hard rule

Every connector emits the same event shape. No connector-specific fields downstream. Tool-specific nuance lives in the `snippet` field as text, not as schema. If a connector starts caring about voice rendering or container resolution, the architecture has leaked.

## Per-connector design notes (to be filled in Week 2)

### Figma

- **Auth.** Personal access token at v0.1; OAuth scope at Stage 2.
- **Event sources.** REST API webhooks (file_update, library_publish, file_comment); polling for events the webhooks don't cover.
- **Magnitude heuristics.** TBD in [[layer-2-normalization]].

### Cowork

- **Auth.** Session-scoped at v0.1.
- **Event sources.** Skill run events, artifact create/update, conversation activity per project folder.
- **Magnitude heuristics.** TBD in [[layer-2-normalization]].

### Slack

- **Auth.** Workspace-restricted OAuth app.
- **Event sources.** Events API webhooks (message, reaction, channel_created, thread_reply).
- **Magnitude heuristics.** TBD in [[layer-2-normalization]].

## Hosting

Cloudflare Workers per connector (per [[../memory/anchor-open-decisions]]). Reuses the `cowork-http-mcp` pattern.

## Related

- [[layer-2-normalization]] — consumes this layer's output.
- [[../memory/anchor-architecture]] — the canonical `change_event` shape.
- [[../memory/anchor-poc-scope]] — v0.1 connector set.
