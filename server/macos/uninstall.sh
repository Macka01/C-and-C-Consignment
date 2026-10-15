#!/bin/bash
# Stop the login service. The data repository is left on disk.

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This uninstall runs on the MacBook Pro."
  exit 1
fi

UID_VALUE="$(id -u)"
AGENT_DIR="$HOME/Library/LaunchAgents"
DATA_DIR="$HOME/Library/Application Support/CottonAndClay/data"

launchctl bootout "gui/$UID_VALUE/com.cottonandclay.tracker" >/dev/null 2>&1 || true
launchctl bootout "gui/$UID_VALUE/com.cottonandclay.backup" >/dev/null 2>&1 || true
rm -f "$AGENT_DIR/com.cottonandclay.tracker.plist"
rm -f "$AGENT_DIR/com.cottonandclay.backup.plist"

echo "The tracker service is stopped."
echo "The data repository is still at: $DATA_DIR"
echo "Backups are still at: $HOME/Library/Application Support/CottonAndClay/backups"
