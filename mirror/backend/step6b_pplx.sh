#!/bin/bash
set -e
cd /home/admin/private_apps/bridge || exit 1
echo "=== Produkty gdzie zastosowanie to WYLACZNIE 'Uniwersalne' ==="
sqlite3 data.db "SELECT COUNT(*) FROM products WHERE zastosowanie='Uniwersalne';"
echo "=== Kategoria glowna tych produktow ==="
sqlite3 data.db "SELECT kategoria, COUNT(*) FROM products WHERE zastosowanie='Uniwersalne' GROUP BY kategoria;"
