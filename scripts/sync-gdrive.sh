#!/bin/bash

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

LOG_FILE="/opt/devops/scripts/logs/rclone.log"

echo "===== RCLONE SYNC START $(date) =====" >> "$LOG_FILE"

docker run --rm \
  -v /opt/devops/01-infra/backup:/data/backup:ro \
  rclone/rclone:latest \
  sync /data/backup :drive:BackupRR/database \
  --drive-client-id="680186237864-gfpufjgmrv3fpuh3sc5qk5oc4aasco8i.apps.googleusercontent.com" \
  --drive-client-secret="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" \
  --drive-token='{"access_token":"","token_type":"Bearer","refresh_token":"1//04vibXciBrRsgCgYIARAAGAQSNwF-L9Irn8sAQ94IBsTHPAxU4sRNZ-eAQ9FFg_oJJbq1_fA1tVmy0ylHFWGAQCvf4LEQEs-S1nQ"}' \
  -v >> "$LOG_FILE" 2>&1

echo "===== RCLONE SYNC END =====" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"