// Anchor seed generator — change_event emitters and real-file writers.
//
// Each emitter returns either a canonical change_event (Figma, Slack) for
// NDJSON output, or performs a real filesystem operation under
// demo/seed-data/projects/<slug>/ (cowork) so the live watcher catches it.
//
// All emitters honor the persona's verbosity and typo_rate by routing the
// content through content.js + typos.js.

import fs from "node:fs";
import path from "node:path";
import { figmaCommentBody, slackMessageBody, coworkDoc } from "./content.js";
import { applyTypos } from "./typos.js";
import { projectNameVariant } from "./projects.js";

/** @typedef {import('./shared').Persona} Persona */
/** @typedef {import('./shared').Project} Project */

let counter = 0;
function nextId(prefix = "x") {
  counter++;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

// ─── Figma emitter ─────────────────────────────────────────────────────────

/**
 * @param {{ persona: Persona, project: Project, decision: boolean, fire_at: string }} ctx
 * @returns {object} change_event
 */
export function emitFigmaComment(ctx) {
  const id = nextId("cmt");
  const raw = figmaCommentBody({
    verbosity: ctx.persona.verbosity,
    decision: ctx.decision,
    // Figma comments occasionally cite the alternate name a team uses.
    project: projectNameVariant(ctx.project, 0.2),
  });
  const snippet = applyTypos(raw, ctx.persona.typo_rate).slice(0, 200);
  return {
    actor: actorOf(ctx.persona),
    timestamp: ctx.fire_at,
    source: "figma",
    entity_id: `${ctx.project.figma_file_key}:comment:${id}`,
    entity_type: "comment",
    parent_id: `file:${ctx.project.figma_file_key}`,
    action: "comment",
    kind: ctx.decision ? "structural" : ctx.persona.verbosity > 0.6 ? "moderate" : "polish",
    tags: ctx.decision ? ["decision"] : [],
    snippet,
    raw_ref: `figma://file/${ctx.project.figma_file_key}/${id}`,
    container_id: null,
  };
}

/**
 * @param {{ persona: Persona, project: Project, decision: boolean, fire_at: string }} ctx
 */
export function emitFigmaVersion(ctx) {
  const id = nextId("ver");
  const labeled = ctx.decision || ctx.persona.verbosity > 0.65;
  const snippet = labeled
    ? applyTypos(`${ctx.project.name} v${(Math.random() * 9 + 1).toFixed(1)} — milestone`, ctx.persona.typo_rate)
    : "autosave";
  return {
    actor: actorOf(ctx.persona),
    timestamp: ctx.fire_at,
    source: "figma",
    entity_id: `${ctx.project.figma_file_key}:version:${id}`,
    entity_type: "version",
    parent_id: `file:${ctx.project.figma_file_key}`,
    action: "edit",
    kind: labeled ? "structural" : "polish",
    tags: ctx.decision ? ["decision"] : [],
    snippet,
    raw_ref: `figma://file/${ctx.project.figma_file_key}/version/${id}`,
    container_id: null,
  };
}

// ─── Slack emitter ─────────────────────────────────────────────────────────

/**
 * @param {{ persona: Persona, project: Project, decision: boolean, fire_at: string }} ctx
 */
export function emitSlackMessage(ctx) {
  const ts = ctx.fire_at;
  const raw = slackMessageBody({
    verbosity: ctx.persona.verbosity,
    decision: ctx.decision,
    // Slack picks up more of the casual-name drift than Figma does.
    project: projectNameVariant(ctx.project, 0.3),
    pmStyle: ctx.persona.id === "u-priya",
  });
  const snippet = applyTypos(raw, ctx.persona.typo_rate).slice(0, 200);
  return {
    actor: actorOf(ctx.persona),
    timestamp: ts,
    source: "slack",
    entity_id: `${ctx.project.slack_channel}:${tsToSlack(ts)}`,
    entity_type: "message",
    parent_id: `channel:${ctx.project.slack_channel}`,
    action: "message",
    kind: ctx.decision ? "structural" : ctx.persona.verbosity > 0.55 ? "moderate" : "polish",
    tags: ctx.decision ? ["decision"] : [],
    snippet,
    raw_ref: `slack://${ctx.project.slack_channel}/${tsToSlack(ts)}`,
    container_id: null,
  };
}

// ─── Cowork emitter (real files written under demo/seed-data/projects) ─────

/**
 * @param {{ persona: Persona, project: Project, kind: "decision"|"prototype"|"doc"|"crit",
 *           decision: boolean, fire_at: string, anchorRoot: string }} ctx
 * @returns {{ created_path: string }}
 */
export function emitCoworkFile(ctx) {
  // Cowork file bodies use the canonical name in headers more often than
  // Slack/Figma do, but a small fraction reach for the alias — mirrors a
  // designer naming a doc the way they think of the project that day.
  const { filename, body } = coworkDoc({
    kind: ctx.kind,
    slug: ctx.project.slug,
    project: projectNameVariant(ctx.project, 0.1),
  });
  const finalBody = applyTypos(body, ctx.persona.typo_rate);
  const projectDir = path.join(ctx.anchorRoot, "demo", "seed-data", "projects", ctx.project.slug);
  fs.mkdirSync(projectDir, { recursive: true });
  const fullPath = path.join(projectDir, filename);
  fs.writeFileSync(fullPath, finalBody + "\n", "utf8");
  return { created_path: fullPath };
}

// ─── Shared helpers ────────────────────────────────────────────────────────

function actorOf(persona) {
  return {
    id: persona.id,
    display_name: persona.display_name,
    source_user_id: persona.id,
    role_hint: persona.role,
  };
}

function tsToSlack(iso) {
  // Slack message ids look like "1717891200.000123". We use seconds + a
  // sub-millisecond counter so simultaneous emits don't collide.
  const sec = Math.floor(new Date(iso).getTime() / 1000);
  return `${sec}.${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
}
