# Slack connector

Layer 1 connector for Slack. Receives Events API webhooks from a workspace-scoped OAuth app, verifies signatures, classifies events into canonical `change_event` records, dedupes by Slack event id, and stores them in KV for the renderer to retrieve. Runs as a Cloudflare Worker.

## v0.2 status

Shipped against [`shared/change-event.ts`](../../shared/change-event.ts). Twenty-two fixture assertions pass (classifier + signature verification + Stage 1.5 channel discovery). Workspace-restricted OAuth per [`architecture/layer-1-connectors.md`](../../architecture/layer-1-connectors.md) and [`memory/anchor-one-auth-per-source.md`](../../memory/anchor-one-auth-per-source.md). The demo workspace is `automation-poc-group`.

Stage 1.5 closes the per-channel `/invite` gap: a `/discover` endpoint enumerates all public channels (`conversations.list`) and joins each one the bot isn't already in (`conversations.join`). On a `channel_created` event the bot auto-joins the new channel. Private channels still require explicit invite — that's Slack's permission model. New scope required: `channels:join`.

## Setup status

| Step | State | Notes |
|---|---|---|
| `npm install` | **done** (2026-05-30) | wrangler 4.95.0, tsx, typescript installed. |
| `npm test` passing | **done** (2026-05-30) | 19/19 (classifier + signature verification). |
| `npm run typecheck` clean | **done** (2026-05-30) | Strict tsc, no errors. |
| Slack app created in `automation-poc-group` workspace | **done** (2026-05-30) | App name `Anchor`. Seven bot scopes added; installed; `xoxb-` token retrieved. |
| `npx wrangler secret put SLACK_SIGNING_SECRET` | **done** (2026-05-30) | Uploaded. |
| `npx wrangler secret put SLACK_BOT_TOKEN` | **done** (2026-05-30) | Uploaded. Side effect: created the empty Worker shell `anchor-slack-connector` on Cloudflare. |
| `npx wrangler secret put SLACK_WORKSPACE_ID` | **done** (2026-05-30) | Uploaded. Value `T074SMHK8LF` (workspace `automation-poc-group`). |
| `npx wrangler kv namespace create "ANCHOR_SLACK_STATE"` | **done** (2026-05-30) | Namespace id `440d61365ae347a5aaa05c1c661ae97f` wired into `wrangler.toml` as binding `SLACK_STATE`. (Title and binding intentionally differ — same convention as the figma connector.) |
| First `npm run deploy` | **done** (2026-05-30) | Live at `https://anchor-slack-connector.designisagoodidea.workers.dev`. |
| Slack app Event Subscription Request URL pointed at deployed `/events` | **done** (2026-05-30) | URL verified by Slack — signing-secret HMAC round-trip works end-to-end. |
| Subscribe to bot events in Slack app | **done** (2026-05-30) | Four bot events subscribed; Save Changes clicked; no reinstall needed. Gotcha: the bot user has to be `/invite`d into each channel before `message.channels` events fire for that channel. |
| Smoke test: post a message, hit `/events?limit=10` | **done** (2026-05-30) | One `polish` message event flowed through clean. Channel-join from `/invite` filtered by classifier as designed. Known gap: `actor.display_name` currently equals the user id; user-handle resolution (Slack `users.info` + KV cache) is a v0.2 enrichment. |
| Stage 1.5 discovery code | **done** (2026-05-30) | `src/discover.ts` enumerates public channels and joins each one. `/discover` endpoint added. `channel_created` event auto-joins the new channel best-effort. Three new fixture assertions for the channel-discovery happy path, `already_in_channel` handling, and per-channel error tolerance. |
| `channels:join` scope added to Slack app | **pending** | In the Slack app dashboard → OAuth & Permissions → Bot Token Scopes → add `channels:join`. Slack will show a banner asking to reinstall the app. |
| Slack app reinstalled with new scope | **pending** | Reinstall to `automation-poc-group`. The bot token stays the same — re-approval just refreshes the scope set. |
| Stage 1.5 deploy | **pending** | `npm run deploy` ships the new code. Worker version bumps to `0.2`. |
| `/discover` returns successful run on free Slack | **pending** | The test of the Stage 1.5 hypothesis. Success ⇒ scalable Slack onboarding works on free tier. Failure (`missing_scope`, `ratelimited`, or per-tier restriction) ⇒ a real limit to document. |
| `channel_created` auto-join verified | **pending** | Create a new public channel in `automation-poc-group`. The bot should appear in it within seconds without `/invite`. Confirms the webhook-driven discovery path. |

## Files

- [`src/verify.ts`](src/verify.ts) — HMAC-SHA256 signature verification + replay-protection window. Pure function.
- [`src/slack-api.ts`](src/slack-api.ts) — typed Slack Events API payload shapes (message, reaction, channel_created).
- [`src/classify.ts`](src/classify.ts) — pure classifier: Slack event → canonical `change_event` (or null to filter).
- [`src/index.ts`](src/index.ts) — Worker entry. Routing, signature verification, dedup, KV event log.
- [`src/test-classify.ts`](src/test-classify.ts) — fixture-based assertions against `classify` + `verify`.

## Setup

Every command below assumes you've started by `cd`-ing into the connector folder. If a shell session has gone stale or you're in a new tab, repeat the `cd` step before running anything else.

Wrangler is installed locally to this folder, not globally — so call it via `npx wrangler ...` (or use one of the `npm run` scripts in `package.json`, which find it automatically). A bare `wrangler` will hit `bash: command not found`.

Install dependencies:

```bash
cd "connectors/slack"
npm install
```

### Slack app setup

One-time. Done in `https://api.slack.com/apps` against your demo workspace (`automation-poc-group`):

1. **Create New App** → **From scratch**. App name: `Anchor` (or similar). Pick `automation-poc-group` as the workspace.
2. **OAuth & Permissions** → add these **Bot Token Scopes** (Anchor only reads + joins public channels; never posts):
   - `channels:history` — read message history in public channels
   - `channels:read` — list public channels and their metadata
   - `channels:join` — join public channels (Stage 1.5 auto-join)
   - `groups:history` — read message history in private channels you've invited the bot to
   - `groups:read` — list those private channels
   - `reactions:read` — read reaction events
   - `users:read` — resolve user ids to display names
   - `team:read` — read workspace metadata (for the workspace id)
3. **Install to Workspace.** Approve the OAuth scope dialog. Copy the **Bot User OAuth Token** (`xoxb-...`) — this becomes `SLACK_BOT_TOKEN`.
4. **Basic Information** → **App Credentials** → copy the **Signing Secret** — this becomes `SLACK_SIGNING_SECRET`.
5. The OAuth install page or the `auth.test` API will show the workspace id (a string like `T01ANCHOR…`) — this becomes `SLACK_WORKSPACE_ID`. Used to pin the connector to your workspace and drop events from anywhere else.
6. **Event Subscriptions** is configured *after* the Worker is deployed, since Slack needs the live `/events` URL to verify it. Come back here after the deploy step below.

### Worker secrets

Set after the Slack app is installed and you have the tokens in hand:

```bash
cd "connectors/slack"
npx wrangler secret put SLACK_SIGNING_SECRET
```

```bash
cd "connectors/slack"
npx wrangler secret put SLACK_BOT_TOKEN
```

```bash
cd "connectors/slack"
npx wrangler secret put SLACK_WORKSPACE_ID
```

Set the admin token used to protect debug/admin routes (recommended for any
non-local run):

```bash
cd "connectors/slack"
npx wrangler secret put SLACK_ADMIN_TOKEN
```

Fail-closed behavior: when `SLACK_ADMIN_TOKEN` is not set, admin/debug routes
return 503 by default. For local-only development, you can opt out with
`ALLOW_UNPROTECTED_ADMIN=1`.

### KV namespace

```bash
cd "connectors/slack"
npx wrangler kv namespace create "ANCHOR_SLACK_STATE"
```

Paste the returned id into `wrangler.toml` and uncomment the `[[kv_namespaces]]` block.

### Deploy

```bash
cd "connectors/slack"
npm run deploy
```

The Worker prints its live URL — paste it into the Slack app's **Event Subscriptions** → **Request URL**, appending `/events` (e.g., `https://anchor-slack-connector.designisagoodidea.workers.dev/events`). Slack will POST a `url_verification` challenge; if the signing secret is set correctly, the URL turns green.

Then **subscribe to bot events**:

- `message.channels` — public channel messages
- `message.groups` — private channel messages (if the bot is in them)
- `reaction_added` — reactions
- `channel_created` — new channels (for the structural-kind path)

Click **Save Changes** in Slack.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Liveness; reports KV binding, signing-secret presence, bot-token presence, workspace pin. |
| POST | `/events` | Slack Events API webhook. Signature-verified, deduped, classified, stored. Auto-joins on `channel_created`. |
| GET | `/events?since=<iso>&limit=N` | Retrieve stored events for the renderer. Default limit 100, max 1000. |
| GET | `/discover` | Enumerate public channels and join each one the bot isn't in. Returns per-channel result. Run on first deploy and periodically (Tier-2 rate limit on `conversations.join` is ~20 req/min). **Protected by `SLACK_ADMIN_TOKEN` (fail-closed)**. |
| POST | `/events/reset` | Debug — wipe stored events. **Protected by `SLACK_ADMIN_TOKEN` (fail-closed)**. |

When `SLACK_ADMIN_TOKEN` is configured, send header:

- `X-Anchor-Reset-Token: <SLACK_ADMIN_TOKEN>`

Admin/debug routes are also rate-limited to 30 requests/minute per IP and action.

## Channel discovery — the Stage 1.5 model

The bot has to be a member of a public channel to receive `message.channels` events (Slack tightened this in 2023). At v0.1 that meant a per-channel `/invite`. Stage 1.5 closes the gap with two paths:

- **`/discover` endpoint** — backfill. Call once after first deploy to join every existing public channel. Idempotent: calls return `already_in_channel` for channels the bot is already in. Rate-limited (~20 join calls per minute on Tier-2), so for very large workspaces the first run may take a couple of minutes.
- **`channel_created` auto-join** — real-time. When a new public channel is created, Slack fires a webhook to `/events`; the handler calls `conversations.join` on the new channel before classifying the event. Bot is in the channel within seconds, no manual step.

Private channels still need explicit invite. That's a Slack permission model, not something Anchor routes around. See [`memory/anchor-one-auth-per-source.md`](../../memory/anchor-one-auth-per-source.md) for the broader scaling principle this implements.

## Magnitude heuristics

Per [`layer-2-normalization.md`](../../architecture/layer-2-normalization.md), informed by [`anchor-figma-signal-shape.md`](../../memory/anchor-figma-signal-shape.md) — same lesson applies: raw message volume is noise; the signal lanes are threads, reactions, and decision tags.

| Signal | Magnitude |
|---|---|
| Message text contains `[decision]` (any case) | `decision` |
| `channel_created` with name starting `proj-`, `design-`, `anchor-`, or `team-` | `structural` |
| Single message in channel | `polish` |
| Thread reply | `polish` (Layer 4 promotes to moderate once thread density crosses a threshold) |
| Reaction added | `polish` |
| `bot_message`, `channel_join`, `channel_leave`, `message_changed`, `message_deleted` | filtered (null) |

Adjust `PROJECT_CHANNEL_PREFIXES` in [`src/classify.ts`](src/classify.ts) once the demo workspace's naming conventions firm up.

## Develop

```bash
cd "connectors/slack"
npm run dev
# Worker runs on http://localhost:8787
curl 'http://localhost:8787/healthz'
```

Local Slack signature verification is awkward because Slack only POSTs to public URLs. Use `npm run dev` for surface-level smoke testing (healthz) and the deployed Worker for real event flow.

## Test

```bash
cd "connectors/slack"
npm test            # 19 fixture assertions, no network, no Slack workspace required
npm run typecheck   # strict tsc against the Worker code
```

## Related

- [`shared/change-event.ts`](../../shared/change-event.ts) — canonical event shape.
- [`architecture/layer-1-connectors.md`](../../architecture/layer-1-connectors.md) — Layer 1 contract.
- [`architecture/layer-2-normalization.md`](../../architecture/layer-2-normalization.md) — kind heuristics for every connector.
- [`memory/anchor-figma-signal-shape.md`](../../memory/anchor-figma-signal-shape.md) — load-bearing assumption about which Slack events the digest should lead with (threads and resolutions, not raw message volume).

## Hardening smoke checks

```bash
# Unauthorized should return 401
curl -i 'https://anchor-slack-connector.designisagoodidea.workers.dev/discover'

# Authorized should return 200
curl -i \
   -H "X-Anchor-Reset-Token: $SLACK_ADMIN_TOKEN" \
   'https://anchor-slack-connector.designisagoodidea.workers.dev/discover'
```
