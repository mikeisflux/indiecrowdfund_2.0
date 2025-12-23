#!/bin/bash
#
# IndieCrowdFund Daily Backup Script
# Backs up PostgreSQL database and site files to /root/backups
#
# Usage: ./backup.sh
# Cron: 0 2 * * * /path/to/backup.sh >> /root/backups/backup.log 2>&1
#

set -e

# Configuration
BACKUP_DIR="/root/backups"
SITE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
RETENTION_DAYS=7

# Create dated backup directory
BACKUP_PATH="${BACKUP_DIR}/${DATE}"
mkdir -p "${BACKUP_PATH}"

echo "========================================"
echo "Backup started at $(date)"
echo "========================================"

# Load environment variables from .env file if it exists
if [ -f "${SITE_DIR}/.env" ]; then
    export $(grep -v '^#' "${SITE_DIR}/.env" | grep DATABASE_URL | xargs)
fi

# ============================================
# DATABASE BACKUP
# ============================================
echo ""
echo "[1/3] Backing up PostgreSQL database..."

if [ -n "$DATABASE_URL" ]; then
    # Parse DATABASE_URL
    # Format: postgresql://user:password@host:port/database
    DB_FILE="${BACKUP_PATH}/database.sql.gz"

    # Use pg_dump with the DATABASE_URL
    PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    PGUSER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    PGHOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:\/]*\).*/\1/p')
    PGPORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    PGDATABASE=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

    # Set default port if not specified
    PGPORT=${PGPORT:-5432}

    echo "  Database: ${PGDATABASE}@${PGHOST}:${PGPORT}"

    PGPASSWORD="${PGPASSWORD}" pg_dump \
        -h "${PGHOST}" \
        -p "${PGPORT}" \
        -U "${PGUSER}" \
        -d "${PGDATABASE}" \
        --no-owner \
        --no-acl \
        2>/dev/null | gzip > "${DB_FILE}"

    DB_SIZE=$(du -h "${DB_FILE}" | cut -f1)
    echo "  Database backup complete: ${DB_SIZE}"
else
    echo "  WARNING: DATABASE_URL not found, skipping database backup"
fi

# ============================================
# SITE FILES BACKUP
# ============================================
echo ""
echo "[2/3] Backing up site files..."

SITE_FILE="${BACKUP_PATH}/site.tar.gz"

# Exclude node_modules, .next, and other unnecessary directories
tar -czf "${SITE_FILE}" \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.next-backup-*' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='.turbo' \
    --exclude='coverage' \
    -C "$(dirname ${SITE_DIR})" \
    "$(basename ${SITE_DIR})" \
    2>/dev/null

SITE_SIZE=$(du -h "${SITE_FILE}" | cut -f1)
echo "  Site backup complete: ${SITE_SIZE}"

# ============================================
# UPLOADS BACKUP (if separate)
# ============================================
echo ""
echo "[3/3] Backing up uploads..."

UPLOADS_DIR="${SITE_DIR}/uploads"
if [ -d "${UPLOADS_DIR}" ]; then
    UPLOADS_FILE="${BACKUP_PATH}/uploads.tar.gz"
    tar -czf "${UPLOADS_FILE}" \
        -C "${SITE_DIR}" \
        "uploads" \
        2>/dev/null || true

    if [ -f "${UPLOADS_FILE}" ]; then
        UPLOADS_SIZE=$(du -h "${UPLOADS_FILE}" | cut -f1)
        echo "  Uploads backup complete: ${UPLOADS_SIZE}"
    fi
else
    echo "  No uploads directory found, skipping"
fi

# Also backup public/uploads if it exists
PUBLIC_UPLOADS_DIR="${SITE_DIR}/public/uploads"
if [ -d "${PUBLIC_UPLOADS_DIR}" ]; then
    PUBLIC_UPLOADS_FILE="${BACKUP_PATH}/public-uploads.tar.gz"
    tar -czf "${PUBLIC_UPLOADS_FILE}" \
        -C "${SITE_DIR}/public" \
        "uploads" \
        2>/dev/null || true

    if [ -f "${PUBLIC_UPLOADS_FILE}" ]; then
        PUBLIC_UPLOADS_SIZE=$(du -h "${PUBLIC_UPLOADS_FILE}" | cut -f1)
        echo "  Public uploads backup complete: ${PUBLIC_UPLOADS_SIZE}"
    fi
fi

# ============================================
# CLEANUP OLD BACKUPS
# ============================================
echo ""
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."

# Find and remove old backup directories
DELETED_COUNT=0
for old_backup in $(find "${BACKUP_DIR}" -maxdepth 1 -type d -mtime +${RETENTION_DAYS} -name "20*"); do
    echo "  Removing: $(basename ${old_backup})"
    rm -rf "${old_backup}"
    ((DELETED_COUNT++)) || true
done

if [ ${DELETED_COUNT} -eq 0 ]; then
    echo "  No old backups to remove"
else
    echo "  Removed ${DELETED_COUNT} old backup(s)"
fi

# ============================================
# SUMMARY
# ============================================
echo ""
echo "========================================"
echo "Backup completed at $(date)"
echo "========================================"
echo ""
echo "Backup location: ${BACKUP_PATH}"
echo "Contents:"
ls -lh "${BACKUP_PATH}"
echo ""

TOTAL_SIZE=$(du -sh "${BACKUP_PATH}" | cut -f1)
echo "Total backup size: ${TOTAL_SIZE}"

# Calculate disk space
DISK_USAGE=$(df -h "${BACKUP_DIR}" | tail -1 | awk '{print $5}')
DISK_AVAIL=$(df -h "${BACKUP_DIR}" | tail -1 | awk '{print $4}')
echo "Disk usage: ${DISK_USAGE} (${DISK_AVAIL} available)"
echo ""
