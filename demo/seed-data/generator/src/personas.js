// Anchor seed generator — personas.
//
// Five synthetic team members. Each carries a verbosity weight, a typo
// rate, what kinds of work they touch, and a base activity level. The
// timeline composer weights event selection by these.
//
// Per air-gap rules: names are synthetic. No real-network names appear.

/** @typedef {import('./shared').Persona} Persona */

/** @type {Persona[]} */
export const PERSONAS = [
  {
    id: "u-maya",
    display_name: "Maya",
    role: "Senior IC designer",
    // Verbose, careful, long-form thinker. Comments are paragraphs, file
    // changes carry substantive prose. Low typo rate. Heavy on prototypes
    // and decision-tagged design rationale.
    verbosity: 0.85,
    typo_rate: 0.02,
    base_activity_weight: 1.0,
    touches: {
      figma_comments: 0.9,
      figma_versions: 0.6,
      slack_messages: 0.5,
      slack_threads: 0.7,
      cowork_docs: 0.8,
      cowork_prototypes: 0.7,
    },
    decision_rate: 0.25,
  },
  {
    id: "u-reza",
    display_name: "Reza",
    role: "Junior IC designer",
    // Mid verbosity, occasional typos when rushing. Exploration-heavy —
    // many small Figma comments, lots of file changes per session.
    verbosity: 0.55,
    typo_rate: 0.05,
    base_activity_weight: 1.4,
    touches: {
      figma_comments: 0.95,
      figma_versions: 0.5,
      slack_messages: 0.8,
      slack_threads: 0.4,
      cowork_docs: 0.4,
      cowork_prototypes: 0.85,
    },
    decision_rate: 0.05,
  },
  {
    id: "u-priya",
    display_name: "Priya",
    role: "Product manager",
    // Terse, structured, decision-oriented. Most messages start with a
    // verb. Writes tasks and short specs. High decision-tag rate.
    verbosity: 0.4,
    typo_rate: 0.01,
    base_activity_weight: 0.9,
    touches: {
      figma_comments: 0.5,
      figma_versions: 0.1,
      slack_messages: 0.9,
      slack_threads: 0.8,
      cowork_docs: 0.7,
      cowork_prototypes: 0.0,
    },
    decision_rate: 0.45,
  },
  {
    id: "u-diego",
    display_name: "Diego",
    role: "Engineering partner",
    // Very terse, code-shaped. Mid typo rate. Focused on review and
    // implementation handoff. Activity bursts in the afternoon.
    verbosity: 0.3,
    typo_rate: 0.04,
    base_activity_weight: 0.7,
    touches: {
      figma_comments: 0.3,
      figma_versions: 0.05,
      slack_messages: 0.7,
      slack_threads: 0.6,
      cowork_docs: 0.4,
      cowork_prototypes: 0.1,
    },
    decision_rate: 0.15,
  },
  {
    id: "u-sam",
    display_name: "Sam",
    role: "Design director",
    // Very low density. High impact per event — most messages carry a
    // decision. Terse and never typos.
    verbosity: 0.35,
    typo_rate: 0.0,
    base_activity_weight: 0.4,
    touches: {
      figma_comments: 0.6,
      figma_versions: 0.0,
      slack_messages: 0.5,
      slack_threads: 0.5,
      cowork_docs: 0.3,
      cowork_prototypes: 0.0,
    },
    decision_rate: 0.6,
  },
];

/** Look up a persona by id. */
export function getPersona(id) {
  const p = PERSONAS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown persona ${id}`);
  return p;
}
