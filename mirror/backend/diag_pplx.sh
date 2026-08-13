#!/bin/bash
cd /home/admin/private_apps/bridge || exit 1
echo "=== kolumna zastosowanie w products ==="
sqlite3 data.db "PRAGMA table_info(products);" | grep -i zastosowanie || echo "BRAK kolumny zastosowanie"
echo "=== rodzaje atrybutow ==="
sqlite3 data.db "SELECT value,label FROM atrybuty_rodzaje;"
echo "=== tabela mapujaca (liczba wierszy albo blad) ==="
sqlite3 data.db "SELECT COUNT(*) FROM selly_categoria_zastosowanie_map;" 2>&1
echo "=== produkty per kategoria ==="
sqlite3 data.db "SELECT kategoria, COUNT(*) FROM products GROUP BY kategoria;"
echo "=== zastosowanie w wartosciach atrybutow ==="
sqlite3 data.db "SELECT COUNT(*) FROM atrybuty_wartosci WHERE rodzaj='zastosowanie';" 2>&1
echo "=== zawartosc apply_zastosowanie.cjs (pierwsze 60 linii) ==="
head -60 apply_zastosowanie.cjs 2>&1
