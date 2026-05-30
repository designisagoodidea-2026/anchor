---
name: anchor-scaling-path
description: Four-stage roadmap from POC to scaled deployment, with explicit triggers for each stage transition.
metadata:
  type: project
---

## Stage 1 — POC

Three connectors, one voice profile, declared containers, three signals. Self-instrumented (synthetic plus own-generated) demo. Shippable as a portfolio artifact plus a cover-letter close hook.

**Duration.** 2-3 weeks.

**Defining ship.** The Anchor demo (per Part 12 of the bootstrap doc — the prospect-facing walkthrough). Anchor renders one daily digest plus one Friday narrative against Jason's own data, anchored against the prior week.

## Stage 2 — First real-org pilot

Add Codex and Coda connectors. Calibration loop turned on — the leader marks digest items as right, wrong, or noise; the system adjusts magnitude thresholds and signal weights per leader. Six signals (add cross-BU coordination cost, decision rework, schedule reality). One additional voice profile (a pilot leader's, not Jason's).

**Duration.** ~6 weeks after Stage 1 ships.

**Trigger to start.** A real leader at a real org wants to try it. Don't start before that.

## Stage 3 — Public MCP SDK

Connectors become community-extensible. Container resolution gets the embedding-inference layer. Multi-leader support inside one deployment. Voice profile spec published.

**Duration.** ~8 weeks.

**Trigger.** Two pilot orgs running and calibration data flowing. Premature otherwise.

## Stage 4 — Scaled deployment

Multi-org tenancy. Role-based viewing. Audit and governance. This is v1.0, not the POC.

**Duration.** Quarters, not weeks.

**Trigger.** Product-market fit signal from pilots. Don't pre-scale.

## Why the staging matters

Each stage is gated by a real-world signal, not a calendar. The system gets pushed forward when the prior stage produces evidence the next stage is worth building. Building Stage 3 infrastructure without two paying pilots is the failure mode the staging exists to prevent.

## Related

- [[anchor-poc-scope]] — what Stage 1 actually builds.
- [[anchor-sprints-week-1-3]] — the first three sprints inside Stage 1.
- [[anchor-open-decisions]] — explicit deferrals for Stage 2 features.
