---
name: anchor-architecture
description: The six-layer architecture; each layer's role, contract, and hard rule. Includes the canonical change_event shape.
publish: true
metadata:
  type: project
---

## Six layers, clean contracts

Anchor is six layers stacked. Each layer has a clean contract with the next. No layer reaches across.

The contracts are load-bearing. If a connector starts caring about voice rendering, or if translation starts caring about which Slack channel an event came from, the architecture has leaked and the whole thing slowly turns back into the dashboard it was built to replace.

## Layer 1 — Source connectors (MCP-based)

**Role.** Convert each tool's native activity into a uniform `change_event` on a shared bus.

**Inputs.** Tool-native APIs and webhooks.

**Outputs.** Stream of `change_event` records.

**Tool set for v1.** Figma, Cowork, Slack. Three is enough to prove the bus and the normalization layer.

**Future tools.** Claude API, Codex, Make, Otter, GitHub, Asana, Linear. Each gets its own MCP server. Jira ships as a Stage 2 connector alongside the ADR-04 container-source build.

**Hard rule.** Every connector emits the same event shape. No connector-specific fields downstream. Tool-specific nuance lives in the `snippet` field as text, not as schema.

## Layer 2 — Normalization

**Role.** Reduce every `change_event` to the canonical shape so downstream layers don't care which tool it came from.

**Canonical shape** (per [adr 02 event kind and decision split](../architecture/adr-02-event-kind-and-decision-split.md)):

```
{
  actor:          { id, display_name, source_user_id, role_hint }
  timestamp:      ISO 8601
  source:         "figma" | "cowork" | "slack" | ...
  entity_id:      stable identifier within source
  entity_type:    "file" | "frame" | "thread" | "message" | "skill_run" | "artifact" | ...
  parent_id:      optional — for hierarchy (project → file → frame)
  action:         "create" | "edit" | "comment" | "review" | "approve" | "mention" | ...
  kind:           "polish" | "moderate" | "structural" | "unknown"
  tags:           string[]   — open vocabulary; v0.1 emits ["decision"]
  snippet:        1–2 sentences of substance preview
  raw_ref:        opaque pointer back to the source record (for audit + click-through)
}
```

**`kind` is the load-bearing computed field.** Not "edited" but "polish-touched" versus "core component restructured." Per-source heuristics decide what counts as polish, moderate, structural, or (when the connector can't tell) unknown. It's a category, not a scale.

**`tags` carries source-emitted markers** orthogonal to scope. v0.1's only emitter is `"decision"` — written when a `[decision]` token appears in the source. A polish-scoped event can carry a decision tag; downstream signals treat the two facts independently.

**Hard rule.** `kind` and `tags` are computed at this layer, not at translation. Downstream signals depend on them being honest. If a connector can't compute `kind`, it emits `"unknown"` and gets filtered. `tags` defaults to `[]` when no markers fire.

Schema history: the original shape carried `magnitude` (a five-value enum that mixed scope and decision-ness) and `change_kind` (the action verb). Per ADR-02, `magnitude` was split into `kind` (scope-only) and `tags` (open vocabulary), and `change_kind` was renamed to `action`. The "computed at Layer 2" rule and the "unknown → filter" rule both carried forward unchanged.

## Layer 3 — Container resolution

**Role.** Map each `change_event` to the body of work it contributes to.

The hardest layer, because real orgs have inconsistent naming. The Figma file says "AI Search v3 — final." The Jira project is "AI Search." The Slack channel is `#proj-aisrch`. Otter calls it "AI Search Project." Same body of work, four different names.

**POC approach (per [adr 04](../architecture/adr-04-jira-pilot-1-coda-removed.md)).** Leader picks Jira projects to watch — the project hierarchy IS the declared bodies of work. Cross-source associations come from optional Jira project properties carrying CSV lists; if unset, Jira-source events still resolve by project key, and Figma / Slack / Cowork events land as `unresolved` until the leader connects them. Airtable retained as fixture / self-hosted fallback:

```
Project: "AI Search"  (Jira project key: AISRCH)
  Figma files (property "anchor-figma-files"): [file keys, CSV]
  Slack channels (property "anchor-slack-channels"): [#proj-aisrch, ...]
  Cowork paths (property "anchor-cowork-paths"): [/Users/.../AISearch, ...]
  Aliases: [AISRCH, AI Search]
```

**Scaled approach.** Embeddings over entity names; the system proposes container assignments; the leader corrects in-band; the system learns the org's vocabulary.

**Hard rule.** Every event must resolve to at most one primary container. If it could belong to multiple, the system asks the leader rather than guessing. Ambiguity surfaces; it never gets hidden.

## Layer 4 — Translation (activity → leadable signal)

**Role.** Convert resolved activity into signals a leader can act on.

**v1 signal set:**

- **Capacity** — sustained load, surge, slack. Per-person, per-team.
- **Health-trend** — improving, plateaued, eroding (week over week per body of work).
- **Drift against leader-defined principles** — the leader registers principles once. The system checks deltas against them. Example principles: every component shipped to the design system must have a contribution doc; every research-backed roadmap item must link the underlying customer evidence.
- **Decision rework** — the same trade-off being relitigated. Detected by repeated edits to the trade-off doc, repeated discussion of the same topic in retros, repeated re-scoping of the same project.
- **Cross-BU coordination cost** — calendar and Slack signal mass per BU pair, surfaced when it spikes.
- **Schedule reality** — roadmap claim versus capacity reality.

**Construction.** Rules plus LLM judgment.

- **Rules** are leader-defined principles and source-specific heuristics. Cheap, deterministic, auditable.
- **LLM** fills the gaps for cases the rules don't cover. Judgment shows its work via the `because` field on each signal.

**Hard rule.** Every signal carries a `because` field — the evidence that produced it. No black-box surfacing. If the leader can't see why the system says "AI Search is health-eroding," the signal doesn't render.

## Layer 5 — Diff and memory

**Role.** Make the report continuous. Each new digest anchors against the prior digest for this leader.

**State per leader:**

- What was the prior read?
- What did the leader flag (acknowledge, dismiss, watch)?
- What did the leader ask to keep watching?
- What has materially changed since the prior read?

**Output shape (per signal in the new digest):**

> Two weeks ago you flagged AI Search as health-eroding because the engineering partner was overloaded. This week the engineering load is back to baseline, but the trade-off doc has been edited four times without a decision — decision-rework signal climbing. Worth asking the team where the decision is stuck.

**Hard rule.** The leader never reads the same digest twice. If nothing has changed on a signal since the last read, the system says "no change" explicitly and moves on. Stillness is a signal too. Faking newness is worse than reporting silence.

## Layer 6 — Voice and rendering

**Role.** Render the digest in the leader's preferred register — across prose, tables, and reporting visualizations.

The output is mixed by default. A capacity signal that names six people lands as a compact table, not six paragraphs. A health-trend signal that's moved week over week lands as a sparkline next to a sentence, not a sentence alone. A drift signal against a leader-defined principle lands as prose because the substance is qualitative. The renderer picks the form that carries the signal honestly; the leader's profile shapes the picks.

**Output forms:**

- **Prose** — narrative paragraphs in the leader's voice. Default for qualitative signals, framing, recommendations, anchoring against prior reads.
- **Tables** — compact, structured. Default when the signal names more than three entities (people, projects, principles).
- **Reporting visualizations** — sparklines, bar charts, dot plots. Default when the signal has trend, comparison, or magnitude that lands faster as a shape than as a number.

**Voice profile schema:** see [voice profile schema](anchor-voice-profile-schema.md). The profile encodes both verbal register (terseness, vocabulary, framing) and visual register (chart types, density, styling, when to use a table versus a chart versus prose).

**The voice profile is a first-class object.** Leaders edit theirs as YAML-in-markdown checked into the repo. The system re-renders the next digest against the updated profile. The profile is design substrate, not configuration.

**Hard rule.** The system applies the same craft to its own output that it expects from the design team. If it can't render in the leader's voice — banned vocabulary present, framing rule violated, visual register violated (e.g., dashboard-style chart junk when the profile asks for minimal) — it surfaces the failure rather than fall back to neutral SaaS language.

## Related

- [voice profile schema](anchor-voice-profile-schema.md) — Layer 6 spec.
- [voice profile jason](anchor-voice-profile-jason.md) — first leader profile.
- [poc scope](anchor-poc-scope.md) — what subset of this is built at v0.1.
