// Anchor Layer 4 — health-trend signal.
//
// Per-container directional movement week over week. Improving / plateaued /
// eroding / no_signal per /signal-spec/health-trend.md.
//
// The composition of kinds matters more than raw counts. A week of 30
// polish edits is different from a week of 3 structural changes.
//
// Per ADR-02: `structural_share` reads only `kind === "structural"` —
// no longer contaminated by decision-tagged polishes. Decision-ness is
// orthogonal; an eventual `decision_share` computation can land alongside
// if it earns its keep.
//
// Heuristics at v0.1 (draft, refined against real history):
//   improving — structural share grew week-over-week
//               AND total weighted score ≥ prior week
//   eroding   — kind weight dropped (more polish, fewer structural),
//               OR total event count dropped below 50% of prior week
//   plateaued — no meaningful change in composition or volume
//   no_signal — fewer than 6 events across both windows combined
//
// Refused patterns (per spec):
//   - "Project X is healthy" — refuse without a named delta. Always
//     differential, never absolute.
//   - "Eroding" without a `because` example — surface the events that
//     produced the read.

import type { ChangeEvent, EventKind } from "../../shared/change-event";
import type { Signal, HealthTrendValue, EventRef } from "./types";
import { refFromEvent } from "./types";

const NO_SIGNAL_TOTAL_FLOOR = 6;
const VOLUME_DROP_THRESHOLD = 0.5;
const SHARE_DELTA_THRESHOLD = 0.1;
const BECAUSE_LIMIT = 5;

/** Kind weights per the signal-spec draft. Calibration-tuned later. */
export const KIND_WEIGHT: Record<EventKind, number> = {
  polish: 1,
  moderate: 3,
  structural: 6,
  unknown: 0,
};

/** Additive weight for events that carry the "decision" tag. */
export const DECISION_TAG_WEIGHT = 4;

export interface HealthTrendOptions {
  container_id: string;
  container_name: string;
  /** Inclusive ISO timestamp — start of the current window. */
  current_start: string;
  /** Exclusive ISO timestamp — end of the current window (also start of prior comparison). */
  current_end: string;
  /** Inclusive ISO timestamp — start of the prior window. */
  prior_start: string;
  /** Exclusive ISO timestamp — end of the prior window (typically === current_start). */
  prior_end: string;
  nowIso?: string;
}

export function computeHealthTrend(events: ChangeEvent[], opts: HealthTrendOptions): Signal {
  const inContainer = events.filter((e) => isForContainer(e, opts.container_id));

  const current = inContainer.filter((e) => inWindow(e, opts.current_start, opts.current_end));
  const prior = inContainer.filter((e) => inWindow(e, opts.prior_start, opts.prior_end));

  const value = classify(current, prior);
  const evidenceBase = current.length > 0 ? current : prior;
  const because = rankImportant(evidenceBase).slice(0, BECAUSE_LIMIT).map(refFromEvent);

  return {
    kind: "health_trend",
    container_id: opts.container_id,
    container_name: opts.container_name,
    window: { start: opts.current_start, end: opts.current_end },
    value,
    because,
    computed_at: opts.nowIso ?? new Date().toISOString(),
  };
}

// ─── Internals ──────────────────────────────────────────────────────────────

function isForContainer(e: ChangeEvent, containerId: string): boolean {
  if (e.container_id === undefined || e.container_id === null) return true;
  return e.container_id === containerId;
}

function inWindow(e: ChangeEvent, start: string, end: string): boolean {
  return e.timestamp >= start && e.timestamp < end;
}

function eventWeight(e: ChangeEvent): number {
  return KIND_WEIGHT[e.kind] + (e.tags.includes("decision") ? DECISION_TAG_WEIGHT : 0);
}

function weighted(events: ChangeEvent[]): number {
  return events.reduce((sum, e) => sum + eventWeight(e), 0);
}

function structuralShare(events: ChangeEvent[]): number {
  if (events.length === 0) return 0;
  const heavy = events.filter((e) => e.kind === "structural");
  return heavy.length / events.length;
}

function classify(current: ChangeEvent[], prior: ChangeEvent[]): HealthTrendValue {
  const current_count = current.length;
  const prior_count = prior.length;
  const current_weight = weighted(current);
  const prior_weight = weighted(prior);

  if (current_count + prior_count < NO_SIGNAL_TOTAL_FLOOR) {
    return {
      current_count,
      prior_count,
      current_weight,
      prior_weight,
      trend: "no_signal",
    };
  }

  const currentShare = structuralShare(current);
  const priorShare = structuralShare(prior);
  const shareDelta = currentShare - priorShare;
  const volumeRatio = prior_count === 0 ? Infinity : current_count / prior_count;
  const weightRatio = prior_weight === 0 ? Infinity : current_weight / prior_weight;

  let trend: HealthTrendValue["trend"];

  if (volumeRatio < VOLUME_DROP_THRESHOLD && prior_count >= NO_SIGNAL_TOTAL_FLOOR) {
    trend = "eroding";
  } else if (weightRatio < VOLUME_DROP_THRESHOLD && prior_weight > 0) {
    trend = "eroding";
  } else if (shareDelta >= SHARE_DELTA_THRESHOLD && current_weight >= prior_weight) {
    trend = "improving";
  } else if (shareDelta <= -SHARE_DELTA_THRESHOLD) {
    trend = "eroding";
  } else {
    trend = "plateaued";
  }

  return {
    current_count,
    prior_count,
    current_weight,
    prior_weight,
    trend,
  };
}

function rankImportant(events: ChangeEvent[]): ChangeEvent[] {
  return [...events].sort((a, b) => {
    const wa = eventWeight(a);
    const wb = eventWeight(b);
    if (wa !== wb) return wb - wa;
    // Tiebreak: most recent first.
    return b.timestamp.localeCompare(a.timestamp);
  });
}
