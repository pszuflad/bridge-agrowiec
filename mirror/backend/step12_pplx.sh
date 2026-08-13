#!/bin/bash
cd /home/admin/private_apps/bridge || exit 1
echo "=== Wszystkie pliki wspominajace SELLY_SHOP_URL lub SELLY_CLIENT ==="
grep -ln "SELLY_SHOP_URL\|SELLY_CLIENT" *.cjs *.js 2>/dev/null
echo "=== Zawartosc package.json - scripts ==="
cat package.json 2>/dev/null | head -40
echo "=== ecosystem.config.cjs (pm2) ==="
cat ecosystem.config.cjs 2>/dev/null
