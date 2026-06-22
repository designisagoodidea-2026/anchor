// Anchor seed generator — .env loader.
//
// Parses KEY=VALUE pairs from a .env file and merges them into
// process.env. Existing env values win — sourcing the file from a shell
// before running the script still takes precedence.
//
// Mirrors the shell pattern `set -a; source .env; set +a` that
// anchor-live-run.sh uses, so the two entry points behave the same.

import fs from "node:fs";

/**
 * @param {string} file  Absolute path to a .env file. Missing file is a no-op.
 */
export function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip surrounding quotes if present.
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!key) continue;
    if (process.env[key] !== undefined) continue; // shell value wins
    process.env[key] = value;
  }
}
