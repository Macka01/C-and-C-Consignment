#!/bin/bash
# Install the Cotton & Clay tracker as a Docker Compose service on a Mac.
# Tailscale publishes the pages; the data repository stays on this Mac’s disk.

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This install runs on the MacBook Pro (macOS). Docker Desktop and Tailscale already live there."
  exit 1
fi

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run this as the Mac user who stays logged in, without sudo."
  exit 1
fi

# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

UID_VALUE="$(id -u)"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not on the PATH. Open Docker Desktop (or start it from Applications), then open a new Terminal window."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
  echo "Docker Compose is not available. Update Docker Desktop and try again."
  exit 1
fi

wait_for_docker 24

if ! tailscale_ready; then
  echo "Tailscale is installed but not logged in, or the tailscale command is missing."
  echo "The container can still start. Log into the Tailscale app on this Mac and on each phone, then run: bash server/macos/start.sh"
fi

mkdir -p "$DATA_DIR/reports" "$BACKUP_DIR" "$LOG_DIR" "$AGENT_DIR"
chmod 700 "$SUPPORT_DIR" "$DATA_DIR" "$BACKUP_DIR"

if [[ -f "$DATA_DIR/consignment.db" ]]; then
  echo "Data repository already has a database. It will be left as it is."
elif [[ -f "$APP_DIR/data/consignment.db" ]]; then
  if lsof -nP -iTCP:43123 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port 43123 is already in use. Stop the other tracker (or the old Node service) before copying the database, then run this again."
    exit 1
  fi
  echo "Copying data/ from this project into the data repository."
  cp -p "$APP_DIR/data/consignment.db" "$DATA_DIR/consignment.db"
  if [[ -f "$APP_DIR/data/consignment.db-wal" ]]; then
    cp -p "$APP_DIR/data/consignment.db-wal" "$DATA_DIR/consignment.db-wal"
  fi
  if [[ -f "$APP_DIR/data/consignment.db-shm" ]]; then
    cp -p "$APP_DIR/data/consignment.db-shm" "$DATA_DIR/consignment.db-shm"
  fi
  if [[ -d "$APP_DIR/data/reports" ]]; then
    cp -pR "$APP_DIR/data/reports/." "$DATA_DIR/reports/"
  fi
else
  echo "No database yet. The first start creates an empty data repository (no sample shops)."
fi

write_host_env "http"

launchctl bootout "gui/$UID_VALUE/$LABEL" >/dev/null 2>&1 || true
launchctl bootout "gui/$UID_VALUE/$BACKUP_LABEL" >/dev/null 2>&1 || true

if lsof -nP -iTCP:43123 -sTCP:LISTEN >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'cotton-clay-tracker'; then
    echo "The cotton-clay-tracker container is already bound to 43123. It will be rebuilt."
  else
    echo "Port 43123 is already in use by another process. Stop that process (or that other container) and run this again."
    lsof -nP -iTCP:43123 -sTCP:LISTEN || true
    exit 1
  fi
fi

cd "$APP_DIR"
compose build

if [[ -f "$DATA_DIR/consignment.db" ]]; then
  compose run --rm backup || echo "Backup before start failed; continuing with the install."
fi

APP_XML="$(xml_escape "$APP_DIR")"
START_XML="$(xml_escape "$APP_DIR/server/macos/start.sh")"
BACKUP_XML="$(xml_escape "$APP_DIR/server/macos/backup.sh")"
LOG_XML="$(xml_escape "$LOG_DIR")"

cat > "$AGENT_DIR/$LABEL.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>WorkingDirectory</key>
  <string>$APP_XML</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$START_XML</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ThrottleInterval</key>
  <integer>20</integer>
  <key>StandardOutPath</key>
  <string>$LOG_XML/tracker.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_XML/tracker.err.log</string>
</dict>
</plist>
EOF

cat > "$AGENT_DIR/$BACKUP_LABEL.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$BACKUP_LABEL</string>
  <key>WorkingDirectory</key>
  <string>$APP_XML</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$BACKUP_XML</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>2</integer>
    <key>Minute</key>
    <integer>15</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>$LOG_XML/backup.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_XML/backup.err.log</string>
</dict>
</plist>
EOF

launchctl bootstrap "gui/$UID_VALUE" "$AGENT_DIR/$LABEL.plist"
launchctl bootstrap "gui/$UID_VALUE" "$AGENT_DIR/$BACKUP_LABEL.plist"
launchctl enable "gui/$UID_VALUE/$LABEL"
launchctl enable "gui/$UID_VALUE/$BACKUP_LABEL"

bash "$APP_DIR/server/macos/start.sh"

ready=0
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:43123/api/health" >/dev/null; then
    ready=1
    break
  fi
  sleep 2
done

if [[ "$ready" -ne 1 ]]; then
  echo "The tracker did not answer on http://127.0.0.1:43123/api/health."
  echo "Container logs:"
  compose logs --tail 80 tracker || true
  echo "Last lines of $LOG_DIR/tracker.err.log:"
  tail -n 40 "$LOG_DIR/tracker.err.log" 2>/dev/null || true
  exit 1
fi

echo
echo "The tracker is running in Docker."
echo "On this Mac: http://127.0.0.1:43123"
if [[ -f "$HOST_ENV" ]]; then
  grep '^CONSIGNMENT_PUBLIC_URLS=' "$HOST_ENV" | cut -d= -f2- | tr ',' '\n' | while read -r item; do
    [[ -n "$item" ]] && echo "From a phone: $item"
  done
fi
echo "Docker stack: cotton-clay (container cotton-clay-tracker). Other Compose projects are left alone."
echo "Data repository: $DATA_DIR"
echo "Backups: $BACKUP_DIR"
echo "Logs: $LOG_DIR"
echo
echo "Leave this Mac logged in, plugged in, and awake. Docker Desktop should start at login. The tracker container then starts with it."
echo "Do not turn on Tailscale Funnel — the tracker has no login, so it should stay on your tailnet only."
