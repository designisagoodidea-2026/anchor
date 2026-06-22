// Anchor seed generator — timeline composer.
//
// Builds a list of PlannedEvents distributed across a configurable
// elapsed period. The arc has five rough phases:
//
//   1. Opening drift   — Sam (director) decision, Priya (PM) task setup
//   2. Crit + comments — Reza and Maya leave Figma comments on review files
//   3. Prototype iter  — Maya commits cowork docs / prototypes
//   4. Decision spike  — Sam + Priya land decision-tagged content
//   5. Closing surge   — Reza pushes a burst (the capacity stressor)
//
// Stressors woven in by design (so the live pipeline exercises every
// signal path at least once):
//
//   - Capacity surge       Reza's closing burst pushes him over the
//                          baseline.
//   - Drift trigger        Diego ships code-shaped events without a
//                          paired test file (drift fires on
//                          code-ships-with-tests).
//   - Health-trend move    Settings polish gets only fade events;
//                          Onboarding gets a heavy crit cluster.
//   - Newly appeared       Q3 roadmap shows up at ~60% through.
//   - Resolved             Settings polish goes silent for the last
//                          stretch.

/** @typedef {import('./shared').PlannedEvent} PlannedEvent */
/** @typedef {import('./shared').Persona}      Persona */
/** @typedef {import('./shared').Project}      Project */

import { PERSONAS } from "./personas.js";
import { PROJECTS, lifecycleWeight } from "./projects.js";

/**
 * @param {{ start_iso: string, duration_minutes: number, density?: number }} opts
 *        density: events per persona per hour (default 8).
 * @returns {PlannedEvent[]}
 */
export function composeTimeline(opts) {
  const startMs = new Date(opts.start_iso).getTime();
  const endMs = startMs + opts.duration_minutes * 60_000;
  const density = opts.density ?? 8;

  /** @type {PlannedEvent[]} */
  const events = [];

  // ─── Phase 1 — opening drift (0% – 10%) ──────────────────────────────────
  events.push(...phaseOpening(startMs, endMs));

  // ─── Phase 2 — crit cluster on Onboarding (15% – 40%) ────────────────────
  events.push(...phaseCritCluster(startMs, endMs));

  // ─── Phase 3 — prototype iteration (30% – 60%) ───────────────────────────
  events.push(...phasePrototype(startMs, endMs));

  // ─── Phase 4 — decision spike (50% – 70%) ────────────────────────────────
  events.push(...phaseDecisionSpike(startMs, endMs));

  // ─── Phase 5 — closing capacity surge (70% – 100%) ───────────────────────
  events.push(...phaseClosingSurge(startMs, endMs));

  // ─── Background hum — spread thin activity across the whole window ───────
  events.push(...backgroundHum(startMs, endMs, density));

  // ─── Newly-appearing project — Q3 roadmap shows up at ~60% ───────────────
  events.push(...newlyAppearing(startMs, endMs));

  // ─── Drift stressor — code-shaped events with no test pairing ────────────
  events.push(...driftStressor(startMs, endMs));

  // Sort chronologically before returning.
  events.sort((a, b) => a.fire_at.localeCompare(b.fire_at));
  return events;
}

// ─── Phase composers ───────────────────────────────────────────────────────

/**
 * @param {number} startMs
 * @param {number} endMs
 */
function phaseOpening(startMs, endMs) {
  /** @type {PlannedEvent[]} */
  const out = [];
  const phaseEnd = startMs + 0.1 * (endMs - startMs);
  out.push(plain("sam", "search-ux", "slack_message", true, atFraction(startMs, phaseEnd, 0.2)));
  out.push(plain("priya", "onboarding", "slack_message", false, atFraction(startMs, phaseEnd, 0.3)));
  out.push(plain("priya", "native-mobile", "slack_message", false, atFraction(startMs, phaseEnd, 0.5)));
  out.push(plain("maya", "onboarding", "cowork_doc", false, atFraction(startMs, phaseEnd, 0.7)));
  return out;
}

/**
 * Heavy Figma comment cluster on Onboarding's review file.
 */
function phaseCritCluster(startMs, endMs) {
  /** @type {PlannedEvent[]} */
  const out = [];
  const phaseStart = startMs + 0.15 * (endMs - startMs);
  const phaseEnd = startMs + 0.4 * (endMs - startMs);
  const span = phaseEnd - phaseStart;
  for (let i = 0; i < 9; i++) {
    const persona = ["maya", "reza", "diego"][i % 3];
    out.push(
      plain(persona, "onboarding", "figma_comment", i === 4, new Date(phaseStart + (i / 9) * span).toISOString())
    );
  }
  // Crit notes doc written by Maya at the end of the cluster.
  out.push(plain("maya", "onboarding", "cowork_crit", false, new Date(phaseEnd).toISOString()));
  return out;
}

/**
 * Maya iterates on a prototype across the middle of the run.
 */
function phasePrototype(startMs, endMs) {
  /** @type {PlannedEvent[]} */
  const out = [];
  const phaseStart = startMs + 0.3 * (endMs - startMs);
  const phaseEnd = startMs + 0.6 * (endMs - startMs);
  const span = phaseEnd - phaseStart;
  for (let i = 0; i < 5; i++) {
    out.push(
      plain("maya", "search-ux", "cowork_prototype", false, new Date(phaseStart + (i / 5) * span).toISOString())
    );
  }
  // One labeled Figma version save in the middle.
  out.push(plain("maya", "search-ux", "figma_version", false, atFraction(startMs, endMs, 0.45)));
  return out;
}

/**
 * Sam + Priya land decision-tagged content.
 */
function phaseDecisionSpike(startMs, endMs) {
  /** @type {PlannedEvent[]} */
  const out = [];
  out.push(plain("sam", "onboarding", "cowork_decision", true, atFraction(startMs, endMs, 0.55)));
  out.push(plain("priya", "search-ux", "slack_message", true, atFraction(startMs, endMs, 0.6)));
  out.push(plain("sam", "native-mobile", "figma_comment", true, atFraction(startMs, endMs, 0.65)));
  out.push(plain("priya", "onboarding", "cowork_decision", true, atFraction(startMs, endMs, 0.68)));
  return out;
}

/**
 * Reza's closing burst — pushes capacity into surge territory.
 */
function phaseClosingSurge(startMs, endMs) {
  /** @type {PlannedEvent[]} */
  const out = [];
  const phaseStart = startMs + 0.7 * (endMs - startMs);
  const span = endMs - phaseStart;
  for (let i = 0; i < 18; i++) {
    const kind = i % 3 === 0 ? "cowork_prototype" : "figma_comment";
    out.push(
      plain("reza", "native-mobile", kind, false, new Date(phaseStart + (i / 18) * span).toISOString())
    );
  }
  return out;
}

/**
 * Background activity — quiet hum spread evenly. Drives baseline so
 * the capacity classifier has something to compare the surge against.
 */
function backgroundHum(startMs, endMs, density) {
  /** @type {PlannedEvent[]} */
  const out = [];
  const span = endMs - startMs;
  const events_per_persona = Math.max(1, Math.round((density * span) / (60 * 60_000)));
  for (const persona of PERSONAS) {
    if (persona.id === "u-reza") continue; // already handled in closing surge
    const slots = Math.round(events_per_persona * persona.base_activity_weight);
    for (let i = 0; i < slots; i++) {
      // Random project, biased away from winding_down + newly_appearing.
      const proj = pickProjectFor(persona.id, "background");
      const kind = pickKindFor(persona);
      out.push(plain(persona.id.replace(/^u-/, ""), proj, kind, false,
        new Date(startMs + Math.random() * span).toISOString()));
    }
  }
  return out;
}

/**
 * Q3 roadmap appears at ~60% with a small cluster.
 */
function newlyAppearing(startMs, endMs) {
  /** @type {PlannedEvent[]} */
  const out = [];
  const start = startMs + 0.6 * (endMs - startMs);
  const span = (endMs - startMs) * 0.3;
  for (let i = 0; i < 6; i++) {
    const persona = ["priya", "sam", "maya"][i % 3];
    const kind = i === 0 ? "cowork_doc" : i % 2 === 0 ? "slack_message" : "figma_comment";
    out.push(plain(persona, "q3-roadmap", kind, i === 1, new Date(start + (i / 6) * span).toISOString()));
  }
  return out;
}

/**
 * Diego ships code-shaped activity with no paired test files — exercises
 * the code-ships-with-tests drift trigger.
 */
function driftStressor(startMs, endMs) {
  /** @type {PlannedEvent[]} */
  const out = [];
  for (let i = 0; i < 4; i++) {
    out.push(plain("diego", "search-ux", "cowork_doc", false, atFraction(startMs, endMs, 0.4 + i * 0.05)));
  }
  return out;
}

// ─── Utility ───────────────────────────────────────────────────────────────

/**
 * @param {string} pidSlug  Persona id without the u- prefix.
 * @param {string} projSlug
 * @param {PlannedEvent["kind"]} kind
 * @param {boolean} decision
 * @param {string} fire_at
 * @returns {PlannedEvent}
 */
function plain(pidSlug, projSlug, kind, decision, fire_at) {
  return {
    fire_at,
    persona_id: pidSlug.startsWith("u-") ? pidSlug : `u-${pidSlug}`,
    project_slug: projSlug,
    kind,
    decision,
  };
}

function atFraction(startMs, endMs, frac) {
  return new Date(startMs + (endMs - startMs) * frac).toISOString();
}

/**
 * @param {string} personaId
 * @param {"background"|"phase"} _mode
 * @returns {string}  project slug
 */
function pickProjectFor(personaId, _mode) {
  const persona = personaId.replace(/^u-/, "");
  // Each persona has a few projects they touch more.
  /** @type {Record<string, string[]>} */
  const affinity = {
    maya: ["onboarding", "search-ux"],
    reza: ["onboarding", "native-mobile"],
    priya: ["onboarding", "q3-roadmap", "search-ux"],
    diego: ["search-ux", "settings-polish"],
    sam: ["onboarding", "search-ux", "native-mobile"],
  };
  const pool = affinity[persona] || PROJECTS.map((p) => p.slug);
  // Lifecycle-weighted random.
  const weighted = pool.flatMap((slug) => {
    const proj = PROJECTS.find((p) => p.slug === slug);
    if (!proj) return [];
    const weight = Math.max(1, Math.round(lifecycleWeight(proj.state) * 4));
    return Array(weight).fill(slug);
  });
  return weighted[Math.floor(Math.random() * weighted.length)];
}

/**
 * @param {Persona} persona
 * @returns {PlannedEvent["kind"]}
 */
function pickKindFor(persona) {
  const t = persona.touches;
  /** @type {[PlannedEvent["kind"], number][]} */
  const candidates = [
    ["figma_comment", t.figma_comments],
    ["figma_version", t.figma_versions],
    ["slack_message", t.slack_messages],
    ["cowork_doc", t.cowork_docs],
    ["cowork_prototype", t.cowork_prototypes],
  ];
  const total = candidates.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [kind, weight] of candidates) {
    r -= weight;
    if (r <= 0) return kind;
  }
  return "slack_message";
}
