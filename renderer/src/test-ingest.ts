import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ingestEvents } from "./ingest.js";

async function testPermissiveValidationAndManifest() {
  const payload = {
    events: [
      {
        actor: { id: "u1", display_name: "User", source_user_id: null, role_hint: null },
        timestamp: "2026-06-21T00:00:00.000Z",
        source: "figma",
        entity_id: "e1",
        entity_type: "file",
        parent_id: null,
        action: "edit",
        kind: "moderate",
        tags: [],
        snippet: "updated frame",
        raw_ref: "figma://file/e1",
      },
      {
        actor: { id: "u2", display_name: "User", source_user_id: null, role_hint: null },
        timestamp: "not-a-date",
        source: "figma",
        entity_id: "e2",
        entity_type: "file",
        parent_id: null,
        action: "edit",
        kind: "moderate",
        tags: [],
        snippet: "bad timestamp",
        raw_ref: "figma://file/e2",
      },
    ],
  };

  const fetchImpl: typeof fetch = async () => {
    return new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json" },
    });
  };

  const result = await ingestEvents({
    figma_worker_url: "https://example.test",
    mode: "permissive",
    fetchImpl,
  });

  assert.equal(result.events.length, 1);
  assert.equal(result.manifest.totals.received, 2);
  assert.equal(result.manifest.totals.accepted, 1);
  assert.equal(result.manifest.totals.dropped, 1);
  assert.equal(result.manifest.violations_by_code.invalid_timestamp, 1);
}

async function testStrictModeStillClassifiesViolations() {
  const payload = { events: [{ source: "mystery" }] };
  const fetchImpl: typeof fetch = async () => {
    return new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json" },
    });
  };

  const result = await ingestEvents({
    slack_worker_url: "https://example.test",
    mode: "strict",
    fetchImpl,
  });

  assert.equal(result.events.length, 0);
  assert.equal(result.manifest.mode, "strict");
  assert.equal(result.manifest.totals.received, 1);
  assert.equal(result.manifest.totals.dropped, 1);
  assert.ok(result.manifest.violations_by_code.missing_required_field > 0 || result.manifest.violations_by_code.unknown_source > 0);
}

await testPermissiveValidationAndManifest();
await testStrictModeStillClassifiesViolations();

async function testSlackNormalizationCore3() {
  const payload = {
    events: [
      {
        actor: { id: "u1", display_name: "  Alex  ", source_user_id: null, role_hint: null },
        timestamp: "2026-06-21T00:00:00Z",
        source: "slack",
        entity_id: "e1",
        entity_type: "message",
        parent_id: null,
        action: "comment",
        kind: "polish",
        tags: [],
        snippet: "hello    world\n\nfrom   slack",
        raw_ref: "slack://msg/e1",
      },
      {
        actor: { id: "u2", display_name: "  Pat  ", source_user_id: null, role_hint: null },
        timestamp: "2026-06-21T00:00:00Z",
        source: "figma",
        entity_id: "e2",
        entity_type: "file",
        parent_id: null,
        action: "edit",
        kind: "moderate",
        tags: [],
        snippet: "figma   text",
        raw_ref: "figma://file/e2",
      },
    ],
  };

  const fetchImpl: typeof fetch = async () => {
    return new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json" },
    });
  };

  const result = await ingestEvents({
    slack_worker_url: "https://example.test",
    mode: "permissive",
    normalization_profile: "slack-pilot-v1-core",
    fetchImpl,
  });

  const slackEvent = result.events.find((e) => e.source === "slack");
  const figmaEvent = result.events.find((e) => e.source === "figma");
  assert.ok(slackEvent);
  assert.ok(figmaEvent);

  assert.equal(slackEvent?.actor.display_name, "Alex");
  assert.equal(slackEvent?.snippet, "hello world from slack");
  assert.equal(slackEvent?.timestamp, "2026-06-21T00:00:00.000Z");

  assert.equal(figmaEvent?.actor.display_name, "  Pat  ");
  assert.equal(figmaEvent?.snippet, "figma   text");

  const stats = result.manifest.normalization.by_transform;
  assert.equal(result.manifest.normalization.profile, "slack-pilot-v1-core");
  assert.equal(stats.timestamp_iso.attempted, 1);
  assert.equal(stats.collapse_snippet_whitespace.attempted, 1);
  assert.equal(stats.trim_actor_display_name.attempted, 1);
  assert.equal(stats.timestamp_iso.applied, 1);
  assert.equal(stats.collapse_snippet_whitespace.applied, 1);
  assert.equal(stats.trim_actor_display_name.applied, 1);
}

await testSlackNormalizationCore3();

async function testSlackNormalizationFiveTransformsAndProfiling() {
  const payload = {
    events: [
      {
        actor: { id: "u1", display_name: "  Alex  ", source_user_id: null, role_hint: null },
        timestamp: "2026-06-21T00:00:00Z",
        source: "slack",
        entity_id: " e1 ",
        entity_type: "message",
        parent_id: " p1 ",
        action: "comment",
        kind: "moderate",
        tags: [" Design ", "ops", "OPS"],
        snippet: "hello    world\n\nfrom   slack",
        raw_ref: "slack://msg/e1",
      },
    ],
  };

  const fetchImpl: typeof fetch = async () => {
    return new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json" },
    });
  };

  const result = await ingestEvents({
    slack_worker_url: "https://example.test",
    mode: "permissive",
    normalization_profile: "slack-pilot-v1",
    normalization_transforms: [
      "timestamp_iso",
      "trim_ids",
      "collapse_snippet_whitespace",
      "normalize_tags",
      "trim_actor_display_name",
    ],
    fetchImpl,
  });

  const slackEvent = result.events[0];
  assert.ok(slackEvent);
  assert.equal(slackEvent.entity_id, "e1");
  assert.equal(slackEvent.parent_id, "p1");
  assert.deepEqual(slackEvent.tags, ["design", "ops"]);

  const stats = result.manifest.normalization.by_transform;
  assert.equal(stats.timestamp_iso.attempted, 1);
  assert.equal(stats.trim_ids.attempted, 1);
  assert.equal(stats.collapse_snippet_whitespace.attempted, 1);
  assert.equal(stats.normalize_tags.attempted, 1);
  assert.equal(stats.trim_actor_display_name.attempted, 1);

  const p = result.manifest.profiling.by_source.slack;
  assert.equal(p.events, 1);
  assert.equal(p.non_empty_tag_events, 1);
  assert.equal(p.unique_actor_ids, 1);
  assert.equal(p.kind_counts.moderate, 1);
  assert.equal(p.tag_counts.design, 1);
  assert.equal(p.tag_counts.ops, 1);
}

await testSlackNormalizationFiveTransformsAndProfiling();

async function testCoworkCapSetsDegradedState() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "anchor-ingest-"));
  const eventsFile = path.join(tmpDir, "events.ndjson");
  const lines = [
    JSON.stringify({
      actor: { id: "u1", display_name: "A", source_user_id: null, role_hint: null },
      timestamp: "2026-06-21T00:00:00.000Z",
      source: "cowork",
      entity_id: "1",
      entity_type: "memory_entry",
      parent_id: null,
      action: "edit",
      kind: "moderate",
      tags: [],
      snippet: "one",
      raw_ref: "file:///tmp/1",
    }),
    JSON.stringify({
      actor: { id: "u1", display_name: "A", source_user_id: null, role_hint: null },
      timestamp: "2026-06-21T00:00:01.000Z",
      source: "cowork",
      entity_id: "2",
      entity_type: "memory_entry",
      parent_id: null,
      action: "edit",
      kind: "moderate",
      tags: [],
      snippet: "two",
      raw_ref: "file:///tmp/2",
    }),
    JSON.stringify({
      actor: { id: "u1", display_name: "A", source_user_id: null, role_hint: null },
      timestamp: "2026-06-21T00:00:02.000Z",
      source: "cowork",
      entity_id: "3",
      entity_type: "memory_entry",
      parent_id: null,
      action: "edit",
      kind: "moderate",
      tags: [],
      snippet: "three",
      raw_ref: "file:///tmp/3",
    }),
  ];
  fs.writeFileSync(eventsFile, lines.join("\n") + "\n", "utf8");

  const result = await ingestEvents({
    cowork_events_file: eventsFile,
    max_cowork_lines: 2,
    cowork_parser_mode: "stream",
  });

  assert.equal(result.events.length, 2);
  assert.equal(result.manifest.limits.cap_hit, true);
  assert.equal(result.manifest.limits.degraded, true);
  assert.equal(result.manifest.limits.stop_reason, "cowork_max_lines_reached");
  assert.equal(result.manifest.limits.cowork_received_lines, 2);
  assert.ok(result.warnings.some((w) => w.includes("cap reached")));

  fs.rmSync(tmpDir, { recursive: true, force: true });
}

await testCoworkCapSetsDegradedState();

console.log("\nAnchor renderer ingest tests\n\n  ok permissive mode validates and drops invalid events\n  ok strict mode captures violations in manifest\n  ok Slack Core-3 normalization applies only to Slack events\n  ok Slack 5-transform normalization and profiling summary are emitted\n  ok cowork cap marks run as degraded with deterministic boundary\n");
