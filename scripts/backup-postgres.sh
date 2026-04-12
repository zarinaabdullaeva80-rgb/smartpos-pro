#!/bin/bash
# PostgreSQL Automatic Backup Script
# Run via cron: 0 2 * * * /path/to/backup-postgres.sh

# Configuration
DB_NAME="${DB_NAME:-accounting_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${DATE}.sql.gz"

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup of database: $DB_NAME"

# Create compressed backup
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "[$(date)] Backup successful: $BACKUP_FILE"
    
    # Get backup size
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] Backup size: $SIZE"
    
    # Delete old backups
    echo "[$(date)] Cleaning up backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
    
    # Count remaining backups
    COUNT=$(ls -1 "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | wc -l)
    echo "[$(date)] Total backups: $COUNT"
else
    echo "[$(date)] ERROR: Backup failed!"
    exit 1
fi

echo "[$(date)] Backup completed successfully"
