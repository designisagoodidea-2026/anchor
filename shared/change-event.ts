// Canonical change_event shape — single source of truth.
//
// This is the contract every Layer 1 connector emits and every downstream
// layer consumes (see /architecture/layer-2-normalization.md).
//
// TypeScript consumers (Cloudflare Workers in /connectors/figma/ and
// /connectors/slack/) import types from here directly.
// JavaScript consumers (the Node /connectors/cowork/ watcher and
// /renderer/ digest) reference these types via JSDoc:
//   /** @typedef {import('../shared/change-event.ts').ChangeEvent} ChangeEvent */
// and import runtime constants from `./change-event.mjs`.
//
// If you change this file, keep `./change-event.mjs` in sync.
//
// Schema history: the original shape carried `magnitude` (a five-value enum
// that mixed scope and decision-ness) and `change_kind` (the action taken).
// ADR-02 (2026-06-02) split that into three fields: `kind` (scope-only),
// `action` (renamed from `change_kind`), and `tags: string[]` (open-vocabulary,
// with `decision` as the v0.1 emitter).

export interface Actor {
  id: string;
  display_name: string;
  source_user_id: string | null;
  role_hint: string | null;
}

/**
 * Scope of change. Computed at Layer 2; load-bearing. If a connector can't
 * classify, it emits `"unknown"` and downstream filters drop the event.
 * Decision-ness is *not* on this axis — see `tags` below.
 */
export type EventKind =
  | "polish"
  | "moderate"
  | "structural"
  | "unknown";

// Sources that emit events onto the bus. `jira` was added per ADR-04 to
// prepare for the future Jira connector; the existing resolver has a
// `default` arm that returns `unresolved`, so adding to this enum is
// non-breaking. The Jira connector's emission path lands in a follow-up
// build alongside `connectors/jira/`.
export type Source = "figma" | "cowork" | "slack" | "jira";

export interface ChangeEvent {
  actor: Actor;
  /** ISO 8601 timestamp. */
  timestamp: string;
  source: Source;
  /** Stable identifier within the source. */
  entity_id: string;
  /** E.g., "file" | "frame" | "thread" | "message" | "skill_run" | "artifact" | "memory_entry" | ... */
  entity_type: string;
  /** Optional hierarchy parent within the source. */
  parent_id: string | null;
  /** The verb of what happened. E.g., "create" | "edit" | "delete" | "comment" | "review" | "approve" | "mention" | ... */
  action: string;
  /** Scope of change. Computed at Layer 2. Load-bearing. */
  kind: EventKind;
  /**
   * Open-vocabulary tags. v0.1 emits `"decision"` when a `[decision]` token
   * appears in the source (Figma version label / comment, Slack message,
   * cowork filename or first line). Empty array when no tags apply.
   * Orthogonal to `kind` — a polish edit can carry a decision tag.
   */
  tags: string[];
  /** 1-2 sentences of substance preview. */
  snippet: string;
  /** Opaque pointer back to the source record (for audit + click-through). */
  raw_ref: string;
  /**
   * The body of work this event belongs to. Set by Layer 3 (container
   * resolution); connectors emit `null` since they don't know about containers.
   * Three values matter:
   *   - string  → resolved to that container's id
   *   - null    → not yet resolved (connector emitted; Layer 3 hasn't run)
   *   - "__unresolved__" → resolver ran but no container matched
   *   - "__ambiguous__"  → resolver ran but >1 containers matched
   */
  container_id?: string | null;
}

export const UNRESOLVED_CONTAINER = "__unresolved__";
export const AMBIGUOUS_CONTAINER = "__ambiguous__";

export const KINDS: EventKind[] = [
  "polish",
  "moderate",
  "structural",
  "unknown",
];

export const SOURCES: Source[] = ["figma", "cowork", "slack", "jira"];

/** Known tag values v0.1 connectors emit. Open vocabulary; this is informational. */
export const KNOWN_TAGS = ["decision"] as const;
