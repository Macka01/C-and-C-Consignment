#!/bin/bash
# Pull a newer tracker, rebuild the image, and restart the container.
# The data repository stays on the Mac disk.

set -euo pipefail

# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

cd "$APP_DIR"
if [[ -d .git ]]; then
  git pull --ff-only
fi

wait_for_docker 24
if [[ -f "$HOST_ENV" && -f "$DATA_DIR/consignment.db" ]]; then
  compose run --rm backup || echo "Backup before update failed; continuing."
fi

exec bash "$APP_DIR/server/macos/install.sh"
