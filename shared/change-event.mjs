// Canonical change_event shape — runtime constants for JavaScript consumers.
//
// This file mirrors /shared/change-event.ts. If you change one, change both.
// TypeScript is the source of truth for the type; this file is the source of
// truth for runtime constants the JS consumers need (the Cowork watcher and
// the renderer).
//
// Schema history: per ADR-02 (2026-06-02), `magnitude` (mixed scope and
// decision-ness) was split into `kind` (scope only) and `tags: string[]`
// (open vocabulary, v0.1 emits `"decision"`). The old `change_kind` was
// renamed to `action`.
//
// Usage from a JS module:
//   /** @typedef {import('../shared/change-event.ts').ChangeEvent} ChangeEvent */
//   import { KINDS, SOURCES } from "../../shared/change-event.mjs";

/**
 * @typedef {Object} Actor
 * @property {string} id
 * @property {string} display_name
 * @property {string|null} source_user_id
 * @property {string|null} role_hint
 */

/**
 * @typedef {"polish"|"moderate"|"structural"|"unknown"} EventKind
 */

/**
 * @typedef {"figma"|"cowork"|"slack"|"jira"} Source
 * `jira` added per ADR-04 to prepare for the future Jira connector;
 * resolver has a default-unresolved arm so the addition is non-breaking.
 */

/**
 * @typedef {Object} ChangeEvent
 * @property {Actor} actor
 * @property {string} timestamp - ISO 8601
 * @property {Source} source
 * @property {string} entity_id - Stable identifier within the source
 * @property {string} entity_type - e.g. "file" | "thread" | "memory_entry"
 * @property {string|null} parent_id - Hierarchy parent within the source
 * @property {string} action - Verb of what happened: "create" | "edit" | "delete" | "comment" | ...
 * @property {EventKind} kind - Scope of change. Computed at Layer 2; load-bearing.
 * @property {string[]} tags - Open vocabulary. v0.1 emits "decision" when [decision] appears.
 * @property {string} snippet - 1-2 sentences of substance preview
 * @property {string} raw_ref - Opaque pointer back to the source record
 * @property {string|null} [container_id] - Layer 3 output. null = not resolved yet; "__unresolved__" = no match; "__ambiguous__" = multiple matches.
 */

export const UNRESOLVED_CONTAINER = "__unresolved__";
export const AMBIGUOUS_CONTAINER = "__ambiguous__";

export const KINDS = /** @type {EventKind[]} */ ([
  "polish",
  "moderate",
  "structural",
  "unknown",
]);

export const SOURCES = /** @type {Source[]} */ ([
  "figma",
  "cowork",
  "slack",
  "jira",
]);

/** Known tag values v0.1 connectors emit. Open vocabulary; informational. */
export const KNOWN_TAGS = /** @type {readonly string[]} */ (["decision"]);
