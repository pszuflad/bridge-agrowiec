#!/bin/bash
# ============================================================================
#  Bridge — deploy-staging.sh : CD po stronie VPS (pull-based)
#  Wdraża nową wersję (rebuild/) na środowisko STAGING (training.agroopony.eu, VPS vpshd86).
#  ⚠ Ticket 188 (2026-10-05): staging przeniesiony z vpshd1242 (test.agritires.eu) na vpshd86.
#  Układ: docroot public_html/training, aplikacja w public_html/training/_app (zablokowane dla WWW).
#  Uruchamiany z crona DirectAdmin. Laptopy tego nie odpalają.
#
#  KONTRAKT z aplikacją (musi spełnić Iteracja 1):
#   - rebuild/backend:  `npm ci --include=dev` && `npm run build` -> katalog dist/, wejście dist/server.js
#       server nasłuchuje na process.env.HOST:process.env.PORT, baza z process.env.DB_PATH
#       `npm run migrate` stosuje schemat/migracje na DB_PATH (idempotentnie)
#       `node scripts/kopia-bazy.cjs` robi kopię bazy przed migracjami (VACUUM INTO, rotacja)
#       wymaga JWT_SECRET z $STAGING_ROOT/.env (sekret poza repo — docs/deploy-setup.md)
#   - rebuild/frontend: `npm ci --include=dev` && `npm run build` -> katalog dist/ (base "/", API pod /api)
#
#  Dopóki rebuild/ nie ma aplikacji (przed I1), skrypt nic nie buduje — placeholder działa dalej.
#  Konfiguracja i pełna instrukcja: docs/deploy-setup.md
#
#  ⚠ ODBICIEM TEGO PLIKU JEST tools/deploy-produkcja.sh (gałąź main, public_html/panel,
#  port 5000, baza data-prod.db). Zmieniasz tu cokolwiek poza konfiguracją na górze —
#  sprawdź, czy tamten nie wymaga tej samej zmiany. Różnice: docs/wdrozenie-produkcji.md.
# ============================================================================
set -euo pipefail

# --- konfiguracja (dostosuj do hosta) ---
DOCROOT="$HOME/domains/agroopony.eu/public_html/training" # frontend (docroot subdomeny training.agroopony.eu)
STAGING_ROOT="$DOCROOT/_app"                              # repo/, releases/, current, data/, node/, bin/, lib/
REPO_DIR="$STAGING_ROOT/repo"                             # klon repo śledzący develop
DATA_DB="$STAGING_ROOT/data/data-test.db"                 # baza testu (przeżywa podmiany)
PM2_NAME="bridge-backend-staging"
BRANCH="develop"
LOG="$STAGING_ROOT/deploy.log"
export PORT=5001 HOST=127.0.0.1 NODE_ENV=production DB_PATH="$DATA_DB"

# --- Selly: staging NIE dotyka ani sklepu, ani produkcyjnego pliku CSV (ticket 34) ---
# Ustawiane TUTAJ, a nie w .env, bo to zabezpieczenie ma być wersjonowane i działać przy
# każdym deployu, a nie zależeć od tego, czy ktoś pamiętał dopisać linijkę na serwerze.
# Wartości można nadpisać świadomie w $STAGING_ROOT/.env — plik wczytywany jest NIŻEJ.
#
#  1. SELLY_TRYB=wylaczony — klient odmawia każdej operacji, także z poprawnymi sekretami.
#     Sam brak SELLY_* to zabezpieczenie przez NIEOBECNOŚĆ: skopiowanie .env z produkcji
#     „żeby coś sprawdzić" czyniło staging żywym po cichu.
#  2. ⚠ SELLY_CSV_* — domyślne wartości w kodzie wskazują katalog PRODUKCYJNY
#     (public_html/panel/ex-port-files), bo tam jest ich miejsce na produkcji. Staging stoi
#     na TYM SAMYM VPS, więc bez tego nadpisania przycisk „Wygeneruj CSV teraz" podmieniłby
#     produkcyjny plik treścią z bazy stagingowej — a Selly zaciąga go o 6:00.
export SELLY_TRYB=wylaczony
export SELLY_CSV_DIR="$DOCROOT/ex-port-files"
export SELLY_CSV_PLIK="sellycsv-staging.csv"
export SELLY_CSV_URL="https://training.agroopony.eu/ex-port-files/sellycsv-staging.csv"

# Sekrety środowiska (JWT_SECRET) — plik POZA repo, tworzony raz ręcznie na VPS.
# Format: jedna para KLUCZ=wartość na linię. Instrukcja: docs/deploy-setup.md.
if [ -f "$STAGING_ROOT/.env" ]; then set -a; . "$STAGING_ROOT/.env"; set +a; fi

log(){ echo "$(date '+%F %T')  $*" | tee -a "$LOG"; }

# node z nvm (build wymaga node 20)
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
# ticket 188 (vpshd86): na nowym serwerze nie ma nvm ani globalnego pm2 — Node 20 leży w
# $STAGING_ROOT/node/bin, a $STAGING_ROOT/bin/pm2 to nakładka na wspólny demon PM2
# (PM2_HOME=bridgeone/_app/.pm2, autostart cronem DirectAdmin). Dokładamy je na początek PATH.
[ -d "$STAGING_ROOT/node/bin" ] && export PATH="$STAGING_ROOT/node/bin:$PATH"
[ -d "$STAGING_ROOT/bin" ] && export PATH="$STAGING_ROOT/bin:$PATH"

cd "$REPO_DIR"
git fetch --quiet origin "$BRANCH"
LOCAL="$(git rev-parse HEAD)"; REMOTE="$(git rev-parse "origin/$BRANCH")"
if [ "$LOCAL" = "$REMOTE" ] && [ "${FORCE:-0}" != "1" ]; then log "brak zmian ($LOCAL) — użyj FORCE=1 by wymusić deploy"; exit 0; fi
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

# --- guard: pusty SELLY_CSV_DIR (np. `SELLY_CSV_DIR=` w .env) przepuszcza `set -u`, a wyłączyłby
# po cichu ochronę katalogu CSV przy publikacji frontendu (backend i tak by nie wstał — env.ts: min(1)) ---
if [ -z "${SELLY_CSV_DIR:-}" ]; then
  log "BŁĄD: pusty SELLY_CSV_DIR (sprawdź $STAGING_ROOT/.env). Przerywam."
  exit 1
fi

# --- guard (ticket 188): katalog aplikacji leży POD docrootem — musi być zablokowany dla WWW ---
# Na vpshd86 wolno nam pisać tylko w public_html/<subdomena>, więc backend, baza i .env są w
# $STAGING_ROOT = $DOCROOT/_app. Bez `Require all denied` w $STAGING_ROOT/.htaccess baza i sekrety
# byłyby do pobrania z internetu. Lepiej nie wdrożyć.
if [ ! -f "$STAGING_ROOT/.htaccess" ] || ! grep -q "Require all denied" "$STAGING_ROOT/.htaccess"; then
  log "BŁĄD: brak blokady WWW ($STAGING_ROOT/.htaccess z 'Require all denied'). Przerywam."
  exit 1
fi

# --- backend: build -> release -> migracje -> pm2 ---
RELEASE="$STAGING_ROOT/releases/$SHA"
log "backend: build -> $RELEASE"
# `--include=dev` jest KONIECZNE: wyżej eksportujemy NODE_ENV=production (dla runtime),
# a przy tej zmiennej `npm ci` pomija devDependencies (TypeScript), bez którego nie ma czym budować.
# `--ignore-scripts`: prebuilt better-sqlite3 wymaga glibc 2.29 (box ma 2.28), a node-gyp 10 nie
# zbuduje ze źródła na Pythonie 3.6 — więc pomijamy skrypty natywne i PODKŁADAMY działającą binarkę
# z produkcji (ta sama wersja 11.7.0 + ten sam ABI node 20 = 115, więc jest w pełni zgodna).
PROD_BSQLITE="$STAGING_ROOT/lib/better_sqlite3.node"   # ticket 188: stała kopia binarki 11.7.0 / ABI 115 na vpshd86
if [ ! -f "$PROD_BSQLITE" ]; then
  log "BŁĄD: brak binarki better-sqlite3 produkcji ($PROD_BSQLITE) do podłożenia. Przerywam."
  exit 1
fi
podloz_bsqlite() {  # $1 = docelowy katalog node_modules
  mkdir -p "$1/better-sqlite3/build/Release"
  cp -f "$PROD_BSQLITE" "$1/better-sqlite3/build/Release/better_sqlite3.node"
}
( cd rebuild/backend && npm ci --include=dev --ignore-scripts )
podloz_bsqlite "rebuild/backend/node_modules"            # dla `npm run migrate` (uruchamiane z repo)
( cd rebuild/backend && npm run build )
mkdir -p "$RELEASE"
cp -a rebuild/backend/dist rebuild/backend/package.json rebuild/backend/package-lock.json "$RELEASE"/
( cd "$RELEASE" && npm ci --omit=dev --ignore-scripts )  # tylko zależności produkcyjne, bez skryptów natywnych
podloz_bsqlite "$RELEASE/node_modules"                   # dla runtime (serwer)
# --- kopia bazy PRZED migracjami ---
# Migracje potrafią PRZEBUDOWAĆ tabelę (SQLite nie ma `ALTER TABLE … ALTER COLUMN`, więc zmiana
# typu kolumny to CREATE → INSERT SELECT → DROP → RENAME; tak działa `003_szerokosc_text.sql`).
# Runner opakowuje każdą migrację w transakcję, więc NIEUDANA wycofa się w całości — ale udanej
# nikt nie cofnie. Skrypt robi kopię TYLKO gdy są migracje do zastosowania (deploy chodzi z crona
# przy każdej zmianie w rebuild/, a ten projekt już raz zasypał dysk backupami — CHANGELOG
# produkcji, 292 pliki / ~6 GB). Trzyma 5 ostatnich kopii w $STAGING_ROOT/data/backups/.
# Kopia idzie przez VACUUM INTO, nie `cp`: baza chodzi w WAL i samo `cp` pliku .db dałoby
# snapshot niespójny. Błąd kopii PRZERYWA deploy (set -e) — lepiej nie wdrożyć niż migrować
# bez punktu powrotu.
log "kopia bazy przed migracjami"
( cd rebuild/backend && DB_PATH="$DATA_DB" ETYKIETA="$SHA" node scripts/kopia-bazy.cjs 2>&1 | tee -a "$LOG" )

( cd rebuild/backend && DB_PATH="$DATA_DB" npm run migrate )   # migracje na bazie staging
ln -sfn "$RELEASE" "$STAGING_ROOT/current"               # atomowa podmiana
# zawsze uruchamiamy BIEŻĄCY release; delete+start jest odporne na (a) placeholder
# trzymający nazwę i (b) pm2 reload trzymający starą, rozwiązaną ścieżkę skryptu po podmianie symlinku
pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
( cd "$STAGING_ROOT/current" && PORT="$PORT" HOST="$HOST" DB_PATH="$DATA_DB" NODE_ENV=production \
    pm2 start dist/server.js --name "$PM2_NAME" --update-env )
pm2 save >/dev/null 2>&1 || true

# --- frontend: build -> publikacja do docroota ---
log "frontend: build -> $DOCROOT"
( cd rebuild/frontend && npm ci --include=dev && npm run build )   # jw. — build wymaga devDependencies
# `--delete` z wyłączeniem .htaccess i katalogu CSV Selly (SELLY_CSV_DIR leży POD docrootem,
# żeby plik był pobieralny) — bez tego każdy deploy kasował wygenerowany CSV (ticket 93).
# ticket 188: $STAGING_ROOT (=$DOCROOT/_app: baza, .env, releases) i cgi-bin leżą POD docrootem —
# MUSZĄ być chronione przed `rsync --delete`, inaczej deploy skasowałby całą aplikację z bazą.
# Ticket 189: tak samo zdjecia-produktow/ (zdjęcia produktów przeniesione z agritires.eu, ~207 MB).
bash tools/publikuj-frontend.sh rebuild/frontend/dist "$DOCROOT" "$SELLY_CSV_DIR" "$STAGING_ROOT" "$DOCROOT/cgi-bin" "$DOCROOT/zdjecia-produktow"
cp -f deploy/staging/htaccess "$DOCROOT/.htaccess"       # proxy utrzymywany z repo

# --- sprzątanie: zostaw 5 ostatnich release ---
ls -1dt "$STAGING_ROOT/releases"/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf

log "OK — wdrożono $SHA na training.agroopony.eu"
