#!/bin/bash
cd /home/admin/private_apps/bridge || exit 1
echo "=== pliki zwiazane z zastosowanie na serwerze ==="
ls -la | grep -i zastosow
echo "=== pliki .sql / .xlsx / .json zwiazane z zastosowanie ==="
ls -la *zastosow* 2>/dev/null
ls -la *.xlsx 2>/dev/null | head
echo "=== pelna reszta apply_zastosowanie.cjs (od linii 60) ==="
tail -n +60 apply_zastosowanie.cjs 2>&1
echo "=== migration_zastosowanie.sql jesli istnieje ==="
cat migration_zastosowanie.sql 2>&1 | head -80
echo "=== zastosowanie_wartosci.sql jesli istnieje ==="
cat zastosowanie_wartosci.sql 2>&1 | head -40
