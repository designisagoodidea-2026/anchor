// Anchor renderer — multi-source ingest.
//
// Composes one ChangeEvent[] from up to three sources:
//
//   - Cowork: NDJSON file at ANCHOR_EVENTS_FILE.
//   - Figma:  GET <ANCHOR_FIGMA_WORKER_URL>/poll-all
//   - Slack:  GET <ANCHOR_SLACK_WORKER_URL>/events?since=<window_start>
//
// Each source is optional — if its env var isn't set, that lane is skipped.
// At least one source must be configured; otherwise we exit with status 1.
//
// Per Layer 1's contract, every source emits the canonical change_event
// shape, so the consumer downstream doesn't care which source produced what.

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import readline from "node:readline";
import type { ChangeEvent } from "../../shared/change-event";
import {
  INGEST_CONTRACT_VERSION,
  emptyNormalizationStats,
  emptySourceProfileSummary,
  emptyViolationCounts,
  type IngestManifest,
  type IngestMode,
  type IngestViolationCode,
  type NormalizationTransformName,
} from "./ingest-manifest";

export interface IngestOptions {
  /** NDJSON file path for cowork. Falsy → skip the cowork lane. */
  cowork_events_file?: string;
  /** Base URL for the Figma Cloudflare Worker. Falsy → skip. */
  figma_worker_url?: string;
  /** Base URL for the Slack Cloudflare Worker. Falsy → skip. */
  slack_worker_url?: string;
  /** ISO timestamp passed to slack/events?since=. */
  slack_since_iso?: string;
  /** Override fetch impl in tests. */
  fetchImpl?: typeof fetch;
  /** Ingest boundary behavior. Default: permissive. */
  mode?: IngestMode;
  /** Normalization profile. Use "none" to disable. */
  normalization_profile?: string;
  /** Explicit transform list for config-driven profiles. */
  normalization_transforms?: NormalizationTransformName[];
  /** Optional deterministic cap for cowork lines processed. */
  max_cowork_lines?: number;
  /** Cowork parser mode. */
  cowork_parser_mode?: "full" | "stream";
}

export interface IngestResult {
  events: ChangeEvent[];
  /** Per-source counts so the renderer can report what came from where. */
  counts: Record<"cowork" | "figma" | "slack", number>;
  /** Any source-level errors. Non-fatal — partial reads still ship. */
  warnings: string[];
  /** Structured ingest diagnostics and contract outcomes. */
  manifest: IngestManifest;
}

export async function ingestEvents(opts: IngestOptions): Promise<IngestResult> {
  const mode: IngestMode = opts.mode ?? "permissive";
  const normalizationProfile = opts.normalization_profile ?? "slack-pilot-v1-core";
  const parserMode = opts.cowork_parser_mode ?? "full";
  const maxCoworkLines =
    typeof opts.max_cowork_lines === "number" && Number.isFinite(opts.max_cowork_lines)
      ? Math.max(0, Math.floor(opts.max_cowork_lines))
      : null;
  const normalizationEnabled = normalizationProfile !== "none";
  const normalizationOrder: NormalizationTransformName[] =
    opts.normalization_transforms && opts.normalization_transforms.length > 0
      ? opts.normalization_transforms
      : ["timestamp_iso", "collapse_snippet_whitespace", "trim_actor_display_name"];
  const counts = { cowork: 0, figma: 0, slack: 0 };
  const warnings: string[] = [];
  const events: ChangeEvent[] = [];
  const manifest: IngestManifest = {
    run_id: randomUUID(),
    contract_version: INGEST_CONTRACT_VERSION,
    mode,
    totals: { received: 0, accepted: 0, dropped: 0 },
    lanes: {
      cowork: {
        configured: Boolean(opts.cowork_events_file),
        received: 0,
        accepted: 0,
        dropped: 0,
      },
      figma: {
        configured: Boolean(opts.figma_worker_url),
        received: 0,
        accepted: 0,
        dropped: 0,
      },
      slack: {
        configured: Boolean(opts.slack_worker_url),
        received: 0,
        accepted: 0,
        dropped: 0,
      },
    },
    accepted_by_source: { cowork: 0, figma: 0, slack: 0 },
    violations_by_code: emptyViolationCounts(),
    normalization: {
      enabled: normalizationEnabled,
      profile: normalizationProfile,
      scope: "slack_only",
      transforms_in_order: normalizationOrder,
      by_transform: emptyNormalizationStats(),
    },
    limits: {
      parser_mode: parserMode,
      max_cowork_lines: maxCoworkLines,
      cowork_received_lines: 0,
      cap_hit: false,
      degraded: false,
      stop_reason: null,
    },
    profiling: {
      by_source: {
        cowork: emptySourceProfileSummary(),
        figma: emptySourceProfileSummary(),
        slack: emptySourceProfileSummary(),
        jira: emptySourceProfileSummary(),
      },
    },
  };
  const actorSets: Record<"cowork" | "figma" | "slack" | "jira", Set<string>> = {
    cowork: new Set(),
    figma: new Set(),
    slack: new Set(),
    jira: new Set(),
  };
  const fetchImpl = opts.fetchImpl ?? fetch;

  const recordViolation = (
    lane: "cowork" | "figma" | "slack",
    code: IngestViolationCode,
    detail: string
  ) => {
    manifest.violations_by_code[code] += 1;
    warnings.push(`${lane}: ${code} - ${detail}`);
  };

  const markCoworkCapHit = () => {
    if (manifest.limits.cap_hit) return;
    manifest.limits.cap_hit = true;
    manifest.limits.degraded = true;
    manifest.limits.stop_reason = "cowork_max_lines_reached";
    warnings.push(
      `cowork: cap reached at ${manifest.limits.cowork_received_lines} lines (max=${manifest.limits.max_cowork_lines})`
    );
  };

  const applyNormalization = (
    lane: "cowork" | "figma" | "slack",
    ev: ChangeEvent
  ): ChangeEvent | null => {
    if (!normalizationEnabled || ev.source !== "slack") return ev;

    const clone: ChangeEvent = {
      ...ev,
      actor: { ...ev.actor },
      tags: Array.isArray(ev.tags) ? [...ev.tags] : [],
    };

    const runTransform = (
      name: NormalizationTransformName,
      apply: () => boolean
    ): boolean => {
      const stats = manifest.normalization.by_transform[name];
      stats.attempted += 1;
      try {
        if (apply()) stats.applied += 1;
        else stats.noop += 1;
        return true;
      } catch (e) {
        stats.errored += 1;
        manifest.totals.dropped += 1;
        manifest.lanes[lane].dropped += 1;
        recordViolation(lane, "transform_error", `${name}: ${e instanceof Error ? e.message : String(e)}`);
        return false;
      }
    };

    for (const t of normalizationOrder) {
      let ok = true;
      if (t === "timestamp_iso") {
        ok = runTransform("timestamp_iso", () => {
          const normalized = new Date(clone.timestamp).toISOString();
          const changed = normalized !== clone.timestamp;
          clone.timestamp = normalized;
          return changed;
        });
      } else if (t === "trim_ids") {
        ok = runTransform("trim_ids", () => {
          const id = clone.entity_id.trim();
          const parent = clone.parent_id === null ? null : clone.parent_id.trim();
          const changed = id !== clone.entity_id || parent !== clone.parent_id;
          clone.entity_id = id;
          clone.parent_id = parent;
          return changed;
        });
      } else if (t === "collapse_snippet_whitespace") {
        ok = runTransform("collapse_snippet_whitespace", () => {
          const normalized = clone.snippet.replace(/\s+/g, " ").trim();
          const changed = normalized !== clone.snippet;
          clone.snippet = normalized;
          return changed;
        });
      } else if (t === "normalize_tags") {
        ok = runTransform("normalize_tags", () => {
          const before = clone.tags.join("|");
          const normalized = Array.from(
            new Set(clone.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))
          ).sort();
          clone.tags = normalized;
          return normalized.join("|") !== before;
        });
      } else if (t === "trim_actor_display_name") {
        ok = runTransform("trim_actor_display_name", () => {
          const normalized = clone.actor.display_name.trim();
          const changed = normalized !== clone.actor.display_name;
          clone.actor.display_name = normalized;
          return changed;
        });
      }

      if (!ok) return null;
    }

    return clone;
  };

  const updateProfiling = (ev: ChangeEvent) => {
    const source = ev.source;
    const p = manifest.profiling.by_source[source];
    p.events += 1;
    if (ev.parent_id === null) p.null_parent_id += 1;
    if (!["polish", "moderate", "structural", "unknown"].includes(ev.kind)) {
      p.unknown_kind_events += 1;
    }
    p.kind_counts[ev.kind] = (p.kind_counts[ev.kind] ?? 0) + 1;
    if (ev.tags.length > 0) p.non_empty_tag_events += 1;
    for (const tag of ev.tags) {
      p.tag_counts[tag] = (p.tag_counts[tag] ?? 0) + 1;
    }
    actorSets[source].add(ev.actor.id);
    p.unique_actor_ids = actorSets[source].size;
  };

  const acceptEvent = (lane: "cowork" | "figma" | "slack", ev: ChangeEvent) => {
    const normalized = applyNormalization(lane, ev);
    if (!normalized) return;

    events.push(normalized);
    updateProfiling(normalized);
    manifest.totals.accepted += 1;
    manifest.lanes[lane].accepted += 1;

    if (normalized.source === "figma") counts.figma++;
    else if (normalized.source === "slack") counts.slack++;
    else counts.cowork++;
  };

  const validateEvent = (
    lane: "cowork" | "figma" | "slack",
    raw: unknown
  ): ChangeEvent | null => {
    manifest.totals.received += 1;
    manifest.lanes[lane].received += 1;

    if (!raw || typeof raw !== "object") {
      manifest.totals.dropped += 1;
      manifest.lanes[lane].dropped += 1;
      recordViolation(lane, "malformed_payload", "event is not an object");
      return null;
    }

    const ev = raw as Record<string, unknown>;
    const requiredStringFields = [
      "timestamp",
      "entity_id",
      "entity_type",
      "action",
      "kind",
      "snippet",
      "raw_ref",
    ];

    for (const field of requiredStringFields) {
      if (!(field in ev)) {
        manifest.totals.dropped += 1;
        manifest.lanes[lane].dropped += 1;
        recordViolation(lane, "missing_required_field", `${field} is missing`);
        return null;
      }
      if (typeof ev[field] !== "string") {
        manifest.totals.dropped += 1;
        manifest.lanes[lane].dropped += 1;
        recordViolation(lane, "invalid_type", `${field} must be a string`);
        return null;
      }
    }

    if (!("source" in ev)) {
      manifest.totals.dropped += 1;
      manifest.lanes[lane].dropped += 1;
      recordViolation(lane, "missing_required_field", "source is missing");
      return null;
    }

    if (typeof ev.source !== "string") {
      manifest.totals.dropped += 1;
      manifest.lanes[lane].dropped += 1;
      recordViolation(lane, "invalid_type", "source must be a string");
      return null;
    }

    if (!["cowork", "figma", "slack", "jira"].includes(ev.source)) {
      manifest.totals.dropped += 1;
      manifest.lanes[lane].dropped += 1;
      recordViolation(lane, "unknown_source", `source '${ev.source}' is not allowed`);
      return null;
    }

    if (!("actor" in ev)) {
      manifest.totals.dropped += 1;
      manifest.lanes[lane].dropped += 1;
      recordViolation(lane, "missing_required_field", "actor is missing");
      return null;
    }

    if (!ev.actor || typeof ev.actor !== "object") {
      manifest.totals.dropped += 1;
      manifest.lanes[lane].dropped += 1;
      recordViolation(lane, "invalid_type", "actor must be an object");
      return null;
    }

    const actor = ev.actor as Record<string, unknown>;
    if (typeof actor.id !== "string" || typeof actor.display_name !== "string") {
      manifest.totals.dropped += 1;
      manifest.lanes[lane].dropped += 1;
      recordViolation(lane, "invalid_type", "actor.id and actor.display_name must be strings");
      return null;
    }

    const ts = Date.parse(ev.timestamp as string);
    if (Number.isNaN(ts)) {
      manifest.totals.dropped += 1;
      manifest.lanes[lane].dropped += 1;
      recordViolation(lane, "invalid_timestamp", `invalid timestamp '${ev.timestamp as string}'`);
      return null;
    }

    return ev as unknown as ChangeEvent;
  };

  const handleCoworkLine = (line: string) => {
    if (!line.trim()) return;

    if (
      manifest.limits.max_cowork_lines !== null &&
      manifest.limits.cowork_received_lines >= manifest.limits.max_cowork_lines
    ) {
      markCoworkCapHit();
      return;
    }

    manifest.limits.cowork_received_lines += 1;

    try {
      const maybeEvent = validateEvent("cowork", JSON.parse(line));
      if (maybeEvent) acceptEvent("cowork", maybeEvent);
    } catch (e) {
      manifest.totals.received += 1;
      manifest.totals.dropped += 1;
      manifest.lanes.cowork.received += 1;
      manifest.lanes.cowork.dropped += 1;
      recordViolation("cowork", "malformed_payload", e instanceof Error ? e.message : String(e));
    }
  };

  // ─── Cowork (events file may also carry figma/slack events mixed in;
  //             the seed generator emits a single NDJSON with all three) ───
  if (opts.cowork_events_file) {
    try {
      const p = opts.cowork_events_file;
      if (!fs.existsSync(p)) {
        warnings.push(`cowork: events file not found (${p})`);
      } else {
        if (parserMode === "stream") {
          const stream = fs.createReadStream(p, { encoding: "utf8" });
          const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
          for await (const line of rl) {
            if (manifest.limits.cap_hit) break;
            handleCoworkLine(line);
          }
          rl.close();
          stream.close();
        } else {
          for (const line of fs.readFileSync(p, "utf8").split("\n")) {
            if (manifest.limits.cap_hit) break;
            handleCoworkLine(line);
          }
        }
      }
    } catch (e) {
      warnings.push(
        `cowork: read failed — ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  // ─── Figma ───────────────────────────────────────────────────────────────
  if (opts.figma_worker_url) {
    try {
      const url = `${opts.figma_worker_url.replace(/\/$/, "")}/poll-all`;
      const res = await fetchImpl(url);
      if (!res.ok) {
        warnings.push(`figma: /poll-all returned ${res.status}`);
      } else {
        const body = (await res.json()) as { events?: unknown[] };
        const figmaEvents = Array.isArray(body.events) ? body.events : [];
        if (!Array.isArray(body.events)) {
          warnings.push("figma: missing events array in /poll-all response");
        }
        for (const ev of figmaEvents) {
          const maybeEvent = validateEvent("figma", ev);
          if (maybeEvent) acceptEvent("figma", maybeEvent);
        }
      }
    } catch (e) {
      warnings.push(
        `figma: fetch failed — ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  // ─── Slack ───────────────────────────────────────────────────────────────
  if (opts.slack_worker_url) {
    try {
      const base = opts.slack_worker_url.replace(/\/$/, "");
      const url = opts.slack_since_iso
        ? `${base}/events?since=${encodeURIComponent(opts.slack_since_iso)}`
        : `${base}/events`;
      const res = await fetchImpl(url);
      if (!res.ok) {
        warnings.push(`slack: /events returned ${res.status}`);
      } else {
        const body = (await res.json()) as { events?: unknown[] };
        const slackEvents = Array.isArray(body.events) ? body.events : [];
        if (!Array.isArray(body.events)) {
          warnings.push("slack: missing events array in /events response");
        }
        for (const ev of slackEvents) {
          const maybeEvent = validateEvent("slack", ev);
          if (maybeEvent) acceptEvent("slack", maybeEvent);
        }
      }
    } catch (e) {
      warnings.push(
        `slack: fetch failed — ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  // Sort by timestamp so downstream sees a coherent timeline regardless of
  // source ordering.
  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  manifest.accepted_by_source = { ...counts };

  return { events, counts, warnings, manifest };
}
