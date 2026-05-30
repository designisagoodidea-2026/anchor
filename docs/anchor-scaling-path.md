---
name: anchor-scaling-path
description: Four-stage roadmap from POC to scaled deployment, with explicit triggers for each stage transition.
publish: true
metadata:
  type: project
---

## Stage 1 — POC

Three connectors, one voice profile, declared containers, three signals. Self-instrumented (synthetic plus own-generated) demo. Shippable as a portfolio artifact plus a cover-letter close hook.

**Duration.** 2-3 weeks.

**Defining ship.** The Anchor demo (per Part 12 of the bootstrap doc — the prospect-facing walkthrough). Anchor renders one daily digest plus one Friday narrative against Jason's own data, anchored against the prior week.

## Stage 2 — First real-org pilot

Add Codex and Coda connectors. Calibration loop turned on — the leader marks digest items as right, wrong, or noise; the system adjusts magnitude thresholds and signal weights per leader. Six signals (add cross-BU coordination cost, decision rework, schedule reality). One additional voice profile (a pilot leader's, not Jason's).

**Auth infrastructure foundations.** Per [adr 01 figma authorization](../architecture/adr-01-figma-authorization.md), Stage 2 prep stands up the Figma service account, dedicated email inbox, and domain. Manual invitation acceptance until the pilot exceeds ~5 designers; the inbox monitor and auto-accept logic land in Stage 2 build at that point.

**Duration.** ~6 weeks after Stage 1 ships.

**Trigger to start.** A real leader at a real org wants to try it. Don't start before that.

## Stage 3 — Public MCP SDK

Connectors become community-extensible. Container resolution gets the embedding-inference layer. Multi-leader support inside one deployment. Voice profile spec published.

**Auth infrastructure — security and webhooks.** Per [adr 01 figma authorization](../architecture/adr-01-figma-authorization.md), Stage 3 prep adds the leader-registration system and invitation validation layer (only accept invites from registered identities, or those carrying a project token). Stage 3 build adds Figma webhooks v2, which requires the service account to be a team member, not just a file collaborator.

**Duration.** ~8 weeks.

**Trigger.** Two pilot orgs running and calibration data flowing. Premature otherwise.

## Stage 4 — Scaled deployment

Multi-org tenancy. Role-based viewing. Audit and governance. This is v1.0, not the POC.

**Auth infrastructure — Enterprise install (parallel path).** Per [adr 01 figma authorization](../architecture/adr-01-figma-authorization.md), Figma Enterprise app install becomes available when a pilot org on Enterprise asks for it. Doesn't replace the service-account pattern; sits alongside.

**Duration.** Quarters, not weeks.

**Trigger.** Product-market fit signal from pilots. Don't pre-scale.

## Why the staging matters

Each stage is gated by a real-world signal, not a calendar. The system gets pushed forward when the prior stage produces evidence the next stage is worth building. Building Stage 3 infrastructure without two paying pilots is the failure mode the staging exists to prevent.

## Related

- [poc scope](anchor-poc-scope.md) — what Stage 1 actually builds.
- [sprints week 1 3](anchor-sprints-week-1-3.md) — the first three sprints inside Stage 1.
- [open decisions](anchor-open-decisions.md) — explicit deferrals for Stage 2 features.
