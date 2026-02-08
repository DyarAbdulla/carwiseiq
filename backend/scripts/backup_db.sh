#!/bin/bash
# Backup SQLite users.db (and optionally other DBs) with timestamp.
# Usage: ./scripts/backup_db.sh [backup_dir]
# Default backup_dir: backend/backups

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${1:-$BACKEND_DIR/backups}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ -f "$BACKEND_DIR/users.db" ]; then
  cp "$BACKEND_DIR/users.db" "$BACKUP_DIR/users_$TIMESTAMP.db"
  echo "Backed up users.db to $BACKUP_DIR/users_$TIMESTAMP.db"
fi

# Optional: backup other db files in backend
for f in "$BACKEND_DIR"/*.db; do
  [ -f "$f" ] || continue
  name=$(basename "$f" .db)
  [ "$name" = "users" ] && continue
  cp "$f" "$BACKUP_DIR/${name}_$TIMESTAMP.db"
  echo "Backed up $f to $BACKUP_DIR/${name}_$TIMESTAMP.db"
done

echo "Backup done."
