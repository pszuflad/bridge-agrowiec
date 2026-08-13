#!/bin/bash
cd /home/admin/private_apps/bridge || exit 1
echo "=== czy jest kolumna selly_id / selly_product_id w products ==="
sqlite3 data.db "PRAGMA table_info(products);" | grep -i selly
echo "=== tabela selly_products - schemat ==="
sqlite3 data.db "PRAGMA table_info(selly_products);"
echo "=== liczba wierszy selly_products ==="
sqlite3 data.db "SELECT COUNT(*) FROM selly_products;"
echo "=== przyklad wiersza selly_products ==="
sqlite3 data.db ".mode line" "SELECT * FROM selly_products LIMIT 2;"
echo "=== tabela selly_sync_log - schemat i przyklad ==="
sqlite3 data.db "PRAGMA table_info(selly_sync_log);"
sqlite3 data.db "SELECT COUNT(*) FROM selly_sync_log;"
sqlite3 data.db ".mode line" "SELECT * FROM selly_sync_log ORDER BY rowid DESC LIMIT 3;"
