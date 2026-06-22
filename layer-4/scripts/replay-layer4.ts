import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

import { computeSignalsWithDiagnostics } from "../src/translator.js";

interface ReplayFixture {
  name: string;
  input: {
    events: any[];
    containers: any[];
    principles: any[];
    nowIso: string;
    mode?: "strict" | "permissive";
  };
  expected?: {
    signals: unknown[];
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultFixture = path.resolve(__dirname, "../fixtures/golden/basic-replay.json");
const defaultFixtureDir = path.resolve(__dirname, "../fixtures/golden");

function main() {
  const args = process.argv.slice(2);
  const update = args.includes("--update");
  const fixtureArg = args.find((a) => !a.startsWith("-"));
  const fixturePaths = resolveFixturePaths(fixtureArg);
  let passed = 0;

  for (const fixturePath of fixturePaths) {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as ReplayFixture;

    const run1 = computeSignalsWithDiagnostics(fixture.input).signals;
    const run2 = computeSignalsWithDiagnostics(fixture.input).signals;

    const stable1 = stableJson(run1);
    const stable2 = stableJson(run2);
    assert.equal(stable1, stable2, `translation replay is not deterministic across two runs (${fixture.name})`);

    if (update || !fixture.expected) {
      fixture.expected = { signals: run1 };
      fs.writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
      process.stdout.write(`layer4-replay: updated baseline at ${fixturePath}\n`);
      passed += 1;
      continue;
    }

    const expected = stableJson(fixture.expected.signals);
    if (expected !== stable1) {
      throw new Error(`fixture baseline mismatch: ${fixture.name} (${fixturePath})`);
    }

    process.stdout.write(`layer4-replay: PASS ${fixture.name}\n`);
    passed += 1;
  }

  process.stdout.write(`layer4-replay: summary passed=${passed} total=${fixturePaths.length}\n`);
}

function resolveFixturePaths(fixtureArg?: string): string[] {
  if (fixtureArg) {
    const resolved = path.resolve(fixtureArg);
    if (!fs.existsSync(resolved)) {
      throw new Error(`fixture not found: ${resolved}`);
    }
    return [resolved];
  }

  const dir = fs.existsSync(defaultFixtureDir)
    ? defaultFixtureDir
    : path.dirname(defaultFixture);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) {
    throw new Error(`no replay fixtures found in ${dir}`);
  }
  return files.map((f) => path.join(dir, f));
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value), null, 2);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((x) => sortValue(x));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

main();
