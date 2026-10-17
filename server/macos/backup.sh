#!/bin/bash
# Dated copy of the data repository, run inside the tracker image.

set -euo pipefail

# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

if ! docker_cmd ps >/dev/null 2>&1; then
  echo "Docker Desktop is not answering (docker ps timed out or failed); backup skipped."
  exit 0
fi
if [[ ! -f "$HOST_ENV" ]]; then
  echo "Missing $HOST_ENV; run bash server/macos/install.sh first."
  exit 1
fi
compose run --rm backup
