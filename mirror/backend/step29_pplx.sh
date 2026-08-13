#!/bin/bash
cd /home/admin/private_apps/bridge/parsers || exit 1
echo "=== linie z 'kod' w adapter.cjs (budowanie pola kod) ==="
grep -n "kod\s*[:=]" adapter.cjs | grep -v "^\s*//" | head -60
