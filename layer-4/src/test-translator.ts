// Anchor Layer 4 — fixture tests for capacity / health-trend / drift / translator.
//
// node:assert only. Same Node-only pattern as the other connectors' tests.
// Run with `npm test`.
//
// Per ADR-02: events carry `kind` (scope) and `tags` (open vocabulary,
// "decision" being the v0.1 emitter). Fixtures and assertions read both
// fields independently.

import assert from "node:assert/strict";

import { computeCapacity } from "./capacity.js";
import { computeHealthTrend, KIND_WEIGHT, DECISION_TAG_WEIGHT } from "./health-trend.js";
import { computeDrift } from "./drift.js";
import { computeSignals, computeSignalsWithDiagnostics } from "./translator.js";
import { eventMatches, snippetMatches } from "./principles.js";
import type { Principle } from "./types.js";
import type { ChangeEvent, EventKind } from "../../shared/change-event";

// ─── Fixture builders ───────────────────────────────────────────────────────

const CONTAINER = "c-anchor";

function ev(over: Partial<ChangeEvent>): ChangeEvent {
  return {
    actor: { id: "u-jason", display_name: "Jason", source_user_id: "u-jason", role_hint: null },
    timestamp: "2026-05-30T18:00:00.000Z",
    source: "cowork",
    entity_id: "memory/anchor-purpose.md",
    entity_type: "memory_entry",
    parent_id: "memory",
    action: "edit",
    kind: "moderate",
    tags: [],
    snippet: "",
    raw_ref: "file:///x.md",
    container_id: CONTAINER,
    ...over,
  };
}

function makeEvents(count: number, baseTime: string, kind: EventKind = "polish"): ChangeEvent[] {
  const out: ChangeEvent[] = [];
  const base = new Date(baseTime).getTime();
  for (let i = 0; i < count; i++) {
    out.push(ev({
      timestamp: new Date(base + i * 60000).toISOString(),
      entity_id: `memory/file-${i}.md`,
      kind,
    }));
  }
  return out;
}

// ─── Runner ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function check(label: string, fn: () => void) {
  try { fn(); console.log(`  ok  ${label}`); passed++; }
  catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  fail ${label}`);
    console.log(`       ${msg}`);
    failed++;
  }
}

console.log("\nAnchor layer-4 — translator fixture tests\n");

// ─── Capacity ──────────────────────────────────────────────────────────────

check("capacity: fewer than 3 events → no_signal", () => {
  const events = makeEvents(2, "2026-05-30T18:00:00.000Z");
  const [s] = computeCapacity(events, {
    container_id: CONTAINER,
    container_name: "Anchor",
    window_start: "2026-05-30T17:00:00.000Z",
    window_end: "2026-05-30T19:00:00.000Z",
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  assert.equal(s.value.state, "no_signal");
  assert.equal(s.because.length, 2);   // because = ranked events; honest about what landed
});

check("capacity: 12 events vs baseline 5 → surge", () => {
  const events = makeEvents(12, "2026-05-30T18:00:00.000Z");
  const [s] = computeCapacity(events, {
    container_id: CONTAINER,
    container_name: "Anchor",
    window_start: "2026-05-30T17:00:00.000Z",
    window_end: "2026-05-30T19:00:00.000Z",
    baseline_per_window: 5,
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  assert.equal(s.value.state, "surge");
  assert.equal((s.value as { person: string }).person, "u-jason");
  assert.equal((s.value as { event_count: number }).event_count, 12);
});

check("capacity: 5 events vs baseline 5 → sustained", () => {
  const events = makeEvents(5, "2026-05-30T18:00:00.000Z");
  const [s] = computeCapacity(events, {
    container_id: CONTAINER,
    container_name: "Anchor",
    window_start: "2026-05-30T17:00:00.000Z",
    window_end: "2026-05-30T19:00:00.000Z",
    baseline_per_window: 5,
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  assert.equal(s.value.state, "sustained");
});

check("capacity: per-person split returns two signals when actors differ", () => {
  const a = ev({ actor: { id: "u-jason", display_name: "Jason", source_user_id: "u-jason", role_hint: null }, timestamp: "2026-05-30T18:01:00.000Z" });
  const b = ev({ actor: { id: "u-mira", display_name: "Mira", source_user_id: "u-mira", role_hint: null }, timestamp: "2026-05-30T18:02:00.000Z" });
  const c = ev({ actor: { id: "u-mira", display_name: "Mira", source_user_id: "u-mira", role_hint: null }, timestamp: "2026-05-30T18:03:00.000Z" });
  const signals = computeCapacity([a, b, c], {
    container_id: CONTAINER,
    container_name: "Anchor",
    window_start: "2026-05-30T17:00:00.000Z",
    window_end: "2026-05-30T19:00:00.000Z",
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  assert.equal(signals.length, 2);
  const people = signals.map((s) => (s.value as { person: string }).person).sort();
  assert.deepEqual(people, ["u-jason", "u-mira"]);
});

check("capacity: because ranks structural and decision-tagged ahead of polish", () => {
  const events = [
    ev({ kind: "polish",     timestamp: "2026-05-30T18:00:00.000Z", entity_id: "polish-1" }),
    ev({ kind: "polish",     timestamp: "2026-05-30T18:01:00.000Z", entity_id: "polish-2" }),
    ev({ kind: "polish",     timestamp: "2026-05-30T18:02:00.000Z", entity_id: "decision-1", tags: ["decision"] }),
    ev({ kind: "structural", timestamp: "2026-05-30T18:03:00.000Z", entity_id: "structural-1" }),
  ];
  const [s] = computeCapacity(events, {
    container_id: CONTAINER,
    container_name: "Anchor",
    window_start: "2026-05-30T17:00:00.000Z",
    window_end: "2026-05-30T19:00:00.000Z",
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  // Structural beats decision-tagged polish on raw weight.
  assert.equal(s.because[0]!.kind, "structural");
  // The decision-tagged polish ranks above an untagged polish.
  assert.deepEqual(s.because[1]!.tags, ["decision"]);
  assert.equal(s.because[1]!.kind, "polish");
});

check("capacity: by_kind counts scope independently of decision tag", () => {
  const events = [
    ev({ kind: "polish",     timestamp: "2026-05-30T18:00:00.000Z", entity_id: "p-1" }),
    ev({ kind: "polish",     timestamp: "2026-05-30T18:01:00.000Z", entity_id: "p-2", tags: ["decision"] }),
    ev({ kind: "structural", timestamp: "2026-05-30T18:02:00.000Z", entity_id: "s-1" }),
  ];
  const [s] = computeCapacity(events, {
    container_id: CONTAINER,
    container_name: "Anchor",
    window_start: "2026-05-30T17:00:00.000Z",
    window_end: "2026-05-30T19:00:00.000Z",
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  const v = s.value as { by_kind: Record<string, number>; decision_count: number };
  assert.equal(v.by_kind.polish, 2);
  assert.equal(v.by_kind.structural, 1);
  assert.equal(v.decision_count, 1);
});

// ─── Health-trend ──────────────────────────────────────────────────────────

check("health_trend: under-floor → no_signal", () => {
  const current = makeEvents(2, "2026-05-30T18:00:00.000Z");
  const prior = makeEvents(2, "2026-05-23T18:00:00.000Z");
  const s = computeHealthTrend([...current, ...prior], {
    container_id: CONTAINER,
    container_name: "Anchor",
    current_start: "2026-05-30T00:00:00.000Z",
    current_end:   "2026-05-31T00:00:00.000Z",
    prior_start:   "2026-05-23T00:00:00.000Z",
    prior_end:     "2026-05-30T00:00:00.000Z",
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  assert.equal((s.value as { trend: string }).trend, "no_signal");
});

check("health_trend: volume halved → eroding", () => {
  const current = makeEvents(5, "2026-05-30T08:00:00.000Z");
  const prior = makeEvents(15, "2026-05-23T08:00:00.000Z");
  const s = computeHealthTrend([...current, ...prior], {
    container_id: CONTAINER,
    container_name: "Anchor",
    current_start: "2026-05-30T00:00:00.000Z",
    current_end:   "2026-05-31T00:00:00.000Z",
    prior_start:   "2026-05-23T00:00:00.000Z",
    prior_end:     "2026-05-30T00:00:00.000Z",
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  assert.equal((s.value as { trend: string }).trend, "eroding");
});

check("health_trend: structural share grew → improving", () => {
  const prior = [
    ...makeEvents(9, "2026-05-23T08:00:00.000Z", "polish"),
    ...makeEvents(1, "2026-05-23T16:00:00.000Z", "structural"),
  ];
  // Current window has more structural share than prior. Decision-tagged
  // events boost the weight but don't fold into the structural share —
  // that's the point of the ADR-02 split.
  const current = [
    ...makeEvents(2, "2026-05-30T08:00:00.000Z", "polish"),
    ...makeEvents(4, "2026-05-30T12:00:00.000Z", "structural"),
  ];
  const s = computeHealthTrend([...current, ...prior], {
    container_id: CONTAINER,
    container_name: "Anchor",
    current_start: "2026-05-30T00:00:00.000Z",
    current_end:   "2026-05-31T00:00:00.000Z",
    prior_start:   "2026-05-23T00:00:00.000Z",
    prior_end:     "2026-05-30T00:00:00.000Z",
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  const v = s.value as { trend: string; current_weight: number; prior_weight: number };
  assert.equal(v.trend, "improving");
  assert.ok(v.current_weight > v.prior_weight);
});

check("health_trend: kind weights match the spec", () => {
  assert.equal(KIND_WEIGHT.polish, 1);
  assert.equal(KIND_WEIGHT.moderate, 3);
  assert.equal(KIND_WEIGHT.structural, 6);
  assert.equal(KIND_WEIGHT.unknown, 0);
  assert.equal(DECISION_TAG_WEIGHT, 4);
});

check("health_trend: decision tag adds weight but not to structural share", () => {
  // 5 polish events: 3 untagged + 2 decision-tagged. Structural share is 0.
  // Weight is 5×1 + 2×4 = 13 (each decision-tagged polish weighs 1 + 4 = 5).
  const events = [
    ev({ kind: "polish", timestamp: "2026-05-30T08:00:00Z", entity_id: "p1" }),
    ev({ kind: "polish", timestamp: "2026-05-30T09:00:00Z", entity_id: "p2" }),
    ev({ kind: "polish", timestamp: "2026-05-30T10:00:00Z", entity_id: "p3" }),
    ev({ kind: "polish", timestamp: "2026-05-30T11:00:00Z", entity_id: "p4", tags: ["decision"] }),
    ev({ kind: "polish", timestamp: "2026-05-30T12:00:00Z", entity_id: "p5", tags: ["decision"] }),
    // Prior: 5 polish events, no decisions.
    ...makeEvents(5, "2026-05-23T08:00:00.000Z", "polish"),
  ];
  const s = computeHealthTrend(events, {
    container_id: CONTAINER,
    container_name: "Anchor",
    current_start: "2026-05-30T00:00:00.000Z",
    current_end:   "2026-05-31T00:00:00.000Z",
    prior_start:   "2026-05-23T00:00:00.000Z",
    prior_end:     "2026-05-30T00:00:00.000Z",
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  const v = s.value as { current_weight: number; prior_weight: number };
  assert.equal(v.current_weight, 13);
  assert.equal(v.prior_weight, 5);
});

// ─── Drift ─────────────────────────────────────────────────────────────────

const TESTS_PRINCIPLE: Principle = {
  id: "tests-with-connector-code",
  text: "Every new or edited connector ships with fixture tests touched in the same session.",
  check: {
    kind: "trigger_then_compliance",
    trigger: {
      source: "cowork",
      entity_id_contains: "connectors/",
      entity_id_contains_any_of: ["src/index"],
    },
    compliance: {
      source: "cowork",
      entity_id_contains_any_of: ["src/test-"],
    },
  },
  window_hours: 4,
};

const README_PRINCIPLE: Principle = {
  id: "readmes-track-state",
  text: "Every README edit on a multi-step setup folder includes a Setup status block.",
  check: {
    kind: "text_presence",
    trigger: {
      source: "cowork",
      entity_id_ends_with: "README.md",
      entity_id_contains_any_of: ["connectors/", "layer-3/"],
    },
    compliance: {
      snippet_contains_any_of: ["Setup status"],
    },
  },
  window_hours: 0,
};

const DECISION_PRINCIPLE: Principle = {
  id: "decisions-are-written-down",
  text: "Trade-off decisions are captured in writing within 24 hours.",
  check: {
    kind: "trigger_then_compliance",
    trigger: {
      tags_include: "decision",
    },
    compliance: {
      source: "cowork",
      entity_id_contains_any_of: ["architecture/", "memory/"],
    },
  },
  window_hours: 24,
};

check("drift: trigger fires + compliance found → compliant", () => {
  const events = [
    ev({ entity_id: "connectors/slack/src/index.ts",   timestamp: "2026-05-30T18:00:00.000Z" }),
    ev({ entity_id: "connectors/slack/src/test-x.ts",  timestamp: "2026-05-30T18:30:00.000Z" }),
  ];
  const [s] = computeDrift(events, [TESTS_PRINCIPLE], {
    container_id: CONTAINER,
    container_name: "Anchor",
    window_start: "2026-05-30T17:00:00.000Z",
    window_end: "2026-05-30T19:00:00.000Z",
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  const v = s.value as { state: string; triggers_satisfied: number };
  assert.equal(v.state, "compliant");
  assert.equal(v.triggers_satisfied, 1);
});

check("drift: trigger fires, no compliance → drifting", () => {
  const events = [
    ev({ entity_id: "connectors/slack/src/index.ts", timestamp: "2026-05-30T18:00:00.000Z" }),
  ];
  const [s] = computeDrift(events, [TESTS_PRINCIPLE], {
    container_id: CONTAINER,
    container_name: "Anchor",
    window_start: "2026-05-30T17:00:00.000Z",
    window_end: "2026-05-30T19:00:00.000Z",
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  const v = s.value as { state: string };
  assert.equal(v.state, "drifting");
  assert.equal(s.because.length, 1);
});

check("drift: no trigger fired → no_signal (don't fake compliance)", () => {
  const events = [
    ev({ entity_id: "memory/anchor-purpose.md", timestamp: "2026-05-30T18:00:00.000Z" }),
  ];
  const [s] = computeDrift(events, [TESTS_PRINCIPLE], {
    container_id: CONTAINER,
    container_name: "Anchor",
    window_start: "2026-05-30T17:00:00.000Z",
    window_end: "2026-05-30T19:00:00.000Z",
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  const v = s.value as { state: string; triggers_fired: number };
  assert.equal(v.state, "no_signal");
  assert.equal(v.triggers_fired, 0);
  assert.equal(s.because.length, 0);
});

check("drift: text_presence — same event content carries compliance → compliant", () => {
  const events = [
    ev({
      entity_id: "connectors/slack/README.md",
      snippet: "...## Setup status\n| Step | State |...",
      timestamp: "2026-05-30T18:00:00.000Z",
    }),
  ];
  const [s] = computeDrift(events, [README_PRINCIPLE], {
    container_id: CONTAINER,
    container_name: "Anchor",
    window_start: "2026-05-30T17:00:00.000Z",
    window_end: "2026-05-30T19:00:00.000Z",
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  assert.equal((s.value as { state: string }).state, "compliant");
});

check("drift: text_presence — missing Setup status → drifting", () => {
  const events = [
    ev({
      entity_id: "connectors/slack/README.md",
      snippet: "Just a connector",
      timestamp: "2026-05-30T18:00:00.000Z",
    }),
  ];
  const [s] = computeDrift(events, [README_PRINCIPLE], {
    container_id: CONTAINER,
    container_name: "Anchor",
    window_start: "2026-05-30T17:00:00.000Z",
    window_end: "2026-05-30T19:00:00.000Z",
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  assert.equal((s.value as { state: string }).state, "drifting");
});

check("drift: tags_include trigger fires on decision-tagged event regardless of kind", () => {
  // A decision-tagged polish event in slack fires the decision principle.
  // The compliance event in /memory/ within 24 hours satisfies it.
  const events = [
    ev({
      source: "slack",
      entity_id: "C01:1780166400.000100",
      kind: "polish",
      tags: ["decision"],
      timestamp: "2026-05-30T08:00:00.000Z",
    }),
    ev({
      entity_id: "memory/decision-note.md",
      timestamp: "2026-05-30T10:00:00.000Z",
    }),
  ];
  const [s] = computeDrift(events, [DECISION_PRINCIPLE], {
    container_id: CONTAINER,
    container_name: "Anchor",
    window_start: "2026-05-30T00:00:00.000Z",
    window_end: "2026-05-30T23:59:59.000Z",
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  assert.equal((s.value as { state: string }).state, "compliant");
});

check("drift: tags_include trigger without compliance → drifting", () => {
  const events = [
    ev({
      source: "slack",
      entity_id: "C01:1780166400.000200",
      kind: "polish",
      tags: ["decision"],
      timestamp: "2026-05-30T08:00:00.000Z",
    }),
  ];
  const [s] = computeDrift(events, [DECISION_PRINCIPLE], {
    container_id: CONTAINER,
    container_name: "Anchor",
    window_start: "2026-05-30T00:00:00.000Z",
    window_end: "2026-05-30T23:59:59.000Z",
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  assert.equal((s.value as { state: string }).state, "drifting");
});

// ─── Matcher unit tests ────────────────────────────────────────────────────

check("eventMatches: AND across fields, OR within _any_of", () => {
  const e = ev({ entity_id: "connectors/slack/src/index.ts" });
  assert.equal(
    eventMatches(e, { source: "cowork", entity_id_contains_any_of: ["src/index", "src/classify"] }),
    true
  );
  assert.equal(
    eventMatches(e, { source: "slack" }),
    false
  );
});

check("eventMatches: tags_include matches when event tags array contains value", () => {
  const tagged = ev({ tags: ["decision"] });
  const untagged = ev({ tags: [] });
  assert.equal(eventMatches(tagged, { tags_include: "decision" }), true);
  assert.equal(eventMatches(untagged, { tags_include: "decision" }), false);
});

check("eventMatches: kind AND tags_include both required when both specified", () => {
  const structDecision = ev({ kind: "structural", tags: ["decision"] });
  const structOnly = ev({ kind: "structural", tags: [] });
  const polishDecision = ev({ kind: "polish", tags: ["decision"] });
  const matcher = { kind: "structural" as const, tags_include: "decision" };
  assert.equal(eventMatches(structDecision, matcher), true);
  assert.equal(eventMatches(structOnly, matcher), false);
  assert.equal(eventMatches(polishDecision, matcher), false);
});

check("snippetMatches: case-insensitive substring match", () => {
  const e = ev({ snippet: "Setup status entries" });
  assert.equal(snippetMatches(e, { snippet_contains_any_of: ["setup STATUS"] }), true);
  assert.equal(snippetMatches(e, { snippet_contains_any_of: ["something else"] }), false);
});

// ─── Translator orchestration ──────────────────────────────────────────────

check("translator: emits capacity + health_trend + drift per container", () => {
  const current = makeEvents(8, "2026-05-30T08:00:00.000Z", "polish");
  const prior = makeEvents(8, "2026-05-23T08:00:00.000Z", "polish");
  const signals = computeSignals({
    events: [...current, ...prior],
    containers: [{
      container_id: CONTAINER,
      container_name: "Anchor",
      current_start: "2026-05-30T00:00:00.000Z",
      current_end:   "2026-05-31T00:00:00.000Z",
      prior_start:   "2026-05-23T00:00:00.000Z",
      prior_end:     "2026-05-30T00:00:00.000Z",
    }],
    principles: [TESTS_PRINCIPLE, README_PRINCIPLE],
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  const kinds = signals.map((s) => s.kind).sort();
  // 1 capacity (1 person), 1 health_trend, 2 drift (one per principle).
  assert.deepEqual(kinds, ["capacity", "drift", "drift", "health_trend"]);
  // Every signal carries a window and a computed_at.
  for (const s of signals) {
    assert.ok(s.window.start && s.window.end, "signal missing window");
    assert.ok(s.computed_at, "signal missing computed_at");
  }
});

check("translator: every signal carries because OR explicitly no_signal", () => {
  const signals = computeSignals({
    events: [],
    containers: [{
      container_id: CONTAINER,
      container_name: "Anchor",
      current_start: "2026-05-30T00:00:00.000Z",
      current_end:   "2026-05-31T00:00:00.000Z",
      prior_start:   "2026-05-23T00:00:00.000Z",
      prior_end:     "2026-05-30T00:00:00.000Z",
    }],
    principles: [TESTS_PRINCIPLE],
    nowIso: "2026-05-30T19:00:00.000Z",
  });
  // With zero events, capacity emits nothing; health_trend emits no_signal;
  // drift emits no_signal for the one principle.
  for (const s of signals) {
    if (s.because.length === 0) {
      const state = (s.value as { state?: string; trend?: string }).state ?? (s.value as { trend?: string }).trend;
      assert.equal(state, "no_signal", `signal without because must be no_signal, got ${state}`);
    }
  }
});

check("translator diagnostics: includes run metadata and counts", () => {
  const result = computeSignalsWithDiagnostics({
    events: makeEvents(6, "2026-05-30T08:00:00.000Z", "moderate"),
    containers: [{
      container_id: CONTAINER,
      container_name: "Anchor",
      current_start: "2026-05-30T00:00:00.000Z",
      current_end:   "2026-05-31T00:00:00.000Z",
      prior_start:   "2026-05-23T00:00:00.000Z",
      prior_end:     "2026-05-30T00:00:00.000Z",
    }],
    principles: [TESTS_PRINCIPLE],
    nowIso: "2026-05-30T19:00:00.000Z",
  });

  assert.ok(result.diagnostics.run_id.length > 0);
  assert.equal(result.diagnostics.mode, "permissive");
  assert.ok(result.diagnostics.totals.signals > 0);
  assert.equal(result.diagnostics.violations.input.length, 0);
});

check("translator strict mode: blocks on invalid input contract", () => {
  assert.throws(() => {
    computeSignalsWithDiagnostics({
      events: [ev({ timestamp: "not-a-date" })],
      containers: [{
        container_id: CONTAINER,
        container_name: "Anchor",
        current_start: "2026-05-30T00:00:00.000Z",
        current_end:   "2026-05-31T00:00:00.000Z",
        prior_start:   "2026-05-23T00:00:00.000Z",
        prior_end:     "2026-05-30T00:00:00.000Z",
      }],
      principles: [TESTS_PRINCIPLE],
      mode: "strict",
      nowIso: "2026-05-30T19:00:00.000Z",
    });
  });
});

check("translator permissive mode: reports violations but still returns signals", () => {
  const result = computeSignalsWithDiagnostics({
    events: [ev({ timestamp: "not-a-date" })],
    containers: [{
      container_id: CONTAINER,
      container_name: "Anchor",
      current_start: "2026-05-30T00:00:00.000Z",
      current_end:   "2026-05-31T00:00:00.000Z",
      prior_start:   "2026-05-23T00:00:00.000Z",
      prior_end:     "2026-05-30T00:00:00.000Z",
    }],
    principles: [TESTS_PRINCIPLE],
    mode: "permissive",
    nowIso: "2026-05-30T19:00:00.000Z",
  });

  assert.ok(result.signals.length > 0);
  assert.ok(result.diagnostics.violations.input.length > 0);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
