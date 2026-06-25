# Figma connector

Layer 1 connector for Figma. Polls file metadata, version history, and comment threads via the Figma REST API; emits canonical `change_event` records on the bus. Runs as a Cloudflare Worker.

## v0.2 status

Shipped against [`shared/change-event.ts`](../../shared/change-event.ts). Stage 1.5 per [`adr-01-figma-authorization`](../../architecture/adr-01-figma-authorization.md) and [`memory/anchor-one-auth-per-source.md`](../../memory/anchor-one-auth-per-source.md): Jason's personal PAT plus team-level discovery. The connector polls the union of `FIGMA_FILE_KEYS` (manual; legacy) and the file list discovered from `FIGMA_TEAM_IDS`. Setup ask shifts from "paste N file keys" to "paste your team URL."

Nineteen classifier + discovery fixture assertions pass. The Stage 1.5 team enumeration is an explicit test of whether Figma's free-tier API allows team→projects→files walking — the answer will tell us whether the discovery path holds for pilot teams without forcing them onto paid plans.

## Setup status

The Setup section below lists one-time steps. This block tracks which are done. Update on each completion.

| Step | State | Notes |
|---|---|---|
| `npm install` | **done** (2026-05-30) | wrangler 4.95.0, tsx, typescript installed. |
| Wrangler 3 → 4 upgrade | **done** (2026-05-30) | Via `npm audit fix --force`; tests and typecheck both green after. |
| `npm test` passing | **done** (2026-05-30) | 16/16. |
| `npm run typecheck` clean | **done** (2026-05-30) | Strict tsc, no errors. |
| `npx wrangler secret put FIGMA_PAT` | **done** (2026-05-30) | New PAT issued with `files:read`, `file_versions:read`, `file_comments:read` scopes; old token revoked. Side effect of the first run: created the empty Worker shell `anchor-figma-connector` on Cloudflare. |
| `npx wrangler secret put FIGMA_FILE_KEYS` | **done** (2026-05-30) | One demo key set: `y0JiNrZ4VVZhOEp5I74BtX` (`Untitled`). Re-run the same command to overwrite when more demo files exist. |
| `npx wrangler kv namespace create "ANCHOR_FIGMA_STATE"` | **done** (2026-05-30) | Namespace id `a975772831fa48909bbdf73ccec2a24d` wired into `wrangler.toml` as binding `FIGMA_STATE`. (Title and binding intentionally differ — title is the cross-account name, binding is the in-code identifier.) |
| First `npm run deploy` | **done** (2026-05-30) | Live at `https://anchor-figma-connector.designisagoodidea.workers.dev`. Version `dd5e0bc9…`. `workers_dev` and `preview_urls` now declared explicitly in `wrangler.toml` to silence the default-on warnings. |
| Smoke test against live Worker | **done** (2026-05-30) | `/healthz` returns ok with `kv_bound: true`, `files_configured: 1`. `/poll-all` returns one event — Figma's initial autosave of `Untitled`, classified `polish`. Cursor written to KV. |
| Stage 1.5 discovery code | **done** (2026-05-30) | `src/discover.ts` enumerates team → projects → files; KV-backed union list; new endpoints `/discover` and `/discovered`. Three new fixture assertions added. |
| Stage 1.5 deploy | **pending** | Push new code via `npm run deploy`. Worker version bumps to `0.2`; `/healthz` adds `files_manual`, `files_discovered`, `files_total_unique`, `teams_configured`. |
| `FIGMA_TEAM_IDS` set on Worker | **pending** | Requires either a Starter team workspace (free) or a paid Figma team. Personal/Drafts accounts don't expose `/v1/teams/:id/projects` — the architecture's deliberate show-stopper test. See memory/anchor-figma-discovery-gap.md. |
| `/discover` returns project + file enumeration | **pending** | The test of the Stage 1.5 hypothesis. Success ⇒ scalable Figma onboarding works for pilots. Failure (402 / 403) ⇒ discovery requires paid plan — captured as a real limit. |

## Files

- [`src/figma-api.ts`](src/figma-api.ts) — typed REST client for `/v1/files/:key`, `/versions`, `/comments`.
- [`src/classify.ts`](src/classify.ts) — pure functions: cursor management, kind and tag classification, `change_event` translation. No I/O, no Worker globals.
- [`src/index.ts`](src/index.ts) — Worker entry. HTTP routing, KV cursor I/O.
- [`src/test-classify.ts`](src/test-classify.ts) — fixture-based assertions against `classify.ts`.

The split lets the test suite run under plain Node (no Workers runtime, no Cloudflare account) while keeping the Worker code small.

## Setup

Every command below assumes you've started by `cd`-ing into the connector folder. If a shell session has gone stale or you're in a new tab, repeat the `cd` step before running anything else.

Wrangler is installed locally to this folder, not globally — so call it via `npx wrangler ...` (or use one of the `npm run` scripts in `package.json`, which find it automatically). A bare `wrangler` will hit `bash: command not found`.

Install dependencies:

```bash
cd "connectors/figma"
npm install
```

Set the Figma PAT as a Worker secret (one-time, interactive — paste the token from `/Anchor/.env` when prompted). The PAT must be created with at least these scopes ticked, or `/poll-all` will return 403 on the versions/comments endpoints:

- `files:read`
- `file_versions:read`
- `file_comments:read`

Generate at `https://www.figma.com/settings` → Security → Personal access tokens.

```bash
cd "connectors/figma"
npx wrangler secret put FIGMA_PAT
```

Set the file list (one-time, interactive — paste a comma-separated list of Figma file keys; each key comes from the URL — both forms work: `https://www.figma.com/file/<KEY>/<name>` or `https://www.figma.com/design/<KEY>/<name>`):

```bash
cd "connectors/figma"
npx wrangler secret put FIGMA_FILE_KEYS
```

Set the admin token used to protect debug/admin routes (recommended for any
non-local run):

```bash
cd "connectors/figma"
npx wrangler secret put FIGMA_ADMIN_TOKEN
```

Fail-closed behavior: when `FIGMA_ADMIN_TOKEN` is not set, admin/debug routes
return 503 by default. For local-only development, you can opt out with
`ALLOW_UNPROTECTED_ADMIN=1`.

Create the KV namespace (one-time — paste the returned id into `wrangler.toml`, then uncomment the `[[kv_namespaces]]` block):

```bash
cd "connectors/figma"
npx wrangler kv namespace create "ANCHOR_FIGMA_STATE"
```

Without KV bound, the Worker still runs — cursors live in memory and reset on every cold start. Bind KV before relying on dedup.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Liveness, source name, KV-bound flag, counts of manual + discovered files + configured teams. |
| GET | `/poll?file=<key>` | Poll one file. Returns `{ file, name, events, cursor }`. Updates KV cursor. |
| GET | `/poll-all` | Poll every file in the union of `FIGMA_FILE_KEYS` and the KV-discovered list. Returns aggregated events plus per-file detail. Per-file failures do not poison the batch. |
| GET | `/discover` | Walks each team in `FIGMA_TEAM_IDS` → projects → files. Stores the union of discovered file keys in KV. Returns the run detail (per-team success, errors, file enumeration). **Protected by `FIGMA_ADMIN_TOKEN` (fail-closed)**. |
| GET | `/discovered` | Reads back the last discovery run and the current KV file list. **Protected by `FIGMA_ADMIN_TOKEN` (fail-closed)**. |
| GET | `/cursor?file=<key>` | Inspect the stored cursor for a file. Debug only. **Protected by `FIGMA_ADMIN_TOKEN` (fail-closed)**. |
| POST | `/cursor/reset?file=<key>` | Wipe the cursor for a file. Next poll re-emits everything. Debug only. **Protected by `FIGMA_ADMIN_TOKEN` (fail-closed)**. |

When `FIGMA_ADMIN_TOKEN` is configured, send header:

- `X-Anchor-Reset-Token: <FIGMA_ADMIN_TOKEN>`

Admin/debug routes are also rate-limited to 30 requests/minute per IP and action.

Every event-producing endpoint returns canonical [`change_event`](../../shared/change-event.ts) records.

## File-list union

`/poll-all` polls the union of two sources, deduped:

1. **`FIGMA_FILE_KEYS`** — manual list (Stage 1 path). Kept because personal Figma accounts can't enumerate via team API; the leader-pasted file key is the only way to demo against Drafts.
2. **`discovered:files` KV entry** — written by `/discover`. The Stage 1.5 path: leader pastes a team id once, `/discover` enumerates, the polled list grows automatically as new files appear in the team.

Run `/discover` on a cron (manually or via Cloudflare Workers cron triggers, when wired) to keep the list fresh.

## Magnitude heuristics

Per [`layer-2-normalization.md`](../../architecture/layer-2-normalization.md). The classifier is conservative at v0.1 and will be refined against real activity.

### Version events

| Signal in label or description | Magnitude |
|---|---|
| Contains `[decision]` (any case) | `decision` |
| Contains *component*, *library*, *system*, *tokens*, *variables*, *design system* | `structural` |
| Has substance (non-empty) | `moderate` |
| Empty (unlabeled save) | `polish` |

### Comment events

| Signal | Magnitude |
|---|---|
| Message contains `[decision]` | `decision` |
| Comment has `resolved_at` | `moderate` |
| Comment sits in a thread of more than 3 messages | `moderate` |
| Single new comment | `polish` |

## Develop

Start the Worker locally and hit a couple of endpoints:

```bash
cd "connectors/figma"
npm run dev
# Worker runs on http://localhost:8787
# In a second terminal (also cd'd into this folder if you need npm or wrangler):
curl 'http://localhost:8787/healthz'
curl 'http://localhost:8787/poll?file=<KEY>'
```

## Test

```bash
cd "connectors/figma"
npm test            # 16 fixture assertions, no network, no Cloudflare account
npm run typecheck   # strict tsc against the Worker code
```

The tests feed hand-rolled Figma API responses through `pollToEvents()` and assert on the emitted records. Refer to [`src/test-classify.ts`](src/test-classify.ts) for the fixture shapes — they double as a spec for what the Worker emits.

## Generating real Figma events for the demo

Designers do not manually label versions in practice — Figma removed the "Save" command from the File menu when continuous autosave landed. See [`anchor-figma-signal-shape.md`](../../memory/anchor-figma-signal-shape.md) for the load-bearing implication: at Stage 1 the gold signal lane is *comments*, not version labels.

### Primary path — comments (the spine of the digest)

1. Open the Figma file in your browser.
2. Press `C` (or pick the comment tool) and click on a frame to drop a comment.
3. Write something a designer would actually write in review — e.g.:
   - `Spacing on the right column feels off — try 16px` → classifies as `polish` (single new comment)
   - `Should we surface the trend arrow here, or move it to the header?` → starts a thread; replies bump it to `moderate`
   - `[decision] going with stacked bars over grouped` → classifies as `decision`
4. To exercise the `moderate` (resolved-thread) path, click the comment in the right rail and mark it resolved.

Comments carry real authors (your Figma handle, not "Figma" the system), real timestamps, and real text — they're the signal a digest can lead with.

### Secondary path — autosaves (activity-floor)

Figma commits a new `/versions` entry every ~20-30 minutes on an active file, or when the file goes idle. These come through attributed to `actor: "Figma"` and classify as `polish`. Useful for "the file is being edited" rate signal, not for who-did-what. You don't have to do anything to generate them — they happen by themselves.

### Optional path — labeled versions (rare-but-valuable)

If you do want to exercise the `moderate` / `structural` / `decision` paths via version labels (rare in real teams, but worth proving once):

1. From the file dropdown next to the filename → **Show version history**.
2. In the right-side panel that opens, click **Add to version history** (or the "+" button — UI varies by Figma version).
3. Set the **title** — this is what the classifier reads.
4. Click **Save**.

After any of these, re-curl `/poll-all` and the new event appears.

## Deploy

```bash
cd "connectors/figma"
npm run deploy
# Live at https://anchor-figma-connector.designisagoodidea.workers.dev
npm run tail
```

### Hardening smoke checks

```bash
# Unauthorized should return 401
curl -i 'https://anchor-figma-connector.designisagoodidea.workers.dev/discovered'

# Authorized should return 200
curl -i \
   -H "X-Anchor-Reset-Token: $FIGMA_ADMIN_TOKEN" \
   'https://anchor-figma-connector.designisagoodidea.workers.dev/discovered'
```

## Related

- [`shared/change-event.ts`](../../shared/change-event.ts) — canonical event shape.
- [`architecture/adr-01-figma-authorization.md`](../../architecture/adr-01-figma-authorization.md) — Stage 1 auth model.
- [`architecture/layer-1-connectors.md`](../../architecture/layer-1-connectors.md) — Layer 1 contract.
- [`architecture/layer-2-normalization.md`](../../architecture/layer-2-normalization.md) — kind heuristics for every connector.
