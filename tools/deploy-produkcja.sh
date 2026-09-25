#!/bin/bash
# ============================================================================
#  Bridge — deploy-produkcja.sh : CD po stronie VPS dla PRODUKCJI.
#  Wdraża nową wersję (rebuild/) na środowisko PRODUKCYJNE (panel.agritires.eu).
#  Uruchamiany z GitHub Actions po pushu do `main`. Laptopy tego nie odpalają.
#
#  ⚠ To jest WIERNE ODBICIE tools/deploy-staging.sh. Różnice są WYŁĄCZNIE w konfiguracji
#  na górze pliku plus trzy bramki bezpieczeństwa, których staging nie potrzebuje
#  (opisane niżej przy każdej). Zmieniasz jeden skrypt — sprawdź, czy drugi nie wymaga
#  tej samej zmiany.
#
#  Różnice wobec stagingu:
#   | gałąź     | develop            -> main                                   |
#   | katalog   | public_html/test   -> public_html/panel                      |
#   | port      | 5001 (127.0.0.1)   -> 5000 (0.0.0.0)                         |
#   | proces    | bridge-backend-staging -> bridge-backend-prod                |
#   | baza      | data-test.db       -> data-prod.db                           |
#   | Selly     | twardo wyłączone   -> z .env (produkcja ma pisać do sklepu)  |
#
#  Konfiguracja i pełna instrukcja: docs/wdrozenie-produkcji.md
# ============================================================================
set -euo pipefail

# --- konfiguracja ---
PROD_ROOT="$HOME/private_apps/bridge-prod"                # repo/, releases/, current, data/
REPO_DIR="$PROD_ROOT/repo"                                # klon repo śledzący main
DATA_DB="$PROD_ROOT/data/data-prod.db"                    # baza produkcji
DOCROOT="$HOME/domains/agritires.eu/public_html/panel"    # docroot panel.agritires.eu
PM2_NAME="bridge-backend-prod"
BRANCH="main"
LOG="$PROD_ROOT/deploy.log"
export PORT=5000 HOST=0.0.0.0 NODE_ENV=production DB_PATH="$DATA_DB"

# --- Selly: produkcja MA pisać do sklepu, więc NIE ustawiamy tu żadnej blokady ---
# Staging robi odwrotnie (deploy-staging.sh:42-45) i to jest jedyny powód, dla którego
# te dwa skrypty różnią się czymkolwiek poza konfiguracją. Wartości bierzemy z .env;
# `SELLY_TRYB` i `SELLY_SCHEDULER` mają w kodzie domyślki BEZPIECZNE (wyłączone), więc
# brak wpisu w .env oznacza „integracja milczy", a nie „pisze na oślep".
#
# `SELLY_CSV_DIR` ustawiamy JAWNIE na katalog pod docrootem, mimo że domyślka w kodzie
# (config/env.ts:138-141) wskazuje dokładnie to samo miejsce. Powód jest mechaniczny:
# ta zmienna jest przekazywana do publikuj-frontend.sh jako katalog CHRONIONY przed
# `rsync --delete`. Gdyby była pusta, deploy skasowałby plik CSV, po który przychodzi Selly.
export SELLY_CSV_DIR="${SELLY_CSV_DIR:-$DOCROOT/ex-port-files}"

# Sekrety środowiska — plik POZA repo, tworzony raz przez tools/przygotuj-produkcje.sh.
if [ -f "$PROD_ROOT/.env" ]; then set -a; . "$PROD_ROOT/.env"; set +a; fi

log(){ echo "$(date '+%F %T')  $*" | tee -a "$LOG"; }

# node z nvm (build wymaga node 20)
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true

cd "$REPO_DIR"
git fetch --quiet origin "$BRANCH"
LOCAL="$(git rev-parse HEAD)"; REMOTE="$(git rev-parse "origin/$BRANCH")"
if [ "$LOCAL" = "$REMOTE" ] && [ "${FORCE:-0}" != "1" ]; then log "brak zmian ($LOCAL) — użyj FORCE=1 by wymusić deploy"; exit 0; fi
log "nowy commit $REMOTE (było $LOCAL) — deployuję PRODUKCJĘ"
git reset --hard "origin/$BRANCH" >/dev/null
SHA="$(git rev-parse --short HEAD)"

# --- guard: aplikacja istnieje ---
if [ ! -f rebuild/backend/package.json ] || [ ! -f rebuild/frontend/package.json ]; then
  log "BŁĄD: rebuild/ nie ma aplikacji na gałęzi $BRANCH. Przerywam."
  exit 1
fi

# --- guard: sekret JWT ---
if [ -z "${JWT_SECRET:-}" ]; then
  log "BŁĄD: brak JWT_SECRET. Utwórz $PROD_ROOT/.env (tools/przygotuj-produkcje.sh). Przerywam."
  exit 1
fi

# --- guard: pusty SELLY_CSV_DIR wyłączyłby ochronę katalogu CSV przy publikacji frontendu ---
if [ -z "${SELLY_CSV_DIR:-}" ]; then
  log "BŁĄD: pusty SELLY_CSV_DIR (sprawdź $PROD_ROOT/.env). Przerywam."
  exit 1
fi

# --- guard PRODUKCYJNY 1: baza MUSI już istnieć ---
# Staging może sobie wytworzyć pustą bazę i ją zmigrować — to tylko środowisko testowe.
# Na produkcji pusty plik oznaczałby katalog bez ani jednego produktu, generator CSV
# oddałby Selly pusty plik, a sklep wyzerowałby stany. Lepiej nie wdrożyć.
if [ ! -f "$DATA_DB" ]; then
  log "BŁĄD: baza produkcji nie istnieje ($DATA_DB). Uruchom tools/przygotuj-produkcje.sh. Przerywam."
  exit 1
fi

# --- guard PRODUKCYJNY 2: docroot musi istnieć ---
# Gdyby go nie było, publikuj-frontend.sh utworzyłby go pustym i panel zniknąłby z internetu
# razem z katalogiem ex-port-files.
if [ ! -d "$DOCROOT" ]; then
  log "BŁĄD: docroot nie istnieje ($DOCROOT). Uruchom tools/przygotuj-produkcje.sh. Przerywam."
  exit 1
fi

# --- guard PRODUKCYJNY 3: stary stos nie może chodzić równolegle ---
# Dwa backendy na jednej bazie to dwa schedulery importu i dwie synchronizacje Selly
# (decyzja D9, docs/cutover.md §2). PM2 starego stosu nazywa się `bridge-backend`.
if pm2 describe bridge-backend >/dev/null 2>&1; then
  log "BŁĄD: proces PM2 'bridge-backend' (stary stos) nadal istnieje. Usuń go: pm2 delete bridge-backend && pm2 save. Przerywam."
  exit 1
fi

# --- backend: build -> release -> migracje -> pm2 ---
RELEASE="$PROD_ROOT/releases/$SHA"
log "backend: build -> $RELEASE"
# `--include=dev` KONIECZNE (NODE_ENV=production każe npm pominąć devDependencies, a bez
# TypeScriptu nie ma czym budować). `--ignore-scripts` + podłożenie binarki better-sqlite3:
# prebuilt wymaga glibc 2.29 (box ma 2.28), a node-gyp 10 nie zbuduje ze źródła na Pythonie 3.6.
PROD_BSQLITE="/home/admin/private_apps/bridge/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
if [ ! -f "$PROD_BSQLITE" ]; then
  log "BŁĄD: brak binarki better-sqlite3 ($PROD_BSQLITE) do podłożenia. Przerywam."
  exit 1
fi
podloz_bsqlite() {  # $1 = docelowy katalog node_modules
  mkdir -p "$1/better-sqlite3/build/Release"
  cp -f "$PROD_BSQLITE" "$1/better-sqlite3/build/Release/better_sqlite3.node"
}
( cd rebuild/backend && npm ci --include=dev --ignore-scripts )
podloz_bsqlite "rebuild/backend/node_modules"
( cd rebuild/backend && npm run build )
mkdir -p "$RELEASE"
cp -a rebuild/backend/dist rebuild/backend/package.json rebuild/backend/package-lock.json "$RELEASE"/
( cd "$RELEASE" && npm ci --omit=dev --ignore-scripts )
podloz_bsqlite "$RELEASE/node_modules"

# --- kopia bazy PRZED migracjami (VACUUM INTO, nie cp — baza chodzi w WAL) ---
# Robiona TYLKO gdy są migracje do zastosowania. Trzyma 5 ostatnich w $PROD_ROOT/data/backups/.
# Błąd kopii PRZERYWA deploy — lepiej nie wdrożyć niż migrować bez punktu powrotu.
log "kopia bazy przed migracjami"
( cd rebuild/backend && DB_PATH="$DATA_DB" ETYKIETA="$SHA" node scripts/kopia-bazy.cjs 2>&1 | tee -a "$LOG" )

( cd rebuild/backend && DB_PATH="$DATA_DB" npm run migrate )
ln -sfn "$RELEASE" "$PROD_ROOT/current"                  # atomowa podmiana
pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
( cd "$PROD_ROOT/current" && PORT="$PORT" HOST="$HOST" DB_PATH="$DATA_DB" NODE_ENV=production \
    pm2 start dist/server.js --name "$PM2_NAME" --update-env )
pm2 save >/dev/null 2>&1 || true

# --- frontend: build -> publikacja do docroota ---
log "frontend: build -> $DOCROOT"
( cd rebuild/frontend && npm ci --include=dev && npm run build )
bash tools/publikuj-frontend.sh rebuild/frontend/dist "$DOCROOT" "$SELLY_CSV_DIR"
cp -f deploy/produkcja/htaccess "$DOCROOT/.htaccess"     # proxy utrzymywany z repo

# --- sprzątanie: zostaw 5 ostatnich release ---
ls -1dt "$PROD_ROOT/releases"/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf

log "OK — wdrożono $SHA na panel.agritires.eu"
