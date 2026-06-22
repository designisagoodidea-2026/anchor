import type { ContractViolation } from "./contracts";
import type { Signal } from "./types";

export interface TranslationDiagnostics {
  run_id: string;
  mode: "strict" | "permissive";
  totals: {
    signals: number;
    by_kind: Record<"capacity" | "health_trend" | "drift", number>;
    no_signal: number;
    with_because: number;
  };
  violations: {
    input: ContractViolation[];
    output: ContractViolation[];
  };
}

export function buildDiagnostics(opts: {
  runId: string;
  mode: "strict" | "permissive";
  signals: Signal[];
  inputViolations: ContractViolation[];
  outputViolations: ContractViolation[];
}): TranslationDiagnostics {
  const byKind: TranslationDiagnostics["totals"]["by_kind"] = {
    capacity: 0,
    health_trend: 0,
    drift: 0,
  };
  let noSignal = 0;
  let withBecause = 0;

  for (const s of opts.signals) {
    byKind[s.kind] += 1;
    const state =
      (s.value as { state?: string }).state ??
      (s.value as { trend?: string }).trend ??
      "unknown";
    if (state === "no_signal") noSignal += 1;
    if (s.because.length > 0) withBecause += 1;
  }

  return {
    run_id: opts.runId,
    mode: opts.mode,
    totals: {
      signals: opts.signals.length,
      by_kind: byKind,
      no_signal: noSignal,
      with_because: withBecause,
    },
    violations: {
      input: opts.inputViolations,
      output: opts.outputViolations,
    },
  };
}
