#!/bin/bash
cd /home/admin/private_apps/bridge || exit 1
echo "=== Pelny schemat tabeli products ==="
sqlite3 data.db "PRAGMA table_info(products);"
echo ""
echo "=== Przyklad 3 pelnych wierszy produktow ==="
sqlite3 data.db ".mode line" "SELECT * FROM products LIMIT 3;"
echo ""
echo "=== Zawartosc .env (nazwy zmiennych SELLY, bez wartosci) ==="
grep "SELLY" .env | sed 's/=.*/=<HIDDEN>/'
echo ""
echo "=== Czy jest juz jakis plik z 'oauth' lub 'token' w nazwie ==="
ls -la *oauth* *token* 2>/dev/null || echo "brak"
echo ""
echo "=== common.cjs - pierwsze 30 linii (zeby zobaczyc styl kodu/importy) ==="
head -30 common.cjs
