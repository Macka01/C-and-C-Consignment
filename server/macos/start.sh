#!/bin/bash
# Bring the tracker container up once Docker Desktop is running.
# Does not stop homeserver-caddy-1, homeserver-hello-1, or homeserver-postgres-1.
# Does not bind 80, 443, or 5432.

set -euo pipefail

# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

echo "Starting cotton-clay-tracker only. Leaving homeserver-caddy-1, homeserver-hello-1, and homeserver-postgres-1 as they are." >&2
wait_for_docker 60
if [[ ! -f "$HOST_ENV" ]]; then
  write_host_env "http"
fi
echo "Rebuilding and recreating cotton-clay-tracker only. Homeserver stays up." >&2
compose up -d --no-deps --build --force-recreate tracker
join_homeserver_network

if find_homeserver_caddy >/dev/null || homeserver_stack_present; then
  echo "homeserver-caddy-1 is already on 80/443. Not running Tailscale Serve/Funnel." >&2
fi

ready=0
for i in $(seq 1 30); do
  if curl -fsS --max-time 5 "http://127.0.0.1:43123/api/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  echo "Waiting for health on :43123 ($i/30)…" >&2
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
  exit 1
fi
echo "Tracker start finished." >&2
