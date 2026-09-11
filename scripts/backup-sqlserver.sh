#!/bin/bash
# chmod +x /opt/devops/scripts/backup-sqlserver.sh

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# ==========================================
# KONFIGURASI
# ==========================================
CONTAINER="infra_sqlserver"
USER="sa"
PASSWORD="LontongKacang1337!!"

# Format Tanggal (DD-MM-YYYY)
DATE=$(date +%d-%m-%Y)

# Path di Host (Ubuntu)
HOST_BACKUP_DIR="/opt/devops/01-infra/backup/sqlserver/$DATE"
LOG_DIR="/opt/devops/scripts/logs"
LOG_FILE="$LOG_DIR/backup.log"

# Path di dalam Container (Sesuai volume di docker-compose.yml)
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

# Buat folder tanggal di Host. 
# Karena sudah di-mapping di docker-compose, folder ini otomatis terbaca di dalam container.
mkdir -p "$HOST_BACKUP_DIR"
chmod 777 "$HOST_BACKUP_DIR" # Memastikan SQL Server di container punya hak tulis

# ==========================================
# PROSES BACKUP
# ==========================================
for DB in "${DATABASES[@]}"
do
  FILE_NAME="${DB}.bak"
  echo "Backing up $DB to $CONTAINER_BACKUP_DIR/$FILE_NAME ..." >> "$LOG_FILE"

  # Eksekusi sqlcmd langsung ke folder hasil mapping
  OUTPUT=$(docker exec $CONTAINER /opt/mssql-tools18/bin/sqlcmd \
    -S localhost \
    -U $USER \
    -P "$PASSWORD" \
    -C \
    -Q "BACKUP DATABASE [$DB] TO DISK = '$CONTAINER_BACKUP_DIR/$FILE_NAME' WITH INIT" 2>&1)

  # Pengecekan status
  if [[ $OUTPUT == *"error"* ]] || [[ $OUTPUT == *"abnormally"* ]]; then
    echo "✖ $DB FAILED" >> "$LOG_FILE"
    echo "Error Detail: $OUTPUT" >> "$LOG_FILE"
  else
    echo "✔ $DB SUCCESS" >> "$LOG_FILE"
  fi
done

# ==========================================
# CLEANUP (Hapus backup lebih dari 7 hari)
# ==========================================
echo "Cleaning old backups (older than 7 days)..." >> "$LOG_FILE"

BASE_HOST_DIR="/opt/devops/01-infra/backup/sqlserver"

if [ -d "$BASE_HOST_DIR" ]; then
  find "$BASE_HOST_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;
  echo "✔ Cleanup done" >> "$LOG_FILE"
else
  echo "✖ Cleanup skipped: Base directory not found" >> "$LOG_FILE"
fi

echo "===== CRON END =====" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"