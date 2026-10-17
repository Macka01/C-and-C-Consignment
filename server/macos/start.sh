#!/bin/bash
# Bring the tracker container up once Docker Desktop is running, then point Tailscale at it.

set -euo pipefail

# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

echo "Starting cotton-clay-tracker only. Not touching homeserver-caddy-1, homeserver-hello-1, or homeserver-postgres-1."
wait_for_docker 60
if [[ ! -f "$HOST_ENV" ]]; then
  write_host_env "http"
fi
echo "Bringing the tracker container up…"
compose up -d --remove-orphans
join_homeserver_network
enable_tailscale_https || true
compose up -d --remove-orphans
join_homeserver_network
echo "Tracker start finished."
