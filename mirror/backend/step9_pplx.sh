#!/bin/bash
set -e
cd /home/admin/private_apps/bridge || exit 1
echo "=== Uruchamiam zastosowanie_selly_map_v2.sql (zastapienie v1) ==="
sqlite3 data.db < zastosowanie_selly_map_v2_pplx.sql
echo "=== Weryfikacja liczby wierszy ==="
sqlite3 data.db "SELECT COUNT(*) FROM selly_zastosowanie_category_map;"
sqlite3 data.db "SELECT dziedziczy_kategorie_produktu, COUNT(*) FROM selly_zastosowanie_category_map GROUP BY dziedziczy_kategorie_produktu;"
echo "TABELA V2 OK"
