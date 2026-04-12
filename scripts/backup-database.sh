#!/bin/bash

# Database Backup Script for 1C Accounting System
# Usage: ./backup-database.sh [backup_name]

set -e

# Configuration
DB_NAME="${DATABASE_NAME:-accounting_db}"
DB_USER="${DATABASE_USER:-postgres}"
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Generate backup filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="${1:-backup_${TIMESTAMP}}"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.sql.gz"

echo "🔄 Starting database backup..."
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "Backup file: $BACKUP_FILE"

# Create backup
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-acl \
    -F c \
    -f "${BACKUP_DIR}/${BACKUP_NAME}.dump"

# Compress
gzip -f "${BACKUP_DIR}/${BACKUP_NAME}.dump"
mv "${BACKUP_DIR}/${BACKUP_NAME}.dump.gz" "$BACKUP_FILE"

# Calculate size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo "✅ Backup completed successfully!"
echo "   File: $BACKUP_FILE"
echo "   Size: $BACKUP_SIZE"

# Create metadata file
cat > "${BACKUP_FILE}.meta" << EOF
{
  "database": "$DB_NAME",
  "host": "$DB_HOST",
  "timestamp": "$TIMESTAMP",
  "size": "$BACKUP_SIZE",
  "retention_days": $RETENTION_DAYS
}
EOF

# Cleanup old backups
echo "🧹 Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "backup_*.sql.gz.meta" -type f -mtime +$RETENTION_DAYS -delete

echo "✅ Backup process completed!"
