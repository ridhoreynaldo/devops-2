#!/bin/bash
# Backup SQL Server (semua database terdaftar) -> folder tanggal -> cleanup >7 hari.
# Password diambil dari 01-infra/.env (TIDAK hardcode di script ini).
# Jalankan via cron, contoh tiap jam 2 pagi:
#   0 2 * * * /opt/devops-2/scripts/backup-sqlserver.sh
# chmod +x scripts/backup-sqlserver.sh

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
set -u

# ==========================================
# KONFIGURASI
# ==========================================
BASE_DIR="${BASE_DIR:-/opt/devops-2}"
CONTAINER="infra_sqlserver"
USER="sa"

# Ambil password dari .env layer infra (sumber tunggal, tidak di-commit)
if [ -f "$BASE_DIR/01-infra/.env" ]; then
  # shellcheck disable=SC1090
  set -a; . "$BASE_DIR/01-infra/.env"; set +a
fi
PASSWORD="${MSSQL_SA_PASSWORD:?MSSQL_SA_PASSWORD belum diisi di 01-infra/.env}"

# Format Tanggal (DD-MM-YYYY)
DATE=$(date +%d-%m-%Y)

# Path di Host
HOST_BACKUP_DIR="$BASE_DIR/01-infra/backup/sqlserver/$DATE"
LOG_DIR="$BASE_DIR/scripts/logs"
LOG_FILE="$LOG_DIR/backup.log"

# Path di dalam Container (sesuai volume di docker-compose.yml)
CONTAINER_BACKUP_DIR="/var/opt/mssql/backup/$DATE"

DATABASES=(
  "dbAsrama"
  "dbAsramaPutra"
  "dbAsetKhusus"
  "dbAsetV2"
  "dbAsset"
)

# ==========================================
# PERSIAPAN FOLDER & LOG
# ==========================================
mkdir -p "$LOG_DIR"
echo "===== CRON START $(date) =====" >> "$LOG_FILE"

# Folder tanggal di Host otomatis terbaca di container via volume mapping.
mkdir -p "$HOST_BACKUP_DIR"
chmod 777 "$HOST_BACKUP_DIR" # Memastikan SQL Server di container punya hak tulis

# ==========================================
# PROSES BACKUP
# ==========================================
for DB in "${DATABASES[@]}"
do
  FILE_NAME="${DB}.bak"
  echo "Backing up $DB to $CONTAINER_BACKUP_DIR/$FILE_NAME ..." >> "$LOG_FILE"

  OUTPUT=$(docker exec "$CONTAINER" /opt/mssql-tools18/bin/sqlcmd \
    -S localhost \
    -U "$USER" \
    -P "$PASSWORD" \
    -C \
    -Q "BACKUP DATABASE [$DB] TO DISK = '$CONTAINER_BACKUP_DIR/$FILE_NAME' WITH INIT" 2>&1)

  if [[ $OUTPUT == *"error"* ]] || [[ $OUTPUT == *"abnormally"* ]]; then
    echo "FAIL: $DB" >> "$LOG_FILE"
    echo "Error Detail: $OUTPUT" >> "$LOG_FILE"
  else
    echo "OK: $DB" >> "$LOG_FILE"
  fi
done

# ==========================================
# CLEANUP (Hapus backup lebih dari 7 hari)
# ==========================================
echo "Cleaning old backups (older than 7 days)..." >> "$LOG_FILE"

BASE_HOST_DIR="$BASE_DIR/01-infra/backup/sqlserver"

if [ -d "$BASE_HOST_DIR" ]; then
  find "$BASE_HOST_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;
  echo "Cleanup done" >> "$LOG_FILE"
else
  echo "Cleanup skipped: Base directory not found" >> "$LOG_FILE"
fi

echo "===== CRON END =====" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
