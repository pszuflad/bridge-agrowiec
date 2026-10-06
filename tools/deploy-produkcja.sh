#!/bin/bash
# ============================================================================
#  Bridge — deploy-produkcja.sh : CD po stronie VPS dla PRODUKCJI.
#  Wdraża nową wersję (rebuild/) na środowisko PRODUKCYJNE (bridgeone.agroopony.eu, VPS vpshd86).
#  ⚠ Ticket 188 (2026-10-05): produkcja przeniesiona z vpshd1242 (panel.agritires.eu) na vpshd86.
#  Układ: docroot public_html/bridgeone, aplikacja w public_html/bridgeone/_app (zablokowane dla WWW).
#  Uruchamiany z GitHub Actions po pushu do `main`. Laptopy tego nie odpalają.
#
#  ⚠ To jest WIERNE ODBICIE tools/deploy-staging.sh. Różnice są WYŁĄCZNIE w konfiguracji
#  na górze pliku plus trzy bramki bezpieczeństwa, których staging nie potrzebuje
#  (opisane niżej przy każdej). Zmieniasz jeden skrypt — sprawdź, czy drugi nie wymaga
#  tej samej zmiany.
#
#  Różnice wobec stagingu:
#   | gałąź     | develop            -> main                                   |
#   | katalog   | public_html/training -> public_html/bridgeone (agroopony.eu) |
#   | port      | 5001 (127.0.0.1)   -> 5000 (127.0.0.1)                       |
#   | proces    | bridge-backend-staging -> bridge-backend-prod                |
#   | baza      | data-test.db       -> data-prod.db                           |
#   | Selly     | twardo wyłączone   -> z .env (produkcja ma pisać do sklepu)  |
#
#  Konfiguracja i pełna instrukcja: docs/wdrozenie-produkcji.md
# ============================================================================
set -euo pipefail

# --- konfiguracja ---
DOCROOT="$HOME/domains/agroopony.eu/public_html/bridgeone" # docroot bridgeone.agroopony.eu
PROD_ROOT="$DOCROOT/_app"                                 # repo/, releases/, current, data/, node/, bin/, lib/
REPO_DIR="$PROD_ROOT/repo"                                # klon repo śledzący main
DATA_DB="$PROD_ROOT/data/data-prod.db"                    # baza produkcji
PM2_NAME="bridge-backend-prod"
BRANCH="main"
LOG="$PROD_ROOT/deploy.log"
export PORT=5000 HOST=127.0.0.1 NODE_ENV=production DB_PATH="$DATA_DB"

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

# Sekrety środowiska — plik POZA repo, tworzony raz ręcznie (układ: docs/tickets/188-CHORE-deploy-agroopony/plan.md).
if [ -f "$PROD_ROOT/.env" ]; then set -a; . "$PROD_ROOT/.env"; set +a; fi

log(){ echo "$(date '+%F %T')  $*" | tee -a "$LOG"; }

# node z nvm (build wymaga node 20)
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
# ticket 188 (vpshd86): na nowym serwerze nie ma nvm ani globalnego pm2 — Node 20 leży w
# $PROD_ROOT/node/bin, a $PROD_ROOT/bin/pm2 to nakładka na wspólny demon PM2
# (PM2_HOME=bridgeone/_app/.pm2, autostart cronem DirectAdmin). Dokładamy je na początek PATH.
[ -d "$PROD_ROOT/node/bin" ] && export PATH="$PROD_ROOT/node/bin:$PATH"
[ -d "$PROD_ROOT/bin" ] && export PATH="$PROD_ROOT/bin:$PATH"

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
  log "BŁĄD: brak JWT_SECRET. Utwórz $PROD_ROOT/.env (układ: docs/tickets/188-CHORE-deploy-agroopony/plan.md). Przerywam."
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
  log "BŁĄD: baza produkcji nie istnieje ($DATA_DB). Sprawdź układ _app/ wg docs/tickets/188-CHORE-deploy-agroopony/plan.md. Przerywam."
  exit 1
fi

# --- guard PRODUKCYJNY 2: docroot musi istnieć ---
# Gdyby go nie było, publikuj-frontend.sh utworzyłby go pustym i panel zniknąłby z internetu
# razem z katalogiem ex-port-files.
if [ ! -d "$DOCROOT" ]; then
  log "BŁĄD: docroot nie istnieje ($DOCROOT). Sprawdź układ _app/ wg docs/tickets/188-CHORE-deploy-agroopony/plan.md. Przerywam."
  exit 1
fi

# --- guard (ticket 188): katalog aplikacji leży POD docrootem — musi być zablokowany dla WWW ---
# Na vpshd86 wolno nam pisać tylko w public_html/<subdomena>, więc backend, baza i .env są w
# $PROD_ROOT = $DOCROOT/_app. Bez `Require all denied` w $PROD_ROOT/.htaccess baza i sekrety
# byłyby do pobrania z internetu. Lepiej nie wdrożyć.
if [ ! -f "$PROD_ROOT/.htaccess" ] || ! grep -q "Require all denied" "$PROD_ROOT/.htaccess"; then
  log "BŁĄD: brak blokady WWW ($PROD_ROOT/.htaccess z 'Require all denied'). Przerywam."
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
PROD_BSQLITE="$PROD_ROOT/lib/better_sqlite3.node"   # ticket 188: stała kopia binarki 11.7.0 / ABI 115 na vpshd86
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

# --- ticket 164/164b/164d: naprawa nazw sklejonych opon (kolizje kod_importu) ---
# ⚠ JEDYNY CELOWY ROZJAZD wobec deploy-staging.sh (nagłówek pliku: "poza konfiguracją
# identyczne") — to naprawa DANYCH produkcyjnych, nie coś, co staging potrzebuje.
#
# ⚠ TICKET 164c wprowadził tu wcześniej plik-znacznik ("uruchom tylko raz"), ale pierwszy
# deploy z tym blokiem (2026-09-30, commit 699d448) NIE wykonał kroku — log deployu nie ma
# ani jednej linii z tego bloku, a przerwa czasowa między `npm run migrate` a startem PM2 jest
# rzędu ułamka sekundy (za mało na uruchomienie Node/tsx). Przyczyna nieustalona (plik-znacznik
# najwyraźniej już istniał na serwerze, mimo że nie powinien — nie dało się tego zdiagnozować
# bez dostępu SSH, którego świadomie unikamy, patrz niżej). Zamiast dalej zgadywać: USUNIĘTO
# znacznik, blok wykonuje się PRZY KAŻDYM deployu bezwarunkowo. Bezpieczne — sam skrypt jest
# idempotentny (upsert w `manual_overrides` + porównanie przed zapisem w `products.nazwa`),
# więc powtarzanie go przy każdym deployu nie szkodzi, tylko kosztuje ułamek sekundy.
log "ticket 164: naprawa nazw sklejonych opon (manual_overrides + products.nazwa)"
( cd rebuild/backend && DB_PATH="$DATA_DB" npm run napraw-nazwy-sklejone 2>&1 | tee -a "$LOG" )

# --- ticket 165: rozdzielenie kod_importu dla tych samych znanych kolizji (backlog #108) ---
# Ten sam dostawca ma dwie fizycznie różne opony pod jednym kod_importu, więc Tor 1 (sync do
# Selly co 15 min) nadpisuje sobie nawzajem zapamiętany stan w selly_products i obie stale
# "wyglądają na zmienione". Świadome odstępstwo od 1:1 (decyzja użytkownika) — nadajemy nowy,
# unikalny numer każdemu produktowi w grupie oprócz pierwszego; `nadajKodImportu()` utrzyma tę
# naprawę przy przyszłych importach (reguła "zachowaj istniejący sześciocyfrowy kod_importu").
# Bezwarunkowo, jak wyżej — skrypt jest idempotentny (porównanie przed zapisem).
#
# ⚠ TICKET 165b: ta linia (bez efektu funkcjonalnego) istnieje wyłącznie po to, żeby ten PR
# faktycznie zmienił `tools/deploy-produkcja.sh` — ze względu na odkrycie z 164d (skrypt
# aktualizuje sam siebie w trakcie działania), krok wyżej dodany w PR #221 nie wykonał się przy
# PIERWSZYM deployu po jego zmergowaniu (ten deploy uruchomił jeszcze POPRZEDNIĄ wersję pliku).
# Ten commit wymusza DRUGI deploy, który faktycznie uruchomi kod 165 — patrz
# `docs/tickets/165-BUG-rozdziel-kod-importu/raport.md`, sekcja Follow-up.
log "ticket 165: rozdzielenie kod_importu dla znanych kolizji (backlog #108)"
( cd rebuild/backend && DB_PATH="$DATA_DB" npm run rozdziel-kod-importu 2>&1 | tee -a "$LOG" )

# --- ticket 168: uzupełnienie pustych EAN-ów (prefiks 999, tabela ean_pary) ---
# NOWA logika biznesowa (decyzja użytkownika 2026-09-30): przy wdrożeniu każdy produkt z PUSTYM EAN
# dostaje EAN z reguły. Idempotentne — dotyka wyłącznie pustych pól, więc bezwarunkowe uruchamianie
# przy każdym deployu jest bezpieczne (jak naprawa nazw wyżej); kopia bazy z kroku wyżej to punkt
# powrotu. Wynik (liczby) ląduje w logu deployu.
# ⚠ Deploy 97825d6 (merge ticketu 168) wykonał jeszcze STARĄ wersję tego skryptu (bash czytał plik sprzed
# `git reset --hard`), więc ten krok ruszył dopiero w następnym deployu — jak kroki 164c i 165b.
log "ticket 168: uzupełnienie pustych EAN (999…)"
( cd rebuild/backend && DB_PATH="$DATA_DB" npm run uzupelnij-ean 2>&1 | tee -a "$LOG" )

# --- podmiana źródeł cenników na lokalne foldery dostawców (IMPORTY_KATALOG z $PROD_ROOT/.env) ---
# Stare adresy agroopony.eu/imports/ znikają; pole url dostawców (poza MO2 i MO3) dostaje
# plik:///<katalog>/<KOD>_…, widoczne w panelu. Idempotentne; bez IMPORTY_KATALOG krok się pomija.
log "podmiana źródeł cenników na foldery dostawców"
( cd rebuild/backend && DB_PATH="$DATA_DB" npm run podmien-zrodla 2>&1 | tee -a "$LOG" )

# --- czyszczenie katalogu: DOT tylko w nazwie (model/bieżnik bez DOT) + poprawki z ticketu 178 ---
# Parser MO9 zostawia w modelu „DOT2016”; import czyści to od nowa, ale stare pozycje katalogu
# zostawały z DOT w modelu i wpadały do stagingu jako „Zmiana kluczowa”. Skrypt używa tej samej
# logiki co import (`normalizujPozycje`), NIE rusza `nazwa` i pomija pola z poprawką ręczną
# (`manual_overrides`). Idempotentny: gdy katalog jest czysty, nie zapisuje i nie robi kopii
# (punkt powrotu to kopia bazy sprzed migracji). Uwaga: to samo przejście poprawia też inne pola
# z ticketu 178 (dopiski osi, konstrukcja, DOT dwucyfrowy, ucięte indeksy).
log "czyszczenie katalogu: DOT w modelu/bieżniku (normalizuj-katalog --apply)"
( cd rebuild/backend && DB_PATH="$DATA_DB" npm run normalizuj-katalog -- --apply 2>&1 | tee -a "$LOG" )

# --- kroki wdrożenia: jednorazowe operacje na danych (zmiana nazw, konta, poprawki) ---
# Rejestr: rebuild/backend/src/kroki/rejestr.ts. Każdy krok biegnie RAZ (zapis w tabeli
# `kroki_wdrozenia`), PO kopii bazy z kroku wyżej. Krok z sekretem (np. HASLO_TYMCZASOWE z
# $PROD_ROOT/.env) pomija się z wpisem w logu, gdy sekretu brak. Błąd kroku przerywa deploy PRZED
# podmianą release'u (set -e) — poprzednia wersja dalej działa. Dzięki temu poprawka danych jedzie
# z merge'em do `main`, a nikt nie uruchamia niczego ręcznie na serwerze.
log "kroki wdrożenia (rejestr: rebuild/backend/src/kroki/rejestr.ts)"
( cd rebuild/backend && DB_PATH="$DATA_DB" npm run kroki-wdrozenia 2>&1 | tee -a "$LOG" )

ln -sfn "$RELEASE" "$PROD_ROOT/current"                  # atomowa podmiana
pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
( cd "$PROD_ROOT/current" && PORT="$PORT" HOST="$HOST" DB_PATH="$DATA_DB" NODE_ENV=production \
    pm2 start dist/server.js --name "$PM2_NAME" --update-env )
pm2 save >/dev/null 2>&1 || true

# --- frontend: build -> publikacja do docroota ---
log "frontend: build -> $DOCROOT"
( cd rebuild/frontend && npm ci --include=dev && npm run build )
# ticket 188: $PROD_ROOT (=$DOCROOT/_app: baza, .env, releases) i cgi-bin leżą POD docrootem —
# MUSZĄ być chronione przed `rsync --delete`, inaczej deploy skasowałby całą aplikację z bazą.
# Ticket 189: tak samo zdjecia-produktow/ (zdjęcia produktów przeniesione z agritires.eu, ~207 MB).
bash tools/publikuj-frontend.sh rebuild/frontend/dist "$DOCROOT" "$SELLY_CSV_DIR" "$PROD_ROOT" "$DOCROOT/cgi-bin" "$DOCROOT/zdjecia-produktow"
cp -f deploy/produkcja/htaccess "$DOCROOT/.htaccess"     # proxy utrzymywany z repo

# --- sprzątanie: zostaw 5 ostatnich release ---
ls -1dt "$PROD_ROOT/releases"/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf

log "OK — wdrożono $SHA na bridgeone.agroopony.eu"
