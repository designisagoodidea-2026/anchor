#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  scripts/onboard-leader.sh <leader-slug> [leader-display-name]

Examples:
  scripts/onboard-leader.sh maya "Maya Patel"
  scripts/onboard-leader.sh reza

What it scaffolds:
  - principles/<leader>.yaml
  - memory/anchor-voice-profile-<leader>.md
  - state/<leader>.json

Notes:
  - It does not modify renderer defaults.
  - Use env vars at runtime:
      ANCHOR_LEADER_ID=<leader>
      ANCHOR_PRINCIPLES=<repo>/principles/<leader>.yaml
      ANCHOR_VOICE_PROFILE=<repo>/memory/anchor-voice-profile-<leader>.md
EOF
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" || $# -lt 1 ]]; then
  usage
  exit 0
fi

LEADER_SLUG="$1"
LEADER_NAME="${2:-$1}"

if [[ ! "$LEADER_SLUG" =~ ^[a-z0-9-]+$ ]]; then
  echo "onboard-leader: leader slug must match ^[a-z0-9-]+$" >&2
  exit 1
fi

PRINCIPLES_SRC="$ROOT/principles/jason.yaml"
VOICE_SRC="$ROOT/memory/anchor-voice-profile-jason.md"
PRINCIPLES_DST="$ROOT/principles/${LEADER_SLUG}.yaml"
VOICE_DST="$ROOT/memory/anchor-voice-profile-${LEADER_SLUG}.md"
STATE_DST="$ROOT/state/${LEADER_SLUG}.json"

if [[ ! -f "$PRINCIPLES_SRC" ]]; then
  echo "onboard-leader: missing template $PRINCIPLES_SRC" >&2
  exit 1
fi
if [[ ! -f "$VOICE_SRC" ]]; then
  echo "onboard-leader: missing template $VOICE_SRC" >&2
  exit 1
fi

if [[ -e "$PRINCIPLES_DST" || -e "$VOICE_DST" || -e "$STATE_DST" ]]; then
  echo "onboard-leader: one or more destination files already exist" >&2
  echo "  $PRINCIPLES_DST" >&2
  echo "  $VOICE_DST" >&2
  echo "  $STATE_DST" >&2
  exit 1
fi

cp "$PRINCIPLES_SRC" "$PRINCIPLES_DST"
cp "$VOICE_SRC" "$VOICE_DST"
printf '{\n  "leader_id": "%s",\n  "signals": []\n}\n' "$LEADER_SLUG" > "$STATE_DST"

# Lightweight identity substitutions in copied templates.
sed -i '' "s/for Jason/for ${LEADER_NAME}/g" "$PRINCIPLES_DST"
sed -i '' "s/for Jason's digest/for ${LEADER_NAME}'s digest/g" "$VOICE_DST"
sed -i '' "s/leader_id: jason-armstrong/leader_id: ${LEADER_SLUG}/g" "$VOICE_DST"
sed -i '' "s/name: anchor-voice-profile-jason/name: anchor-voice-profile-${LEADER_SLUG}/g" "$VOICE_DST"

cat <<EOF
onboard-leader: scaffold complete for '${LEADER_SLUG}'.

Created:
  - $PRINCIPLES_DST
  - $VOICE_DST
  - $STATE_DST

Next:
1. Edit principles in $PRINCIPLES_DST.
2. Tune banned/preferred vocabulary in $VOICE_DST.
3. Run digest with:
   ANCHOR_LEADER_ID=${LEADER_SLUG} \\
   ANCHOR_PRINCIPLES=$PRINCIPLES_DST \\
   ANCHOR_VOICE_PROFILE=$VOICE_DST \\
   npx tsx renderer/src/digest.ts
EOF
