import assert from "node:assert/strict";
import { toChangeEvent } from "./classify";

function testDecisionTag() {
  const evt = toChangeEvent({
    eventType: "comment-created",
    issueKey: "AN-42",
    issueId: "10001",
    summary: "Decision on chart type",
    body: "[decision] use stacked bars",
    actorId: "u1",
    actorName: "Jason",
    timestamp: "2026-06-21T12:00:00.000Z",
  });

  assert.equal(evt.source, "jira");
  assert.deepEqual(evt.tags, ["decision"]);
  assert.equal(evt.action, "comment");
}

function testStructuralTransition() {
  const evt = toChangeEvent({
    eventType: "issue-transitioned",
    issueKey: "AN-9",
    issueId: "10002",
    summary: "Finalize plugin contract",
    actorId: "u2",
    actorName: "Operator",
    timestamp: "2026-06-21T12:00:00.000Z",
    transitionTo: "Done",
  });

  assert.equal(evt.kind, "structural");
  assert.equal(evt.action, "transition");
}

function testModerateUpdate() {
  const evt = toChangeEvent({
    eventType: "issue-updated",
    issueKey: "AN-7",
    issueId: "10003",
    summary: "Tweak estimator copy",
    actorId: "u3",
    actorName: "Editor",
    timestamp: "2026-06-21T12:00:00.000Z",
  });

  assert.equal(evt.kind, "moderate");
  assert.equal(evt.entity_type, "issue");
}

function run() {
  testDecisionTag();
  testStructuralTransition();
  testModerateUpdate();
  process.stdout.write("jira classify fixtures: PASS\n");
}

run();
