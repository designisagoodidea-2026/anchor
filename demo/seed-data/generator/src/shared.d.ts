// Type declarations for the generator's JSDoc consumers. The runtime is
// plain JS; these are JSDoc hints only.

export interface Persona {
  id: string;
  display_name: string;
  role: string;
  /** 0..1 — higher = longer messages. */
  verbosity: number;
  /** 0..1 — probability a word gets a typo. */
  typo_rate: number;
  /** Multiplier on event count for this persona. */
  base_activity_weight: number;
  touches: {
    figma_comments: number;
    figma_versions: number;
    slack_messages: number;
    slack_threads: number;
    cowork_docs: number;
    cowork_prototypes: number;
  };
  /** 0..1 — probability a given message/file is decision-tagged. */
  decision_rate: number;
}

export interface Project {
  /** Slug used in file paths, ids, and substitution. */
  slug: string;
  /** Canonical display name. */
  name: string;
  /**
   * Alternate names the project goes by in other tools / by other people.
   * Surfaces occasionally in synthetic content to mimic real teams'
   * cross-tool name drift.
   */
  aliases: string[];
  /** Lifecycle state — drives the timeline's weighting and arc. */
  state: "kickoff" | "active" | "review" | "winding_down" | "newly_appearing";
  /** Fake Figma file key used in synthetic Figma events. */
  figma_file_key: string;
  /** Fake Slack channel id used in synthetic Slack events. */
  slack_channel: string;
  /** Cowork path prefix Airtable will carry — absolute. */
  cowork_path_prefix: string;
}

export interface PlannedEvent {
  /** ISO timestamp the event should fire at. */
  fire_at: string;
  /** Persona id. */
  persona_id: string;
  /** Project slug. */
  project_slug: string;
  /** What shape of event. */
  kind:
    | "figma_comment"
    | "figma_version"
    | "slack_message"
    | "slack_thread_reply"
    | "cowork_doc"
    | "cowork_prototype"
    | "cowork_decision"
    | "cowork_crit";
  /** Whether to tag with [decision]. */
  decision: boolean;
  /** Optional parent reference (for thread replies, etc.). */
  parent?: string;
}
