#!/bin/bash
cd /home/admin/private_apps/bridge || exit 1
echo "=== pliki parserow dostawcow ==="
ls -la parsers/ 2>/dev/null
echo "=== szukam wzorca budowania kod z podkreslnikiem (dostawca + '_' + ...) ==="
grep -rn "kod.*=.*'_'\|kod.*=.*\`.*_.*\`\|+ '_' +\|_\${" --include="*.cjs" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v "\.bak"
