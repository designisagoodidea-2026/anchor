import type { ChangeEvent } from "../../shared/change-event";
import type { Principle, Signal } from "./types";
import type { ContainerWindow, TranslationMode } from "./translator";

export type ContractViolationCode =
  | "container_missing_id"
  | "container_missing_name"
  | "window_invalid"
  | "principle_missing_id"
  | "principle_duplicate_id"
  | "event_missing_actor"
  | "event_invalid_timestamp"
  | "signal_missing_because"
  | "signal_missing_window";

export interface ContractViolation {
  code: ContractViolationCode;
  severity: "critical" | "warning";
  detail: string;
}

export interface ContractResult {
  ok: boolean;
  violations: ContractViolation[];
}

export function validateTranslatorInputs(opts: {
  events: ChangeEvent[];
  containers: ContainerWindow[];
  principles: Principle[];
  mode: TranslationMode;
}): ContractResult {
  const violations: ContractViolation[] = [];

  for (const c of opts.containers) {
    if (!c.container_id) {
      violations.push({
        code: "container_missing_id",
        severity: "critical",
        detail: "container_id is required",
      });
    }
    if (!c.container_name) {
      violations.push({
        code: "container_missing_name",
        severity: "warning",
        detail: `container ${c.container_id || "<unknown>"} has empty name`,
      });
    }

    const currentOk = isValidWindow(c.current_start, c.current_end);
    const priorOk = isValidWindow(c.prior_start, c.prior_end);
    if (!currentOk || !priorOk) {
      violations.push({
        code: "window_invalid",
        severity: "critical",
        detail: `container ${c.container_id || "<unknown>"} has invalid window boundaries`,
      });
    }
  }

  const seenPrinciples = new Set<string>();
  for (const p of opts.principles) {
    if (!p.id || p.id.trim().length === 0) {
      violations.push({
        code: "principle_missing_id",
        severity: "critical",
        detail: "principle id is required",
      });
      continue;
    }
    if (seenPrinciples.has(p.id)) {
      violations.push({
        code: "principle_duplicate_id",
        severity: "critical",
        detail: `duplicate principle id: ${p.id}`,
      });
    }
    seenPrinciples.add(p.id);
  }

  for (const e of opts.events) {
    if (!e.actor || !e.actor.id) {
      violations.push({
        code: "event_missing_actor",
        severity: "critical",
        detail: `event ${e.entity_id} missing actor`,
      });
    }
    if (!Number.isFinite(new Date(e.timestamp).getTime())) {
      violations.push({
        code: "event_invalid_timestamp",
        severity: "critical",
        detail: `event ${e.entity_id} has invalid timestamp '${e.timestamp}'`,
      });
    }
  }

  const hasCritical = violations.some((v) => v.severity === "critical");
  return { ok: !hasCritical, violations };
}

export function validateSignalsContract(signals: Signal[]): ContractResult {
  const violations: ContractViolation[] = [];

  for (const s of signals) {
    if (!s.window?.start || !s.window?.end) {
      violations.push({
        code: "signal_missing_window",
        severity: "critical",
        detail: `signal ${s.kind} missing window`,
      });
    }

    const state =
      (s.value as { state?: string }).state ??
      (s.value as { trend?: string }).trend ??
      "unknown";
    if (state !== "no_signal" && s.because.length === 0) {
      violations.push({
        code: "signal_missing_because",
        severity: "critical",
        detail: `signal ${s.kind} in state '${state}' must include because evidence`,
      });
    }
  }

  const hasCritical = violations.some((v) => v.severity === "critical");
  return { ok: !hasCritical, violations };
}

function isValidWindow(start: string, end: string): boolean {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Number.isFinite(s) && Number.isFinite(e) && s < e;
}
