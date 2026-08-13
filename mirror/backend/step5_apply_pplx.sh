#!/bin/bash
set -e
cd /home/admin/private_apps/bridge || exit 1
echo "=== Sprzatam pliki testowe (juz niepotrzebne) ==="
rm -f data_dryrun_test.db data_dryrun_test.db-shm data_dryrun_test.db-wal
echo "=== UWAGA: uruchamiam apply_zastosowanie.cjs na PRODUKCYJNEJ bazie data.db ==="
node apply_zastosowanie.cjs data.db marka_model_zastosowanie.json
echo ""
echo "=== Weryfikacja po zapisie: rozklad zastosowanie (top 15) ==="
sqlite3 data.db "SELECT zastosowanie, COUNT(*) FROM products GROUP BY zastosowanie ORDER BY COUNT(*) DESC LIMIT 15;"
echo ""
echo "=== Ile NULL / ile total ==="
sqlite3 data.db "SELECT (SELECT COUNT(*) FROM products WHERE zastosowanie IS NULL) as bez, (SELECT COUNT(*) FROM products) as total;"
echo "APPLY NA PRODUKCJI ZAKONCZONY"
