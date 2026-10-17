#!/bin/bash
# Run on Wendys-MBP, usually via ordinary ssh over Tailscale from the Mac Mini.
# Do not use `tailscale ssh` — the Mac GUI app is sandboxed and cannot run it.
# Only the tracker (cotton-clay / cotton-clay-tracker). Never stop or recreate
# homeserver-caddy-1, homeserver-hello-1, or homeserver-postgres-1.
# Never bind 80, 443, or 5432.

set -euo pipefail

# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

PROTECTED=(homeserver-caddy-1 homeserver-hello-1 homeserver-postgres-1)

refuse_homeserver() {
  local name
  for name in "${PROTECTED[@]}"; do
    case " $* " in
      *" $name "*)
        echo "Refusing: that would touch $name. This script only manages cotton-clay-tracker."
        exit 1
        ;;
    esac
  done
}

homeserver_still_up() {
  local name status
  echo "homeserver stack (must stay Up):"
  for name in "${PROTECTED[@]}"; do
    status="$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || echo missing)"
    echo "  $name  $status"
  done
}

cmd="${1:-status}"
refuse_homeserver "$@"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not on PATH in this ssh session. Expected: /Applications/Docker.app/Contents/Resources/bin/docker" >&2
  echo "Open Docker Desktop on Wendys-MBP, then try again." >&2
  exit 1
fi

case "$cmd" in
  status)
    echo "tracker:"
    tracker_line="$(docker ps --filter name=cotton-clay-tracker --format '  {{.Names}}  {{.Status}}  {{.Ports}}' 2>/dev/null || true)"
    if [[ -n "$tracker_line" ]]; then
      printf '%s\n' "$tracker_line"
    else
      echo "  cotton-clay-tracker  not running"
      echo "  start it from the Mini:  ssh stevemcintyre@100.73.158.74 \"bash /Users/stevemcintyre/cotton-clay/server/macos/remote.sh restart\""
    fi
    if curl -fsS --max-time 5 "http://127.0.0.1:43123/api/health" >/dev/null 2>&1; then
      echo "  health  http://127.0.0.1:43123/api/health  ok"
    else
      echo "  health  http://127.0.0.1:43123/api/health  down"
    fi
    echo "data repository (SQLite on the Mac disk, not homeserver-postgres-1):"
    echo "  $DATA_DIR"
    if [[ -f "$DATA_DIR/consignment.db" ]]; then
      echo "  consignment.db  $(python3 -c 'import os,sys; print(os.path.getsize(sys.argv[1]))' "$DATA_DIR/consignment.db" 2>/dev/null || echo present) bytes"
    else
      echo "  consignment.db  missing"
    fi
    echo "  reports  $DATA_DIR/reports"
    echo "  backups  $BACKUP_DIR"
    homeserver_still_up
    ;;
  health)
    curl -fsS "http://127.0.0.1:43123/api/health"
    echo
    ;;
  logs)
    echo "Last tracker logs (not following)…" >&2
    docker logs --tail 80 cotton-clay-tracker || true
    echo
    echo "LaunchAgent errors (if any):"
    tail -n 20 "$LOG_DIR/tracker.err.log" 2>/dev/null || true
    echo "logs finished." >&2
    ;;
  start | restart)
    echo "Restarting cotton-clay-tracker only. Homeserver containers stay up." >&2
    bash "$APP_DIR/server/macos/start.sh"
    homeserver_still_up
    ;;
  update)
    bash "$APP_DIR/server/macos/update.sh"
    homeserver_still_up
    ;;
  backup)
    bash "$APP_DIR/server/macos/backup.sh"
    ;;
  stop)
    bash "$APP_DIR/server/macos/uninstall.sh"
    homeserver_still_up
    ;;
  *)
    echo "Usage: bash server/macos/remote.sh status|health|logs|start|restart|update|backup|stop"
    echo "Only cotton-clay-tracker. Does not stop homeserver-caddy-1, homeserver-hello-1, or homeserver-postgres-1."
    exit 1
    ;;
esac
