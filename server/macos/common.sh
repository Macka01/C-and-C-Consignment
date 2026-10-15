# Shared paths and helpers for the Mac Docker + Tailscale install.
# shellcheck shell=bash

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOST_ENV="$APP_DIR/server/macos/host.env"
SUPPORT_DIR="${HOME}/Library/Application Support/CottonAndClay"
DATA_DIR="$SUPPORT_DIR/data"
BACKUP_DIR="$SUPPORT_DIR/backups"
LOG_DIR="${HOME}/Library/Logs/CottonAndClay"
AGENT_DIR="${HOME}/Library/LaunchAgents"
LABEL="com.cottonandclay.tracker"
BACKUP_LABEL="com.cottonandclay.backup"
compose_project="cotton-clay"

export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

xml_escape() {
  local value=$1
  value=${value//&/&amp;}
  value=${value//</&lt;}
  value=${value//>/&gt;}
  printf '%s' "$value"
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose --project-directory "$APP_DIR" --project-name "$compose_project" --env-file "$HOST_ENV" -f "$APP_DIR/compose.yaml" "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose --project-directory "$APP_DIR" --project-name "$compose_project" --env-file "$HOST_ENV" -f "$APP_DIR/compose.yaml" "$@"
  else
    echo "Docker Compose is not installed. Open Docker Desktop and try again."
    return 1
  fi
}

wait_for_docker() {
  local tries=${1:-60}
  local i
  for i in $(seq 1 "$tries"); do
    if docker info >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done
  echo "Docker Desktop did not become ready. Start Docker Desktop, wait until it says it is running, and try again."
  return 1
}

host_timezone() {
  local tzfile
  tzfile="$(readlink /etc/localtime 2>/dev/null || true)"
  if [[ "$tzfile" == *zoneinfo/* ]]; then
    printf '%s\n' "${tzfile##*zoneinfo/}"
    return
  fi
  printf '%s\n' "Australia/Sydney"
}

tailscale_ready() {
  command -v tailscale >/dev/null 2>&1 && tailscale status >/dev/null 2>&1
}

tailscale_dns_name() {
  tailscale status --json 2>/dev/null | python3 -c 'import json,sys
j=json.load(sys.stdin)
print((j.get("Self") or {}).get("DNSName") or "", end="")' | sed 's/\.$//'
}

tailscale_hostname() {
  tailscale status --json 2>/dev/null | python3 -c 'import json,sys
j=json.load(sys.stdin)
print((j.get("Self") or {}).get("HostName") or "", end="")'
}

tailscale_ipv4() {
  tailscale ip -4 2>/dev/null | head -n 1
}

lan_ipv4() {
  local iface ip
  for iface in en0 en1; do
    ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
    if [[ -n "$ip" ]]; then
      printf '%s\n' "$ip"
      return
    fi
  done
}

bonjour_name() {
  local host
  host="$(scutil --get LocalHostName 2>/dev/null || true)"
  if [[ -n "$host" ]]; then
    printf '%s.local\n' "$host"
  fi
}

join_urls() {
  local out="" item
  for item in "$@"; do
    [[ -z "$item" ]] && continue
    if [[ -z "$out" ]]; then
      out="$item"
    elif [[ ",$out," != *",$item,"* ]]; then
      out="$out,$item"
    fi
  done
  printf '%s\n' "$out"
}

write_host_env() {
  local tz https_url magic_http ip_http lan_http bonjour
  tz="$(host_timezone)"
  https_url=""
  magic_http=""
  ip_http=""
  lan_http=""
  bonjour="$(bonjour_name)"
  if tailscale_ready; then
    local dns host ip
    dns="$(tailscale_dns_name)"
    host="$(tailscale_hostname)"
    ip="$(tailscale_ipv4)"
    if [[ -n "$dns" && "$1" == "https" ]]; then
      https_url="https://${dns}"
    fi
    if [[ -n "$host" ]]; then
      magic_http="http://${host}:43123"
    elif [[ -n "$dns" ]]; then
      magic_http="http://${dns}:43123"
    fi
    if [[ -n "$ip" ]]; then
      ip_http="http://${ip}:43123"
    fi
  fi
  lan_http=""
  local lan
  lan="$(lan_ipv4 || true)"
  if [[ -n "$lan" ]]; then
    lan_http="http://${lan}:43123"
  fi
  local urls
  urls="$(join_urls "$https_url" "$magic_http" "$ip_http" "${bonjour:+http://${bonjour}:43123}" "$lan_http")"
  cat > "$HOST_ENV" <<EOF
TZ=${tz}
HOST_UID=$(id -u)
HOST_GID=$(id -g)
CONSIGNMENT_HOST_DATA="${DATA_DIR}"
CONSIGNMENT_HOST_BACKUPS="${BACKUP_DIR}"
CONSIGNMENT_BONJOUR=${bonjour}
CONSIGNMENT_PUBLIC_URLS=${urls}
EOF
}

serve_already_ours() {
  tailscale serve status --json 2>/dev/null | python3 -c 'import json,sys
raw=sys.stdin.read().strip()
if not raw:
    raise SystemExit(1)
j=json.loads(raw)
for cfg in (j.get("Web") or {}).values():
    handlers=(cfg or {}).get("Handlers") or {}
    proxy=((handlers.get("/") or {}).get("Proxy") or "")
    if "43123" in proxy:
        raise SystemExit(0)
raise SystemExit(1)' >/dev/null 2>&1
}

https_port_busy() {
  tailscale serve status --json 2>/dev/null | python3 -c 'import json,sys
raw=sys.stdin.read().strip()
if not raw:
    raise SystemExit(1)
j=json.loads(raw)
tcp=j.get("TCP") or {}
if "443" in tcp:
    raise SystemExit(0)
raise SystemExit(1)' >/dev/null 2>&1
}

enable_tailscale_https() {
  if ! tailscale_ready; then
    echo "Tailscale is not logged in. The tracker is still on port 43123. Log in with the Tailscale app, then run: bash server/macos/start.sh"
    write_host_env "http"
    return 1
  fi
  if serve_already_ours; then
    write_host_env "https"
    return 0
  fi
  if https_port_busy; then
    echo "Tailscale already serves HTTPS on port 443 for something else. Leaving that alone. Phones can use the MagicDNS address on port 43123."
    write_host_env "http"
    return 1
  fi
  if tailscale serve --bg 43123; then
    write_host_env "https"
    return 0
  fi
  echo "Could not enable Tailscale HTTPS. Phones can still use the MagicDNS address on port 43123."
  write_host_env "http"
  return 1
}
