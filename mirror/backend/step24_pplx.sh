#!/bin/bash
cd /home/admin/private_apps/bridge || exit 1
echo "=== ilu zsynchronizowanych ma zastosowanie NOT NULL ==="
sqlite3 data.db "SELECT COUNT(*) FROM products p JOIN selly_products sp ON sp.bridge_kod = p.kod WHERE p.zastosowanie IS NOT NULL;"
echo "=== przyklady (dowolne zastosowanie, jedna wartosc) ==="
sqlite3 data.db "SELECT p.kod, p.kategoria, p.zastosowanie, sp.selly_product_id FROM products p JOIN selly_products sp ON sp.bridge_kod = p.kod WHERE p.zastosowanie IS NOT NULL LIMIT 5;"
