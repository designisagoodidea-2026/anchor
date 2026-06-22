---
name: cos-poc-publishing
description: "The publishing workflow for POC artifacts — single self-contained HTML hosted as a public GitHub Pages site. Captures the constraints discovered while shipping the claude-dt-system POC: which paths work, which are blocked, and the per-POC PAT pattern."
metadata: 
  node_type: memory
  type: reference
  originSessionId: e23eb99c-920c-4813-a195-79c71f997038
---

## The pattern

For every POC that needs a public shareable URL:

1. **Build the artifact** as a single self-contained `index.html` (inline CSS + JS, no external deps beyond the three Cowork-allowlisted CDNs if needed).
2. **Create the GitHub repo manually** — public, empty, one-time per POC. Jason does this in the web UI; takes ~20 seconds.
3. **Generate a fine-grained PAT** scoped only to that repo, with Contents: read/write AND Pages: write. Short expiry (24h–7d).
4. **Run [[poc-publish]] skill** — two-step orchestration:
   - `/Chief of Staff/scripts/poc-publish.sh` clones, copies, commits, pushes (git via `github.com`)
   - Then the skill calls the cowork-http-mcp worker's `http_request` tool to POST `/pages` on `api.github.com` (the only path the sandbox has to that host)
5. **Revoke the PAT** at https://github.com/settings/tokens after the session's publishes are done.

Live URL pattern: `https://<github-user>.github.io/<repo-slug>/`

## Why this path (the alternatives that don't work)

- **Native GitHub MCP connector:** none currently. (If one ships in the future, evaluate switching — would remove the PAT dance entirely.)
- **Claude in Chrome on github.com:** blocked by Anthropic's extension policy (same as Trello — see [[cos-trello-access]]). Cannot drive the GitHub web UI to create repos, push files, or enable Pages.
- **GitHub CLI (`gh`):** not installed in the sandbox; installing it per-session would still require auth (back to PAT or device-flow OAuth).
- **Drive-hosted HTML:** Drive doesn't serve raw HTML at a public URL (it forces a download).
- **Netlify / Vercel / Cloudflare Pages drag-and-drop:** all also require auth and add a platform; GitHub Pages keeps the surface small.

What actually works:
- **Bash sandbox can reach `github.com`** over HTTPS (git via PAT). Confirmed.
- **Bash sandbox CANNOT reach `api.github.com` directly.** Sandbox allowlist returns 403 with `X-Proxy-Error: blocked-by-allowlist`. Discovered 2026-05-21 — explains why the original poc-publish.sh's Pages-enable curl had been silently failing.
- **cowork-http-mcp worker bridges the gap.** `api.github.com` is on the worker's allowlist; the worker's `http_request` MCP tool reaches it. See [[cos-capabilities]] cowork-http-mcp entry.
- **Fine-grained PAT in env var** → one-shot push from sandbox (git path) → never persisted to disk or memory.
- **GitHub Pages API** enabled via the worker — needs PAT with Pages: write scope.

## Constraints to know

- **Fine-grained PATs cannot create repos.** Repo must exist before the PAT is generated (because the PAT is scoped to "selected repositories"). Jason creates the empty public repo first.
- **Pages on private repos requires GitHub Pro.** Free tier serves Pages only from public repos. If Jason has a private POC, the workflow either won't work for free or needs the Pro upgrade.
- **First Pages deployment takes 30-60s.** Subsequent pushes deploy in seconds.
- **Each fine-grained PAT is scoped to ONE repo** (well, a selected set, but in practice we generate one per POC for least-privilege). Cannot reuse a `claude-dt-system` PAT for a different POC's repo.
- **The PAT appears in shell command parameters** during the bash invocation. The conversation history captures the command. Mitigations: sed-redact all script output, never write to file, remind Jason to revoke immediately. This is the residual risk worth accepting given the alternatives.

## File conventions

- Publishable artifact: `/Chief of Staff/pocs/<slug>/index.html`
- Landing page: `/Chief of Staff/pocs/<slug>/README.md`
- Publish script: `/Chief of Staff/scripts/poc-publish.sh` (the shell script that does the git push half)
- Skill that wraps the script: [[poc-publish]]

All POCs follow this convention (including `claude-dt-system`, migrated 2026-05-21 from the legacy `/Chief of Staff/poc-dt-system-publish/` path).

## The script + the skill (two-step orchestration)

`/Chief of Staff/scripts/poc-publish.sh` (v2 — 2026-05-21) — bash script that handles ONLY the git push half. Takes `repo-slug index.html README.md "commit message"` plus `GITHUB_TOKEN` env var. Clones via `github.com`, copies, commits-if-changed, pushes. Sed-redacts the token from output. Does NOT attempt to enable Pages — the original v1 script tried this via direct curl to `api.github.com` and silently failed (sandbox allowlist).

The [[poc-publish]] skill drives the orchestration:
1. Run the bash script for the git push.
2. Call the cowork-http-mcp worker's `http_request` tool to enable Pages (POST `/pages` on `api.github.com`).
3. Report the live URL.

The split exists because of the sandbox's asymmetric access: `github.com` is reachable, `api.github.com` is not. The worker is the only path to the latter from a Cowork session.

## Established case

`claude-dt-system` — the AI-first design thinking workshop architecture POC (v0.9 at time of writing). Live at https://designisagoodidea-2026.github.io/claude-dt-system/. Iterated v0.1 → v0.9 over a single Cowork session; pushed to GitHub starting at v0.3. The workflow proved out the pattern: build in Cowork, refine in chat, publish on demand. ~30 seconds per push once the PAT is in place.

## Why

POCs need a shareable URL to be useful as a portfolio talking point. Without one, the artifact stays inside Cowork — not reachable by a recruiter, hiring manager, or peer. GitHub Pages is the cheapest, simplest path that doesn't require a new platform or paid hosting. The PAT dance is friction but it's a one-time setup per POC; iterations within a session are fast.

## How to apply

- When Jason finishes a POC artifact and wants it public: invoke [[poc-publish]].
- When iterating on an existing POC in the same session: reuse the PAT, re-run the script with the updated `index.html`.
- When a new POC needs its first publish: confirm the empty public repo exists; generate a new PAT for it; run the skill.
- When done with a session that involved publishing: remind Jason to revoke the PAT.
