# Connector plugin blueprints (top 5)

Purpose: define the minimum structure each new integration plugin must implement so connector work is mostly mapping and fixture authoring, not architecture redesign.

These files are intentionally implementation-light. They are a pre-build contract for:

- auth and required scopes
- sync mode (webhook, polling, or hybrid)
- cursor/checkpoint strategy
- dedupe strategy
- canonical `change_event` mapping defaults
- minimum fixture pack for strict/permissive replay

## Files

- `acceptance-checklist.md` - promotion checklist required before a connector moves to active.
- `plugin.template.json` - baseline structure for any new plugin.
- `cowork-current.plugin.json` - retrofit of current Cowork connector state (partial; implementation gap flagged).
- `figma-current.plugin.json` - retrofit of current Figma connector state.
- `slack-current.plugin.json` - retrofit of current Slack connector state.
- `jira.plugin.json`
- `github.plugin.json`
- `linear.plugin.json`
- `notion.plugin.json`
- `microsoft-teams.plugin.json`

## How to use

1. Copy `plugin.template.json` to `<source>.plugin.json`.
2. Fill auth + scope requirements.
3. Define source event types and canonical mappings.
4. Define cursor/dedupe keys and backfill strategy.
5. Add fixture IDs for smoke/strict/permissive tests.
6. Implement connector code only after this blueprint is approved.

## Acceptance gate before implementation

- Auth path is explicit and testable.
- Cursor strategy is explicit and idempotent.
- Dedupe key is explicit and stable.
- At least one event from each source category maps to canonical `change_event`.
- Required fixture pack is defined.

## Promotion gate

Before moving a connector to `active`, run the full checklist in `acceptance-checklist.md`.
