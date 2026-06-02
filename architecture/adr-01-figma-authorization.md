# ADR 01 — Figma authorization model

**Status:** decided 2026-05-29. Implementation staged per [scaling path](../docs/anchor-scaling-path.md).

**Decision:** service account with email-mediated invites as the target architecture. OAuth as a fallback for individual leaders. Enterprise app install as a parallel path when a pilot demands it.

## Context

Anchor's Figma connector needs read access to files belonging to designers across a leader's team or org. Three patterns are available:

1. **OAuth as the leader.** Each leader authorizes Anchor via their own Figma session. Anchor reads what the leader can read.
2. **Service account with file-level invites.** Anchor has a dedicated Figma identity tied to a public email address. Designers invite that identity to their files; Anchor monitors the inbox and auto-accepts.
3. **Enterprise app install.** Only available on Figma Enterprise. Anchor gets installed at the org level.

OAuth scales operationally to about ten leaders managing their own files. Beyond that, OAuth-per-designer becomes the bottleneck. Enterprise install only works for pilots already on Enterprise.

The service account pattern scales to many designers across many teams without OAuth-per-person overhead. Each designer invites a known email; the system handles the rest. It's the right default for the multi-team and multi-org cases Anchor is built for.

## Decision

**Target architecture.** Service account with email-mediated invites.

- A dedicated Figma account ("Anchor Watcher") tied to a public email address (e.g., `figma@<domain>`).
- The inbox is monitored. Figma invitation emails are parsed and auto-accepted against the service account's logged-in Figma session.
- After accept, the service account inherits whatever access the inviter granted (viewer, editor, comment-only).
- The Figma connector polls files the service account has access to. Webhooks come later, once the service account has team membership.

**Fallback for individual leaders.** OAuth flow.

- A leader who wants Anchor watching only their own personal files, without team-level setup, OAuths into Anchor directly.
- OAuth and service-account flows coexist in the connector. The auth model is configuration, not code branches — the connector's bus output is the same shape either way.

**Parallel path for Enterprise.** App install.

- When a pilot org is on Figma Enterprise, Anchor can be installed at the org level for cleaner permission management.
- Doesn't replace the service-account pattern; sits alongside it.

## Trade-offs

For the service account pattern:

- Scales to many designers without per-person onboarding friction.
- Decouples Anchor's identity from any leader's job status (a designer leaving the org doesn't break Anchor's access to files they shared).
- The leader's onboarding ask is small: tell your team to invite one email.

Against:

- Real engineering: inbox monitor, invitation parser, auto-accept logic, persistent Figma session, eventual team-membership flow for webhooks.
- Security surface: anyone who knows the public email can invite. Mitigated by a validation layer (leaders enroll the Figma identities they expect; the system only accepts invites from registered identities or invites carrying a project token).
- Brittleness risk: the auto-accept logic depends on Figma's invitation email format and accept-link flow. UI changes upstream could break things. Mitigated by an alert when accept rates drop unexpectedly.

## Staged build

Each stage triggered by a real-world signal, not a calendar. Stages align with [scaling path](../docs/anchor-scaling-path.md).

### Anchor Stage 1 (current) — no auth infrastructure

Jason uses a personal Figma PAT for his own files. No service account, no email plumbing. This ADR records the target; implementation deferred until a pilot signal arrives.

### Anchor Stage 2 prep — service account foundations

**Trigger:** first pilot leader identified.

- Register a domain (likely `anchor.app` or similar) or use a dedicated Gmail Workspace alias on an existing domain.
- Create the dedicated Figma account ("Anchor Watcher") tied to `figma@<domain>`.
- Create a long-lived Figma PAT for the service account; store via Path B vault once that exists (see [open decisions](../docs/anchor-open-decisions.md)) or `.env` until then.
- Manually invite the service account to one test file (Jason's). Verify polling works through the PAT.
- Document the manual onboarding procedure: the pilot's designers invite `figma@<domain>`; a human accepts each invite from the inbox until automation lands.

### Anchor Stage 2 build — auto-accept inbox monitor

**Trigger:** the pilot team has more than ~5 designers, making manual invitation acceptance friction.

- Inbox monitor running as a Cloudflare Worker reading the Gmail API (or IMAP if simpler).
- Figma invitation parser — matches against Figma's invitation email structure (sender, subject, body markers).
- Auto-accept logic. The accept link in Figma's email isn't a simple HTTP call; it triggers a browser flow. Two implementation options:
  - **Playwright** running in a sidecar service (Workers don't natively support headless browsers; deploy alongside the Worker fleet on a small VM or Fly.io machine).
  - **Figma API for invitation acceptance** if one exists (less likely but worth confirming with their docs before building Playwright infrastructure).
- Audit log of every accepted invite, sender, file, and timestamp.

### Anchor Stage 3 prep — security and multi-tenancy

**Trigger:** second pilot signs on; multi-org tenancy becomes real.

- Leader-registration system. Each leader enrolls the Figma identities (emails, team URLs) of designers they expect to send invites.
- Invitation validation. Only accept invites whose sender is on a registered leader's enrollment list, or whose invitation message carries a project-token query string the leader generated.
- Reject and alert on unregistered invites; surface to the appropriate leader to confirm or deny.
- Per-org audit log.

### Anchor Stage 3 build — webhooks via team membership

**Trigger:** webhooks become valuable (real-time signal needed; polling lag becomes a friction point in the digest).

- Figma webhooks v2 fire at the team level, not the file level — the service account needs to be a team member, not just a file collaborator.
- The leader (or a team admin) invites the service account to the team. The auto-accept logic detects team-level invitations and handles them.
- Webhook handler in the Figma connector subscribes to relevant team events; reduces polling load and tightens digest latency.

### Anchor Stage 4 — Enterprise app install (parallel path)

**Trigger:** a pilot org on Figma Enterprise asks Anchor to be installed at the org level.

- Submit Anchor to Figma's app marketplace or pursue a direct enterprise install per Figma's process.
- Enterprise install runs alongside the service-account pattern, not as a replacement. Some leaders within the org might still prefer OAuth or service-account invites for files outside the enterprise scope.

## Open questions

Resolved at Stage 2 prep, not now:

- **Email and domain.** `figma@anchor.app` (needs domain registration) vs. `figma+anchor@designisagoodidea.com` (no new domain). Default at Stage 2 prep: register the domain — name matters once external designers are inviting it.
- **Service account avatar and display name.** Default: "Anchor Watcher" with a neutral icon. Confirmed at Stage 2 prep.
- **Auto-accept implementation choice.** Playwright sidecar vs. Figma API (if one exists). Confirm at Stage 2 build by reading Figma's current API docs.
- **Validation token mechanism.** How does the leader generate a project token to include in invitations from designers Anchor hasn't seen before? Likely a per-leader signed URL Anchor generates and the leader pastes into the invitation. Decision deferred to Stage 3 prep.

## Why not other defaults

- **OAuth-only.** Operationally fine up to about ten leaders. Doesn't scale to multi-team pilots without per-designer OAuth, which is the friction the service account pattern exists to remove.
- **Enterprise-only.** Locks Anchor to Figma Enterprise customers. The first pilots will almost certainly be on Professional team plans.
- **No automation — manual invitation acceptance forever.** Works for the first pilot if the team is small. Becomes the bottleneck immediately at the second pilot.

## Related

- [layer 1 connectors](layer-1-connectors.md) — Figma connector design notes; this ADR sets the auth pattern.
- [scaling path](../docs/anchor-scaling-path.md) — the four-stage roadmap the build aligns with.
- [open decisions](../docs/anchor-open-decisions.md) — the higher-level decisions log this ADR is referenced from.
- [airgap rules](../docs/anchor-airgap-rules.md) — the service account's public Figma identity is part of Anchor's marketing surface; no leakage from leader data.
