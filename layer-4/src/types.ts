// Anchor Layer 4 — translation types.
//
// Signals are what a leader actually reads. Each one carries a load-bearing
// `because` field — the evidence that produced it. Per the architecture's
// hard rule: no `because`, no signal.
//
// Per ADR-02 (2026-06-02): events carry `kind` (scope-only enum) and
// `tags: string[]` (open vocabulary, v0.1 emits `"decision"`). Layer 4
// reads both — `kind` weights events; `tags` triggers decision-shaped
// rules independently of scope.

import type { ChangeEvent, EventKind } from "../../shared/change-event";

export type SignalKind = "capacity" | "health_trend" | "drift";

export interface EventRef {
  /** Echo of the change_event's raw_ref so the renderer can deep-link. */
  raw_ref: string;
  /** Brief preview — same value the original event carried. */
  snippet: string;
  /** When the underlying event happened. */
  timestamp: string;
  /** Scope of change at the time of capture. */
  kind: EventKind;
  /** Tags carried by the source event (e.g., ["decision"]). */
  tags: string[];
}

/**
 * The structured value of a capacity signal. Per architecture: per-person,
 * per-container load, never an aggregate "the team is overloaded" — that's
 * a refused pattern per /signal-spec/capacity.md.
 */
export interface CapacityValue {
  /** Actor id (from event.actor.id). */
  person: string;
  /** Human-readable label if known. Defaults to person id. */
  person_label: string;
  /** Event count in the window. */
  event_count: number;
  /** Counts per kind bucket. */
  by_kind: Record<EventKind, number>;
  /** Count of events carrying the "decision" tag. Orthogonal to by_kind. */
  decision_count: number;
  /** Classified load state. `no_signal` returns when count is below the floor. */
  state: "surge" | "sustained" | "slack" | "no_signal";
  /** Median used as the comparison baseline (events per window). */
  baseline_per_window: number | null;
}

export interface HealthTrendValue {
  /** Total events in the most recent window. */
  current_count: number;
  /** Total events in the immediately prior window. */
  prior_count: number;
  /** Kind-weighted score for current window (higher = more structural activity). */
  current_weight: number;
  /** Kind-weighted score for the prior window. */
  prior_weight: number;
  /** Direction classification. */
  trend: "improving" | "plateaued" | "eroding" | "no_signal";
}

export interface DriftValue {
  /** Principle id from the principles file. */
  principle_id: string;
  /** Principle text — rendered verbatim by the digest. */
  principle_text: string;
  /** Per-architecture: per-principle, per-container compliance read. */
  state: "compliant" | "drifting" | "no_signal";
  /** Count of trigger events that fired in the window. */
  triggers_fired: number;
  /** Count of triggers that found compliance evidence. */
  triggers_satisfied: number;
}

/**
 * Common Signal shape. Each signal kind's `value` field is structured per
 * its respective interface above; the `because` field is the load-bearing
 * evidence trail — no signal renders without one populated.
 */
export interface Signal {
  kind: SignalKind;
  container_id: string;
  container_name: string;
  /** Inclusive-exclusive ISO timestamps for the analysis window. */
  window: { start: string; end: string };
  value: CapacityValue | HealthTrendValue | DriftValue;
  /** The events that produced the signal. Empty array = the signal must be `no_signal`. */
  because: EventRef[];
  /** When this signal was computed. */
  computed_at: string;
}

// ─── Principle config (loaded from yaml) ────────────────────────────────────

export interface PrincipleFile {
  principles: Principle[];
}

export interface Principle {
  id: string;
  text: string;
  check: PrincipleCheck;
  window_hours: number;
}

export type PrincipleCheck = TriggerThenComplianceCheck | TextPresenceCheck;

export interface TriggerThenComplianceCheck {
  kind: "trigger_then_compliance";
  trigger: EventMatcher;
  compliance: EventMatcher;
}

export interface TextPresenceCheck {
  kind: "text_presence";
  trigger: EventMatcher;
  compliance: SnippetMatcher;
}

/**
 * Substring matchers over change_event fields. All fields must match (AND).
 * `_contains_any_of` is OR within the same field. `tags_include` matches
 * when the event's `tags` array contains the literal value.
 */
export interface EventMatcher {
  source?: ChangeEvent["source"];
  kind?: EventKind;
  tags_include?: string;
  entity_id_contains?: string;
  entity_id_contains_any_of?: string[];
  entity_id_ends_with?: string;
}

export interface SnippetMatcher {
  snippet_contains_any_of: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function refFromEvent(event: ChangeEvent): EventRef {
  return {
    raw_ref: event.raw_ref,
    snippet: event.snippet,
    timestamp: event.timestamp,
    kind: event.kind,
    tags: event.tags,
  };
}

export const EMPTY_KIND_COUNTS: Record<EventKind, number> = {
  polish: 0,
  moderate: 0,
  structural: 0,
  unknown: 0,
};
