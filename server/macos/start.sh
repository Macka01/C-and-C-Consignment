#!/bin/bash
# Bring the tracker container up once Docker Desktop is running.
# Does not stop homeserver-caddy-1, homeserver-hello-1, or homeserver-postgres-1.
# Does not bind 80, 443, or 5432.

set -euo pipefail

# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

echo "Starting cotton-clay-tracker only. Leaving homeserver-caddy-1, homeserver-hello-1, and homeserver-postgres-1 as they are." >&2
acquire_start_lock
wait_for_docker 20

# LaunchAgent RunAtLoad fires start.sh again after update.sh. If the tracker
# already answered, do not force-recreate it under the other start.
if [[ -n "${COTTON_CLAY_FROM_LAUNCHD:-}" ]] && tracker_health_ok; then
  echo "Tracker already healthy on :43123. LaunchAgent is not recreating cotton-clay-tracker." >&2
  join_homeserver_network
  echo "Tracker start finished." >&2
  exit 0
fi

if [[ ! -f "$HOST_ENV" ]]; then
  write_host_env "http"
fi
echo "Rebuilding and recreating cotton-clay-tracker only. Homeserver stays up." >&2
compose up -d --no-deps --build --force-recreate tracker
join_homeserver_network

if find_homeserver_caddy >/dev/null || homeserver_stack_present; then
  echo "homeserver-caddy-1 is already on 80/443. Not running Tailscale Serve/Funnel." >&2
fi

echo "Waiting for the tracker on :43123. After a rebuild this can take a minute. Do not docker stop homeserver." >&2
ready=0
for i in $(seq 1 45); do
  if tracker_health_ok; then
    ready=1
    break
  fi
  echo "Waiting for health on :43123 ($i/45)…" >&2
  if [[ "$i" -eq 1 || $((i % 5)) -eq 0 ]]; then
    docker ps --filter name=cotton-clay-tracker --format '  tracker: {{.Status}}  {{.Ports}}' >&2 || true
    docker logs --tail 5 cotton-clay-tracker 2>&1 | sed 's/^/  /' >&2 || true
  fi
  sleep 2
done

if [[ "$ready" -eq 1 ]]; then
  echo "Tracker health ok: http://127.0.0.1:43123/api/health" >&2
  curl -fsS --max-time 5 "http://127.0.0.1:43123/api/health"; echo
else
  echo "Health still failing. Tracker logs:" >&2
  docker logs --tail 80 cotton-clay-tracker || true
  echo "Listeners on 43123:" >&2
  lsof -nP -iTCP:43123 -sTCP:LISTEN || true
  echo "homeserver-caddy-1, homeserver-hello-1, and homeserver-postgres-1 were left running." >&2
  exit 1
fi
echo "Tracker start finished." >&2
