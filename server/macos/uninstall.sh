#!/bin/bash
# Stop the tracker container and login helpers. The data repository is left on disk.
# Other Docker stacks and Tailscale itself are not touched.

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This uninstall runs on the MacBook Pro."
  exit 1
fi

# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

UID_VALUE="$(id -u)"

launchctl bootout "gui/$UID_VALUE/$LABEL" >/dev/null 2>&1 || true
launchctl bootout "gui/$UID_VALUE/$BACKUP_LABEL" >/dev/null 2>&1 || true
rm -f "$AGENT_DIR/$LABEL.plist"
rm -f "$AGENT_DIR/$BACKUP_LABEL.plist"

if docker_cmd ps >/dev/null 2>&1; then
  detach_homeserver_network
  if [[ -f "$HOST_ENV" ]]; then
    compose down || true
  fi
fi

echo "The tracker container is stopped."
echo "The data repository is still at: $DATA_DIR"
echo "Backups are still at: $BACKUP_DIR"
echo "Docker Desktop, Tailscale, homeserver-caddy-1, homeserver-hello-1, and homeserver-postgres-1 were left as they are."
if command -v tailscale >/dev/null 2>&1 && serve_already_ours; then
  echo "Tailscale still publishes HTTPS for this tracker. To drop only that mapping: tailscale serve --https=443 off"
fi
