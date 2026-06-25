# Phase B - Contentrain-Inspired Governance Controls

## Specific source

Contentrain

## Impacted layer

Governance and explainability plane.

## Borrowed pattern

- canonical decision record schema
- template-driven decision artifacts
- lightweight validation gate

## Keep native to Anchor guardrails

- no CMS/runtime scope expansion
- no semantic ownership transfer
- urgent signal-quality fixes keep a fast path

## Initial implementation proposal

- Add a canonical schema and template for material decisions.
- Add a validator script and a `governance-check` command.
- Seed one Phase A decision record.

## Council review

See:

- `../reviews/phase-b/anchor-advocate.md`
- `../reviews/phase-b/goldenflow-advocate.md`
- `../reviews/phase-b/contentrain-advocate.md`
- `../reviews/phase-b/moderator-decision.md`

## Revised implementation proposal

- Keep this phase fail-open and lightweight:
  - local and manual validation support first
  - command integrated into operations script
  - enforcement policy documented as staged
- Include break-glass rule: urgent fixes can bypass, but need a retro record within 24h.
- Limit required decision record fields to minimum operational set.

## Change execution

Status: executed in this phase.

Changed areas:

- governance schema and template
- governance records seed
- validation script
- operations script command wiring

## Cleanup before next phase

- prune temporary rollout notes after adoption
- keep only active checks and constraints
- archive superseded decision records
