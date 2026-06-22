// Anchor Slack connector — Worker entry.
//
// Architecture: Slack pushes Events API webhooks to /events. We verify the
// signature, classify the event into a change_event, dedup by event_id, and
// store the event under a sortable key in KV. The renderer pulls events back
// via GET /events?since=<iso>.
//
// Endpoints:
//   GET  /healthz                liveness; reports KV binding + signing-secret presence
//   POST /events                 Slack Events API webhook
//   GET  /events?since=<iso>     retrieve stored events for the renderer
//   GET  /events?limit=N         retrieve most recent N events (debug)
//   POST /events/reset           wipe stored events (debug — guarded by header)
//   GET  /discover               enumerate public channels and join each one
//                                the bot isn't already in (Stage 1.5)
//
// The /events POST is signature-verified. The GET endpoints are unauthenticated
// at v0.1 — fine for the POC since the URL is unpredictable and the data is
// already public to anyone with the workspace. Lock down at Stage 2.

import type { ChangeEvent } from "../../../shared/change-event";
import { verifySlackRequest } from "./verify";
import { classifyEnvelope } from "./classify";
import type { SlackEventEnvelope, SlackChannelCreatedEvent } from "./slack-api";
import { isFromExpectedWorkspace } from "./slack-api";
import { discoverAndJoin, joinChannel } from "./discover.js";

export interface Env {
  SLACK_SIGNING_SECRET: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_WORKSPACE_ID?: string;
  SLACK_ADMIN_TOKEN?: string;
  ALLOW_UNPROTECTED_ADMIN?: string;
  ADMIN_RATE_LIMITER?: DurableObjectNamespace;
  SLACK_STATE?: KVNamespace;
  SOURCE: string;
}

const EVENT_KV_PREFIX = "event:";
const SEEN_KV_PREFIX = "seen:";
const SEEN_TTL_SECONDS = 60 * 60 * 24; // 24h — Slack retries within minutes; this is generous.
const RESET_HEADER = "X-Anchor-Reset-Token";
const ADMIN_RATE_LIMIT_PER_MIN = 30;

// ─── Worker entry ───────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/healthz" && request.method === "GET") {
        return json({
          status: "ok",
          source: env.SOURCE,
          version: "0.2",
          kv_bound: Boolean(env.SLACK_STATE),
          signing_secret_present: Boolean(env.SLACK_SIGNING_SECRET),
          bot_token_present: Boolean(env.SLACK_BOT_TOKEN),
          workspace_pinned: Boolean(env.SLACK_WORKSPACE_ID),
        });
      }

      if (url.pathname === "/discover" && request.method === "GET") {
        const authError = await enforceAdminGuard(request, env, "discover");
        if (authError) return authError;
        if (!env.SLACK_BOT_TOKEN) return err(503, "SLACK_BOT_TOKEN not set");
        const run = await discoverAndJoin(env.SLACK_BOT_TOKEN);
        audit(request, "discover", "ok", {
          channels_seen: run.channels_seen,
          joined_new: run.joined_new,
          already_in: run.already_in,
          errors: run.errors,
        });
        return json(run);
      }

      if (url.pathname === "/events" && request.method === "POST") {
        return await handleEventsPost(request, env);
      }

      if (url.pathname === "/events" && request.method === "GET") {
        return await handleEventsGet(url, env);
      }

      if (url.pathname === "/events/reset" && request.method === "POST") {
        return await handleReset(request, env);
      }

      return new Response(
        "Anchor Slack connector v0.1\n" +
          "Endpoints: GET /healthz · POST /events (signed) · GET /events?since=<iso>&limit=N\n",
        { headers: { "content-type": "text/plain" } }
      );
    } catch (e) {
      return err(500, e instanceof Error ? e.message : String(e));
    }
  },
};

// ─── POST /events ──────────────────────────────────────────────────────────

async function handleEventsPost(request: Request, env: Env): Promise<Response> {
  const rawBody = await request.text();

  const verifyResult = await verifySlackRequest({
    signingSecret: env.SLACK_SIGNING_SECRET,
    rawBody,
    timestamp: request.headers.get("X-Slack-Request-Timestamp"),
    signature: request.headers.get("X-Slack-Signature"),
  });

  if (!verifyResult.ok) {
    return err(401, `signature verification failed: ${verifyResult.reason}`);
  }

  let envelope: SlackEventEnvelope;
  try {
    envelope = JSON.parse(rawBody) as SlackEventEnvelope;
  } catch {
    return err(400, "invalid json body");
  }

  // URL verification handshake — Slack sends this once during app setup.
  if (envelope.type === "url_verification") {
    return new Response(envelope.challenge ?? "", {
      headers: { "content-type": "text/plain" },
    });
  }

  // Workspace pinning — drop events from the wrong workspace if pinned.
  if (!isFromExpectedWorkspace(envelope, env.SLACK_WORKSPACE_ID)) {
    return new Response("ignored: wrong workspace", { status: 200 });
  }

  // Dedup by event_id — Slack retries deliveries on 5xx/timeouts. Always
  // return 200 once we've seen an id so Slack stops retrying.
  if (envelope.event_id && env.SLACK_STATE) {
    const seenKey = SEEN_KV_PREFIX + envelope.event_id;
    const already = await env.SLACK_STATE.get(seenKey);
    if (already) {
      return json({ deduped: true, event_id: envelope.event_id });
    }
    await env.SLACK_STATE.put(seenKey, "1", { expirationTtl: SEEN_TTL_SECONDS });
  }

  // Auto-join on channel_created — Stage 1.5 discovery.
  // Best-effort: failures don't poison the webhook response. Slack expects
  // a 200 within a few seconds; the join is fire-and-forget if it errors.
  let auto_join_result: { ok: boolean; error?: string } | undefined;
  if (envelope.event && (envelope.event as { type?: string }).type === "channel_created" && env.SLACK_BOT_TOKEN) {
    const created = envelope.event as SlackChannelCreatedEvent;
    try {
      const res = await joinChannel(created.channel.id, env.SLACK_BOT_TOKEN);
      auto_join_result = { ok: Boolean(res.ok), error: res.error };
    } catch (e) {
      auto_join_result = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  const change = classifyEnvelope(envelope);
  if (!change) {
    return json({ stored: false, reason: "classifier returned null (filtered)", auto_join_result });
  }

  if (env.SLACK_STATE) {
    const key = `${EVENT_KV_PREFIX}${change.timestamp}:${envelope.event_id ?? change.entity_id}`;
    await env.SLACK_STATE.put(key, JSON.stringify(change));
  }

  return json({ stored: true, event: change, auto_join_result });
}

// ─── GET /events ───────────────────────────────────────────────────────────

async function handleEventsGet(url: URL, env: Env): Promise<Response> {
  if (!env.SLACK_STATE) return err(503, "SLACK_STATE KV not bound");

  const since = url.searchParams.get("since");
  const limitParam = url.searchParams.get("limit");
  const limit = clampLimit(limitParam);

  // KV list is lexicographic; our keys sort by ISO timestamp.
  const list = await env.SLACK_STATE.list({ prefix: EVENT_KV_PREFIX, limit: 1000 });
  const filteredKeys = list.keys
    .map((k) => k.name)
    .filter((name) => {
      if (!since) return true;
      const ts = name.slice(EVENT_KV_PREFIX.length).split(":")[0];
      return ts >= since;
    })
    .slice(-limit);

  const events: ChangeEvent[] = [];
  for (const key of filteredKeys) {
    const raw = await env.SLACK_STATE.get(key);
    if (!raw) continue;
    try {
      events.push(JSON.parse(raw) as ChangeEvent);
    } catch {
      // Skip malformed entries; do not fail the whole read.
    }
  }

  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return json({
    count: events.length,
    since: since ?? null,
    events,
    metadata: {
      source: "slack",
      source_version: "0.2",
      workspace_pinned: Boolean(env.SLACK_WORKSPACE_ID),
      retrieved_at: new Date().toISOString(),
      limit,
    },
  });
}

// ─── POST /events/reset ────────────────────────────────────────────────────

async function handleReset(request: Request, env: Env): Promise<Response> {
  const authError = await enforceAdminGuard(request, env, "reset events");
  if (authError) return authError;
  if (!env.SLACK_STATE) return err(503, "SLACK_STATE KV not bound");

  let cursor: string | undefined;
  let deleted = 0;
  do {
    const list = await env.SLACK_STATE.list({ prefix: EVENT_KV_PREFIX, cursor });
    for (const k of list.keys) {
      await env.SLACK_STATE.delete(k.name);
      deleted++;
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  audit(request, "reset_events", "ok", { deleted });
  return json({ reset: true, deleted });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function enforceAdminGuard(request: Request, env: Env, action: string): Promise<Response | null> {
  const authError = requireAdmin(request, env, action);
  if (authError) {
    audit(request, action, "unauthorized");
    return authError;
  }

  const rateError = await enforceRateLimit(request, env, action);
  if (rateError) {
    audit(request, action, "rate_limited");
    return rateError;
  }

  return null;
}

function requireAdmin(request: Request, env: Env, action: string): Response | null {
  // Fail closed by default: non-local runs must provide a dedicated admin token.
  // For local/dev-only scenarios, ALLOW_UNPROTECTED_ADMIN=1 can opt out.
  if (!env.SLACK_ADMIN_TOKEN) {
    if (env.ALLOW_UNPROTECTED_ADMIN === "1") return null;
    return err(503, `${action} blocked: set SLACK_ADMIN_TOKEN (or ALLOW_UNPROTECTED_ADMIN=1 for local dev)`);
  }
  const tokenPresent = request.headers.get(RESET_HEADER);
  if (!tokenPresent || tokenPresent !== env.SLACK_ADMIN_TOKEN) {
    return err(401, `${action} requires ${RESET_HEADER} header matching SLACK_ADMIN_TOKEN`);
  }
  return null;
}

async function enforceRateLimit(request: Request, env: Env, action: string): Promise<Response | null> {
  if (!env.ADMIN_RATE_LIMITER) {
    return err(503, `rate limiter not configured for ${action}; bind ADMIN_RATE_LIMITER Durable Object`);
  }

  const id = env.ADMIN_RATE_LIMITER.idFromName(`${action}:${clientIp(request)}`);
  const stub = env.ADMIN_RATE_LIMITER.get(id);
  const res = await stub.fetch("https://admin-rate-limiter/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ limit: ADMIN_RATE_LIMIT_PER_MIN, windowSec: 60 }),
  });

  if (!res.ok) {
    return err(503, `rate limiter unavailable for ${action}`);
  }

  const body = (await res.json()) as { allowed: boolean; resetInSec: number };
  if (!body.allowed) {
    return err(429, `rate limit exceeded for ${action}; retry in ${body.resetInSec}s`);
  }
  return null;
}

function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

function audit(
  request: Request,
  action: string,
  outcome: "ok" | "unauthorized" | "rate_limited",
  extra: Record<string, unknown> = {}
): void {
  const url = new URL(request.url);
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      source: "slack",
      action,
      outcome,
      method: request.method,
      path: url.pathname,
      ip: clientIp(request),
      ...extra,
    })
  );
}

export class AdminRateLimiter implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly _env: Env
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }

    const payload = (await request.json()) as { limit?: number; windowSec?: number };
    const limit = Number(payload.limit) || 30;
    const windowSec = Number(payload.windowSec) || 60;

    const nowSec = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(nowSec / windowSec);
    const key = `bucket:${bucket}`;
    const previousKey = `bucket:${bucket - 2}`;

    const count = ((await this.state.storage.get<number>(key)) ?? 0) + 1;
    await this.state.storage.put(key, count);
    await this.state.storage.delete(previousKey);

    const resetInSec = windowSec - (nowSec % windowSec);
    const allowed = count <= limit;
    return new Response(JSON.stringify({ allowed, resetInSec }), {
      headers: { "content-type": "application/json" },
    });
  }
}

function clampLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(n, 1000);
}

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

function err(status: number, message: string): Response {
  return json({ error: message }, { status });
}
