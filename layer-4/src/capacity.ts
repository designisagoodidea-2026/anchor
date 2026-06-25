// Anchor Layer 4 — capacity signal.
//
// Per-person × per-container event count over a window, classified as
// surge / sustained / slack / no_signal per /signal-spec/capacity.md.
//
// Heuristics at v0.1 (calibration-tuned per-leader later):
//   surge        — event_count > 2× baseline
//   sustained    — event_count within ±30% of baseline
//   slack        — event_count < 0.5× baseline
//   no_signal    — event_count < 3 (the spec's refusal floor)
//
// Baseline is the median of prior windows. Without prior windows the v0.1
// fallback baseline is 5 events/window — refined when real signal history
// accumulates.
//
// Per ADR-02: `because` ranks by (kind weight × recency), with an additive
// boost for events carrying the `"decision"` tag. Scope and decision-ness
// are independent — a decision-tagged polish edit ranks above an untagged
// polish edit, but below a structural change.
//
// Refused patterns (per spec):
//   - Aggregate capacity ("the team is overloaded") — refuse; always
//     per-person.
//   - Capacity-by-kind without context — pair with `because`.

import type { ChangeEvent, EventKind } from "../../shared/change-event";
import type { Signal, CapacityValue, EventRef } from "./types";
import { refFromEvent, EMPTY_KIND_COUNTS } from "./types";

const NO_SIGNAL_FLOOR = 3;
const SURGE_FACTOR = 2.0;
const SLACK_FACTOR = 0.5;
const SUSTAINED_TOLERANCE = 0.3;
const BECAUSE_LIMIT = 5;
const DEFAULT_FALLBACK_BASELINE = 5;

/** Kind weight for ranking events in the `because` evidence. */
const KIND_WEIGHT: Record<EventKind, number> = {
  polish: 1,
  moderate: 3,
  structural: 6,
  unknown: 1,
};

/** Additive boost for events carrying the `"decision"` tag. */
const DECISION_TAG_BOOST = 4;

export interface CapacityOptions {
  /** Container id to compute for. Container name comes along for the ride. */
  container_id: string;
  container_name: string;
  /** ISO timestamp — start of the analysis window. Inclusive. */
  window_start: string;
  /** ISO timestamp — end of the analysis window. Exclusive. */
  window_end: string;
  /** Median events/window across prior windows for this person. */
  baseline_per_window?: number | null;
  /** Override now() in tests. */
  nowIso?: string;
}

/**
 * Pure function. Returns one Signal per actor that appeared in the window.
 * If no events for the container, returns an empty array (no signal at all).
 */
export function computeCapacity(events: ChangeEvent[], opts: CapacityOptions): Signal[] {
  // Filter to (container, window). Caller is expected to pre-filter by
  // container_id; we double-check here to be paranoid.
  const inScope = events.filter((e) => isInScope(e, opts));

  // Group by actor.
  const byPerson = new Map<string, ChangeEvent[]>();
  for (const e of inScope) {
    const id = e.actor.id;
    if (!byPerson.has(id)) byPerson.set(id, []);
    byPerson.get(id)!.push(e);
  }

  const now = opts.nowIso ?? new Date().toISOString();
  const signals: Signal[] = [];

  for (const [personId, personEvents] of byPerson) {
    const value = classifyPerson(personId, personEvents, opts.baseline_per_window ?? null);
    const because = rankEvents(personEvents).slice(0, BECAUSE_LIMIT).map(refFromEvent);

    signals.push({
      kind: "capacity",
      container_id: opts.container_id,
      container_name: opts.container_name,
      window: { start: opts.window_start, end: opts.window_end },
      value,
      because,
      computed_at: now,
    });
  }

  return signals;
}

// ─── Internals ──────────────────────────────────────────────────────────────

function isInScope(e: ChangeEvent, opts: CapacityOptions): boolean {
  // Container check — if container_id is set on the event, it must match.
  if (e.container_id !== undefined && e.container_id !== null && e.container_id !== opts.container_id) {
    return false;
  }
  // Window check — inclusive start, exclusive end.
  return e.timestamp >= opts.window_start && e.timestamp < opts.window_end;
}

function classifyPerson(
  personId: string,
  events: ChangeEvent[],
  baseline: number | null
): CapacityValue {
  const by_kind = { ...EMPTY_KIND_COUNTS };
  let decision_count = 0;
  for (const e of events) {
    by_kind[e.kind]++;
    if (e.tags.includes("decision")) decision_count++;
  }

  const count = events.length;
  const baselineUsed = baseline ?? DEFAULT_FALLBACK_BASELINE;
  const personLabel = events[0]?.actor.display_name ?? personId;

  let state: CapacityValue["state"];
  if (count < NO_SIGNAL_FLOOR) {
    state = "no_signal";
  } else if (count > baselineUsed * SURGE_FACTOR) {
    state = "surge";
  } else if (count < baselineUsed * SLACK_FACTOR) {
    state = "slack";
  } else if (Math.abs(count - baselineUsed) <= baselineUsed * SUSTAINED_TOLERANCE) {
    state = "sustained";
  } else {
    // Between slack and surge but outside the sustained tolerance — most
    // honest read is "sustained-ish, no strong signal." Don't fake surge.
    state = "sustained";
  }

  return {
    person: personId,
    person_label: personLabel,
    event_count: count,
    by_kind,
    decision_count,
    state,
    baseline_per_window: baseline,
  };
}

/**
 * Ranks events by (kind weight × recency) with an additive boost for
 * decision-tagged events. Most-recent structural and decision-tagged events
 * come first; old polish events come last.
 */
function rankEvents(events: ChangeEvent[]): ChangeEvent[] {
  if (events.length === 0) return [];
  const times = events.map((e) => new Date(e.timestamp).getTime());
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const span = Math.max(maxT - minT, 1);

  return [...events].sort((a, b) => score(b) - score(a));

  function score(e: ChangeEvent): number {
    const w = KIND_WEIGHT[e.kind] + (e.tags.includes("decision") ? DECISION_TAG_BOOST : 0);
    const recency = (new Date(e.timestamp).getTime() - minT) / span;
    return w * (1 + recency);
  }
}
