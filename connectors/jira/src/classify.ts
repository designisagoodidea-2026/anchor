import type { ChangeEvent } from "../../../shared/change-event";

export type JiraEventType =
  | "issue-created"
  | "issue-updated"
  | "issue-transitioned"
  | "comment-created"
  | "comment-updated";

export interface JiraInput {
  eventType: JiraEventType;
  issueKey: string;
  issueId: string;
  summary: string;
  body?: string;
  actorId: string;
  actorName: string;
  timestamp: string;
  transitionTo?: string;
}

export function toChangeEvent(input: JiraInput): ChangeEvent {
  const text = [input.summary, input.body || ""].join(" ");
  const hasDecision = /\[decision\]/i.test(text);

  return {
    actor: {
      id: input.actorId,
      display_name: input.actorName,
      source_user_id: input.actorId,
      role_hint: null,
    },
    timestamp: input.timestamp,
    source: "jira",
    entity_id: input.issueId,
    entity_type: input.eventType.startsWith("comment") ? "comment" : "issue",
    parent_id: input.issueKey,
    action: inferAction(input.eventType),
    kind: inferKind(input.eventType, input.summary, input.transitionTo),
    tags: hasDecision ? ["decision"] : [],
    snippet: buildSnippet(input),
    raw_ref: `jira:issue:${input.issueKey}`,
    container_id: null,
  };
}

function inferAction(eventType: JiraEventType): string {
  switch (eventType) {
    case "issue-created":
      return "create";
    case "issue-updated":
      return "edit";
    case "issue-transitioned":
      return "transition";
    case "comment-created":
      return "comment";
    case "comment-updated":
      return "edit";
    default:
      return "edit";
  }
}

function inferKind(eventType: JiraEventType, summary: string, transitionTo?: string): ChangeEvent["kind"] {
  const s = summary.toLowerCase();
  if (eventType === "issue-transitioned" && transitionTo) {
    if (["done", "blocked", "in review"].includes(transitionTo.toLowerCase())) return "structural";
    return "moderate";
  }
  if (s.includes("epic") || s.includes("component") || s.includes("schema")) return "structural";
  if (eventType === "issue-updated" || eventType === "comment-created" || eventType === "comment-updated") {
    return "moderate";
  }
  if (eventType === "issue-created") return "moderate";
  return "unknown";
}

function buildSnippet(input: JiraInput): string {
  const prefix = input.eventType.replace(/-/g, " ");
  const detail = input.summary.slice(0, 120);
  return `${prefix}: ${input.issueKey} - ${detail}`;
}
