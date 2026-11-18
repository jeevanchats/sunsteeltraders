#!/usr/bin/env bash
# Nightly backup of the Sun Steel database and uploaded files, kept for 14 days.
# deploy.sh installs this as /usr/local/sbin/sunsteel-backup.sh and /etc/cron.d/sunsteel-backup runs it at 02:30.
#   DB:     mysqldump of `sunsteel` (single transaction, so the site stays up)
#   Files:  media library (uploads) and customer drawings (lead-files)
# Backups hold customer data, so the folder is root-only. Restore steps: deploy/README.md.
set -euo pipefail
umask 077
D=/var/backups/sunsteel
R=/var/www/sunsteel
KEEP_DAYS=14
TS=$(date +%F-%H%M)

mkdir -p "$D"
trap 'rm -f "$D"/*.part' EXIT   # never leave a half-written file that looks like a backup

mysqldump --single-transaction --routines --default-character-set=utf8mb4 sunsteel | gzip > "$D/db-$TS.sql.gz.part"
gzip -t "$D/db-$TS.sql.gz.part"
tar -czf "$D/files-$TS.tar.gz.part" -C "$R" uploads lead-files
gzip -t "$D/files-$TS.tar.gz.part"
mv "$D/db-$TS.sql.gz.part" "$D/db-$TS.sql.gz"
mv "$D/files-$TS.tar.gz.part" "$D/files-$TS.tar.gz"

find "$D" -maxdepth 1 -type f \( -name 'db-*.sql.gz' -o -name 'files-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) ok: db-$TS.sql.gz ($(du -h "$D/db-$TS.sql.gz" | cut -f1)), files-$TS.tar.gz ($(du -h "$D/files-$TS.tar.gz" | cut -f1)); $(ls "$D" | grep -c -E '^(db|files)-') kept"
