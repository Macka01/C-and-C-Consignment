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
  echo "Waiting for Docker Desktop on Wendys-MBP…"
  for i in $(seq 1 "$tries"); do
    if docker info >/dev/null 2>&1; then
      echo "Docker Desktop is running."
      return 0
    fi
    echo "  still waiting ($i/$tries). On Wendys-MBP: wake it, stay logged in, open Docker Desktop."
    sleep 5
  done
  echo "Docker Desktop did not become ready. Start Docker Desktop on Wendys-MBP, wait until it says it is running, and try again."
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

host_env_value() {
  local key=$1
  [[ -f "$HOST_ENV" ]] || return 0
  python3 -c 'import sys
key, path = sys.argv[1], sys.argv[2]
for line in open(path, encoding="utf-8"):
    if line.startswith(key + "="):
        print(line.split("=", 1)[1].strip().strip("\""))
        break
' "$key" "$HOST_ENV"
}

# Compose project `homeserver` on Wendys-MBP. There is no container named "homeserver".
HOMESERVER_CADDY="homeserver-caddy-1"
HOMESERVER_HELLO="homeserver-hello-1"
HOMESERVER_POSTGRES="homeserver-postgres-1"

pick_homeserver_caddy() {
  python3 -c 'import sys
names=[line.strip() for line in sys.stdin if line.strip()]
want=("homeserver-caddy-1",)
for name in names:
    if name in want:
        print(name)
        raise SystemExit(0)
for name in names:
    low=name.lower()
    if low == "homeserver-caddy" or low.startswith("homeserver-caddy-"):
        print(name)
        raise SystemExit(0)
raise SystemExit(1)'
}

find_homeserver_caddy() {
  local names
  names="$(docker ps --format '{{.Names}}' 2>/dev/null || true)"
  printf '%s\n' "$names" | pick_homeserver_caddy
}

# Used by install/start: the reverse-proxy container, not hello or postgres.
find_homeserver() {
  find_homeserver_caddy
}

homeserver_stack_present() {
  local names
  names="$(docker ps --format '{{.Names}}' 2>/dev/null || true)"
  printf '%s\n' "$names" | python3 -c 'import sys
names=set(line.strip() for line in sys.stdin if line.strip())
need={"homeserver-caddy-1","homeserver-hello-1","homeserver-postgres-1"}
raise SystemExit(0 if need & names else 1)' >/dev/null 2>&1
}

homeserver_exists_stopped() {
  local rows
  rows="$(docker ps -a --format '{{.Names}} {{.Status}}' 2>/dev/null || true)"
  printf '%s\n' "$rows" | python3 -c 'import sys
wanted={"homeserver-caddy-1","homeserver-caddy"}
for line in sys.stdin:
    parts=line.strip().split(" ", 1)
    if not parts:
        continue
    name=parts[0]
    status=parts[1] if len(parts)>1 else ""
    low=name.lower()
    if (name in wanted or low.startswith("homeserver-caddy")) and not status.lower().startswith("up"):
        raise SystemExit(0)
raise SystemExit(1)' >/dev/null 2>&1
}

homeserver_compose_network() {
  local caddy saved net
  caddy="$(find_homeserver_caddy 2>/dev/null || true)"
  saved="$(host_env_value HOMESERVER_NETWORK || true)"
  if [[ -n "$saved" ]] && docker network inspect "$saved" >/dev/null 2>&1; then
    printf '%s\n' "$saved"
    return 0
  fi
  if [[ -n "$caddy" ]]; then
    while read -r net; do
      [[ -z "$net" ]] && continue
      case "$net" in
        bridge|host|none|cotton-clay) continue ;;
      esac
      if [[ "$net" == homeserver ]] || [[ "$net" == homeserver_* ]] || [[ "$net" == homeserver-* ]]; then
        printf '%s\n' "$net"
        return 0
      fi
    done < <(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' "$caddy" 2>/dev/null || true)
    while read -r net; do
      [[ -z "$net" ]] && continue
      case "$net" in
        bridge|host|none|cotton-clay) continue ;;
      esac
      printf '%s\n' "$net"
      return 0
    done < <(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' "$caddy" 2>/dev/null || true)
  fi
  for net in homeserver_default homeserver; do
    if docker network inspect "$net" >/dev/null 2>&1; then
      printf '%s\n' "$net"
      return 0
    fi
  done
  return 1
}

# Leave homeserver-caddy-1, homeserver-hello-1, and homeserver-postgres-1 running.
# Join Caddy (or the homeserver compose network) so it can proxy to cotton-clay-tracker:43123.
join_homeserver_network() {
  local caddy net
  caddy="$(find_homeserver_caddy 2>/dev/null || true)"
  if [[ -z "$caddy" ]]; then
    if homeserver_exists_stopped; then
      echo "homeserver-caddy-1 exists but is not running. Start the homeserver Compose stack, then run: bash server/macos/start.sh"
    elif ! homeserver_stack_present; then
      echo "Did not see homeserver-caddy-1. The tracker is still on port 43123. Start the homeserver stack (caddy, hello, postgres) and run: bash server/macos/start.sh"
    fi
    return 0
  fi
  echo "Found reverse proxy $caddy. Leaving homeserver-caddy-1, homeserver-hello-1, and homeserver-postgres-1 running."
  docker network connect cotton-clay "$caddy" 2>/dev/null || true
  if net="$(homeserver_compose_network)"; then
    echo "Joining cotton-clay-tracker to Docker network $net so Caddy can reach http://cotton-clay-tracker:43123"
    docker network connect "$net" cotton-clay-tracker 2>/dev/null || true
  fi
}

detach_homeserver_network() {
  local caddy net
  caddy="$(find_homeserver_caddy 2>/dev/null || host_env_value HOMESERVER_CONTAINER || true)"
  net="$(homeserver_compose_network 2>/dev/null || host_env_value HOMESERVER_NETWORK || true)"
  if [[ -n "$caddy" ]]; then
    docker network disconnect cotton-clay "$caddy" 2>/dev/null || true
  fi
  if [[ -n "$net" ]]; then
    docker network disconnect "$net" cotton-clay-tracker 2>/dev/null || true
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
  local tz https_url magic_http ip_http lan_http bonjour homeserver_url homeserver_name homeserver_net access_code
  tz="$(host_timezone)"
  https_url=""
  magic_http=""
  ip_http=""
  lan_http=""
  bonjour="$(bonjour_name)"
  homeserver_url="$(host_env_value CONSIGNMENT_HOMESERVER_URL || true)"
  homeserver_name="$(find_homeserver_caddy 2>/dev/null || host_env_value HOMESERVER_CONTAINER || true)"
  homeserver_net="$(homeserver_compose_network 2>/dev/null || host_env_value HOMESERVER_NETWORK || true)"
  access_code="$(host_env_value CONSIGNMENT_ACCESS_CODE || true)"
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
  urls="$(join_urls "$homeserver_url" "$https_url" "$magic_http" "$ip_http" "${bonjour:+http://${bonjour}:43123}" "$lan_http")"
  cat > "$HOST_ENV" <<EOF
TZ=${tz}
HOST_UID=$(id -u)
HOST_GID=$(id -g)
CONSIGNMENT_HOST_DATA="${DATA_DIR}"
CONSIGNMENT_HOST_BACKUPS="${BACKUP_DIR}"
CONSIGNMENT_BONJOUR=${bonjour}
CONSIGNMENT_PUBLIC_URLS=${urls}
CONSIGNMENT_HOMESERVER_URL=${homeserver_url}
CONSIGNMENT_ACCESS_CODE=${access_code}
HOMESERVER_CONTAINER=${homeserver_name}
HOMESERVER_NETWORK=${homeserver_net}
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
  if find_homeserver_caddy >/dev/null || homeserver_stack_present; then
    echo "homeserver-caddy-1 already owns host ports 80 and 443. Not taking those ports, 5432, or Tailscale HTTPS 443."
    echo "Point Caddy at http://cotton-clay-tracker:43123 (see docs/mac-server.md)."
    write_host_env "http"
    return 1
  fi
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
    echo "Tailscale already serves HTTPS on port 443 for something else (often homeserver). Leaving that alone. Phones can use the MagicDNS address on port 43123, or a hostname you add on homeserver."
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
