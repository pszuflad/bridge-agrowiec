#!/bin/bash
# ============================================================================
#  Bridge — deploy-staging.sh : CD po stronie VPS (pull-based)
#  Wdraża nową wersję (rebuild/) na środowisko STAGING (test.agritires.eu).
#  Uruchamiany z crona DirectAdmin. Laptopy tego nie odpalają.
#
#  KONTRAKT z aplikacją (musi spełnić Iteracja 1):
#   - rebuild/backend:  `npm ci` && `npm run build` -> katalog dist/, wejście dist/server.js
#       server nasłuchuje na process.env.HOST:process.env.PORT, baza z process.env.DB_PATH
#       `npm run migrate` stosuje schemat/migracje na DB_PATH (idempotentnie)
#       wymaga JWT_SECRET z $STAGING_ROOT/.env (sekret poza repo — docs/deploy-setup.md)
#   - rebuild/frontend: `npm ci` && `npm run build` -> katalog dist/ (base "/", API pod /api)
#
#  Dopóki rebuild/ nie ma aplikacji (przed I1), skrypt nic nie buduje — placeholder działa dalej.
#  Konfiguracja i pełna instrukcja: docs/deploy-setup.md
# ============================================================================
set -euo pipefail

# --- konfiguracja (dostosuj do hosta) ---
STAGING_ROOT="$HOME/private_apps/bridge-staging"          # repo/, releases/, current, data/
REPO_DIR="$STAGING_ROOT/repo"                             # klon repo śledzący develop
DATA_DB="$STAGING_ROOT/data/data-nowy.db"                 # baza staging (przeżywa podmiany)
DOCROOT="$HOME/domains/agritires.eu/public_html/test"     # frontend (docroot subdomeny)
PM2_NAME="bridge-backend-staging"
BRANCH="develop"
LOG="$STAGING_ROOT/deploy.log"
export PORT=5001 HOST=127.0.0.1 NODE_ENV=production DB_PATH="$DATA_DB"

# Sekrety środowiska (JWT_SECRET) — plik POZA repo, tworzony raz ręcznie na VPS.
# Format: jedna para KLUCZ=wartość na linię. Instrukcja: docs/deploy-setup.md.
if [ -f "$STAGING_ROOT/.env" ]; then set -a; . "$STAGING_ROOT/.env"; set +a; fi

log(){ echo "$(date '+%F %T')  $*" | tee -a "$LOG"; }

# node z nvm (build wymaga node 20)
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true

cd "$REPO_DIR"
git fetch --quiet origin "$BRANCH"
LOCAL="$(git rev-parse HEAD)"; REMOTE="$(git rev-parse "origin/$BRANCH")"
if [ "$LOCAL" = "$REMOTE" ]; then log "brak zmian ($LOCAL)"; exit 0; fi
log "nowy commit $REMOTE (było $LOCAL) — deployuję"
git reset --hard "origin/$BRANCH" >/dev/null
SHA="$(git rev-parse --short HEAD)"

# --- guard: czy aplikacja już istnieje (I1)? ---
if [ ! -f rebuild/backend/package.json ] || [ ! -f rebuild/frontend/package.json ]; then
  log "rebuild/ nie ma jeszcze aplikacji (I1 niezrobione) — pomijam build. Placeholder działa dalej."
  exit 0
fi

# --- guard: sekret JWT musi istnieć, inaczej backend nie wstanie (pm2 crash-loop) ---
if [ -z "${JWT_SECRET:-}" ]; then
  log "BŁĄD: brak JWT_SECRET. Utwórz $STAGING_ROOT/.env z linią JWT_SECRET=... (docs/deploy-setup.md). Przerywam."
  exit 1
fi

# --- backend: build -> release -> migracje -> pm2 ---
RELEASE="$STAGING_ROOT/releases/$SHA"
log "backend: build -> $RELEASE"
( cd rebuild/backend && npm ci && npm run build )
mkdir -p "$RELEASE"
cp -a rebuild/backend/dist rebuild/backend/package.json rebuild/backend/package-lock.json "$RELEASE"/
( cd "$RELEASE" && npm ci --omit=dev )                    # tylko zależności produkcyjne
( cd rebuild/backend && DB_PATH="$DATA_DB" npm run migrate )   # migracje na bazie staging
ln -sfn "$RELEASE" "$STAGING_ROOT/current"               # atomowa podmiana
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 reload "$PM2_NAME" --update-env
else
  ( cd "$STAGING_ROOT/current" && pm2 start dist/server.js --name "$PM2_NAME" --update-env )
fi
pm2 save >/dev/null 2>&1 || true

# --- frontend: build -> publikacja do docroota ---
log "frontend: build -> $DOCROOT"
( cd rebuild/frontend && npm ci && npm run build )
mkdir -p "$DOCROOT"
rsync -a --delete --exclude '.htaccess' rebuild/frontend/dist/ "$DOCROOT"/
cp -f deploy/staging/htaccess "$DOCROOT/.htaccess"       # proxy utrzymywany z repo

# --- sprzątanie: zostaw 5 ostatnich release ---
ls -1dt "$STAGING_ROOT/releases"/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf

log "OK — wdrożono $SHA na test.agritires.eu"
