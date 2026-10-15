#!/bin/bash
# Install the Cotton & Clay tracker as a login service on a Mac.
# Serves the pages on port 43123 and keeps the database outside the project folder.

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This install runs on the MacBook Pro (macOS). The web server and the data repository both live on that Mac."
  exit 1
fi

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run this as the Mac user who will stay logged in, without sudo."
  exit 1
fi

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SUPPORT_DIR="$HOME/Library/Application Support/CottonAndClay"
DATA_DIR="$SUPPORT_DIR/data"
BACKUP_DIR="$SUPPORT_DIR/backups"
LOG_DIR="$HOME/Library/Logs/CottonAndClay"
AGENT_DIR="$HOME/Library/LaunchAgents"
LABEL="com.cottonandclay.tracker"
BACKUP_LABEL="com.cottonandclay.backup"
UID_VALUE="$(id -u)"

xml() {
  local value=$1
  value=${value//&/&amp;}
  value=${value//</&lt;}
  value=${value//>/&gt;}
  printf '%s' "$value"
}

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install the current 22 LTS from https://nodejs.org and open a new Terminal window, then run this again."
  exit 1
fi

if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 20 || (major === 20 && minor < 9)) process.exit(1)'; then
  echo "Node.js $(node -v) is too old. Install Node.js 22 LTS or newer."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found next to node. Reinstall Node.js 22 LTS from https://nodejs.org."
  exit 1
fi

NODE_BIN="$(command -v node)"
NODE_DIR="$(dirname "$NODE_BIN")"
PATH_VALUE="$NODE_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

mkdir -p "$DATA_DIR/reports" "$BACKUP_DIR" "$LOG_DIR" "$AGENT_DIR"
chmod 700 "$SUPPORT_DIR" "$DATA_DIR" "$BACKUP_DIR"

if [[ -f "$DATA_DIR/consignment.db" ]]; then
  echo "Data repository already has a database. It will be left as it is."
elif [[ -f "$APP_DIR/data/consignment.db" ]]; then
  if lsof -nP -iTCP:43123 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port 43123 is already in use. Stop the tracker before copying the database, then run this again."
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

cd "$APP_DIR"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

if [[ -f "$DATA_DIR/consignment.db" ]]; then
  CONSIGNMENT_DATA_DIR="$DATA_DIR" CONSIGNMENT_BACKUP_DIR="$BACKUP_DIR" node "$APP_DIR/scripts/backup-data.mjs"
fi

npm run build

APP_XML="$(xml "$APP_DIR")"
NODE_XML="$(xml "$NODE_BIN")"
DATA_XML="$(xml "$DATA_DIR")"
BACKUP_XML="$(xml "$BACKUP_DIR")"
LOG_XML="$(xml "$LOG_DIR")"
PATH_XML="$(xml "$PATH_VALUE")"

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
    <string>$NODE_XML</string>
    <string>$APP_XML/node_modules/next/dist/bin/next</string>
    <string>start</string>
    <string>-H</string>
    <string>0.0.0.0</string>
    <string>-p</string>
    <string>43123</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$PATH_XML</string>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>PORT</key>
    <string>43123</string>
    <key>CONSIGNMENT_DATA_DIR</key>
    <string>$DATA_XML</string>
    <key>CONSIGNMENT_BACKUP_DIR</key>
    <string>$BACKUP_XML</string>
    <key>CONSIGNMENT_SEED</key>
    <string>0</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
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
    <string>$NODE_XML</string>
    <string>$APP_XML/scripts/backup-data.mjs</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$PATH_XML</string>
    <key>CONSIGNMENT_DATA_DIR</key>
    <string>$DATA_XML</string>
    <key>CONSIGNMENT_BACKUP_DIR</key>
    <string>$BACKUP_XML</string>
  </dict>
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

launchctl bootout "gui/$UID_VALUE/$LABEL" >/dev/null 2>&1 || true
launchctl bootout "gui/$UID_VALUE/$BACKUP_LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID_VALUE" "$AGENT_DIR/$LABEL.plist"
launchctl bootstrap "gui/$UID_VALUE" "$AGENT_DIR/$BACKUP_LABEL.plist"
launchctl enable "gui/$UID_VALUE/$LABEL"
launchctl enable "gui/$UID_VALUE/$BACKUP_LABEL"
launchctl kickstart -k "gui/$UID_VALUE/$LABEL"

ready=0
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:43123/api/health" >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done

if [[ "$ready" -ne 1 ]]; then
  echo "The server did not answer on http://127.0.0.1:43123/api/health."
  echo "Last lines of $LOG_DIR/tracker.err.log:"
  tail -n 40 "$LOG_DIR/tracker.err.log" 2>/dev/null || true
  launchctl bootout "gui/$UID_VALUE/$LABEL" >/dev/null 2>&1 || true
  echo "The service was stopped so it does not keep restarting. Fix the error above and run this again."
  exit 1
fi

echo
echo "The tracker is running."
echo "On this Mac: http://127.0.0.1:43123"
LOCAL_NAME="$(scutil --get LocalHostName 2>/dev/null || true)"
if [[ -n "$LOCAL_NAME" ]]; then
  echo "From a phone on the same Wi-Fi: http://${LOCAL_NAME}.local:43123"
fi
for iface in en0 en1; do
  ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
  if [[ -n "$ip" ]]; then
    echo "Or: http://${ip}:43123"
  fi
done
echo "Data repository: $DATA_DIR"
echo "Backups: $BACKUP_DIR"
echo "Logs: $LOG_DIR"
echo
echo "Leave this Mac logged in, plugged in, and awake. The service starts again after you log in."
