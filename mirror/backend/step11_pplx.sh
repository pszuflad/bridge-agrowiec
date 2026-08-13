#!/bin/bash
cd /home/admin/private_apps/bridge || exit 1
echo "=== Szukam wzmianek o selly24 / sync do Selly ==="
grep -ln "selly24" *.cjs *.js 2>/dev/null
echo "=== Szukam kategoria/category w plikach nie-node_modules ==="
grep -ln "categoryid\|category_id" *.cjs *.js 2>/dev/null
echo "=== .env - jakie zmienne (bez wartosci sekretnych, tylko nazwy) ==="
grep -o '^[A-Z_]*=' .env 2>/dev/null
