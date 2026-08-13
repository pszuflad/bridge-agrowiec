#!/bin/bash
set -e
cd /home/admin/private_apps/bridge || exit 1
echo "=== Uruchamiam kategoria_norm_map.sql ==="
sqlite3 data.db < kategoria_norm_map_pplx.sql
echo "=== Uruchamiam zastosowanie_selly_map.sql ==="
sqlite3 data.db < zastosowanie_selly_map_pplx.sql
echo "=== Weryfikacja: liczba wierszy w obu tabelach ==="
sqlite3 data.db "SELECT COUNT(*) FROM selly_kategoria_norm_map;"
sqlite3 data.db "SELECT COUNT(*) FROM selly_zastosowanie_category_map;"
echo "=== Podglad zawartosci norm_map ==="
sqlite3 data.db "SELECT * FROM selly_kategoria_norm_map;"
echo "TABELE WGRANE OK"
