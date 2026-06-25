#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  scripts/onboard-source.sh <source-slug> [runtime]

Arguments:
  source-slug   lowercase source id, e.g. jira, linear, github
  runtime       worker|local (default: worker)

Examples:
  scripts/onboard-source.sh jira worker
  scripts/onboard-source.sh notion local

What it scaffolds:
  - connectors/<source>/README.md
  - connectors/<source>/src/index.ts
  - connectors/<source>/package.json
  - connectors/<source>/tsconfig.json
  - connectors/<source>/wrangler.toml (worker runtime only)

Important:
  This script scaffolds connector structure only. To fully activate a new source,
  follow the manual checklist printed at the end.
EOF
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" || $# -lt 1 ]]; then
  usage
  exit 0
fi

SOURCE="$1"
RUNTIME="${2:-worker}"

if [[ ! "$SOURCE" =~ ^[a-z0-9-]+$ ]]; then
  echo "onboard-source: source slug must match ^[a-z0-9-]+$" >&2
  exit 1
fi
if [[ "$RUNTIME" != "worker" && "$RUNTIME" != "local" ]]; then
  echo "onboard-source: runtime must be worker|local" >&2
  exit 1
fi

DIR="$ROOT/connectors/$SOURCE"
SRC_DIR="$DIR/src"

if [[ -e "$DIR" ]]; then
  echo "onboard-source: connector directory already exists: $DIR" >&2
  exit 1
fi

mkdir -p "$SRC_DIR"

cat > "$DIR/README.md" <<EOF
# ${SOURCE^} connector

Scaffolded by scripts/onboard-source.sh.

## Runtime
- ${RUNTIME}

## TODO
1. Implement source fetch/poll/webhook logic in src/index.ts.
2. Emit canonical change_event records (shared/change-event.ts).
3. Add fixture tests for classification and edge cases.
4. Wire secrets/config and document setup.
EOF

cat > "$SRC_DIR/index.ts" <<'EOF'
// Connector scaffold: implement source ingestion and emit canonical change_event.
// Contract lives in ../../shared/change-event.ts

export {};
EOF

cat > "$DIR/package.json" <<EOF
{
  "name": "anchor-connector-${SOURCE}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "echo \"add connector tests\"",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.5.0"
  }
}
EOF

cat > "$DIR/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true
  },
  "include": ["src/**/*.ts"]
}
EOF

if [[ "$RUNTIME" == "worker" ]]; then
  cat > "$DIR/wrangler.toml" <<EOF
name = "anchor-${SOURCE}"
main = "src/index.ts"
compatibility_date = "2026-06-21"

# TODO: add bindings and secrets per connector requirements.
EOF
fi

cat <<EOF
onboard-source: scaffold complete for '${SOURCE}' (${RUNTIME}).

Created:
  - $DIR/README.md
  - $DIR/src/index.ts
  - $DIR/package.json
  - $DIR/tsconfig.json
$( [[ "$RUNTIME" == "worker" ]] && echo "  - $DIR/wrangler.toml" )

Manual activation checklist:
1. Extend source support in shared/change-event.ts (Source union + SOURCES constant).
2. Add ingest path handling in renderer/src/ingest.ts.
3. Add source-specific contract/normalization tests.
4. Add governance coverage for translation-sensitive impacts.
5. Update connectors/README.md with runtime + setup details.
EOF
