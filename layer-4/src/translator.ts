// Anchor Layer 4 — translator (orchestrator).
//
// Runs every Layer 4 signal against the given event stream. The renderer
// (when it picks this up) doesn't need to know about individual signal
// functions — just call computeSignals() and consume the Signal[] that
// comes back.

import type { ChangeEvent } from "../../shared/change-event";
import type { Signal, Principle } from "./types";
import { computeCapacity } from "./capacity.js";
import { computeHealthTrend } from "./health-trend.js";
import { computeDrift } from "./drift.js";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDiagnostics, type TranslationDiagnostics } from "./diagnostics.js";
import { validateSignalsContract, validateTranslatorInputs } from "./contracts.js";
import { loadTranslationPolicy, shouldBlockInStrictMode } from "./policy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_POLICY_PATH = path.resolve(__dirname, "../policy/layer4-policy.json");

export interface ContainerWindow {
  container_id: string;
  container_name: string;
  /** Most recent window — what's "now-ish" for the leader. */
  current_start: string;
  current_end: string;
  /** Immediately preceding window — what we're comparing against. */
  prior_start: string;
  prior_end: string;
}

export interface TranslatorOptions {
  events: ChangeEvent[];
  containers: ContainerWindow[];
  principles: Principle[];
  /** Override now() in tests. */
  nowIso?: string;
  /** Translation boundary behavior. Default: permissive. */
  mode?: TranslationMode;
  /** Optional policy file path override. */
  policyFilePath?: string;
}

export type TranslationMode = "strict" | "permissive";

export interface TranslationResult {
  signals: Signal[];
  diagnostics: TranslationDiagnostics;
}

export function computeSignals(opts: TranslatorOptions): Signal[] {
  return computeSignalsWithDiagnostics(opts).signals;
}

export function computeSignalsWithDiagnostics(opts: TranslatorOptions): TranslationResult {
  const mode: TranslationMode = opts.mode ?? "permissive";
  const policy = loadTranslationPolicy(opts.policyFilePath ?? DEFAULT_POLICY_PATH);
  const inputContract = validateTranslatorInputs({
    events: opts.events,
    containers: opts.containers,
    principles: opts.principles,
    mode,
  });

  if (mode === "strict" && shouldBlockInStrictMode(inputContract.violations, policy)) {
    throw new Error(
      `translation strict failure (input contract): ${inputContract.violations
        .map((v) => `${v.code}:${v.detail}`)
        .join("; ")}`
    );
  }

  const out: Signal[] = [];

  for (const container of opts.containers) {
    const containerScoped = opts.events.filter(
      (e) =>
        e.container_id === undefined ||
        e.container_id === null ||
        e.container_id === container.container_id
    );

    // Capacity — current window only.
    out.push(
      ...computeCapacity(containerScoped, {
        container_id: container.container_id,
        container_name: container.container_name,
        window_start: container.current_start,
        window_end: container.current_end,
        nowIso: opts.nowIso,
      })
    );

    // Health-trend — current vs. prior window.
    out.push(
      computeHealthTrend(containerScoped, {
        container_id: container.container_id,
        container_name: container.container_name,
        current_start: container.current_start,
        current_end: container.current_end,
        prior_start: container.prior_start,
        prior_end: container.prior_end,
        nowIso: opts.nowIso,
      })
    );

    // Drift — current window only.
    out.push(
      ...computeDrift(containerScoped, opts.principles, {
        container_id: container.container_id,
        container_name: container.container_name,
        window_start: container.current_start,
        window_end: container.current_end,
        nowIso: opts.nowIso,
      })
    );
  }

  const outputContract = validateSignalsContract(out);
  if (mode === "strict" && shouldBlockInStrictMode(outputContract.violations, policy)) {
    throw new Error(
      `translation strict failure (output contract): ${outputContract.violations
        .map((v) => `${v.code}:${v.detail}`)
        .join("; ")}`
    );
  }

  const diagnostics = buildDiagnostics({
    runId: randomUUID(),
    mode,
    signals: out,
    inputViolations: inputContract.violations,
    outputViolations: outputContract.violations,
  });

  return { signals: out, diagnostics };
}
