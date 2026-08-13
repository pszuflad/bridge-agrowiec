#!/bin/bash
cd /home/admin/private_apps/bridge || exit 1
echo "=== SCHEMAT atrybuty_wartosci (czy jest origin?) ==="
sqlite3 data.db "PRAGMA table_info(atrybuty_wartosci);"
echo "=== SCHEMAT atrybuty_rodzaje ==="
sqlite3 data.db "PRAGMA table_info(atrybuty_rodzaje);"
echo "=== czy sa tabele selly_* ==="
sqlite3 data.db "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'selly%';"
echo "=== przyklad marka_model_zastosowanie.json (pierwszy obiekt) ==="
head -c 600 marka_model_zastosowanie.json
echo ""
echo "=== rozne pisownie kategoria (dokladnie) ==="
sqlite3 data.db "SELECT DISTINCT kategoria FROM products;"
echo "=== czy jest git w katalogu (kontrola wersji) ==="
ls -la .git 2>/dev/null && echo "GIT JEST" || echo "brak git"
echo "=== jak uruchomiony jest backend (pm2?) ==="
pm2 list 2>/dev/null || ps aux | grep -i node | grep -v grep | head
