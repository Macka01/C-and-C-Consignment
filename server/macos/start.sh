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
echo "Bringing the tracker container up…" >&2
compose up -d --remove-orphans
join_homeserver_network

if find_homeserver_caddy >/dev/null || homeserver_stack_present; then
  echo "homeserver-caddy-1 is already on 80/443. Not running Tailscale Serve/Funnel." >&2
else
  enable_tailscale_https || true
  compose up -d --remove-orphans
  join_homeserver_network
fi

if curl -fsS --max-time 8 "http://127.0.0.1:43123/api/health" >/dev/null 2>&1; then
  echo "Tracker health ok on http://127.0.0.1:43123" >&2
else
  echo "Tracker container was started but health is not answering yet. Wait a few seconds and run: bash server/macos/remote.sh status" >&2
fi
echo "Tracker start finished. Mini ssh can return now." >&2
