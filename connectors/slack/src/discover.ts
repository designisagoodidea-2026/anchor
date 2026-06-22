// Anchor Slack connector — Stage 1.5 channel discovery and auto-join.
//
// The principle (per memory/anchor-one-auth-per-source.md): one authorization
// per source, automatic discovery of everything inside. For Slack at v0.1,
// the bot needs to be `/invite`d to every channel to receive `message.channels`
// events — that's per-resource registration. Stage 1.5 closes the gap with
// two pieces:
//
//   1. /discover endpoint enumerates all public channels (conversations.list)
//      and joins each one the bot isn't already in (conversations.join).
//   2. On a `channel_created` event, auto-join the new channel.
//
// Both are best-effort. Rate limits (Slack Tier 2 caps `conversations.join`
// at ~20 requests/min) and "already_in_channel" warnings are recorded but
// don't fail the batch. Private channels still require explicit invite —
// that's Slack's permission model, not something Anchor routes around.
//
// Required scope: channels:join (added to the bot at app-setup time).
// Existing scopes used: channels:read.

const BASE = "https://slack.com/api";

export interface SlackChannelSummary {
  id: string;
  name: string;
  is_archived: boolean;
  is_private: boolean;
  is_member: boolean;
  num_members?: number;
}

interface ConversationsListResponse {
  ok: boolean;
  channels?: SlackChannelSummary[];
  response_metadata?: { next_cursor?: string };
  error?: string;
}

interface JoinResponse {
  ok: boolean;
  channel?: { id: string; name: string };
  error?: string;
  warning?: string;
  already_in_channel?: boolean;
}

export class SlackApiError extends Error {
  constructor(public status: number, public slackError: string | undefined, msg: string) {
    super(msg);
    this.name = "SlackApiError";
  }
}

async function callGet<T>(path: string, token: string, fetchImpl: typeof fetch = fetch): Promise<T> {
  const res = await fetchImpl(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new SlackApiError(res.status, undefined, `Slack ${path} → HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as T & { ok?: boolean; error?: string };
  if (json.ok === false) {
    throw new SlackApiError(200, json.error, `Slack ${path} → ok:false (${json.error})`);
  }
  return json;
}

async function callPostForm<T>(
  path: string,
  token: string,
  form: Record<string, string>,
  fetchImpl: typeof fetch = fetch
): Promise<T & { ok?: boolean; error?: string; warning?: string }> {
  const body = new URLSearchParams(form).toString();
  const res = await fetchImpl(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new SlackApiError(res.status, undefined, `Slack ${path} → HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  return (await res.json()) as T & { ok?: boolean; error?: string; warning?: string };
}

/**
 * GET conversations.list — public channels in the workspace.
 * Pagination handled here; we walk until next_cursor is empty.
 */
export async function fetchPublicChannels(
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<SlackChannelSummary[]> {
  const out: SlackChannelSummary[] = [];
  let cursor: string | undefined;
  do {
    const qs = new URLSearchParams({
      types: "public_channel",
      exclude_archived: "true",
      limit: "200",
    });
    if (cursor) qs.set("cursor", cursor);
    const body = await callGet<ConversationsListResponse>(
      `/conversations.list?${qs.toString()}`,
      token,
      fetchImpl
    );
    if (body.channels) out.push(...body.channels);
    cursor = body.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return out;
}

/**
 * POST conversations.join — bot joins the channel.
 * "already_in_channel" returns ok:true with a warning; we capture that as
 * `already_in_channel: true` in the per-channel result. Rate limit
 * ("ratelimited") and missing-scope errors are surfaced as Slack errors.
 */
export async function joinChannel(
  channelId: string,
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<JoinResponse> {
  // We use callPostForm-the-raw-form because conversations.join returns
  // ok:false on real errors but we want to see the error string per-channel
  // rather than throw — `discoverAndJoin` decides per-channel handling.
  const res = await fetchImpl(`${BASE}/conversations.join`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ channel: channelId }).toString(),
  });
  if (!res.ok) {
    return { ok: false, error: `http_${res.status}` };
  }
  const body = (await res.json()) as JoinResponse;
  // Slack returns ok:true + warning:"already_in_channel" when the bot
  // is already a member. Normalize to a boolean.
  if (body.ok && body.warning === "already_in_channel") {
    body.already_in_channel = true;
  }
  return body;
}

// ─── Top-level discovery ────────────────────────────────────────────────────

export interface DiscoveryChannel {
  id: string;
  name: string;
  was_member: boolean;
  joined: boolean;
  already_in_channel?: boolean;
  error?: string;
}

export interface DiscoveryRun {
  channels_seen: number;
  joined_new: number;
  already_in: number;
  errors: number;
  per_channel: DiscoveryChannel[];
}

/**
 * Enumerate public channels and join each one the bot isn't already in.
 * Sequential to stay under Slack's ~20 req/min Tier-2 limit on join.
 * For workspaces with hundreds of channels this will take a minute or two
 * to walk; subsequent runs are cheap because most channels return
 * already_in_channel and the run completes faster.
 */
export async function discoverAndJoin(
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<DiscoveryRun> {
  const channels = await fetchPublicChannels(token, fetchImpl);
  const per_channel: DiscoveryChannel[] = [];
  let joined_new = 0;
  let already_in = 0;
  let errors = 0;

  for (const c of channels) {
    const entry: DiscoveryChannel = {
      id: c.id,
      name: c.name,
      was_member: c.is_member,
      joined: false,
    };
    if (c.is_member) {
      already_in++;
      per_channel.push(entry);
      continue;
    }
    try {
      const res = await joinChannel(c.id, token, fetchImpl);
      if (res.ok) {
        if (res.already_in_channel) {
          entry.already_in_channel = true;
          already_in++;
        } else {
          entry.joined = true;
          joined_new++;
        }
      } else {
        entry.error = res.error || "unknown";
        errors++;
      }
    } catch (e) {
      entry.error = e instanceof Error ? e.message : String(e);
      errors++;
    }
    per_channel.push(entry);
  }

  return {
    channels_seen: channels.length,
    joined_new,
    already_in,
    errors,
    per_channel,
  };
}
