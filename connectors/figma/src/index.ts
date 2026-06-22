// Anchor Figma connector — Worker entry.
//
// Stage 1.5 per ADR-01: PAT-authenticated, REST polling, no webhooks. The
// connector reads file keys from two sources, unioned:
//   1. FIGMA_FILE_KEYS — comma-separated manual list (env secret).
//   2. discovered:files KV entry — populated by /discover when the leader
//      configures team ids in FIGMA_TEAM_IDS.
//
// The leader's typical setup ask is now "paste your team url" (which
// resolves to FIGMA_TEAM_IDS); the manual file list stays for personal-
// account demos where team enumeration isn't available.
//
// Endpoints:
//   GET  /healthz                  liveness + version + configured counts
//   GET  /poll?file=<key>          poll one file; emit change_events since cursor
//   GET  /poll-all                 poll every file in the union list
//   GET  /discover                 enumerate FIGMA_TEAM_IDS → projects → files;
//                                  write discovered file keys to KV
//   GET  /discovered               read back the most recent discovery result
//   GET  /cursor?file=<key>        inspect the stored cursor (debug only)
//   POST /cursor/reset?file=<key>  wipe the cursor (debug only — forces re-emit)
//
// All event-producing endpoints return:
//   { file: <key>, events: ChangeEvent[], cursor: Cursor }
// or for /poll-all:
//   { polled: number, events: ChangeEvent[], per_file: [...] }

import type { ChangeEvent } from "../../../shared/change-event";
import { fetchFile, fetchVersions, fetchComments, FigmaApiError } from "./figma-api";
import { pollToEvents, EMPTY_CURSOR, type Cursor } from "./classify";
import { discoverTeams, type DiscoveryRun } from "./discover.js";

export interface Env {
  FIGMA_PAT: string;
  FIGMA_FILE_KEYS?: string;        // manual list (kept for personal-account demos)
  FIGMA_TEAM_IDS?: string;         // Stage 1.5 — comma-separated team ids
  FIGMA_ADMIN_TOKEN?: string;      // optional guard for debug/admin endpoints
  ALLOW_UNPROTECTED_ADMIN?: string;
  ADMIN_RATE_LIMITER?: DurableObjectNamespace;
  FIGMA_STATE?: KVNamespace;
  SOURCE: string;
}

const DISCOVERED_KEY = "discovered:files";
const DISCOVERY_LAST_KEY = "discovered:last_run";
const ADMIN_HEADER = "X-Anchor-Reset-Token";
const ADMIN_RATE_LIMIT_PER_MIN = 30;

// ─── Cursor I/O ─────────────────────────────────────────────────────────────

function cursorKey(fileKey: string): string {
  return `cursor:${fileKey}`;
}

async function loadCursor(env: Env, fileKey: string): Promise<Cursor> {
  if (!env.FIGMA_STATE) return { ...EMPTY_CURSOR };
  const raw = await env.FIGMA_STATE.get(cursorKey(fileKey));
  if (!raw) return { ...EMPTY_CURSOR };
  try {
    return JSON.parse(raw) as Cursor;
  } catch {
    return { ...EMPTY_CURSOR };
  }
}

async function saveCursor(env: Env, fileKey: string, cursor: Cursor): Promise<void> {
  if (!env.FIGMA_STATE) return;
  await env.FIGMA_STATE.put(cursorKey(fileKey), JSON.stringify(cursor));
}

// ─── Discovery KV I/O ──────────────────────────────────────────────────────

async function loadDiscoveredFileKeys(env: Env): Promise<string[]> {
  if (!env.FIGMA_STATE) return [];
  const raw = await env.FIGMA_STATE.get(DISCOVERED_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

async function saveDiscoveredFileKeys(env: Env, keys: string[]): Promise<void> {
  if (!env.FIGMA_STATE) return;
  await env.FIGMA_STATE.put(DISCOVERED_KEY, JSON.stringify(keys));
}

async function saveDiscoveryRun(env: Env, run: DiscoveryRun): Promise<void> {
  if (!env.FIGMA_STATE) return;
  await env.FIGMA_STATE.put(
    DISCOVERY_LAST_KEY,
    JSON.stringify({ run, fetched_at: new Date().toISOString() })
  );
}

async function loadDiscoveryRun(env: Env): Promise<unknown | null> {
  if (!env.FIGMA_STATE) return null;
  const raw = await env.FIGMA_STATE.get(DISCOVERY_LAST_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── File-list union ───────────────────────────────────────────────────────

function envFileKeys(env: Env): string[] {
  return splitCsv(env.FIGMA_FILE_KEYS ?? "");
}

function envTeamIds(env: Env): string[] {
  return splitCsv(env.FIGMA_TEAM_IDS ?? "");
}

function splitCsv(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

async function allFileKeys(env: Env): Promise<string[]> {
  const manual = envFileKeys(env);
  const discovered = await loadDiscoveredFileKeys(env);
  return Array.from(new Set([...manual, ...discovered]));
}

// ─── Polling ────────────────────────────────────────────────────────────────

interface PollOne {
  file: string;
  name: string;
  events: ChangeEvent[];
  cursor: Cursor;
  /** Error message if polling failed for this file. */
  error?: string;
}

async function pollFile(env: Env, fileKey: string): Promise<PollOne> {
  const [meta, versions, comments] = await Promise.all([
    fetchFile(fileKey, env.FIGMA_PAT),
    fetchVersions(fileKey, env.FIGMA_PAT),
    fetchComments(fileKey, env.FIGMA_PAT),
  ]);

  const prior = await loadCursor(env, fileKey);
  const { events, cursor } = pollToEvents(meta, fileKey, versions, comments, prior);
  await saveCursor(env, fileKey, cursor);

  return { file: fileKey, name: meta.name, events, cursor };
}

// ─── HTTP handlers ──────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/healthz") {
        const manual = envFileKeys(env);
        const discovered = await loadDiscoveredFileKeys(env);
        return json({
          status: "ok",
          source: env.SOURCE,
          version: "0.2",
          kv_bound: Boolean(env.FIGMA_STATE),
          files_manual: manual.length,
          files_discovered: discovered.length,
          files_total_unique: new Set([...manual, ...discovered]).size,
          teams_configured: envTeamIds(env).length,
        });
      }

      if (url.pathname === "/poll" && request.method === "GET") {
        const fileKey = url.searchParams.get("file");
        if (!fileKey) return err(400, "missing file= query param");
        const result = await pollFile(env, fileKey);
        return json({
          ...result,
          metadata: {
            source: "figma",
            source_version: "0.2",
            mode: "single",
            polled_at: new Date().toISOString(),
          },
        });
      }

      if (url.pathname === "/poll-all" && request.method === "GET") {
        const keys = await allFileKeys(env);
        if (keys.length === 0) {
          return err(
            400,
            "no file keys to poll; set FIGMA_FILE_KEYS or call /discover with FIGMA_TEAM_IDS populated"
          );
        }
        const per_file: PollOne[] = [];
        const events: ChangeEvent[] = [];
        for (const key of keys) {
          try {
            const result = await pollFile(env, key);
            per_file.push(result);
            events.push(...result.events);
          } catch (e) {
            per_file.push({
              file: key,
              name: "(error)",
              events: [],
              cursor: EMPTY_CURSOR,
              error: errorMessage(e),
            });
          }
        }
        events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        return json({
          polled: keys.length,
          events,
          per_file,
          metadata: {
            source: "figma",
            source_version: "0.2",
            mode: "all",
            polled_at: new Date().toISOString(),
            files_attempted: keys.length,
            files_succeeded: per_file.filter((p) => !p.error).length,
            files_failed: per_file.filter((p) => Boolean(p.error)).length,
          },
        });
      }

      if (url.pathname === "/discover" && request.method === "GET") {
        const authError = await enforceAdminGuard(request, env, "discover");
        if (authError) return authError;
        const teamIds = envTeamIds(env);
        if (teamIds.length === 0) {
          return err(400, "FIGMA_TEAM_IDS is empty; set it via wrangler secret put FIGMA_TEAM_IDS");
        }
        const run = await discoverTeams(teamIds, env.FIGMA_PAT);
        await saveDiscoveredFileKeys(env, run.unique_file_keys);
        await saveDiscoveryRun(env, run);
        const projectsSeen = run.per_team.reduce((sum, t) => sum + t.project_count, 0);
        const filesSeen = run.per_team.reduce((sum, t) => sum + t.file_count, 0);
        const errors = run.per_team.filter((t) => !t.ok).length;
        audit(request, "discover", "ok", {
          teams_attempted: run.teams_attempted,
          teams_succeeded: run.teams_succeeded,
          projects_seen: projectsSeen,
          files_seen: filesSeen,
          unique_file_keys: run.unique_file_keys.length,
          errors,
        });
        return json(run);
      }

      if (url.pathname === "/discovered" && request.method === "GET") {
        const authError = await enforceAdminGuard(request, env, "read discovered state");
        if (authError) return authError;
        const stored = await loadDiscoveryRun(env);
        const keys = await loadDiscoveredFileKeys(env);
        audit(request, "read_discovered", "ok", { discovered_file_count: keys.length });
        return json({
          discovered_file_count: keys.length,
          discovered_file_keys: keys,
          last_run: stored,
        });
      }

      if (url.pathname === "/cursor" && request.method === "GET") {
        const authError = await enforceAdminGuard(request, env, "read cursor");
        if (authError) return authError;
        const fileKey = url.searchParams.get("file");
        if (!fileKey) return err(400, "missing file= query param");
        const cursor = await loadCursor(env, fileKey);
        audit(request, "read_cursor", "ok", { file: fileKey });
        return json({ file: fileKey, cursor });
      }

      if (url.pathname === "/cursor/reset" && request.method === "POST") {
        const authError = await enforceAdminGuard(request, env, "reset cursor");
        if (authError) return authError;
        const fileKey = url.searchParams.get("file");
        if (!fileKey) return err(400, "missing file= query param");
        if (env.FIGMA_STATE) {
          await env.FIGMA_STATE.delete(cursorKey(fileKey));
        }
        audit(request, "reset_cursor", "ok", { file: fileKey });
        return json({ file: fileKey, reset: true });
      }

      return new Response(
        "Anchor Figma connector v0.2\n" +
          "Endpoints: /healthz /poll?file= /poll-all /discover /discovered /cursor?file= /cursor/reset?file=\n",
        { headers: { "content-type": "text/plain" } }
      );
    } catch (e) {
      if (e instanceof FigmaApiError) {
        return err(e.status === 404 ? 404 : 502, `figma api: ${e.message}`, { body: e.body });
      }
      return err(500, errorMessage(e));
    }
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

function err(status: number, message: string, extra: Record<string, unknown> = {}): Response {
  return json({ error: message, ...extra }, { status });
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

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
  if (!env.FIGMA_ADMIN_TOKEN) {
    if (env.ALLOW_UNPROTECTED_ADMIN === "1") return null;
    return err(503, `${action} blocked: set FIGMA_ADMIN_TOKEN (or ALLOW_UNPROTECTED_ADMIN=1 for local dev)`);
  }
  const tokenPresent = request.headers.get(ADMIN_HEADER);
  if (!tokenPresent || tokenPresent !== env.FIGMA_ADMIN_TOKEN) {
    return err(401, `${action} requires ${ADMIN_HEADER} header matching FIGMA_ADMIN_TOKEN`);
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
      source: "figma",
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
