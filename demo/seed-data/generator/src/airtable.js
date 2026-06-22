// Anchor seed generator — Airtable write client.
//
// Creates one row per project in the configured Containers table.
// Returns the created record ids in a manifest so reset can remove them
// cleanly. Uses node:fetch (Node 18+) — no external deps.
//
// Schema (per layer-3/README.md):
//   Project        — display name
//   Figma files    — comma-separated file keys
//   Slack channels — comma-separated channel ids
//   Cowork tags    — comma-separated absolute path prefixes
//   Aliases        — comma-separated alternate names
//   Notes          — free text
//
// Env (from /Anchor/.env):
//   AIRTABLE_API_TOKEN
//   AIRTABLE_BASE_ID
//   AIRTABLE_CONTAINER_TABLE_ID

/** @typedef {import('./shared').Project} Project */

/**
 * @param {{ projects: Project[], absoluteSeedRoot: string }} opts
 * @returns {Promise<{ project_slug: string, airtable_id: string }[]>}
 */
export async function createProjectRows(opts) {
  const auth = requireEnv();
  /** @type {{ project_slug: string, airtable_id: string }[]} */
  const out = [];

  for (const p of opts.projects) {
    const fields = projectToFields(p, opts.absoluteSeedRoot);
    const id = await createOne(auth, fields);
    out.push({ project_slug: p.slug, airtable_id: id });
  }
  return out;
}

/**
 * @param {{ rows: { airtable_id: string }[] }} opts
 * @returns {Promise<{ deleted: number, failed: string[] }>}
 */
export async function deleteProjectRows(opts) {
  const auth = requireEnv();
  let deleted = 0;
  /** @type {string[]} */
  const failed = [];
  for (const r of opts.rows) {
    try {
      await deleteOne(auth, r.airtable_id);
      deleted++;
    } catch (e) {
      failed.push(`${r.airtable_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { deleted, failed };
}

/**
 * @param {{ airtable_id: string, fields: Record<string, string> }} opts
 */
export async function updateProjectRow(opts) {
  const auth = requireEnv();
  const url = `${apiBase(auth)}/${opts.airtable_id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...authHeaders(auth), "content-type": "application/json" },
    body: JSON.stringify({ fields: opts.fields }),
  });
  if (!res.ok) throw new Error(`Airtable PATCH failed: ${res.status} ${await res.text()}`);
}

// ─── Internals ──────────────────────────────────────────────────────────────

/** @typedef {{ token: string, baseId: string, tableId: string }} Auth */

/** @returns {Auth} */
function requireEnv() {
  const token = process.env.AIRTABLE_API_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_CONTAINER_TABLE_ID;
  if (!token || !baseId || !tableId) {
    throw new Error(
      "Missing AIRTABLE_API_TOKEN / AIRTABLE_BASE_ID / AIRTABLE_CONTAINER_TABLE_ID. Source /Anchor/.env first."
    );
  }
  return { token, baseId, tableId };
}

/** @param {Auth} a */
function apiBase(a) {
  return `https://api.airtable.com/v0/${a.baseId}/${a.tableId}`;
}

/** @param {Auth} a */
function authHeaders(a) {
  return { authorization: `Bearer ${a.token}` };
}

/**
 * @param {Project} p
 * @param {string} absoluteSeedRoot  Absolute path to /Anchor/demo/seed-data on this machine.
 * @returns {Record<string, string>}
 */
function projectToFields(p, absoluteSeedRoot) {
  const cowork_abs = `${absoluteSeedRoot}/projects/${p.slug}`;
  return {
    "Project": p.name,
    "Figma files": p.figma_file_key,
    "Slack channels": p.slack_channel,
    "Cowork tags": cowork_abs,
    "Aliases": (p.aliases || []).join(", "),
    "Notes": `Seed-generated. Lifecycle: ${p.state}. Created by anchor-seed-generator.`,
  };
}

/**
 * @param {Auth} a
 * @param {Record<string, string>} fields
 * @returns {Promise<string>}
 */
async function createOne(a, fields) {
  const res = await fetch(apiBase(a), {
    method: "POST",
    headers: { ...authHeaders(a), "content-type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable POST failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return body.id;
}

/**
 * @param {Auth} a
 * @param {string} id
 */
async function deleteOne(a, id) {
  const url = `${apiBase(a)}/${id}`;
  const res = await fetch(url, { method: "DELETE", headers: authHeaders(a) });
  if (!res.ok) throw new Error(`Airtable DELETE failed: ${res.status} ${await res.text()}`);
}
