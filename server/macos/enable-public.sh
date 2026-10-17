#!/bin/bash
# Opt-in on Wendys-MBP: publish the tracker so Mini / iPad / iPhone can open
# it away from home Wi-Fi without installing Tailscale on those devices.
# Requires a shared access code. Uses Tailscale Funnel to port 43123.
# Does not bind 80, 443, or 5432. Does not change homeserver containers.

set -euo pipefail

# shellcheck source=common.sh
. "$(cd "$(dirname "$0")" && pwd)/common.sh"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Run this on Wendys-MBP (macOS)."
  exit 1
fi

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run this as stevemcintyre, not with sudo for the whole script."
  exit 1
fi

code="$(host_env_value CONSIGNMENT_ACCESS_CODE || true)"
if [[ -z "$code" ]]; then
  echo "Set a shared access code first, then start the tracker, then run this again:"
  echo
  echo "  nano /Users/stevemcintyre/cotton-clay/server/macos/host.env"
  echo "  # add: CONSIGNMENT_ACCESS_CODE=pick-a-code-you-will-remember"
  echo "  cd /Users/stevemcintyre/cotton-clay"
  echo "  bash server/macos/start.sh"
  echo
  echo "Do not publish the tracker without a code — there are no user accounts."
  exit 1
fi

if ! tailscale_ready; then
  echo "Tailscale is not connected on this Mac. Open the Tailscale app and connect."
  exit 1
fi

echo "Not taking host ports 80, 443, or 5432. homeserver-caddy-1 keeps those."
echo "Trying Tailscale Funnel to the tracker on 43123 (phones will not need the Tailscale app)."

funnel_err="$(mktemp)"
if tailscale funnel --bg 43123 >"$funnel_err" 2>&1; then
  echo "Funnel is on."
else
  echo "Funnel could not start:"
  cat "$funnel_err"
  echo
  echo "If the Tailscale Mac GUI blocks Funnel the way it blocks Tailscale SSH, enable Funnel"
  echo "in the Tailscale admin console (DNS / Funnel), or keep Tailscale on the phones for now."
  echo "http://100.73.158.74:43123 still works on the tailnet."
  rm -f "$funnel_err"
  exit 1
fi
rm -f "$funnel_err"

dns="$(tailscale_dns_name)"
if [[ -n "$dns" ]]; then
  python3 -c 'from pathlib import Path
import sys
path = Path(sys.argv[1])
url = sys.argv[2]
text = path.read_text(encoding="utf-8") if path.exists() else ""
lines = []
found = False
for line in text.splitlines():
    if line.startswith("CONSIGNMENT_HOMESERVER_URL="):
        lines.append("CONSIGNMENT_HOMESERVER_URL=" + url)
        found = True
    else:
        lines.append(line)
if not found:
    lines.append("CONSIGNMENT_HOMESERVER_URL=" + url)
path.write_text("\n".join(lines) + "\n", encoding="utf-8")
' "$HOST_ENV" "https://${dns}"
  write_host_env "http"
  compose up -d --remove-orphans
  echo
  echo "Phones and the Mini (Safari, no Tailscale app required once Funnel is on):"
  echo "  https://${dns}"
  echo "Enter the access code from host.env. Then Share → Add to Home Screen."
fi

echo "Do not docker stop homeserver-caddy-1, homeserver-hello-1, or homeserver-postgres-1."
echo "Data repository stays at: $DATA_DIR"
