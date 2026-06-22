#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const recordsDir = path.join(ROOT, "governance", "records");

const allowedDecision = new Set(["approve", "approve-with-guardrails", "defer", "reject"]);
const allowedSource = new Set(["GoldenFlow", "Contentrain", "Anchor"]);
const allowedPhase = new Set(["A", "B", "C", "D", "E"]);

function fail(msg) {
  process.stderr.write(`governance-check: FAIL - ${msg}\n`);
}

function ok(msg) {
  process.stdout.write(`governance-check: OK - ${msg}\n`);
}

function isDateLike(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validateRecord(filePath, rec) {
  const errors = [];
  const required = [
    "id",
    "phase",
    "source",
    "impacted_layer",
    "borrowed_pattern",
    "keep_native_guardrails",
    "decision",
    "owner",
    "reviewed_by",
    "date",
    "rollback_trigger",
  ];

  for (const key of required) {
    if (!(key in rec)) errors.push(`missing required field '${key}'`);
  }

  if (typeof rec.id !== "string" || rec.id.length === 0) errors.push("id must be a non-empty string");
  if (!allowedPhase.has(rec.phase)) errors.push("phase must be one of A/B/C/D/E");
  if (!allowedSource.has(rec.source)) errors.push("source must be GoldenFlow, Contentrain, or Anchor");
  if (typeof rec.impacted_layer !== "string" || rec.impacted_layer.length === 0) errors.push("impacted_layer must be a non-empty string");
  if (typeof rec.borrowed_pattern !== "string" || rec.borrowed_pattern.length === 0) errors.push("borrowed_pattern must be a non-empty string");
  if (!Array.isArray(rec.keep_native_guardrails) || rec.keep_native_guardrails.length === 0) {
    errors.push("keep_native_guardrails must be a non-empty array");
  }
  if (!allowedDecision.has(rec.decision)) errors.push("decision has invalid value");
  if (typeof rec.owner !== "string" || rec.owner.length === 0) errors.push("owner must be a non-empty string");
  if (!Array.isArray(rec.reviewed_by) || rec.reviewed_by.length === 0) errors.push("reviewed_by must be a non-empty array");
  if (!isDateLike(rec.date)) errors.push("date must use YYYY-MM-DD");
  if (typeof rec.rollback_trigger !== "string" || rec.rollback_trigger.length === 0) errors.push("rollback_trigger must be a non-empty string");
  if (
    "change_scope_prefixes" in rec &&
    (!Array.isArray(rec.change_scope_prefixes) || rec.change_scope_prefixes.length === 0)
  ) {
    errors.push("change_scope_prefixes must be a non-empty array when present");
  }

  if ("break_glass" in rec) {
    if (!rec.break_glass || typeof rec.break_glass !== "object") {
      errors.push("break_glass must be an object when present");
    } else {
      if (typeof rec.break_glass.allowed !== "boolean") errors.push("break_glass.allowed must be boolean");
      if (!Number.isInteger(rec.break_glass.retro_sla_hours) || rec.break_glass.retro_sla_hours < 1) {
        errors.push("break_glass.retro_sla_hours must be integer >= 1");
      }
    }
  }

  if (errors.length > 0) {
    fail(`${path.basename(filePath)} -> ${errors.join("; ")}`);
    return false;
  }

  ok(`${path.basename(filePath)} validated`);
  return true;
}

function main() {
  if (!fs.existsSync(recordsDir)) {
    fail(`records dir not found: ${recordsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(recordsDir).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) {
    fail("no decision records found");
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  for (const file of files) {
    const fullPath = path.join(recordsDir, file);
    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      if (validateRecord(fullPath, parsed)) passed += 1;
      else failed += 1;
    } catch (e) {
      failed += 1;
      fail(`${file} -> invalid json: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  process.stdout.write(`governance-check: summary passed=${passed} failed=${failed}\n`);
  if (failed > 0) process.exit(1);
}

main();
