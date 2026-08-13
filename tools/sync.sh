#!/bin/bash
# ============================================================================
#  Bridge — sync.sh : różnicowa synchronizacja produkcji + auto-commit
#  Każde uruchomienie = świeży stan + commit z diffem (jeśli coś się zmieniło).
#  Uruchom z katalogu repo:  bash tools/sync.sh
#  Cron:  0 * * * * cd ~/apinfo/projects/bridge && bash tools/sync.sh >> tools/sync.log 2>&1
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== sync $(date '+%F %T') ==="
bash tools/acquire.sh

# snapshot bazy jest gitignored (binarny, duży) — wersjonujemy schemat i bundle
git add mirror/ knowledge/ db/schema.sql 2>/dev/null || true

if git diff --cached --quiet; then
  echo "Brak zmian od ostatniej synchronizacji."
else
  git commit -m "sync: stan produkcji $(date '+%F %T')"
  echo "Zacommitowano zmiany. Podgląd:  git show --stat HEAD"
fi
