import fs from "node:fs";

import type { ContractViolation } from "./contracts";

export interface TranslationPolicy {
  strict_block_codes: string[];
}

export function loadTranslationPolicy(filePath?: string): TranslationPolicy {
  const fallback: TranslationPolicy = {
    strict_block_codes: [
      "container_missing_id",
      "window_invalid",
      "principle_missing_id",
      "principle_duplicate_id",
      "event_missing_actor",
      "event_invalid_timestamp",
      "signal_missing_because",
      "signal_missing_window",
    ],
  };

  if (!filePath || !fs.existsSync(filePath)) return fallback;

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<TranslationPolicy>;
    const strictBlockCodes = Array.isArray(parsed.strict_block_codes)
      ? parsed.strict_block_codes.filter((x): x is string => typeof x === "string")
      : fallback.strict_block_codes;
    return { strict_block_codes: strictBlockCodes };
  } catch {
    return fallback;
  }
}

export function shouldBlockInStrictMode(
  violations: ContractViolation[],
  policy: TranslationPolicy
): boolean {
  const blockCodes = new Set(policy.strict_block_codes);
  return violations.some((v) => v.severity === "critical" || blockCodes.has(v.code));
}
