#!/bin/bash
cd /home/admin/private_apps/bridge || exit 1
echo "=== selly_products bridge_kod przyklady ==="
sqlite3 data.db "SELECT bridge_kod FROM selly_products LIMIT 5;"
echo "=== czy te kody istnieja w products ==="
sqlite3 data.db "SELECT sp.bridge_kod, p.kod, p.zastosowanie FROM selly_products sp LEFT JOIN products p ON p.kod = sp.bridge_kod LIMIT 5;"
echo "=== liczba selly_products gdzie produkt istnieje w products ==="
sqlite3 data.db "SELECT COUNT(*) FROM selly_products sp JOIN products p ON p.kod = sp.bridge_kod;"
