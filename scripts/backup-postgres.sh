#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-production.env}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${KEEP:-7}"

mkdir -p "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/fastrouteco_${STAMP}.sql.gz"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U postgres -d fastrouteco | gzip > "$FILE"

ls -1t "$BACKUP_DIR"/fastrouteco_*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
  rm -f "$old"
done

echo "Backup written to $FILE"
