#!/usr/bin/env bash
# Bramki jakości projektu — JEDNO miejsce, które woła Master, hook i CI.
# DOSTOSUJ do stosu (poniżej przykład Node). Zwraca kod != 0 przy pierwszym błędzie.
# Skille i skrypty wołają TEN plik, więc nie wpisuj komend lint/test w kilku miejscach.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# --- PRZYKŁAD: Node ---------------------------------------------------------------
# npm ci
# npm run lint
# npm run typecheck
# npm run build
# npm test

# --- PRZYKŁAD: Python -------------------------------------------------------------
# ruff check . && mypy . && pytest -q

echo "⚠ tools/bramki.sh nie jest jeszcze skonfigurowany — uzupełnij komendy dla tego projektu." >&2
exit 1
