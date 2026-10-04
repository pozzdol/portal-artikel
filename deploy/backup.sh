#!/usr/bin/env bash
# ALMAIDAH daily backup: database dump (pg_dump custom format) + uploads/ archive.
# Reads DATABASE_URL from backend/.env; never echoes or logs the secret itself.
#
# Usage:
#   deploy/backup.sh [backup-dir]      # default backup-dir: /opt/portal-berita/backups
#
# Cron example (03:15 every day, retain 14 days worth):
#   15 3 * * * /opt/portal-berita/deploy/backup.sh >> /var/log/almaidah-backup.log 2>&1
#
# Store the resulting files outside this server too (rsync/rclone to another
# host or object storage) — a local-only backup does not survive disk/host loss.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${REPO_DIR}/backend/.env"
BACKUP_DIR="${1:-${REPO_DIR}/backups}"
RETENTION_DAYS=14
STAMP="$(date +%Y%m%d-%H%M)"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "backup.sh: ${ENV_FILE} not found" >&2
  exit 1
fi

# Read DATABASE_URL without sourcing the whole file (avoids executing
# arbitrary content) and without ever printing it.
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -n1 | cut -d= -f2-)"
if [[ -z "$DATABASE_URL" ]]; then
  echo "backup.sh: DATABASE_URL is empty in ${ENV_FILE}" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

DB_DUMP="${BACKUP_DIR}/db-${STAMP}.dump"
UPLOADS_TGZ="${BACKUP_DIR}/uploads-${STAMP}.tgz"

echo "[$(date -Iseconds)] dumping database -> ${DB_DUMP}"
pg_dump -Fc "$DATABASE_URL" > "$DB_DUMP"

echo "[$(date -Iseconds)] archiving uploads -> ${UPLOADS_TGZ}"
tar -czf "$UPLOADS_TGZ" -C "${REPO_DIR}/backend" uploads

echo "[$(date -Iseconds)] pruning backups older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'uploads-*.tgz' \) \
  -mtime "+${RETENTION_DAYS}" -print -delete

echo "[$(date -Iseconds)] backup done: ${DB_DUMP} ${UPLOADS_TGZ}"
