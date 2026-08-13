#!/bin/bash
cd /home/admin/private_apps/bridge || exit 1
echo "=== selly_zastosowanie_category_map ==="
sqlite3 data.db "PRAGMA table_info(selly_zastosowanie_category_map);"
sqlite3 data.db "SELECT COUNT(*) FROM selly_zastosowanie_category_map;"
sqlite3 data.db "SELECT zastosowanie, category_id_glowna, category_id_zastosowanie, dziedziczy_kategorie_produktu FROM selly_zastosowanie_category_map LIMIT 5;"
echo "=== selly_kategoria_norm_map ==="
sqlite3 data.db "PRAGMA table_info(selly_kategoria_norm_map);"
sqlite3 data.db "SELECT * FROM selly_kategoria_norm_map;"
echo "=== przyklad produktu z zastosowanie wypelnionym ==="
sqlite3 data.db ".mode line" "SELECT kod, kategoria, marka, zastosowanie FROM products WHERE zastosowanie IS NOT NULL AND zastosowanie LIKE '%+%' LIMIT 3;"
