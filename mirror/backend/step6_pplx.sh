#!/bin/bash
set -e
cd /home/admin/private_apps/bridge || exit 1
echo "=== Wszystkie unikalne wartosci zastosowanie (pelna lista, nie tylko top) ==="
sqlite3 data.db "SELECT DISTINCT zastosowanie FROM products WHERE zastosowanie IS NOT NULL ORDER BY zastosowanie;"
