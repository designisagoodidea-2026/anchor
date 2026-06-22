// Anchor Layer 4 — principle loader and matcher engine.
//
// Reads /principles/<leader>.yaml and runs the simple v0.1 rule engine:
// substring matching over change_event fields. Pure — no I/O beyond the
// file read in `loadPrinciples` (which the caller can skip by injecting
// principles directly).
//
// Per ADR-02: matchers can specify `kind` (scope-only enum) or
// `tags_include` (matches when the event's tags array contains the value).
// These compose with AND across the matcher; a rule can require both
// `kind: structural` and `tags_include: decision` to fire.

import fs from "node:fs";
import yaml from "js-yaml";

import type { ChangeEvent } from "../../shared/change-event";
import type {
  Principle,
  PrincipleFile,
  EventMatcher,
  SnippetMatcher,
} from "./types";

/** Read /principles/<leader>.yaml from disk and return the parsed list. */
export function loadPrinciples(filePath: string): Principle[] {
  const text = fs.readFileSync(filePath, "utf8");
  const parsed = yaml.load(text) as PrincipleFile;
  if (!parsed || !Array.isArray(parsed.principles)) {
    throw new Error(`Principles file ${filePath} has no top-level principles[] list.`);
  }
  // Fail loud on missing fields — silent defaults hide YAML indentation bugs.
  for (const [i, p] of parsed.principles.entries()) {
    if (typeof p.id !== "string" || !p.id.trim()) {
      throw new Error(`Principle #${i} in ${filePath} is missing an id.`);
    }
    if (typeof p.text !== "string" || !p.text.trim()) {
      throw new Error(`Principle ${p.id} in ${filePath} is missing text.`);
    }
    if (!p.check || typeof p.check.kind !== "string") {
      throw new Error(`Principle ${p.id} in ${filePath} is missing check.kind.`);
    }
    if (typeof p.window_hours !== "number") {
      throw new Error(
        `Principle ${p.id} in ${filePath}: window_hours must be a number at the principle level (not nested inside check).`
      );
    }
  }
  return parsed.principles;
}

/**
 * Does this event match the given matcher? All fields are AND; the
 * _any_of arrays are OR within their field. `tags_include` matches when
 * the event's `tags` array contains the literal value.
 */
export function eventMatches(event: ChangeEvent, matcher: EventMatcher): boolean {
  if (matcher.source !== undefined && event.source !== matcher.source) return false;
  if (matcher.kind !== undefined && event.kind !== matcher.kind) return false;
  if (matcher.tags_include !== undefined && !event.tags.includes(matcher.tags_include)) return false;

  if (matcher.entity_id_contains !== undefined) {
    if (!event.entity_id.includes(matcher.entity_id_contains)) return false;
  }
  if (matcher.entity_id_contains_any_of !== undefined) {
    if (!matcher.entity_id_contains_any_of.some((s) => event.entity_id.includes(s))) return false;
  }
  if (matcher.entity_id_ends_with !== undefined) {
    if (!event.entity_id.endsWith(matcher.entity_id_ends_with)) return false;
  }
  return true;
}

export function snippetMatches(event: ChangeEvent, matcher: SnippetMatcher): boolean {
  const snippet = event.snippet.toLowerCase();
  return matcher.snippet_contains_any_of.some((s) => snippet.includes(s.toLowerCase()));
}
