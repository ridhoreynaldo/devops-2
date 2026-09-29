#!/bin/bash
# Bootstrap VPS baru untuk stack devops-2: install Docker Engine,
# clone repo, generate secrets, dan jalankan semua layer.
#
# Cara pakai (di VPS sebagai root):
#   curl -fsSL https://raw.githubusercontent.com/ridhoreynaldo/devops-2/main/bootstrap.sh | bash
# Buka semua port ke publik:
#   curl -fsSL https://raw.githubusercontent.com/ridhoreynaldo/devops-2/main/bootstrap.sh | PUBLIC_PORTS=1 bash
#
# Lokasi install standar: /opt/devops-2 (sesuai nama repo & BASE_DIR default script)
set -euo pipefail

BRANCH="${BRANCH:-main}"
REPO_URL="https://github.com/ridhoreynaldo/devops-2.git"
BASE_DIR="/opt/devops-2"
NETWORK="global-gateway-net"

# Mode port publik:  curl ... | PUBLIC_PORTS=1 bash
# Membind semua port service ke 0.0.0.0 (bisa diakses publik).
# Default: 127.0.0.1 (hanya localhost, lebih aman).
if [ "${PUBLIC_PORTS:-0}" = "1" ]; then
  export BIND_IP="0.0.0.0"
fi

log()  { echo -e "\033[1;32m[bootstrap]\033[0m $*"; }
warn() { echo -e "\033[1;33m[bootstrap][WARN]\033[0m $*"; }
die()  { echo -e "\033[1;31m[bootstrap][ERROR]\033[0m $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Jalankan sebagai root (sudo -i dulu)."

# ----------------------------------------------------------
# 1. Docker Engine (official) + git + curl
# ----------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  log "Install Docker Engine dari repo resmi Docker..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg git
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
    https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git curl
  systemctl enable --now docker
else
  log "Docker sudah terinstall: $(docker --version)"
fi
command -v git >/dev/null 2>&1 || apt-get install -y -qq git

# ----------------------------------------------------------
# 2. Clone / update repo ke /opt/devops-2
# ----------------------------------------------------------
if [ -d "$BASE_DIR/.git" ]; then
  log "Repo sudah ada, update ke branch $BRANCH..."
  git -C "$BASE_DIR" fetch origin
  git -C "$BASE_DIR" checkout "$BRANCH"
  git -C "$BASE_DIR" reset --hard "origin/$BRANCH"
else
  log "Clone repo ke $BASE_DIR (branch $BRANCH)..."
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$BASE_DIR"
fi

# ----------------------------------------------------------
# 3. Docker network global
# ----------------------------------------------------------
docker network inspect "$NETWORK" >/dev/null 2>&1 \
  || docker network create "$NETWORK"
log "Network $NETWORK siap."

# ----------------------------------------------------------
# 4. Generate secrets (hanya bila .env belum ada)
# ----------------------------------------------------------
gen_pass() { openssl rand -base64 24 | tr -d '\n'; }

if [ ! -f "$BASE_DIR/01-infra/.env" ]; then
  log "Generate password baru untuk 01-infra/.env ..."
  POSTGRES_PASSWORD="$(gen_pass)"
  MSSQL_SA_PASSWORD="$(gen_pass)"
  REDIS_PASSWORD="$(gen_pass)"
  cat > "$BASE_DIR/01-infra/.env" <<EOF
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
MSSQL_SA_PASSWORD=$MSSQL_SA_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD
EOF
  chmod 600 "$BASE_DIR/01-infra/.env"
  # Samakan userlist pgbouncer dengan password postgres
  sed "s/SAMAKAN_DENGAN_POSTGRES_PASSWORD_DI_ENV/$POSTGRES_PASSWORD/" \
    "$BASE_DIR/01-infra/postgres/userlist.txt.example" > "$BASE_DIR/01-infra/postgres/userlist.txt"
  chmod 600 "$BASE_DIR/01-infra/postgres/userlist.txt"
else
  log "01-infra/.env sudah ada, tidak di-generate ulang."
fi

if [ ! -f "$BASE_DIR/02-monitoring/.env" ]; then
  log "Generate password Grafana baru ..."
  cat > "$BASE_DIR/02-monitoring/.env" <<EOF
GRAFANA_ADMIN_PASSWORD=$(gen_pass)
EOF
  chmod 600 "$BASE_DIR/02-monitoring/.env"
else
  log "02-monitoring/.env sudah ada, tidak di-generate ulang."
fi

if [ ! -f "$BASE_DIR/scripts/.env" ]; then
  cp "$BASE_DIR/scripts/.env.example" "$BASE_DIR/scripts/.env"
  chmod 600 "$BASE_DIR/scripts/.env"
  warn "scripts/.env masih placeholder — isi kredensial rclone Google Drive manual!"
fi

# File pendukung wa-gateway (hindari docker membuat folder kosong)
[ -f "$BASE_DIR/03-services/wa-gateway/groups.json" ] \
  || echo '{}' > "$BASE_DIR/03-services/wa-gateway/groups.json"

# ----------------------------------------------------------
# 5. Jalankan layer berurutan
# ----------------------------------------------------------
wait_healthy() { # wait_healthy <container> <timeout_detik>
  local c="$1" t="$2" i=0 status
  log "Menunggu $c healthy (maks ${t}s)..."
  while [ "$i" -lt "$t" ]; do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$c" 2>/dev/null || echo "none")
    [ "$status" = "healthy" ] && { log "$c healthy."; return 0; }
    [ "$status" = "none" ] && { log "$c tidak punya healthcheck, lanjut."; return 0; }
    sleep 5; i=$((i+5))
  done
  warn "$c belum healthy setelah ${t}s — cek manual: docker logs $c"
}

log "== Layer 1: infra (database) =="
if [ "${PUBLIC_PORTS:-0}" = "1" ]; then
  log "PUBLIC_PORTS=1: semua port service dibuka ke publik (0.0.0.0)."
fi
docker compose -f "$BASE_DIR/01-infra/docker-compose.yml" up -d
wait_healthy infra_postgres 180

log "== Layer 2: monitoring =="
docker compose -f "$BASE_DIR/02-monitoring/docker-compose.yml" up -d

log "== Layer 3: services =="
docker compose -f "$BASE_DIR/03-services/docker-compose.yml" up -d --build

log "== Layer 4: gateway =="
docker compose -f "$BASE_DIR/00-gateway/docker-compose.yml" up -d --force-recreate
docker exec global_gateway nginx -t
docker exec global_gateway nginx -s reload || true

# ----------------------------------------------------------
# 6. Firewall (bila UFW aktif) + ringkasan
# ----------------------------------------------------------
if [ "${PUBLIC_PORTS:-0}" = "1" ] && command -v ufw >/dev/null 2>&1 \
   && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 5432,1433,3000,3001,5000,5001,9000/tcp
  log "Port service dibuka di UFW."
fi

log "Selesai! Status container:"
docker ps --format '  {{.Names}}  {{.Status}}' | sort

echo ""
warn "Langkah manual berikutnya:"
warn "  1. Arahkan DNS domain ke IP VPS ini."
warn "  2. Terbitkan SSL: docker exec -it certbot_auto_renew certbot certonly --webroot -w /var/www/certbot -d DOMAINKAMU"
warn "     lalu buat vhost di 00-gateway/nginx/conf.d/ dan reload gateway."
warn "  3. WhatsApp gateway butuh scan ulang QR (sesi lama sudah tidak valid)."
warn "  4. Isi kredensial rclone di $BASE_DIR/scripts/.env lalu atur cron backup."
warn "  5. Amankan SSH: ganti password root & pakai SSH key, matikan login password."
