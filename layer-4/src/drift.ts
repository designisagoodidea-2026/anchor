// Anchor Layer 4 — drift signal.
//
// Per-principle × per-container compliance over a window. Compliant /
// drifting / no_signal per /signal-spec/drift.md.
//
// Rule first, LLM later. v0.1 ships the rule engine; LLM judgment is the
// architecturally-acknowledged gap and lives behind the same `because`
// contract when it lands.
//
// For each principle, find trigger events in the window. For each trigger,
// look for a compliance event in the same container within ±window_hours.
// A trigger without compliance contributes to drift. All triggers satisfied
// = compliant. Some unsatisfied = drifting. No triggers = no_signal (don't
// claim compliance with an empty check).
//
// Refused patterns (per spec):
//   - Aggregate drift score — refuse; always per-principle, per-event.
//   - "Drifting" without an example — caller must surface the
//     trigger-without-compliance events in `because`.

import type { ChangeEvent } from "../../shared/change-event";
import type {
  Signal,
  DriftValue,
  Principle,
  EventRef,
} from "./types";
import { refFromEvent } from "./types";
import { eventMatches, snippetMatches } from "./principles.js";

const BECAUSE_LIMIT = 5;

export interface DriftOptions {
  container_id: string;
  container_name: string;
  window_start: string;
  window_end: string;
  nowIso?: string;
}

export function computeDrift(
  events: ChangeEvent[],
  principles: Principle[],
  opts: DriftOptions
): Signal[] {
  // Pre-filter to the container.
  const inContainer = events.filter((e) => isForContainer(e, opts.container_id));

  // Pre-filter to the window for trigger evaluation. Compliance can fall
  // outside the window per principle.window_hours but inside the container.
  const triggerCandidates = inContainer.filter((e) => inWindow(e, opts.window_start, opts.window_end));

  const signals: Signal[] = [];
  const now = opts.nowIso ?? new Date().toISOString();

  for (const principle of principles) {
    const triggers = triggerCandidates.filter((e) => eventMatches(e, principle.check.trigger));

    if (triggers.length === 0) {
      signals.push({
        kind: "drift",
        container_id: opts.container_id,
        container_name: opts.container_name,
        window: { start: opts.window_start, end: opts.window_end },
        value: {
          principle_id: principle.id,
          principle_text: principle.text,
          state: "no_signal",
          triggers_fired: 0,
          triggers_satisfied: 0,
        },
        because: [],
        computed_at: now,
      });
      continue;
    }

    const unsatisfied: ChangeEvent[] = [];
    let satisfied = 0;

    for (const trigger of triggers) {
      if (isSatisfied(trigger, principle, inContainer)) {
        satisfied++;
      } else {
        unsatisfied.push(trigger);
      }
    }

    const value: DriftValue = {
      principle_id: principle.id,
      principle_text: principle.text,
      state: unsatisfied.length === 0 ? "compliant" : "drifting",
      triggers_fired: triggers.length,
      triggers_satisfied: satisfied,
    };

    // `because`: the unsatisfied triggers — those are what the leader needs
    // to see. If compliant, surface a sample of triggers that DID satisfy so
    // the leader has evidence of the principle being respected.
    const because: EventRef[] =
      value.state === "drifting"
        ? unsatisfied.slice(0, BECAUSE_LIMIT).map(refFromEvent)
        : triggers.slice(0, BECAUSE_LIMIT).map(refFromEvent);

    signals.push({
      kind: "drift",
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

function isForContainer(e: ChangeEvent, containerId: string): boolean {
  if (e.container_id === undefined || e.container_id === null) return true;
  return e.container_id === containerId;
}

function inWindow(e: ChangeEvent, start: string, end: string): boolean {
  return e.timestamp >= start && e.timestamp < end;
}

function isSatisfied(
  trigger: ChangeEvent,
  principle: Principle,
  pool: ChangeEvent[]
): boolean {
  const check = principle.check;
  const triggerTime = new Date(trigger.timestamp).getTime();
  const windowMs = principle.window_hours * 3600 * 1000;

  if (check.kind === "text_presence") {
    // window_hours: 0 means "same event content must satisfy."
    if (principle.window_hours === 0) {
      return snippetMatches(trigger, check.compliance);
    }
    // Otherwise look across the container for a snippet match within window.
    return pool.some((e) => {
      if (e === trigger) return false;
      const dt = Math.abs(new Date(e.timestamp).getTime() - triggerTime);
      if (dt > windowMs) return false;
      return snippetMatches(e, check.compliance);
    });
  }

  // trigger_then_compliance
  return pool.some((e) => {
    if (e === trigger) return false;
    const dt = Math.abs(new Date(e.timestamp).getTime() - triggerTime);
    if (dt > windowMs) return false;
    return eventMatches(e, check.compliance);
  });
}
