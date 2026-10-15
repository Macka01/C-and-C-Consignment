#!/bin/bash
# Bring the tracker container up once Docker Desktop is running, then point Tailscale at it.

set -euo pipefail

# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

wait_for_docker 60
if [[ ! -f "$HOST_ENV" ]]; then
  write_host_env "http"
fi
compose up -d --remove-orphans
enable_tailscale_https || true
compose up -d --remove-orphans
