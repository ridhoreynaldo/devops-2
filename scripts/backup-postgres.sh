#!/bin/bash
# Backup PostgreSQL (pg_dumpall, format custom + gzip) -> folder tanggal -> cleanup >7 hari.
# Password diambil dari 01-infra/.env (TIDAK hardcode di script ini).
# Jalankan via cron, contoh tiap jam 2:30 pagi:
#   30 2 * * * /opt/devops-2/scripts/backup-postgres.sh
# chmod +x scripts/backup-postgres.sh

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
set -u

# ==========================================
# KONFIGURASI
# ==========================================
BASE_DIR="${BASE_DIR:-/opt/devops-2}"
CONTAINER="infra_postgres"
USER="postgres"

# Ambil password dari .env layer infra (sumber tunggal, tidak di-commit)
if [ -f "$BASE_DIR/01-infra/.env" ]; then
  # shellcheck disable=SC1090
  set -a; . "$BASE_DIR/01-infra/.env"; set +a
fi
export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD belum diisi di 01-infra/.env}"

# Format Tanggal (DD-MM-YYYY)
DATE=$(date +%d-%m-%Y)

# Path di Host
HOST_BACKUP_DIR="$BASE_DIR/01-infra/backup/postgresql/$DATE"
LOG_DIR="$BASE_DIR/scripts/logs"
LOG_FILE="$LOG_DIR/backup.log"

# Path di dalam Container (sesuai volume di docker-compose.yml)
CONTAINER_BACKUP_DIR="/var/opt/postgresql/backup/$DATE"

# ==========================================
# PERSIAPAN FOLDER & LOG
# ==========================================
mkdir -p "$LOG_DIR"
echo "===== PG CRON START $(date) =====" >> "$LOG_FILE"

mkdir -p "$HOST_BACKUP_DIR"
chmod 777 "$HOST_BACKUP_DIR"

# ==========================================
# PROSES BACKUP (pg_dumpall -> gzip)
# ==========================================
FILE_NAME="pg_dumpall-$DATE.sql.gz"
echo "Backing up all postgres databases to $CONTAINER_BACKUP_DIR/$FILE_NAME ..." >> "$LOG_FILE"

if docker exec "$CONTAINER" sh -c "mkdir -p '$CONTAINER_BACKUP_DIR' && pg_dumpall -U '$USER' | gzip > '$CONTAINER_BACKUP_DIR/$FILE_NAME'" 2>>"$LOG_FILE"; then
  SIZE=$(du -h "$HOST_BACKUP_DIR/$FILE_NAME" 2>/dev/null | cut -f1)
  echo "OK: pg_dumpall ($SIZE)" >> "$LOG_FILE"
else
  echo "FAIL: pg_dumpall, lihat log di atas" >> "$LOG_FILE"
fi

# ==========================================
# CLEANUP (Hapus backup lebih dari 7 hari)
# ==========================================
echo "Cleaning old backups (older than 7 days)..." >> "$LOG_FILE"

BASE_HOST_DIR="$BASE_DIR/01-infra/backup/postgresql"

if [ -d "$BASE_HOST_DIR" ]; then
  find "$BASE_HOST_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;
  echo "Cleanup done" >> "$LOG_FILE"
else
  echo "Cleanup skipped: Base directory not found" >> "$LOG_FILE"
fi

echo "===== PG CRON END =====" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
