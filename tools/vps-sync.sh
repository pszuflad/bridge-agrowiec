#!/bin/bash
# ============================================================================
#  Bridge — vps-sync.sh : PRODUCENT po stronie serwera
#  Uruchamiany z crona na VPS. Pliki produkcji są LOKALNE (bez ssh/rsync po sieci).
#  Snapshotuje stan produkcji -> git -> push do GitHuba (przez deploy key).
#
#  Laptopy NIE uruchamiają tego skryptu — one tylko `git pull`.
#  Konfiguracja: patrz docs/vps-syncer-setup.md
# ============================================================================
set -euo pipefail

REPO="$HOME/bridge-sync"                                  # klon repo na VPS
BE_SRC="/home/admin/private_apps/bridge"                  # żywy backend
FE_SRC="/home/admin/domains/agritires.eu/public_html/panel"  # żywy frontend

cd "$REPO"

# node z nvm/.nvmrc jeśli dostępne (dla deminify), inaczej systemowy node
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use >/dev/null 2>&1 || true

# 1. Bądź na bieżąco z tym, co pushnęły laptopy (docs/, knowledge/, rebuild/)
git pull --rebase --autostash origin main >/dev/null 2>&1 || true

# 2. Skopiuj lokalną produkcję do mirror/ (te same wykluczenia co acquire.sh)
rsync -a --delete --delete-excluded \
  --exclude 'node_modules' \
  --exclude 'data.db*' --exclude 'bridge.db' \
  --exclude 'backups' \
  --exclude 'index.cjs.bak*' --exclude 'index.cjs.backup*' \
  --exclude '*.tar.gz' --exclude '*.gz' \
  --exclude '.env' --exclude '.env.*' \
  --exclude 'logs' --exclude '*.log' \
  "$BE_SRC/" "$REPO/mirror/backend/"

rsync -a --delete --exclude 'node_modules' \
  "$FE_SRC/" "$REPO/mirror/frontend/"

# 3. Schemat bazy (wersjonowany). snapshot.db jest gitignored — nie kopiujemy.
sqlite3 "$BE_SRC/data.db" .schema > "$REPO/db/schema.sql"

# 4. Deminify żywych bundli -> deminified/ (diffowalne)
bash "$REPO/tools/deminify.sh" >/dev/null

# 5. Commit + push tylko jeśli coś się zmieniło
git add mirror/ deminified/ db/schema.sql
if git diff --cached --quiet; then
  echo "$(date '+%F %T')  brak zmian"
else
  git commit -q -m "sync(vps): stan produkcji $(date '+%F %T')"
  git push -q origin main
  echo "$(date '+%F %T')  wypchnięto zmiany"
fi
