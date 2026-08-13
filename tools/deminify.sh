#!/bin/bash
# ============================================================================
#  Bridge — deminify.sh : upiększa ŻYWE bundle do postaci diffowalnej
#  Nie odminifikuje nazw (X, he zostają), ale rozbija kod na osobne linie,
#  dzięki czemu `git diff deminified/` pokazuje konkretną zmienioną linię.
#  Deterministyczne (js-beautify, stałe opcje) — te same wejście = ten sam output.
#  Wywoływane przez sync.sh; można też ręcznie: bash tools/deminify.sh
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JSB="$ROOT/tools/node_modules/js-beautify"
mkdir -p "$ROOT/deminified"

if [ ! -d "$JSB" ]; then
  echo "BŁĄD: brak js-beautify. Zainstaluj: npm install --prefix tools js-beautify@1.14.11"
  exit 1
fi

beautify() {  # $1 = plik wejściowy, $2 = plik wyjściowy
  node -e '
    const b = require(process.argv[1]).js, fs = require("fs");
    const src = fs.readFileSync(process.argv[2], "utf8");
    fs.writeFileSync(process.argv[3],
      b(src, { indent_size: 2, preserve_newlines: false, end_with_newline: true }));
  ' "$JSB" "$1" "$2"
}

# --- backend: żywy index.cjs ---
if [ -f "$ROOT/mirror/backend/index.cjs" ]; then
  echo "  backend  index.cjs -> deminified/backend-index.cjs"
  beautify "$ROOT/mirror/backend/index.cjs" "$ROOT/deminified/backend-index.cjs"
fi

# --- frontend: bundle wskazany przez index.html (żywy) ---
FE_HTML="$ROOT/mirror/frontend/index.html"
if [ -f "$FE_HTML" ]; then
  BUNDLE="$(grep -oE 'assets/index-[A-Za-z0-9]+\.js' "$FE_HTML" | head -1 || true)"
  if [ -n "${BUNDLE:-}" ] && [ -f "$ROOT/mirror/frontend/$BUNDLE" ]; then
    echo "  frontend $BUNDLE -> deminified/frontend-index.js"
    beautify "$ROOT/mirror/frontend/$BUNDLE" "$ROOT/deminified/frontend-index.js"
    echo "$BUNDLE" > "$ROOT/deminified/frontend-active-bundle.txt"
  else
    echo "  UWAGA: nie znaleziono żywego bundla frontendu w index.html"
  fi
fi

echo "GOTOWE."
