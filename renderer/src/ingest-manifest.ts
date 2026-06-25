export type IngestMode = "permissive" | "strict";

export type IngestViolationCode =
  | "missing_required_field"
  | "invalid_type"
  | "invalid_timestamp"
  | "unknown_source"
  | "malformed_payload"
  | "transform_error";

export type NormalizationTransformName =
  | "timestamp_iso"
  | "collapse_snippet_whitespace"
  | "trim_actor_display_name"
  | "normalize_tags"
  | "trim_ids";

export interface NormalizationTransformStats {
  attempted: number;
  applied: number;
  noop: number;
  errored: number;
}

export interface NormalizationManifest {
  enabled: boolean;
  profile: string;
  scope: "slack_only";
  transforms_in_order: NormalizationTransformName[];
  by_transform: Record<NormalizationTransformName, NormalizationTransformStats>;
}

export interface IngestLaneStats {
  configured: boolean;
  received: number;
  accepted: number;
  dropped: number;
}

export interface SourceProfileSummary {
  events: number;
  null_parent_id: number;
  non_empty_tag_events: number;
  unknown_kind_events: number;
  kind_counts: Record<string, number>;
  tag_counts: Record<string, number>;
  unique_actor_ids: number;
}

export interface IngestManifest {
  run_id: string;
  contract_version: string;
  mode: IngestMode;
  totals: {
    received: number;
    accepted: number;
    dropped: number;
  };
  lanes: Record<"cowork" | "figma" | "slack", IngestLaneStats>;
  accepted_by_source: Record<"cowork" | "figma" | "slack", number>;
  violations_by_code: Record<IngestViolationCode, number>;
  normalization: NormalizationManifest;
  limits: {
    parser_mode: "full" | "stream";
    max_cowork_lines: number | null;
    cowork_received_lines: number;
    cap_hit: boolean;
    degraded: boolean;
    stop_reason: "cowork_max_lines_reached" | null;
  };
  profiling: {
    by_source: Record<"cowork" | "figma" | "slack" | "jira", SourceProfileSummary>;
  };
}

export const INGEST_CONTRACT_VERSION = "1.1.0";

export function emptyNormalizationStats(): Record<NormalizationTransformName, NormalizationTransformStats> {
  return {
    timestamp_iso: { attempted: 0, applied: 0, noop: 0, errored: 0 },
    collapse_snippet_whitespace: { attempted: 0, applied: 0, noop: 0, errored: 0 },
    trim_actor_display_name: { attempted: 0, applied: 0, noop: 0, errored: 0 },
    normalize_tags: { attempted: 0, applied: 0, noop: 0, errored: 0 },
    trim_ids: { attempted: 0, applied: 0, noop: 0, errored: 0 },
  };
}

export function emptySourceProfileSummary(): SourceProfileSummary {
  return {
    events: 0,
    null_parent_id: 0,
    non_empty_tag_events: 0,
    unknown_kind_events: 0,
    kind_counts: {},
    tag_counts: {},
    unique_actor_ids: 0,
  };
}

export function emptyViolationCounts(): Record<IngestViolationCode, number> {
  return {
    missing_required_field: 0,
    invalid_type: 0,
    invalid_timestamp: 0,
    unknown_source: 0,
    malformed_payload: 0,
    transform_error: 0,
  };
}
