#!/usr/bin/env node

/**
 * Anchor Cowork connector (local watcher).
 * Emits newline-delimited canonical change_event records on stdout.
 */

import fs from "node:fs/promises";
import path from "node:path";
import chokidar from "chokidar";
import { classifyCoworkEvent, fingerprintEvent } from "./classify.js";

const rootDir = path.resolve(process.env.COWORK_WATCH_PATH || process.cwd());
const actorId = process.env.COWORK_ACTOR_ID || "local-cowork";
const actorName = process.env.COWORK_ACTOR_NAME || "Cowork";
const includeDotfiles = process.env.COWORK_INCLUDE_DOTFILES === "1";
const dedupeWindowSec = Number(process.env.COWORK_DEDUPE_WINDOW_SEC || "15");

/** @type {Map<string, number>} */
const seen = new Map();

boot().catch((err) => {
  console.error(`cowork-connector fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

async function boot() {
  const watcher = chokidar.watch(rootDir, {
    ignored: (p) => shouldIgnore(p),
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 250,
      pollInterval: 100,
    },
  });

  watcher.on("add", (p) => handlePathEvent("add", p));
  watcher.on("change", (p) => handlePathEvent("change", p));
  watcher.on("unlink", (p) => handlePathEvent("unlink", p));
  watcher.on("addDir", (p) => handlePathEvent("addDir", p));
  watcher.on("unlinkDir", (p) => handlePathEvent("unlinkDir", p));
  watcher.on("error", (err) => {
    console.error(`cowork-connector watcher-error: ${err instanceof Error ? err.message : String(err)}`);
  });

  process.stderr.write(
    `cowork-connector watching ${rootDir} (dotfiles=${includeDotfiles ? "on" : "off"})\n`
  );
}

async function handlePathEvent(watchEvent, targetPath) {
  const abs = path.resolve(targetPath);
  const fileText = await maybeRead(abs, watchEvent);

  const event = classifyCoworkEvent({
    rootDir,
    absolutePath: abs,
    watchEvent,
    fileText,
    actorId,
    actorName,
    timestamp: new Date().toISOString(),
  });

  const fp = fingerprintEvent(event);
  const now = Date.now();
  pruneSeen(now);

  const previous = seen.get(fp);
  if (previous && now - previous < dedupeWindowSec * 1000) {
    return;
  }

  seen.set(fp, now);
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function shouldIgnore(targetPath) {
  const rel = path.relative(rootDir, path.resolve(targetPath)).split(path.sep).join("/");

  if (!includeDotfiles) {
    if (rel.startsWith(".")) return true;
    if (rel.split("/").some((part) => part.startsWith("."))) return true;
  }

  if (rel.includes("/node_modules/")) return true;
  if (rel.includes("/.git/")) return true;
  if (rel.endsWith("~")) return true;
  if (rel.endsWith(".swp")) return true;
  return false;
}

async function maybeRead(absPath, watchEvent) {
  if (watchEvent === "unlink" || watchEvent === "unlinkDir" || watchEvent === "addDir") return "";
  try {
    const stat = await fs.stat(absPath);
    if (!stat.isFile()) return "";
    if (stat.size > 128 * 1024) return "";
    return await fs.readFile(absPath, "utf8");
  } catch {
    return "";
  }
}

function pruneSeen(nowMs) {
  const maxAge = Math.max(1, dedupeWindowSec) * 1000;
  for (const [key, ts] of seen.entries()) {
    if (nowMs - ts > maxAge) seen.delete(key);
  }
}
