#!/usr/bin/env tsx
//
// Anchor digest renderer — v0.3 (Layer 3 + multi-source wired in).
//
// Ingests change_event records from up to three sources (Cowork NDJSON,
// Figma /poll-all, Slack /events?since=) into one stream, applies Layer 3
// container resolution against the leader's declared mapping table, then
// runs Layer 4 per resolved container. Loads principles from
// /principles/jason.yaml. Renders capacity + health-trend + drift signals
// per container in the leader's voice. Refuses on banned vocabulary.
//
// Configuration:
//   ANCHOR_EVENTS_FILE         Cowork NDJSON. Falsy → skip the cowork lane.
//                              Default: /tmp/anchor-events.ndjson if it exists.
//                              (Positional arg also accepted: digest.ts <file>)
//   ANCHOR_FIGMA_WORKER_URL    Base URL of the deployed Figma Worker. Falsy → skip.
//   ANCHOR_SLACK_WORKER_URL    Base URL of the deployed Slack Worker. Falsy → skip.
//   ANCHOR_CONTAINER_SOURCE    "jira" | "airtable" | "fixture". Default: jira (per ADR-04).
//   ANCHOR_FIXTURE_CONTAINERS  Required when ANCHOR_CONTAINER_SOURCE=fixture —
//                              path to a Container[] JSON file.
//   ANCHOR_VOICE_PROFILE       Path to the voice profile markdown.
//                              Default: ../../memory/anchor-voice-profile-jason.md
//   ANCHOR_PRINCIPLES          Path to the principles YAML.
//                              Default: ../../principles/jason.yaml
//   ANCHOR_WINDOW_HOURS        Length of each window (decimal allowed). Default: 1.
//   ANCHOR_LEADER_ID           Leader slug. Default: jason.
//   ANCHOR_STATE_DIR           State directory. Default: <repo>/state.
//   ANCHOR_DRY_RUN             "1" → compute diffs but don't write state.
//
// Output: markdown digest on stdout. Status / warnings on stderr.
// Exit 0 on success, 1 on input error, 2 on vocabulary refusal.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

import type { EventKind } from "../../shared/change-event";
import { computeSignalsWithDiagnostics } from "../../layer-4/src/translator.js";
import { loadPrinciples } from "../../layer-4/src/principles.js";
import type {
  Signal,
  CapacityValue,
  HealthTrendValue,
  DriftValue,
  EventRef,
} from "../../layer-4/src/types.js";
import { computeDiffs, commitSnapshot } from "../../layer-5/src/diff.js";
import { LocalJsonStateSource } from "../../layer-5/src/storage.js";
import type { Diff } from "../../layer-5/src/types.js";
import { ingestEvents } from "./ingest.js";
import type { IngestMode, NormalizationTransformName } from "./ingest-manifest.js";
import { getContainerSource, resolveEvents } from "./resolve.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Configuration ──────────────────────────────────────────────────────────

const EVENTS_FILE =
  process.argv[2] || process.env.ANCHOR_EVENTS_FILE || "";

const FIGMA_WORKER_URL = process.env.ANCHOR_FIGMA_WORKER_URL || "";
const SLACK_WORKER_URL = process.env.ANCHOR_SLACK_WORKER_URL || "";
const INGEST_MODE =
  process.env.ANCHOR_INGEST_MODE === "strict" ? ("strict" as IngestMode) : ("permissive" as IngestMode);
const NORMALIZATION_PROFILE = process.env.ANCHOR_NORMALIZATION_PROFILE || "slack-pilot-v1-core";
const NORMALIZATION_CONFIG =
  process.env.ANCHOR_NORMALIZATION_CONFIG || path.resolve(__dirname, "../config/normalization-profiles.json");
const COWORK_PARSER_MODE =
  process.env.ANCHOR_COWORK_PARSER_MODE === "stream" ? "stream" : "full";
const INGEST_MAX_EVENTS =
  process.env.ANCHOR_INGEST_MAX_EVENTS && Number.isFinite(Number(process.env.ANCHOR_INGEST_MAX_EVENTS))
    ? Number(process.env.ANCHOR_INGEST_MAX_EVENTS)
    : undefined;
const TRANSLATION_MODE =
  process.env.ANCHOR_TRANSLATION_MODE === "strict" ? "strict" : "permissive";
const TRANSLATION_POLICY_FILE = process.env.ANCHOR_TRANSLATION_POLICY_FILE || "";

const VOICE_PROFILE =
  process.env.ANCHOR_VOICE_PROFILE ||
  path.resolve(__dirname, "../../memory/anchor-voice-profile-jason.md");

const PRINCIPLES_FILE =
  process.env.ANCHOR_PRINCIPLES || path.resolve(__dirname, "../../principles/jason.yaml");

const WINDOW_HOURS = parseFloat(process.env.ANCHOR_WINDOW_HOURS || "1");

// ─── Layer 5 — state + diff configuration ──────────────────────────────────

const LEADER_ID = process.env.ANCHOR_LEADER_ID || "jason";

const STATE_DIR =
  process.env.ANCHOR_STATE_DIR || path.resolve(__dirname, "../../state");

/** When true, compute diffs but don't write the new snapshot back. */
const DRY_RUN = process.env.ANCHOR_DRY_RUN === "1";

// ─── Load voice profile ─────────────────────────────────────────────────────

interface VoiceProfile {
  register?: { vocabulary_avoid?: string[] };
  [k: string]: unknown;
}

function loadVoiceProfile(file: string): VoiceProfile {
  if (!fs.existsSync(file)) {
    process.stderr.write(`anchor-digest: voice profile not found: ${file}\n`);
    process.exit(1);
  }
  const content = fs.readFileSync(file, "utf8");
  const match = content.match(/```yaml\n([\s\S]+?)\n```/);
  if (!match) {
    process.stderr.write(`anchor-digest: no \`\`\`yaml block in ${file}\n`);
    process.exit(1);
  }
  try {
    return yaml.load(match[1]!) as VoiceProfile;
  } catch (e) {
    process.stderr.write(
      `anchor-digest: voice profile YAML parse error: ${
        e instanceof Error ? e.message : String(e)
      }\n`
    );
    process.exit(1);
  }
}

// ─── Window math ────────────────────────────────────────────────────────────

function makeWindows(hours: number, nowIso: string) {
  const now = new Date(nowIso).getTime();
  const windowMs = hours * 3600 * 1000;
  const currentEnd = new Date(now).toISOString();
  const currentStart = new Date(now - windowMs).toISOString();
  const priorStart = new Date(now - 2 * windowMs).toISOString();
  return {
    current_start: currentStart,
    current_end: currentEnd,
    prior_start: priorStart,
    prior_end: currentStart,
  };
}

// ─── Render helpers ─────────────────────────────────────────────────────────

function pluralize(n: number, singular: string, plural?: string): string {
  return n === 1 ? singular : plural || `${singular}s`;
}

function formatWindow(hours: number): string {
  if (hours >= 1) {
    const n = hours === Math.floor(hours) ? hours : hours.toFixed(1);
    return `${n} ${pluralize(hours, "hour")}`;
  }
  const minutes = Math.round(hours * 60);
  return `${minutes} ${pluralize(minutes, "minute")}`;
}

function entityLabel(ref: EventRef): string {
  // raw_ref is opaque per-source. Trim the scheme for readability.
  return ref.raw_ref.replace(/^file:\/\//, "").replace(/^slack:\/\//, "").replace(/^figma:\/\//, "");
}

function kindLine(by: Record<EventKind, number>, decision_count: number): string {
  const order: EventKind[] = ["structural", "moderate", "polish", "unknown"];
  const parts = order.filter((k) => (by[k] || 0) > 0).map((k) => `${by[k]} ${k}`);
  if (decision_count > 0) parts.push(`${decision_count} decision-tagged`);
  return parts.join(", ");
}

/** Suffix like " [decision]" when the ref carries that tag, otherwise empty. */
function tagSuffix(ref: EventRef): string {
  if (!ref.tags || ref.tags.length === 0) return "";
  return ` [${ref.tags.join(", ")}]`;
}

// ─── Anchored opening (Layer 5) ────────────────────────────────────────────

/**
 * Renders the diff layer's contribution: watched items, resolved items,
 * and changed items, in that order. Empty when the diff set carries
 * nothing the leader needs surfaced (all first_read or all no_change with
 * no flags) — the honesty rule, applied at the opening.
 */
function renderAnchoredOpening(diffs: Diff[]): string[] {
  const lines: string[] = [];

  const watched = diffs.filter((d) => d.prior_flag?.kind === "watch");
  const resolved = diffs.filter((d) => d.delta === "resolved");
  const changed = diffs.filter(
    (d) => d.delta === "changed" || d.delta === "newly_appeared"
  );

  if (watched.length === 0 && resolved.length === 0 && changed.length === 0) {
    return lines;
  }

  lines.push(`## Since you last read this`);
  lines.push(``);

  if (watched.length > 0) {
    lines.push(`**Items you flagged to watch:**`);
    lines.push(``);
    for (const d of watched) {
      lines.push(`- ${d.delta_narrative}`);
    }
    lines.push(``);
  }

  if (resolved.length > 0) {
    lines.push(`**Resolved since last read:**`);
    lines.push(``);
    for (const d of resolved) {
      lines.push(`- ${d.delta_narrative}`);
    }
    lines.push(``);
  }

  if (changed.length > 0) {
    lines.push(`**What moved:**`);
    lines.push(``);
    for (const d of changed) {
      lines.push(`- ${d.delta_narrative}`);
    }
    lines.push(``);
  }

  return lines;
}

/**
 * Renders the no_change subjects as a compact roundup. Honors the hard
 * rule: no_change collapses to a single line, not a full signal block.
 */
function renderNoChangeRoundup(diffs: Diff[]): string[] {
  const noChange = diffs.filter((d) => d.delta === "no_change");
  if (noChange.length === 0) return [];

  const lines: string[] = [];
  lines.push(`## No change since last read`);
  lines.push(``);
  for (const d of noChange) {
    lines.push(`- ${d.delta_narrative}`);
  }
  lines.push(``);
  return lines;
}

// ─── Renderers per signal kind ──────────────────────────────────────────────

function renderCapacitySection(signals: Signal[]): string[] {
  const capacities = signals.filter((s) => s.kind === "capacity");
  if (capacities.length === 0) return [];

  const lines: string[] = [];
  lines.push(`## Capacity`);
  lines.push(``);

  for (const sig of capacities) {
    const v = sig.value as CapacityValue;
    const window = `${formatWindow(hoursBetween(sig.window.start, sig.window.end))}`;

    if (v.state === "no_signal") {
      lines.push(
        `- **${v.person_label}** — ${v.event_count} ${pluralize(
          v.event_count,
          "event"
        )} in the last ${window}. Below the read floor; no capacity classification.`
      );
      continue;
    }

    const stateLine = ({
      surge: "Surge.",
      sustained: "Sustained load.",
      slack: "Slack.",
      no_signal: "No signal.",
    } as const)[v.state];

    const baselinePhrase =
      v.baseline_per_window !== null && v.baseline_per_window !== undefined
        ? ` against a baseline of ${v.baseline_per_window} per window`
        : "";

    lines.push(
      `- **${v.person_label}** — ${stateLine} ${v.event_count} ${pluralize(
        v.event_count,
        "event"
      )} in the last ${window}${baselinePhrase}.`
    );

    const kindLineText = kindLine(v.by_kind, v.decision_count);
    if (kindLineText) lines.push(`    - Kind: ${kindLineText}.`);

    if (sig.because.length > 0) {
      lines.push(`    - Why:`);
      for (const ref of sig.because.slice(0, 3)) {
        const snip = ref.snippet ? ` — ${truncate(ref.snippet, 80)}` : "";
        lines.push(`        - \`${entityLabel(ref)}\` (${ref.kind})${tagSuffix(ref)}${snip}`);
      }
    }
  }
  lines.push(``);
  return lines;
}

function renderHealthTrendSection(signals: Signal[]): string[] {
  const trends = signals.filter((s) => s.kind === "health_trend");
  if (trends.length === 0) return [];

  const lines: string[] = [];
  lines.push(`## Health trend`);
  lines.push(``);

  for (const sig of trends) {
    const v = sig.value as HealthTrendValue;

    if (v.trend === "no_signal") {
      lines.push(
        `- **${sig.container_name}** — ${v.current_count} events this window, ${v.prior_count} in the prior. Below the read floor; no trend classification.`
      );
      continue;
    }

    const phrase = ({
      improving: "Improving.",
      plateaued: "Plateaued.",
      eroding: "Eroding.",
      no_signal: "No signal.",
    } as const)[v.trend];

    const deltaCount = v.current_count - v.prior_count;
    const deltaWeight = v.current_weight - v.prior_weight;
    const sign = (n: number) => (n > 0 ? "+" : "");

    lines.push(
      `- **${sig.container_name}** — ${phrase} ${v.current_count} ${pluralize(
        v.current_count,
        "event"
      )} this window vs. ${v.prior_count} prior (${sign(
        deltaCount
      )}${deltaCount}). Kind weight ${v.current_weight} vs. ${v.prior_weight} (${sign(
        deltaWeight
      )}${deltaWeight}).`
    );

    if (sig.because.length > 0) {
      lines.push(`    - Top movement:`);
      for (const ref of sig.because.slice(0, 3)) {
        const snip = ref.snippet ? ` — ${truncate(ref.snippet, 80)}` : "";
        lines.push(`        - \`${entityLabel(ref)}\` (${ref.kind})${tagSuffix(ref)}${snip}`);
      }
    }
  }
  lines.push(``);
  return lines;
}

function renderDriftSection(signals: Signal[]): string[] {
  const drifts = signals.filter((s) => s.kind === "drift");
  if (drifts.length === 0) return [];

  // Order: drifting first, compliant second, no_signal last.
  const orderRank = (s: Signal): number => {
    const state = (s.value as DriftValue).state;
    return state === "drifting" ? 0 : state === "compliant" ? 1 : 2;
  };
  const sorted = [...drifts].sort((a, b) => orderRank(a) - orderRank(b));

  const lines: string[] = [];
  lines.push(`## Drift against principles`);
  lines.push(``);

  for (const sig of sorted) {
    const v = sig.value as DriftValue;
    const stateLabel = ({
      drifting: "Drifting.",
      compliant: "Compliant.",
      no_signal: "No signal.",
    } as const)[v.state];

    lines.push(`- **${v.principle_id}** — ${stateLabel}`);
    lines.push(`    - Principle: *${v.principle_text}*`);
    lines.push(
      `    - Triggers fired: ${v.triggers_fired}. Triggers satisfied: ${v.triggers_satisfied}.`
    );

    if (v.state === "drifting" && sig.because.length > 0) {
      lines.push(`    - Violating events:`);
      for (const ref of sig.because.slice(0, 5)) {
        const snip = ref.snippet ? ` — ${truncate(ref.snippet, 80)}` : "";
        lines.push(`        - \`${entityLabel(ref)}\` (${ref.kind})${tagSuffix(ref)}${snip}`);
      }
    } else if (v.state === "compliant" && sig.because.length > 0) {
      lines.push(`    - Sample compliant events:`);
      for (const ref of sig.because.slice(0, 3)) {
        const snip = ref.snippet ? ` — ${truncate(ref.snippet, 80)}` : "";
        lines.push(`        - \`${entityLabel(ref)}\` (${ref.kind})${tagSuffix(ref)}${snip}`);
      }
    }
  }
  lines.push(``);
  return lines;
}

function renderHeader(
  window_hours: number,
  total_events: number,
  source_counts: Record<"cowork" | "figma" | "slack", number>,
  containers_seen: number,
  unresolved: number,
  ambiguous: number
): string[] {
  const lines: string[] = [];
  lines.push(`# Anchor digest`);
  lines.push(``);
  if (total_events === 0) {
    lines.push(`Last ${formatWindow(window_hours)}. No events landed. Quiet window.`);
    lines.push(``);
    return lines;
  }
  // Per-source breakdown — honest about where the activity came from.
  const sourceParts: string[] = [];
  if (source_counts.cowork > 0) sourceParts.push(`${source_counts.cowork} cowork`);
  if (source_counts.figma > 0) sourceParts.push(`${source_counts.figma} figma`);
  if (source_counts.slack > 0) sourceParts.push(`${source_counts.slack} slack`);

  lines.push(
    `Last ${formatWindow(window_hours)}. ${total_events} ${pluralize(
      total_events,
      "event"
    )} landed${sourceParts.length > 0 ? ` (${sourceParts.join(", ")})` : ""}.`
  );

  // Container resolution honesty. If everything resolved cleanly, don't say
  // anything; if there's drift, surface it.
  const resolutionParts: string[] = [];
  if (containers_seen > 0) {
    resolutionParts.push(
      `${containers_seen} ${pluralize(containers_seen, "container")} seen`
    );
  }
  if (unresolved > 0) resolutionParts.push(`${unresolved} unresolved`);
  if (ambiguous > 0) resolutionParts.push(`${ambiguous} ambiguous`);
  if (resolutionParts.length > 0) {
    lines.push(`Resolution: ${resolutionParts.join(", ")}.`);
  }
  lines.push(``);
  return lines;
}

function renderClose(signals: Signal[]): string {
  // Pick the strongest signal to close with.
  const drift = signals.find(
    (s) => s.kind === "drift" && (s.value as DriftValue).state === "drifting"
  );
  if (drift) {
    const v = drift.value as DriftValue;
    return `Worth asking: the *${v.principle_id}* principle is drifting. Take a look at the violating events.`;
  }

  const eroding = signals.find(
    (s) => s.kind === "health_trend" && (s.value as HealthTrendValue).trend === "eroding"
  );
  if (eroding) {
    return `Worth checking: ${eroding.container_name}'s health trend is eroding. The top-movement entries are where to start.`;
  }

  const surge = signals.find(
    (s) => s.kind === "capacity" && (s.value as CapacityValue).state === "surge"
  );
  if (surge) {
    const v = surge.value as CapacityValue;
    return `Worth checking on ${v.person_label} — capacity reading as a surge against baseline.`;
  }

  return `Steady window. Nothing that needs attention right now.`;
}

// ─── Vocabulary check ───────────────────────────────────────────────────────

function checkVocabulary(text: string, profile: VoiceProfile): string[] {
  const avoid = profile?.register?.vocabulary_avoid || [];
  const lower = text.toLowerCase();
  const violations: string[] = [];
  for (const entry of avoid) {
    if (typeof entry !== "string") continue;
    const w = entry.trim().toLowerCase();
    if (!w) continue;
    if (lower.includes(w)) violations.push(entry);
  }
  return violations;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hoursBetween(startIso: string, endIso: string): number {
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3600 / 1000;
}

function truncate(s: string, n: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n - 1) + "…" : flat;
}

function loadNormalizationTransforms(
  profile: string,
  configPath: string
): NormalizationTransformName[] | undefined {
  if (profile === "none") return undefined;
  if (!fs.existsSync(configPath)) return undefined;
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
      profiles?: Record<string, { transforms?: NormalizationTransformName[] }>;
    };
    const entry = raw.profiles?.[profile];
    if (!entry?.transforms || entry.transforms.length === 0) return undefined;
    return entry.transforms;
  } catch {
    return undefined;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

const profile = loadVoiceProfile(VOICE_PROFILE);
const principles = fs.existsSync(PRINCIPLES_FILE) ? loadPrinciples(PRINCIPLES_FILE) : [];

const nowIso = new Date().toISOString();
const windows = makeWindows(WINDOW_HOURS, nowIso);
const normalizationTransforms = loadNormalizationTransforms(
  NORMALIZATION_PROFILE,
  NORMALIZATION_CONFIG
);

// ─── Layer 1+2 — ingest from configured sources ────────────────────────────

const ingest = await ingestEvents({
  cowork_events_file: EVENTS_FILE || undefined,
  figma_worker_url: FIGMA_WORKER_URL || undefined,
  slack_worker_url: SLACK_WORKER_URL || undefined,
  slack_since_iso: windows.current_start,
  mode: INGEST_MODE,
  normalization_profile: NORMALIZATION_PROFILE,
  normalization_transforms: normalizationTransforms,
  cowork_parser_mode: COWORK_PARSER_MODE,
  max_cowork_lines: INGEST_MAX_EVENTS,
});

process.stderr.write(
  `anchor-digest: ingest manifest — run=${ingest.manifest.run_id} mode=${ingest.manifest.mode} contract=${ingest.manifest.contract_version} ` +
    `received=${ingest.manifest.totals.received} accepted=${ingest.manifest.totals.accepted} dropped=${ingest.manifest.totals.dropped} ` +
    `normalization=${ingest.manifest.normalization.profile} parser=${ingest.manifest.limits.parser_mode} ` +
    `cowork_lines=${ingest.manifest.limits.cowork_received_lines} cap_hit=${ingest.manifest.limits.cap_hit}\n`
);

if (ingest.manifest.mode === "strict") {
  const hasViolations = Object.values(ingest.manifest.violations_by_code).some((n) => n > 0);
  const maskedConfiguredLane = (Object.keys(ingest.manifest.lanes) as Array<"cowork" | "figma" | "slack">).some(
    (lane) => {
      const stats = ingest.manifest.lanes[lane];
      return stats.configured && stats.received > 0 && stats.accepted === 0;
    }
  );
  if (hasViolations || maskedConfiguredLane) {
    process.stderr.write(
      `anchor-digest: strict ingest failure — violations=${JSON.stringify(ingest.manifest.violations_by_code)}\n`
    );
    process.exit(1);
  }
}

for (const w of ingest.warnings) {
  process.stderr.write(`anchor-digest: ingest warning — ${w}\n`);
}

const anyConfigured = !!(EVENTS_FILE || FIGMA_WORKER_URL || SLACK_WORKER_URL);
if (!anyConfigured) {
  process.stderr.write(
    `anchor-digest: no source configured. Set at least one of ANCHOR_EVENTS_FILE, ANCHOR_FIGMA_WORKER_URL, ANCHOR_SLACK_WORKER_URL.\n`
  );
  process.exit(1);
}

// ─── Layer 3 — resolve every event to a container ─────────────────────────

const containerSource = getContainerSource();
const resolution = await resolveEvents(ingest.events, containerSource);

process.stderr.write(
  `anchor-digest: containers from ${containerSource.describe()} — ${resolution.all_containers.length} declared, ${resolution.containers_seen.length} touched\n`
);

// Build the windowed-containers list Layer 4 expects. Only containers that
// had at least one resolved event participate in signal computation.
const containers = resolution.containers_seen.map((c) => ({
  container_id: c.id,
  container_name: c.name,
  ...windows,
}));

const translation = computeSignalsWithDiagnostics({
  events: resolution.events,
  containers,
  principles,
  nowIso,
  mode: TRANSLATION_MODE,
  policyFilePath: TRANSLATION_POLICY_FILE || undefined,
});
const signals = translation.signals;

process.stderr.write(
  `anchor-digest: translation diagnostics — run=${translation.diagnostics.run_id} mode=${translation.diagnostics.mode} ` +
    `signals=${translation.diagnostics.totals.signals} no_signal=${translation.diagnostics.totals.no_signal} ` +
    `with_because=${translation.diagnostics.totals.with_because} ` +
    `violations_in=${translation.diagnostics.violations.input.length} violations_out=${translation.diagnostics.violations.output.length}\n`
);

const currentWindowEvents = resolution.events.filter(
  (e) =>
    e.timestamp >= windows.current_start &&
    e.timestamp < windows.current_end &&
    e.container_id !== "__unresolved__" &&
    e.container_id !== "__ambiguous__"
);

// ─── Layer 5 — load state, compute diffs ───────────────────────────────────

const stateSource = new LocalJsonStateSource({ dir: STATE_DIR });
const priorState = await stateSource.load(LEADER_ID);
const diffs = computeDiffs(signals, priorState);

const lines: string[] = [];
lines.push(
  ...renderHeader(
    WINDOW_HOURS,
    currentWindowEvents.length,
    ingest.counts,
    resolution.containers_seen.length,
    resolution.counts.unresolved,
    resolution.counts.ambiguous
  )
);
lines.push(...renderAnchoredOpening(diffs));
lines.push(...renderCapacitySection(signals));
lines.push(...renderHealthTrendSection(signals));
lines.push(...renderDriftSection(signals));
lines.push(...renderNoChangeRoundup(diffs));
if (currentWindowEvents.length > 0) {
  lines.push(renderClose(signals));
}

const digest = lines.join("\n") + "\n";

// ANCHOR_DISABLE_VOCAB_CHECK=1 bypasses the banned-vocabulary refusal.
// Useful when iterating on synthetic content or debugging signals — the
// guardrail still exists by default, just opt-out for the moment.
const DISABLE_VOCAB = process.env.ANCHOR_DISABLE_VOCAB_CHECK === "1";

if (!DISABLE_VOCAB) {
  const violations = checkVocabulary(digest, profile);
  if (violations.length > 0) {
    process.stderr.write(
      `anchor-digest: render_failed — banned vocabulary present: ${violations.join(", ")}\n` +
        `(refusing to publish; refine the renderer's templates or update the profile)\n` +
        `(or set ANCHOR_DISABLE_VOCAB_CHECK=1 to bypass)\n`
    );
    process.exit(2);
  }
} else {
  process.stderr.write(`anchor-digest: vocab check disabled (ANCHOR_DISABLE_VOCAB_CHECK=1)\n`);
}

// ─── Commit state — only after a successful render ─────────────────────────

if (!DRY_RUN) {
  const nextState = commitSnapshot(priorState, signals);
  await stateSource.save(nextState);
  process.stderr.write(`anchor-digest: state committed for leader "${LEADER_ID}"\n`);
} else {
  process.stderr.write(`anchor-digest: dry run — state NOT committed\n`);
}

process.stdout.write(digest);
