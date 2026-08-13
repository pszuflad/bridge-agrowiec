#!/bin/bash
set -e
cd /home/admin/private_apps/bridge || exit 1
echo "=== Uruchamiam migration_zastosowanie.sql ==="
sqlite3 data.db < migration_zastosowanie.sql
echo "=== Weryfikacja: kolumna zastosowanie ==="
sqlite3 data.db "PRAGMA table_info(products);" | grep -i zastosowanie
echo "=== Weryfikacja: rodzaj atrybutu ==="
sqlite3 data.db "SELECT value,label,opis,core FROM atrybuty_rodzaje WHERE value='zastosowanie';"
echo "MIGRACJA OK"
