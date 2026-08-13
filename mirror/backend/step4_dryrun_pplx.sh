#!/bin/bash
set -e
cd /home/admin/private_apps/bridge || exit 1
echo "=== Tworze kopie testowa bazy do dry-run ==="
cp data.db data_dryrun_test.db
echo "=== Uruchamiam apply_zastosowanie.cjs na KOPII testowej ==="
node apply_zastosowanie.cjs data_dryrun_test.db marka_model_zastosowanie.json
echo ""
echo "=== Wynik w kopii testowej: rozklad zastosowanie ==="
sqlite3 data_dryrun_test.db "SELECT zastosowanie, COUNT(*) FROM products GROUP BY zastosowanie ORDER BY COUNT(*) DESC;"
echo ""
echo "=== Ile produktow BEZ przypisanego zastosowania (NULL) ==="
sqlite3 data_dryrun_test.db "SELECT COUNT(*) FROM products WHERE zastosowanie IS NULL;"
echo ""
echo "=== Ile produktow calkowitych ==="
sqlite3 data_dryrun_test.db "SELECT COUNT(*) FROM products;"
echo ""
echo "=== Przyklad 10 produktow z przypisanym zastosowaniem ==="
sqlite3 data_dryrun_test.db "SELECT marka, model, zastosowanie FROM products WHERE zastosowanie IS NOT NULL LIMIT 10;"
echo "DRY RUN ZAKONCZONY - baza produkcyjna NIETKNIETA"
