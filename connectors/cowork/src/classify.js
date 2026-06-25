/**
 * Cowork connector classifier.
 *
 * Converts local file-system watcher events into canonical change_event records.
 * This is intentionally conservative and deterministic for v0.1.
 */

import path from "node:path";

/** @typedef {import('../../../shared/change-event.ts').ChangeEvent} ChangeEvent */

const DECISION_TOKEN = /\[decision\]/i;

/**
 * @param {object} args
 * @param {string} args.rootDir
 * @param {string} args.absolutePath
 * @param {"add"|"change"|"unlink"|"addDir"|"unlinkDir"} args.watchEvent
 * @param {string} [args.fileText]
 * @param {string} [args.timestamp]
 * @param {string} [args.actorId]
 * @param {string} [args.actorName]
 * @returns {ChangeEvent}
 */
export function classifyCoworkEvent(args) {
  const {
    rootDir,
    absolutePath,
    watchEvent,
    fileText = "",
    timestamp = new Date().toISOString(),
    actorId = "local-cowork",
    actorName = "Cowork",
  } = args;

  const rel = normalizeRelPath(rootDir, absolutePath);
  const firstLine = (fileText || "").split(/\r?\n/, 1)[0]?.trim() || "";
  const tags = hasDecisionToken(rel, firstLine) ? ["decision"] : [];

  return {
    actor: {
      id: actorId,
      display_name: actorName,
      source_user_id: null,
      role_hint: "assistant",
    },
    timestamp,
    source: "cowork",
    entity_id: rel,
    entity_type: inferEntityType(rel, watchEvent),
    parent_id: parentPath(rel),
    action: inferAction(watchEvent),
    kind: inferKind(rel, watchEvent, tags),
    tags,
    snippet: buildSnippet(rel, watchEvent, firstLine),
    raw_ref: `file:${absolutePath}`,
    container_id: null,
  };
}

/**
 * Best-effort deterministic fingerprint for local dedupe.
 * @param {ChangeEvent} evt
 */
export function fingerprintEvent(evt) {
  return [evt.source, evt.entity_id, evt.action, evt.timestamp.slice(0, 19)].join("|");
}

function normalizeRelPath(rootDir, absolutePath) {
  const rel = path.relative(rootDir, absolutePath) || path.basename(absolutePath);
  return rel.split(path.sep).join("/");
}

function hasDecisionToken(relPath, firstLine) {
  return DECISION_TOKEN.test(relPath) || DECISION_TOKEN.test(firstLine);
}

function inferEntityType(relPath, watchEvent) {
  if (watchEvent === "addDir" || watchEvent === "unlinkDir") return "folder";
  if (hasPathSegment(relPath, "skills")) return "skill";
  if (hasPathSegment(relPath, "voice-profiles")) return "voice_profile";
  if (hasPathSegment(relPath, "memory")) return "memory_entry";
  return "artifact";
}

function hasPathSegment(relPath, segment) {
  return relPath === segment || relPath.startsWith(`${segment}/`) || relPath.includes(`/${segment}/`);
}

function inferAction(watchEvent) {
  switch (watchEvent) {
    case "add":
    case "addDir":
      return "create";
    case "change":
      return "edit";
    case "unlink":
    case "unlinkDir":
      return "delete";
    default:
      return "edit";
  }
}

function inferKind(relPath, watchEvent, tags) {
  if (tags.includes("decision")) return "moderate";

  if (
    hasPathSegment(relPath, "skills") ||
    hasPathSegment(relPath, "voice-profiles") ||
    relPath.endsWith("schema.json") ||
    relPath.endsWith(".schema.md") ||
    watchEvent === "addDir" ||
    watchEvent === "unlinkDir"
  ) {
    return "structural";
  }

  if (watchEvent === "add" || watchEvent === "unlink") return "moderate";
  if (watchEvent === "change") return "polish";
  return "unknown";
}

function buildSnippet(relPath, watchEvent, firstLine) {
  const head = watchEventLabel(watchEvent);
  if (firstLine) return `${head}: ${relPath} — ${firstLine.slice(0, 120)}`;
  return `${head}: ${relPath}`;
}

function watchEventLabel(watchEvent) {
  switch (watchEvent) {
    case "add":
      return "file created";
    case "change":
      return "file edited";
    case "unlink":
      return "file deleted";
    case "addDir":
      return "folder created";
    case "unlinkDir":
      return "folder deleted";
    default:
      return "change";
  }
}

function parentPath(relPath) {
  const idx = relPath.lastIndexOf("/");
  return idx > 0 ? relPath.slice(0, idx) : null;
}
