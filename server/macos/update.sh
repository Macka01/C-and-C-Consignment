#!/bin/bash
# Update the app on the Mac, then reinstall the login service.
# The data repository is outside this folder and is backed up before the new version starts.

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$APP_DIR"

if [[ -d .git ]]; then
  git pull --ff-only
fi

exec bash "$APP_DIR/server/macos/install.sh"
