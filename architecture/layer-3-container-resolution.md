# Layer 3 — Container resolution

Shipped as of 2026-05-30; pivoted on 2026-06-04 per [ADR-04](adr-04-jira-pilot-1-coda-removed.md). The resolver library lives at [`/layer-3/`](../layer-3/README.md): pure `resolveContainer(event, containers)` function with source adapters for Jira (pilot-1 primary) and Airtable (fixture / fallback). Fifteen fixture assertions cover all per-source matching paths (Figma file-key, Slack channel-id, Cowork longest-prefix) plus `resolved` / `unresolved` / `ambiguous` decisions per the hard rule.

## Role

Map each `change_event` to the body of work it contributes to.

## Inputs

Normalized `change_event` records from [layer 2 normalization](layer-2-normalization.md).

## Outputs

`change_event` records with a `container_id` and `container_name` attached. Events that can't be resolved get flagged for the leader rather than guessed.

## v0.2 approach — Jira projects as declared bodies of work

Per [ADR-04](adr-04-jira-pilot-1-coda-removed.md). The leader's Jira project hierarchy IS the container set — they declared it when they set up the tracker. No separate mapping table to maintain.

The leader picks which Jira projects Anchor watches (`JIRA_PROJECT_KEYS` env var; empty = all accessible). Each project becomes one Container. Cross-source associations (Figma files, Slack channels, Cowork paths) are read from optional Jira project properties; if the leader doesn't set them, the Container's cross-source arrays are empty and only Jira-source events resolve to that container.

The Airtable adapter is retained as the fixture / self-hosted fallback path. Pilot leaders who'd rather configure containers outside their tracker can use `ANCHOR_CONTAINER_SOURCE=airtable` and keep the seven-column mapping table.

### Live instance (Jason's v0.1, retained as fallback)

**Airtable base** (fixture / self-hosted fallback):

- URL: https://airtable.com/appHUDQRGwtB7eE3m
- Base ID: `appHUDQRGwtB7eE3m`
- Containers table ID: `tblsWJg3atwEhOBmk`

One real row — `Anchor` — attaching the Figma file the connector polls, the Slack channel the connector receives events from, and the cowork path prefix the watcher emits against. The resolver handles 1-to-N containers per the test suite.

### Jira mapping (per project)

| Anchor field | Jira source |
|---|---|
| `id` | Project key (e.g. `ANC`) |
| `name` | Project name |
| `figma_file_ids` | CSV value of the project property named by `JIRA_FIGMA_CUSTOM_FIELD` |
| `slack_channel_refs` | CSV value of `JIRA_SLACK_CUSTOM_FIELD` |
| `cowork_path_prefixes` | CSV value of `JIRA_COWORK_CUSTOM_FIELD` |
| `aliases` | `[project key, project name]` |
| `notes` | Project description |

### Airtable mapping (retained, unchanged from v0.1)

```
Project (text, required)
  Figma files (URL list)
  Slack channels (text list, e.g. #proj-aisrch)
  Cowork artifact tags (text list)
  Aliases (text list — alternate names the system might see in event data)
  Notes (long text, optional)
```

### Resolution algorithm

1. Pull the leader's container set from the configured source on each digest run (cached for the digest's duration).
2. For each event, match its source-specific identifier (Figma file key, Slack channel id, Cowork absolute path) against the matching field on each Container.
3. If exactly one Container matches → tag the event with that `container_id`.
4. If zero Containers match → tag as `unresolved`; surface to the leader at the end of the digest.
5. If multiple Containers match → tag as `ambiguous`; surface to the leader for a one-time disambiguation.

When the future Jira connector ships, the resolver gains a `jira` arm that matches by project key on the event's `entity_id`. Per [ADR-04](adr-04-jira-pilot-1-coda-removed.md), `Source` was extended to include `"jira"` and the existing `default → unresolved` arm in the resolver keeps Jira events safely until the matching code lands.

## Scaled approach (Stage 3+)

Embeddings over entity names; system proposes container assignments; leader corrects in-band; system learns the org's vocabulary. Downgraded from Stage 2 per ADR-04 — Jira project hierarchy already carries declared structure, so embedding-based inference doesn't become load-bearing until the leader-picks model hits its ceiling.

## Hard rule

Every event must resolve to at most one primary container. If it could belong to multiple, the system asks the leader rather than guessing. Ambiguity surfaces; it never gets hidden.

## Why this is the hardest layer

Real orgs have inconsistent naming. The Figma file says "AI Search v3 — final." The Jira project is called "AI Search." The Slack channel is `#proj-aisrch`. Otter calls it "AI Search Project." Same body of work, four different names.

The Jira-projects-as-containers approach inherits the leader's existing tracker vocabulary. The leader carries the cost of naming consistency *once* (when they configured Jira), and Anchor reads it from there. The Airtable fallback exists for orgs whose Jira projects aren't yet structured the way Anchor wants to watch them.

## Related

- [adr 04 jira pilot 1 coda removed](adr-04-jira-pilot-1-coda-removed.md) — the pivot that drove this v0.2.
- [layer 2 normalization](layer-2-normalization.md) — produces input.
- [layer 4 translation](layer-4-translation.md) — consumes output.
- [architecture](../docs/anchor-architecture.md) — full spec.
- [open decisions](../docs/anchor-open-decisions.md) — Jira-for-pilot-1 / Coda-removed entry.
- [`/layer-3/README.md`](../layer-3/README.md) — implementation, setup status, and resolver test suite.
