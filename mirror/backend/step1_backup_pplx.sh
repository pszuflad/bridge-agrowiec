#!/bin/bash
set -e
cd /home/admin/private_apps/bridge || exit 1
TS=$(date +%Y%m%d-%H%M%S)
cp data.db "data.db.backup-${TS}-pre_zastosowanie"
echo "BACKUP OK: data.db.backup-${TS}-pre_zastosowanie"
ls -la data.db.backup-${TS}-pre_zastosowanie
