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
  # Fetch eksplisit per-branch: clone lama bersifat --single-branch
  # (hanya melacak branch lama), jadi "fetch origin" polos akan gagal.
  git -C "$BASE_DIR" fetch origin "$BRANCH"
  # Fetch eksplisit menyimpan di FETCH_HEAD (bukan origin/<branch>),
  # jadi reset+checkout pakai FETCH_HEAD agar jalan di clone single-branch.
  git -C "$BASE_DIR" reset --hard FETCH_HEAD
  git -C "$BASE_DIR" checkout -B "$BRANCH"
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

if [ ! -f "$BASE_DIR/03-services/.env" ]; then
  log "Generate password dashboard 9Router ..."
  cat > "$BASE_DIR/03-services/.env" <<EOF
NINEROUTER_PASSWORD=$(gen_pass)
EOF
  chmod 600 "$BASE_DIR/03-services/.env"
elif ! grep -q '^NINEROUTER_PASSWORD=' "$BASE_DIR/03-services/.env"; then
  log "Menambah NINEROUTER_PASSWORD ke 03-services/.env ..."
  echo "NINEROUTER_PASSWORD=$(gen_pass)" >> "$BASE_DIR/03-services/.env"
else
  log "03-services/.env sudah ada, tidak di-generate ulang."
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

# --- SSL Let's Encrypt untuk ridhoreynaldo.com (diterbitkan sekali saja) ---
LE_LIVE="$BASE_DIR/00-gateway/letsencrypt/live/ridhoreynaldo.com"
if [ ! -f "$LE_LIVE/fullchain.pem" ]; then
  VPS_IPv4=$(curl -4 -fsSL --max-time 5 ifconfig.me 2>/dev/null || true)
  DOMAIN_IP=$(getent hosts ridhoreynaldo.com 2>/dev/null | awk '{print $1}' | grep -E '^[0-9]{1,3}\.' | head -1)
  if [ -n "$VPS_IPv4" ] && [ "$DOMAIN_IP" = "$VPS_IPv4" ]; then
    log "Menerbitkan sertifikat Let's Encrypt untuk ridhoreynaldo.com ..."
    docker stop global_gateway 2>/dev/null || true
    if [ -n "${CERTBOT_EMAIL:-}" ]; then EMAIL_ARG="--email ${CERTBOT_EMAIL}"; else EMAIL_ARG="--register-unsafely-without-email"; fi
    # shellcheck disable=SC2086
    if docker run --rm -p 80:80 -v "$BASE_DIR/00-gateway/letsencrypt:/etc/letsencrypt" \
      certbot/certbot:v2.11.0 certonly --standalone \
      -d ridhoreynaldo.com -d www.ridhoreynaldo.com \
      --non-interactive --agree-tos $EMAIL_ARG; then
      log "Sertifikat Let's Encrypt terbit."
    else
      warn "Gagal menerbitkan sertifikat — lanjut tanpa HTTPS (pastikan DNS & port 80 terbuka)."
    fi
  else
    warn "ridhoreynaldo.com belum mengarah ke IP VPS ini — lewati penerbitan SSL."
  fi
else
  log "Sertifikat Let's Encrypt sudah ada."
fi

# Pasang vhost HTTPS hanya bila sertifikat tersedia (agar nginx -t tidak gagal)
SSL_CONF="$BASE_DIR/00-gateway/nginx/conf.d/ridhoreynaldo-com-ssl.conf"
if [ -f "$LE_LIVE/fullchain.pem" ]; then
  cp "$BASE_DIR/00-gateway/nginx/ridhoreynaldo-com-ssl.conf.template" "$SSL_CONF"
  log "Vhost HTTPS ridhoreynaldo.com dipasang."
else
  rm -f "$SSL_CONF"
fi

docker compose -f "$BASE_DIR/00-gateway/docker-compose.yml" up -d --force-recreate
docker exec global_gateway nginx -t
docker exec global_gateway nginx -s reload || true

# Cron harian: reload nginx agar sertifikat hasil auto-renew langsung terpakai
if command -v crontab >/dev/null 2>&1; then
  if ! crontab -l 2>/dev/null | grep -q "global_gateway nginx -s reload"; then
    (crontab -l 2>/dev/null; echo "17 3 * * * docker exec global_gateway nginx -s reload >/dev/null 2>&1 || true") | crontab -
    log "Cron reload nginx harian dipasang."
  fi
fi

# ----------------------------------------------------------
# ----------------------------------------------------------
# 5b. Layer 5: aplikasi (04-apps) — clone repo + deploy
# ----------------------------------------------------------
log "== Layer 5: apps =="
APPS_DIR="$BASE_DIR/04-apps"
mkdir -p "$APPS_DIR"
if [ ! -d "$APPS_DIR/portfolio/.git" ]; then
  log "Clone repo portfolio ..."
  git clone --depth 1 https://github.com/ridhoreynaldo/portfolio "$APPS_DIR/portfolio" \
    || warn "Repo portfolio belum tersedia — lewati deploy aplikasi."
else
  git -C "$APPS_DIR/portfolio" fetch --depth 1 origin main 2>/dev/null \
    && git -C "$APPS_DIR/portfolio" reset --hard FETCH_HEAD \
    || warn "Gagal update repo portfolio — pakai versi lokal."
fi

# .env untuk 04-apps (sekali saja): kredensial diambil dari 01-infra/.env
if [ ! -f "$APPS_DIR/.env" ]; then
  log "Generate 04-apps/.env ..."
  PG_SUPER_PASS=$(grep '^POSTGRES_PASSWORD=' "$BASE_DIR/01-infra/.env" 2>/dev/null | cut -d= -f2-)
  cat > "$APPS_DIR/.env" <<EOF
PGHOST=infra_pgbouncer
PGPORT=5432
PGUSER=postgres
PGPASSWORD=$PG_SUPER_PASS
PGDATABASE=portfolio
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_EMAIL=admin@local
ADMIN_PASSWORD=$(gen_pass)
PORTFOLIO_PORT=3002
EOF
  chmod 600 "$APPS_DIR/.env"
else
  log "04-apps/.env sudah ada, tidak di-generate ulang."
fi

# Pastikan database portfolio ada (PgBouncer wildcard hanya routing)
if [ -d "$APPS_DIR/portfolio/.git" ]; then
  PG_SUPER_PASS=$(grep '^POSTGRES_PASSWORD=' "$BASE_DIR/01-infra/.env" 2>/dev/null | cut -d= -f2-)
  if ! docker exec -e PGPASSWORD="$PG_SUPER_PASS" infra_postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='portfolio'" 2>/dev/null | grep -q 1; then
    log "Membuat database portfolio ..."
    docker exec -e PGPASSWORD="$PG_SUPER_PASS" infra_postgres psql -U postgres -c "CREATE DATABASE portfolio" \
      || warn "Gagal membuat database portfolio."
  fi
  log "Deploy portfolio ..."
  docker compose -f "$APPS_DIR/docker-compose.yml" up -d --build \
    || warn "Gagal deploy portfolio."
else
  warn "Folder $APPS_DIR/portfolio tidak ada — lewati deploy aplikasi."
fi

# 6. Firewall (bila UFW aktif) + ringkasan
# ----------------------------------------------------------
if [ "${PUBLIC_PORTS:-0}" = "1" ] && command -v ufw >/dev/null 2>&1 \
   && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 80,443,3002,5432,1433,3000,3001,5000,5001,9000,20128/tcp
  log "Port service dibuka di UFW."
fi

log "Selesai! Status container:"
docker ps --format '  {{.Names}}  {{.Status}}' | sort

echo ""
if [ "${PUBLIC_PORTS:-0}" = "1" ]; then
  PUB_IP=$(curl -4 -fsSL --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
  log "Akses layanan:"
  log "  - WA dashboard : http://$PUB_IP:5001"
  log "  - WA API       : http://$PUB_IP:5000"
  log "  - Portainer    : http://$PUB_IP:9000"
  log "  - Grafana      : http://$PUB_IP:3000"
  log "  - Uptime Kuma  : http://$PUB_IP:3001"
  log "  - 9Router AI   : http://$PUB_IP:20128"
  log "  - Portfolio    : http://$PUB_IP:3002"
  echo ""
fi
if [ -f "$BASE_DIR/00-gateway/letsencrypt/live/ridhoreynaldo.com/fullchain.pem" ]; then
  log "Web (HTTPS): https://ridhoreynaldo.com"
fi
PORTFOLIO_ADMIN_PASS=$(grep '^ADMIN_PASSWORD=' "$BASE_DIR/04-apps/.env" 2>/dev/null | cut -d= -f2-)
[ -n "$PORTFOLIO_ADMIN_PASS" ] && log "Login Portfolio admin@local: $PORTFOLIO_ADMIN_PASS"
NINEROUTER_PASS=$(grep '^NINEROUTER_PASSWORD=' "$BASE_DIR/03-services/.env" 2>/dev/null | cut -d= -f2-)
[ -n "$NINEROUTER_PASS" ] && log "Password dashboard 9Router: $NINEROUTER_PASS"
warn "Langkah manual berikutnya:"
warn "  1. WhatsApp gateway butuh scan ulang QR (sesi lama sudah tidak valid)."
warn "  2. Isi kredensial rclone di $BASE_DIR/scripts/.env lalu atur cron backup."
warn "  3. Amankan SSH: ganti password root & pakai SSH key, matikan login password."
