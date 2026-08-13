#!/bin/bash
cd /home/admin/private_apps/bridge || exit 1
echo "=== przyklady kodow w products (obecny format) ==="
sqlite3 data.db "SELECT kod FROM products LIMIT 5;"
echo "=== czy istnieje kod bez podkreslnika np MO110000085 w products ==="
sqlite3 data.db "SELECT COUNT(*) FROM products WHERE kod LIKE 'MO1%' AND kod NOT LIKE 'MO1\_%' ESCAPE '\';"
echo "=== czy istnieje analogiczny kod z podkreslnikiem (moze to ten sam produkt po migracji)? ==="
sqlite3 data.db "SELECT kod FROM products WHERE kod LIKE '%10000085%';"
echo "=== data ostatniej modyfikacji plikow migracji kodu ==="
ls -la scripts/*kod* 2>/dev/null
