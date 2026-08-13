#!/bin/bash
cd /home/admin/private_apps/bridge || exit 1
echo "=== Szukam plikow uzywajacych selly_products lub sync_supplier ==="
grep -ln "selly_products\|sync_supplier" *.cjs *.js 2>/dev/null
echo "=== Szukam w podkatalogach (nie node_modules) ==="
find . -path ./node_modules -prune -o -type f \( -name "*.cjs" -o -name "*.js" \) -print 2>/dev/null | xargs grep -l "selly_products\|sync_supplier" 2>/dev/null
echo "=== Lista wszystkich podkatalogow ==="
find . -maxdepth 2 -type d -not -path "*/node_modules*" 2>/dev/null
