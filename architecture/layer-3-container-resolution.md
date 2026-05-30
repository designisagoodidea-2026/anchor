# Layer 3 — Container resolution

Stub. Week 1 outcome: declared-mapping schema written, read-only access from Anchor to the mapping table. Fleshed out in Week 2 as events flow.

## Role

Map each `change_event` to the body of work it contributes to.

## Inputs

Normalized `change_event` records from [[layer-2-normalization]].

## Outputs

`change_event` records with a `container_id` and `container_name` attached. Events that can't be resolved get flagged for the leader rather than guessed.

## v0.1 approach — declared mapping

A table in Coda or Airtable (dual adapter per [[../memory/anchor-open-decisions]]). The leader sets up:

- 3 projects.
- File, channel, and thread attachments per project.

~10 minutes of setup.

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

- [[layer-2-normalization]] — produces input.
- [[layer-4-translation]] — consumes output.
- [[../memory/anchor-architecture]] — full spec.
- [[../memory/anchor-open-decisions]] — Coda/Airtable dual-adapter decision.
