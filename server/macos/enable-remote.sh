#!/bin/bash
# One-time: let the Mac Mini reach Wendys-MBP over Tailscale SSH.
# Run this on the MacBook (Wendys-MBP), logged in as the user who stays logged in.
# Does not change homeserver-caddy-1, homeserver-hello-1, or homeserver-postgres-1.

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Run this on Wendys-MBP (macOS)."
  exit 1
fi

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run this as the Mac user who stays logged in, not with sudo for the whole script."
  exit 1
fi

export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

if ! command -v tailscale >/dev/null 2>&1; then
  echo "Tailscale is not on the PATH. Open the Tailscale app, then a new Terminal window."
  exit 1
fi

if ! tailscale status >/dev/null 2>&1; then
  echo "Tailscale is not connected. Open the Tailscale menu extra and connect, then run this again."
  exit 1
fi

echo "Enabling Tailscale SSH on this Mac (the Mini will use this)."
sudo tailscale set --ssh

if command -v systemsetup >/dev/null 2>&1; then
  if ! sudo systemsetup -getremotelogin 2>/dev/null | grep -qi "On"; then
    echo "Turning on macOS Remote Login as a fallback over the tailnet."
    sudo systemsetup -setremotelogin on || echo "If that failed: System Settings → General → Sharing → Remote Login, turn it on for this user."
  fi
else
  echo "Turn on System Settings → General → Sharing → Remote Login for this user (fallback if Tailscale SSH is off)."
fi

dns="$(tailscale status --json 2>/dev/null | python3 -c 'import json,sys
j=json.load(sys.stdin)
print(((j.get("Self") or {}).get("DNSName") or "").rstrip("."))' 2>/dev/null || true)"
host="$(tailscale status --json 2>/dev/null | python3 -c 'import json,sys
j=json.load(sys.stdin)
print((j.get("Self") or {}).get("HostName") or "")' 2>/dev/null || true)"
user="$(whoami)"

echo
echo "Tailscale SSH is on. This Mac stays the server. The Mini only opens a shell here."
echo "There is no login on the tracker website."
echo
echo "On the Mac Mini, Tailscale must be connected to the same tailnet. Then paste:"
echo
echo "  USER=${user}"
if [[ -n "$host" ]]; then
  echo "  MBP=${host}"
elif [[ -n "$dns" ]]; then
  echo "  MBP=${dns}"
else
  echo "  MBP=Wendys-MBP"
fi
echo "  REMOTE=${HOME}/cotton-clay/server/macos/remote.sh"
echo '  tailscale ssh "$USER@$MBP" -- bash "$REMOTE" status'
echo
echo "Do not docker stop homeserver-caddy-1, homeserver-hello-1, or homeserver-postgres-1."
