#!/bin/bash
cd /home/admin/private_apps/bridge || exit 1
echo "=== dostawcy z zastosowanie wypelnionym ==="
sqlite3 data.db "SELECT dostawca, COUNT(*) FROM products WHERE zastosowanie IS NOT NULL GROUP BY dostawca;"
echo "=== dostawcy juz zsynchronizowani (w selly_products) ==="
sqlite3 data.db "SELECT p.dostawca, COUNT(*) FROM products p JOIN selly_products sp ON sp.bridge_kod=p.kod GROUP BY p.dostawca;"
