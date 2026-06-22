#!/usr/bin/env bash
#
# anchor-live-run.sh
#
# Runs the cowork watcher in the background against the Anchor folder,
# streams change_event records to an NDJSON file, and renders the digest on
# demand. The promise: leave this running for a few hours of real activity,
# then read the prose.
#
# Subcommands:
#   start         Start the watcher in the background. Idempotent.
#   stop          Stop the watcher. Idempotent.
#   status        Show whether the watcher is running, event count, file size.
#   tail [N=20]   Show the last N events (raw NDJSON).
#   digest        Render the digest from the captured events. Dry-run by
#                 default — pass --commit to write state. Pass
#                 --with-synthetic to fold in the seed generator's
#                 figma.ndjson + slack.ndjson alongside the watcher file.
#   friday        Render the Friday narrative over state's weekly_log. Read-only.
#                 Flags (passed to renderer/src/friday.ts):
#                   --html              HTML instead of markdown.
#                   --send              POST to ANCHOR_EMAIL_WEBHOOK_URL.
#                   --subject "<text>"  Override email subject.
#                   --to "<addr>"       Override ANCHOR_EMAIL_TO.
#   governance-check
#                 Validate governance decision records against the
#                 canonical lightweight contract.
#   reset         Stop the watcher, archive the current NDJSON, start fresh.
#
# Output paths (all under /Anchor/state/live/, which is gitignored):
#   cowork.ndjson  Captured event stream.
#   watcher.pid    Watcher PID.
#   watcher.err    Watcher stderr log.
#   archive/       Rotated NDJSON files from `reset`.

set -euo pipefail

ANCHOR_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIVE_DIR="$ANCHOR_ROOT/state/live"
EVENTS_FILE="$LIVE_DIR/cowork.ndjson"
PID_FILE="$LIVE_DIR/watcher.pid"
ERR_FILE="$LIVE_DIR/watcher.err"
ARCHIVE_DIR="$LIVE_DIR/archive"

mkdir -p "$LIVE_DIR" "$ARCHIVE_DIR"

# Source /Anchor/.env so subcommands inherit AIRTABLE_API_TOKEN,
# AIRTABLE_BASE_ID, AIRTABLE_CONTAINER_TABLE_ID, and the rest. set -a marks
# every subsequent assignment for export; set +a turns that off after the
# source. Quiet about it on purpose — we don't want to print secrets into
# the watcher log or stdout.
if [[ -f "$ANCHOR_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ANCHOR_ROOT/.env"
  set +a
fi

is_running() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid
  pid="$(cat "$PID_FILE")"
  kill -0 "$pid" 2>/dev/null
}

cmd_start() {
  if is_running; then
    echo "anchor-live-run: watcher already running (PID $(cat "$PID_FILE"))." >&2
    return 0
  fi

  cd "$ANCHOR_ROOT/connectors/cowork"

  # Append (>>) rather than overwrite so a restart doesn't lose history.
  # Run with nohup so closing the terminal doesn't kill the watcher.
  ANCHOR_PROJECT_ROOTS="$ANCHOR_ROOT" \
    nohup node src/index.js >> "$EVENTS_FILE" 2>> "$ERR_FILE" &
  local pid=$!
  echo "$pid" > "$PID_FILE"

  # Give the watcher a beat to start.
  sleep 1
  if is_running; then
    echo "anchor-live-run: started (PID $pid)."
    echo "  events:  $EVENTS_FILE"
    echo "  stderr:  $ERR_FILE"
    echo "  stop with: $0 stop"
  else
    echo "anchor-live-run: failed to start. See $ERR_FILE." >&2
    rm -f "$PID_FILE" 2>/dev/null || true
    return 1
  fi
}

cmd_stop() {
  if ! is_running; then
    echo "anchor-live-run: not running."
    rm -f "$PID_FILE" 2>/dev/null || true
    return 0
  fi
  local pid
  pid="$(cat "$PID_FILE")"
  kill "$pid" 2>/dev/null || true
  # Wait a second for clean shutdown.
  sleep 1
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$PID_FILE" 2>/dev/null || true
  echo "anchor-live-run: stopped (was PID $pid)."
}

cmd_status() {
  if is_running; then
    echo "anchor-live-run: running (PID $(cat "$PID_FILE"))."
  else
    echo "anchor-live-run: not running."
  fi
  if [[ -f "$EVENTS_FILE" ]]; then
    local count
    count="$(wc -l < "$EVENTS_FILE" | tr -d ' ')"
    local size
    size="$(wc -c < "$EVENTS_FILE" | tr -d ' ')"
    echo "  events file: $EVENTS_FILE"
    echo "  event count: $count"
    echo "  size bytes:  $size"
  else
    echo "  events file: $EVENTS_FILE (not yet created)"
  fi
}

cmd_tail() {
  local n="${1:-20}"
  if [[ ! -f "$EVENTS_FILE" ]]; then
    echo "anchor-live-run: no events file yet at $EVENTS_FILE." >&2
    return 1
  fi
  tail -n "$n" "$EVENTS_FILE"
}

cmd_digest() {
  local commit="0"
  local with_synthetic="0"
  for arg in "$@"; do
    case "$arg" in
      --commit) commit="1" ;;
      --with-synthetic) with_synthetic="1" ;;
      *) echo "anchor-live-run: unknown digest arg: $arg" >&2; return 1 ;;
    esac
  done

  if [[ ! -f "$EVENTS_FILE" ]]; then
    echo "anchor-live-run: no events file at $EVENTS_FILE. Start the watcher first." >&2
    return 1
  fi

  local source_file="$EVENTS_FILE"

  # When --with-synthetic, concatenate the watcher's cowork.ndjson with the
  # generator's figma.ndjson and slack.ndjson into a single combined file the
  # renderer reads. Sources self-identify via each event's `source` field, so
  # the digest header counts each lane honestly.
  if [[ "$with_synthetic" == "1" ]]; then
    local synth_dir="$ANCHOR_ROOT/demo/seed-data/synthetic-events"
    local combined="$LIVE_DIR/combined.ndjson"
    : > "$combined"
    cat "$EVENTS_FILE" >> "$combined" 2>/dev/null || true
    [[ -f "$synth_dir/figma.ndjson" ]] && cat "$synth_dir/figma.ndjson" >> "$combined"
    [[ -f "$synth_dir/slack.ndjson" ]] && cat "$synth_dir/slack.ndjson" >> "$combined"
    source_file="$combined"
    echo "anchor-live-run: combined cowork + synthetic figma/slack → $combined" >&2
  fi

  cd "$ANCHOR_ROOT/renderer"
  local dry_env=""
  if [[ "$commit" == "0" ]]; then
    dry_env="ANCHOR_DRY_RUN=1"
    echo "anchor-live-run: dry run — state will NOT be committed. Pass --commit to anchor." >&2
  fi

  env $dry_env \
    ANCHOR_EVENTS_FILE="$source_file" \
    npx tsx src/digest.ts
}

cmd_friday() {
  # The Friday narrative reads state — it does NOT need the events file or
  # the watcher. It only requires that the digest has been run with --commit
  # at least once so weekly_log has snapshots.
  #
  # Flags pass-through to renderer/src/friday.ts:
  #   --html              Emit HTML instead of markdown.
  #   --send              Render HTML + POST to ANCHOR_EMAIL_WEBHOOK_URL.
  #   --subject "<text>"  Override the email subject.
  #   --to "<addr>"       Override ANCHOR_EMAIL_TO.
  cd "$ANCHOR_ROOT/renderer"
  npx tsx src/friday.ts "$@"
}

cmd_governance_check() {
  cd "$ANCHOR_ROOT"
  node scripts/validate-decision-records.mjs
  node scripts/check-translation-governance.mjs
}

cmd_reset() {
  cmd_stop
  if [[ -f "$EVENTS_FILE" ]]; then
    local ts
    ts="$(date -u +%Y%m%dT%H%M%SZ)"
    mv "$EVENTS_FILE" "$ARCHIVE_DIR/cowork-$ts.ndjson"
    echo "anchor-live-run: archived events to $ARCHIVE_DIR/cowork-$ts.ndjson"
  fi
  if [[ -f "$ERR_FILE" ]]; then
    mv "$ERR_FILE" "$ARCHIVE_DIR/watcher-$(date -u +%Y%m%dT%H%M%SZ).err"
  fi
  cmd_start
}

main() {
  local subcommand="${1:-}"
  shift || true
  case "$subcommand" in
    start)   cmd_start "$@" ;;
    stop)    cmd_stop "$@" ;;
    status)  cmd_status "$@" ;;
    tail)    cmd_tail "$@" ;;
    digest)  cmd_digest "$@" ;;
    friday)  cmd_friday "$@" ;;
    governance-check) cmd_governance_check "$@" ;;
    reset)   cmd_reset "$@" ;;
    ""|-h|--help)
      sed -n '3,22p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      ;;
    *)
      echo "anchor-live-run: unknown subcommand: $subcommand" >&2
      echo "Run \`$0 --help\` for usage." >&2
      return 1
      ;;
  esac
}

main "$@"
