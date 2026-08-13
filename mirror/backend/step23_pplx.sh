#!/bin/bash
cd /home/admin/private_apps/bridge || exit 1
sqlite3 data.db "SELECT p.kod, p.kategoria, p.zastosowanie, sp.selly_product_id, sp.selly_category_id FROM products p JOIN selly_products sp ON sp.bridge_kod = p.kod WHERE p.zastosowanie LIKE '%+%' LIMIT 5;"
