#!/bin/bash
set -e
cd /home/admin/private_apps/bridge || exit 1
echo "=== Marki produktow BEZ zastosowania (top 20, ile produktow kazda) ==="
sqlite3 data_dryrun_test.db "SELECT marka, COUNT(*) FROM products WHERE zastosowanie IS NULL GROUP BY marka ORDER BY COUNT(*) DESC LIMIT 20;"
echo ""
echo "=== Przyklad 50 niedopasowanych wpisow z mapowania (marka/model/kategoria) ==="
cat niedopasowane_marka_model.json | node -e "
const data = JSON.parse(require('fs').readFileSync(0,'utf-8'));
data.slice(0,50).forEach(e => console.log(e.kategoria, '|', e.marka, '|', e.model));
"
