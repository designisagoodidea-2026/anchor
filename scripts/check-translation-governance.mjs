#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const recordsDir = path.join(ROOT, "governance", "records");
const policyPath = path.join(ROOT, "governance", "policies", "translation-gate.json");

function info(msg) {
  process.stdout.write(`translation-governance: ${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`translation-governance: FAIL - ${msg}\n`);
}

function loadPolicy() {
  if (!fs.existsSync(policyPath)) {
    return {
      translation_sensitive_prefixes: ["layer-4/src/", "layer-4/", "renderer/src/translate"],
      max_approval_age_days: 45,
      required_phase: "E",
    };
  }
  return JSON.parse(fs.readFileSync(policyPath, "utf8"));
}

function runGit(command) {
  try {
    const out = execSync(command, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] })
      .toString("utf8")
      .trim();
    if (!out) return [];
    return out.split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function listChangedFiles(baseRef) {
  const unstaged = runGit("git diff --name-only");
  const staged = runGit("git diff --name-only --cached");
  const untracked = runGit("git ls-files --others --exclude-standard");
  const commitRange = baseRef
    ? runGit(`git diff --name-only ${baseRef}..HEAD`)
    : runGit("git diff --name-only HEAD~1..HEAD");
  return Array.from(new Set([...unstaged, ...staged, ...untracked, ...commitRange]));
}

function isTranslationSensitive(file, prefixes) {
  return (
    prefixes.some((prefix) => file.startsWith(prefix))
  );
}

function daysSince(dateStr) {
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  const diffMs = Date.now() - parsed.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function resolveApprovedScopePrefixes(requiredPhase, maxApprovalAgeDays) {
  if (!fs.existsSync(recordsDir)) return [];
  const files = fs.readdirSync(recordsDir).filter((f) => f.endsWith(".json"));
  const approvedPrefixes = new Set();
  for (const file of files) {
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(recordsDir, file), "utf8"));
      const approved = rec.decision === "approve" || rec.decision === "approve-with-guardrails";
      const translationLayer =
        typeof rec.impacted_layer === "string" && /translation|layer\s*4/i.test(rec.impacted_layer);
      const ageDays = typeof rec.date === "string" ? daysSince(rec.date) : Number.POSITIVE_INFINITY;
      if (
        rec.phase === requiredPhase &&
        approved &&
        translationLayer &&
        ageDays >= 0 &&
        ageDays <= maxApprovalAgeDays
      ) {
        if (Array.isArray(rec.change_scope_prefixes)) {
          for (const prefix of rec.change_scope_prefixes) {
            if (typeof prefix === "string" && prefix.length > 0) {
              approvedPrefixes.add(prefix);
            }
          }
        }
      }
    } catch {
      // Let validate-decision-records.mjs handle malformed JSON reporting.
    }
  }
  return Array.from(approvedPrefixes);
}

function main() {
  const policy = loadPolicy();
  const prefixes = Array.isArray(policy.translation_sensitive_prefixes)
    ? policy.translation_sensitive_prefixes
    : ["layer-4/src/", "layer-4/", "renderer/src/translate"];
  const maxApprovalAgeDays = Number.isInteger(policy.max_approval_age_days)
    ? policy.max_approval_age_days
    : 45;
  const requiredPhase = typeof policy.required_phase === "string" ? policy.required_phase : "E";
  const baseRef = process.env.ANCHOR_GOV_BASE_REF || "";

  const changed = listChangedFiles(baseRef);
  const sensitive = changed.filter((file) => isTranslationSensitive(file, prefixes));

  if (sensitive.length === 0) {
    info("OK - no translation-sensitive files changed in working tree");
    return;
  }

  const approvedPrefixes = resolveApprovedScopePrefixes(requiredPhase, maxApprovalAgeDays);
  if (approvedPrefixes.length === 0) {
    fail(
      `translation-sensitive files changed but no ${requiredPhase} approval record exists within ${maxApprovalAgeDays} days`
    );
    fail(`changed files: ${sensitive.join(", ")}`);
    process.exit(1);
  }

  const uncovered = sensitive.filter(
    (file) => !approvedPrefixes.some((prefix) => file.startsWith(prefix))
  );
  if (uncovered.length > 0) {
    fail("translation-sensitive files changed outside approved scope prefixes");
    fail(`uncovered files: ${uncovered.join(", ")}`);
    process.exit(1);
  }

  const layer4Changed = sensitive.some((file) => file.startsWith("layer-4/"));
  if (layer4Changed) {
    try {
      execSync("npm --prefix layer-4 run replay", {
        cwd: ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      });
      execSync("npm --prefix layer-4 run check:strict", {
        cwd: ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      });
      info("OK - layer-4 replay and strict checks passed");
    } catch (e) {
      fail("layer-4 replay/strict checks failed");
      fail(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  }

  info("OK - translation-sensitive changes are covered by a Phase E approval record");
}

main();
