#!/bin/bash
# Sinkronisasi folder backup ke Google Drive via rclone (docker, tanpa install).
# Kredensial Google diambil dari scripts/.env (TIDAK hardcode di script ini).
# Jalankan via cron SETELAH backup selesai, contoh jam 4 pagi:
#   0 4 * * * /opt/devops-2/scripts/sync-gdrive.sh
# chmod +x scripts/sync-gdrive.sh

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
set -u

BASE_DIR="${BASE_DIR:-/opt/devops-2}"

# Ambil kredensial rclone dari scripts/.env (tidak di-commit)
if [ -f "$BASE_DIR/scripts/.env" ]; then
  # shellcheck disable=SC1090
  set -a; . "$BASE_DIR/scripts/.env"; set +a
fi

: "${RCLONE_DRIVE_CLIENT_ID:?RCLONE_DRIVE_CLIENT_ID belum diisi di scripts/.env}"
: "${RCLONE_DRIVE_CLIENT_SECRET:?RCLONE_DRIVE_CLIENT_SECRET belum diisi di scripts/.env}"
: "${RCLONE_DRIVE_TOKEN:?RCLONE_DRIVE_TOKEN belum diisi di scripts/.env}"

LOG_DIR="$BASE_DIR/scripts/logs"
LOG_FILE="$LOG_DIR/rclone.log"
mkdir -p "$LOG_DIR"

echo "===== RCLONE SYNC START $(date) =====" >> "$LOG_FILE"

docker run --rm \
  -v "$BASE_DIR/01-infra/backup:/data/backup:ro" \
  rclone/rclone:1.71 \
  sync /data/backup :drive:BackupRR/database \
  --drive-client-id="$RCLONE_DRIVE_CLIENT_ID" \
  --drive-client-secret="$RCLONE_DRIVE_CLIENT_SECRET" \
  --drive-token="$RCLONE_DRIVE_TOKEN" \
  -v >> "$LOG_FILE" 2>&1

echo "===== RCLONE SYNC END (exit=$?) =====" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
