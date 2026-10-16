#!/bin/bash
# One-time on Wendys-MBP: turn on macOS Remote Login so the Mini can ssh over Tailscale.
# The Mac App Store / sandboxed Tailscale GUI cannot run Tailscale SSH — do not use `tailscale ssh`.
# Does not change homeserver-caddy-1, homeserver-hello-1, or homeserver-postgres-1.

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Run this on Wendys-MBP (macOS)."
  exit 1
fi

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run this as the Mac user who stays logged in (stevemcintyre), not with sudo for the whole script."
  exit 1
fi

export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

if ! command -v tailscale >/dev/null 2>&1; then
  echo "Tailscale is not on the PATH. Open the Tailscale app, then a new Terminal window."
  exit 1
fi

if ! tailscale status >/dev/null 2>&1; then
  echo "Tailscale is not connected. Open the Tailscale menu extra and connect, then run this again."
  exit 1
fi

echo "The Tailscale Mac GUI cannot run Tailscale SSH. Enabling macOS Remote Login instead."
echo "The Mini will use ordinary ssh over the tailnet (MagicDNS or 100.x address)."
echo "Not running: sudo tailscale set --ssh"
echo

remote_on=0
if command -v systemsetup >/dev/null 2>&1; then
  if sudo systemsetup -getremotelogin 2>/dev/null | grep -qi "On"; then
    echo "Remote Login is already on."
    remote_on=1
  elif sudo systemsetup -setremotelogin on; then
    echo "Remote Login is on."
    remote_on=1
  fi
fi

if [[ "$remote_on" -ne 1 ]]; then
  echo
  echo "Remote Login is still off. Paste this, then run enable-remote.sh again:"
  echo "  sudo systemsetup -setremotelogin on"
  echo
  echo "Or turn it on by hand:"
  echo "  System Settings → General → Sharing → Remote Login"
  echo "  Turn it on. Allow user $(whoami)."
  exit 1
fi

dns="$(tailscale status --json 2>/dev/null | python3 -c 'import json,sys
j=json.load(sys.stdin)
print(((j.get("Self") or {}).get("DNSName") or "").rstrip("."))' 2>/dev/null || true)"
host="$(tailscale status --json 2>/dev/null | python3 -c 'import json,sys
j=json.load(sys.stdin)
print((j.get("Self") or {}).get("HostName") or "")' 2>/dev/null || true)"
ip4="$(tailscale ip -4 2>/dev/null | head -n 1 || true)"
user="$(whoami)"
remote="$APP_DIR/server/macos/remote.sh"

mbp="${host:-}"
if [[ -z "$mbp" ]]; then
  mbp="${dns:-Wendys-MBP}"
fi

echo
echo "Remote Login is on. This Mac stays the server. The Mini only opens a shell here."
echo "There is no login on the tracker website."
echo "Do not docker stop homeserver-caddy-1, homeserver-hello-1, or homeserver-postgres-1."
echo
echo "On the Mac Mini, Tailscale must be connected to the same tailnet. Then paste:"
echo
echo "  ssh ${user}@${mbp} \"bash ${remote} status\""
if [[ -n "$dns" && "$dns" != "$mbp" ]]; then
  echo "  ssh ${user}@${dns} \"bash ${remote} status\""
fi
if [[ -n "$ip4" ]]; then
  echo "  ssh ${user}@${ip4} \"bash ${remote} status\""
fi
echo
echo "Other commands (same ssh, different last word): status logs restart update backup stop"
echo
echo "  USER=${user}"
echo "  MBP=${mbp}"
if [[ -n "$ip4" ]]; then
  echo "  MBP_IP=${ip4}"
fi
echo "  REMOTE=${remote}"
echo '  ssh "$USER@$MBP" "bash $REMOTE status"'
