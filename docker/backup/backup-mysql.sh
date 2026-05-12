#!/bin/bash
# ============================================================
# HRMS Narwasthu Group - Automated MySQL Backup to Nextcloud
# ============================================================
# This script:
#   1. Dumps MySQL database from Docker container
#   2. Compresses it with gzip
#   3. Uploads to Nextcloud via WebDAV
#   4. Cleans up local backups older than 7 days
#   5. Cleans up remote backups older than 30 days
# ============================================================

set -euo pipefail

# ── Configuration ────────────────────────────────────────────
CONTAINER_NAME="hrms-mysql-master"
DB_NAME="hrm_saas"
DB_USER="hrms_user"
DB_PASS="OnTimeNarwastugo2026"

# Nextcloud WebDAV Configuration
NEXTCLOUD_URL="https://cloud.jelantik.com/remote.php/dav/files/casaos/BACKUP%20SQL%20DATA%20BASE%20ONTIME-HRMS"
NEXTCLOUD_USER="casaos"
NEXTCLOUD_PASS="casaos"

# Local backup directory (inside the project)
BACKUP_DIR="/home/hrms/backups/mysql"
LOCAL_RETENTION_DAYS=7
REMOTE_RETENTION_DAYS=30

# ── Derived Variables ────────────────────────────────────────
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
DAY_OF_WEEK=$(date +"%A")
FILENAME="hrms_backup_${TIMESTAMP}.sql.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"

# ── Functions ────────────────────────────────────────────────
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

send_notification() {
    # Optional: Send notification on failure via curl to a webhook
    # Uncomment and configure if needed
    # curl -s -X POST "https://your-webhook-url" -d "{\"text\":\"$1\"}" > /dev/null 2>&1
    :
}

# ── Main Script ──────────────────────────────────────────────
log "========================================="
log "  MySQL Backup Started"
log "========================================="

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Step 1: Dump MySQL database
log "[1/4] Dumping database '${DB_NAME}' from container '${CONTAINER_NAME}'..."
if docker exec "$CONTAINER_NAME" mysqldump \
    -u"$DB_USER" \
    -p"$DB_PASS" \
    --single-transaction \
    --no-tablespaces \
    --skip-lock-tables \
    --quick \
    "$DB_NAME" 2>/dev/null | gzip > "${BACKUP_DIR}/${FILENAME}"; then
    
    FILESIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
    log "    ✓ Dump successful: ${FILENAME} (${FILESIZE})"
else
    log "    ✗ ERROR: MySQL dump failed!"
    send_notification "❌ HRMS Backup FAILED: MySQL dump error at ${TIMESTAMP}"
    exit 1
fi

# Step 2: Verify the backup is not empty/corrupt
FILESIZE_BYTES=$(stat -c%s "${BACKUP_DIR}/${FILENAME}" 2>/dev/null || stat -f%z "${BACKUP_DIR}/${FILENAME}" 2>/dev/null)
if [ "$FILESIZE_BYTES" -lt 1000 ]; then
    log "    ✗ ERROR: Backup file too small (${FILESIZE_BYTES} bytes). Possibly corrupt."
    rm -f "${BACKUP_DIR}/${FILENAME}"
    send_notification "❌ HRMS Backup FAILED: File too small at ${TIMESTAMP}"
    exit 1
fi
log "[2/4] Backup verified: ${FILESIZE_BYTES} bytes ✓"

# Step 3: Upload to Nextcloud via WebDAV
log "[3/4] Uploading to Nextcloud..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -u "${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}" \
    -T "${BACKUP_DIR}/${FILENAME}" \
    "${NEXTCLOUD_URL}/${FILENAME}" \
    --connect-timeout 30 \
    --max-time 300)

if [ "$HTTP_CODE" -eq 201 ] || [ "$HTTP_CODE" -eq 204 ]; then
    log "    ✓ Upload successful (HTTP ${HTTP_CODE})"
else
    log "    ✗ Upload failed (HTTP ${HTTP_CODE})"
    send_notification "❌ HRMS Backup: Upload to Nextcloud failed (HTTP ${HTTP_CODE}) at ${TIMESTAMP}"
    # Don't exit — keep local backup even if upload fails
fi

# Step 4: Cleanup old local backups
log "[4/4] Cleaning up local backups older than ${LOCAL_RETENTION_DAYS} days..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "hrms_backup_*.sql.gz" -mtime +${LOCAL_RETENTION_DAYS} -print -delete | wc -l)
log "    ✓ Deleted ${DELETED_COUNT} old local backup(s)"

# Step 5: Cleanup old remote backups (older than 30 days)
log "    Cleaning up remote backups older than ${REMOTE_RETENTION_DAYS} days..."
CUTOFF_DATE=$(date -d "-${REMOTE_RETENTION_DAYS} days" +"%Y-%m-%d" 2>/dev/null || date -v-${REMOTE_RETENTION_DAYS}d +"%Y-%m-%d" 2>/dev/null)
if [ -n "$CUTOFF_DATE" ]; then
    # List remote files via PROPFIND
    REMOTE_FILES=$(curl -s -u "${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}" \
        -X PROPFIND \
        -H "Depth: 1" \
        "${NEXTCLOUD_URL}/" 2>/dev/null | grep -oP 'hrms_backup_[^<]+\.sql\.gz' || true)
    
    for REMOTE_FILE in $REMOTE_FILES; do
        # Extract date from filename: hrms_backup_YYYY-MM-DD_HH-MM-SS.sql.gz
        FILE_DATE=$(echo "$REMOTE_FILE" | grep -oP '\d{4}-\d{2}-\d{2}' | head -1)
        if [ -n "$FILE_DATE" ] && [[ "$FILE_DATE" < "$CUTOFF_DATE" ]]; then
            curl -s -u "${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}" \
                -X DELETE \
                "${NEXTCLOUD_URL}/${REMOTE_FILE}" > /dev/null 2>&1
            log "    Deleted remote: ${REMOTE_FILE}"
        fi
    done
fi

log "========================================="
log "  Backup Complete! ✅"
log "========================================="
log ""
