import assert from "node:assert/strict";
import path from "node:path";
import { classifyCoworkEvent } from "./classify.js";

const root = "/tmp/anchor-cowork";

function testDecisionTagFromFirstLine() {
  const evt = classifyCoworkEvent({
    rootDir: root,
    absolutePath: path.join(root, "notes", "daily.md"),
    watchEvent: "change",
    fileText: "[decision] use stacked bars\nrest",
    timestamp: "2026-06-21T12:00:00.000Z",
  });

  assert.equal(evt.source, "cowork");
  assert.deepEqual(evt.tags, ["decision"]);
  assert.equal(evt.kind, "moderate");
}

function testStructuralFromSkillsPath() {
  const evt = classifyCoworkEvent({
    rootDir: root,
    absolutePath: path.join(root, "skills", "new-skill", "SKILL.md"),
    watchEvent: "add",
    fileText: "New skill",
    timestamp: "2026-06-21T12:00:00.000Z",
  });

  assert.equal(evt.entity_type, "skill");
  assert.equal(evt.kind, "structural");
  assert.equal(evt.action, "create");
}

function testDeleteMapsToModerate() {
  const evt = classifyCoworkEvent({
    rootDir: root,
    absolutePath: path.join(root, "notes", "old.md"),
    watchEvent: "unlink",
    fileText: "",
    timestamp: "2026-06-21T12:00:00.000Z",
  });

  assert.equal(evt.action, "delete");
  assert.equal(evt.kind, "moderate");
}

function run() {
  testDecisionTagFromFirstLine();
  testStructuralFromSkillsPath();
  testDeleteMapsToModerate();
  process.stdout.write("cowork fixtures: PASS\n");
}

run();
