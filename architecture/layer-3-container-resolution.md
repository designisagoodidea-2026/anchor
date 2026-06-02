# Layer 3 — Container resolution

Shipped as of 2026-05-30. The resolver library lives at [`/layer-3/`](../layer-3/README.md): pure `resolveContainer(event, containers)` function with mirrored Coda and Airtable source adapters. Fifteen fixture assertions cover all per-source matching paths (Figma file-key, Slack channel-id, Cowork longest-prefix) plus `resolved` / `unresolved` / `ambiguous` decisions per the hard rule.

## Role

Map each `change_event` to the body of work it contributes to.

## Inputs

Normalized `change_event` records from [layer 2 normalization](layer-2-normalization.md).

## Outputs

`change_event` records with a `container_id` and `container_name` attached. Events that can't be resolved get flagged for the leader rather than guessed.

## v0.1 approach — declared mapping

A table in Coda or Airtable (dual adapter per [open decisions](../docs/anchor-open-decisions.md)). The leader sets up:

- 3 projects.
- File, channel, and thread attachments per project.

~10 minutes of setup.

### Live instance (Jason's v0.1)

**Coda doc** (primary):

- URL: https://coda.io/d/_dThZySK6YQg
- Container mapping page: `coda://docs/ThZySK6YQg/pages/section-Dhqta_7ctc`
- Containers table: `coda://docs/ThZySK6YQg/tables/grid-Qw7OPuyfqD`

**Airtable base** (mirror, proving the dual adapter):

- URL: https://airtable.com/appHUDQRGwtB7eE3m
- Base ID: `appHUDQRGwtB7eE3m`
- Containers table ID: `tblsWJg3atwEhOBmk`

Both surfaces carry the same seven-column schema (Project, Figma files, Slack channels, Coda pages, Cowork tags, Aliases, Notes) and the same three seed rows (AI Search, Mobile Redesign, Design System v2). The Layer 3 reader picks whichever surface the leader's `CONTAINER_BACKEND` env var points to — leader chooses the canonical instance; the other is a mirror.

Generic-shaped seed rows per [airgap rules](../docs/anchor-airgap-rules.md) until real demo substrate exists. As of 2026-05-30, both surfaces hold one real row — `Anchor` — attaching the Figma file the connector polls, the Slack channel the connector receives events from, and the cowork path prefix the watcher emits against. The two remaining aspirational rows were deleted; the resolver handles 1-to-N containers per the test suite.

### Table schema (Coda or Airtable)

```
Project (text, required)
  Figma files (URL list)
  Slack channels (text list, e.g. #proj-aisrch)
  Coda pages (URL list)
  Cowork artifact tags (text list)
  Aliases (text list — alternate names the system might see in event data)
  Notes (long text, optional)
```

### Resolution algorithm (POC)

1. Pull the leader's mapping table on each digest run (cached for the digest's duration).
2. For each event, match its `raw_ref` against the configured attachments per project.
3. If exactly one project matches → tag the event with that `container_id`.
4. If zero projects match → tag as `unresolved`; surface to the leader at the end of the digest.
5. If multiple projects match → tag as `ambiguous`; surface to the leader for a one-time disambiguation.

## Scaled approach (Stage 2+)

Embeddings over entity names; system proposes container assignments; leader corrects in-band; system learns the org's vocabulary.

## Hard rule

Every event must resolve to at most one primary container. If it could belong to multiple, the system asks the leader rather than guessing. Ambiguity surfaces; it never gets hidden.

## Why this is the hardest layer

Real orgs have inconsistent naming. The Figma file says "AI Search v3 — final." The Coda project page says "AI Search." The Slack channel is `#proj-aisrch`. Otter calls it "AI Search Project." Same body of work, four different names.

The declared-mapping approach sidesteps inference at the POC stage. The leader carries the cost (10 minutes of setup) so the system can be honest about what it knows.

## Related

- [layer 2 normalization](layer-2-normalization.md) — produces input.
- [layer 4 translation](layer-4-translation.md) — consumes output.
- [architecture](../docs/anchor-architecture.md) — full spec.
- [open decisions](../docs/anchor-open-decisions.md) — Coda/Airtable dual-adapter decision.
- [`/layer-3/README.md`](../layer-3/README.md) — implementation, setup status, and resolver test suite.
