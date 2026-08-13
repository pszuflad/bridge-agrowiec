#!/bin/bash
cd /home/admin/private_apps/bridge || exit 1
echo "=== kategorie w selly_dict ==="
sqlite3 data.db "SELECT klucz, wartosc_id FROM selly_dict WHERE slownik='categories' ORDER BY wartosc_id;"
echo "=== kiedy odswiezono ==="
sqlite3 data.db "SELECT DISTINCT slownik, odswiezono FROM selly_dict;"
echo "=== ile produktow ma selly_category_id NULL w selly_products ==="
sqlite3 data.db "SELECT COUNT(*) FROM selly_products WHERE selly_category_id IS NULL;"
echo "=== rozklad selly_category_id (ile produktow na kazde id) ==="
sqlite3 data.db "SELECT selly_category_id, COUNT(*) FROM selly_products GROUP BY selly_category_id ORDER BY 2 DESC;"
