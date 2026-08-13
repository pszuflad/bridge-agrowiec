#!/bin/bash
set -e
cd /home/admin/private_apps/bridge || exit 1
echo "=== Uruchamiam zastosowanie_wartosci.sql ==="
sqlite3 data.db < zastosowanie_wartosci.sql
echo "=== Weryfikacja: liczba wartosci ==="
sqlite3 data.db "SELECT COUNT(*) FROM atrybuty_wartosci WHERE rodzaj='zastosowanie';"
echo "=== Lista wartosci ==="
sqlite3 data.db "SELECT wartosc FROM atrybuty_wartosci WHERE rodzaj='zastosowanie' ORDER BY wartosc;"
echo "WARTOSCI OK"
