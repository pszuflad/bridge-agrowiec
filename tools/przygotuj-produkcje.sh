#!/bin/bash
# ============================================================================
#  Bridge — przygotuj-produkcje.sh : JEDNORAZOWE przygotowanie środowiska PRODUKCYJNEGO
#  na VPS. Uruchamiasz RĘCZNIE, raz. Potem wdrożeniami zajmuje się deploy-produkcja.sh.
#
#  Co robi (każdy krok jest idempotentny i NICZEGO NIE KASUJE):
#    1. kopie bezpieczeństwa: katalog panelu + produkcyjna baza
#    2. drzewo ~/private_apps/bridge-prod/ i klon repo na gałęzi main
#    3. baza data-prod.db jako spójna migawka produkcyjnej data.db
#    4. data-test.db dla środowiska testowego (kopia, stara nazwa zostaje)
#    5. szkielet pliku .env produkcji (nie nadpisuje istniejącego)
#    6. dedykowana para kluczy SSH dla deployu produkcji + linia do authorized_keys
#    7. wypis, co zrobić dalej (GitHub, DirectAdmin)
#
#  Czego NIE robi świadomie — to są decyzje, nie czynności:
#    - nie zatrzymuje starego stosu (pm2 delete bridge-backend)
#    - nie publikuje frontendu ani nie podmienia .htaccess w katalogu panelu
#    - nie uruchamia migracji (robi je deploy-produkcja.sh, po kopii bazy)
#    - nie zakłada subdomeny w DirectAdmin
#
#  Użycie:
#    bash tools/przygotuj-produkcje.sh            # wykonaj
#    bash tools/przygotuj-produkcje.sh --sucho    # tylko pokaż, co by zrobił
#
#  Pełny kontekst: docs/wdrozenie-produkcji.md
# ============================================================================
set -euo pipefail

SUCHO=0
[ "${1:-}" = "--sucho" ] && SUCHO=1

# --- ścieżki ---
STARY_ROOT="$HOME/private_apps/bridge"                     # stary stos (źródło bazy i sekretów)
TEST_ROOT="$HOME/private_apps/bridge-staging"              # środowisko testowe (zostaje)
PROD_ROOT="$HOME/private_apps/bridge-prod"                 # nowe środowisko produkcyjne
PANEL_DIR="$HOME/domains/agritires.eu/public_html/panel"   # docroot panel.agritires.eu
KOPIE="$HOME/kopie-cutover"
REPO_URL="git@github.com:pszuflad/bridge-agrowiec.git"
STEMPEL="$(date +%F-%H%M)"

krok(){ printf '\n\033[1m=== %s\033[0m\n' "$*"; }
info(){ printf '    %s\n' "$*"; }
ostrz(){ printf '    \033[33m⚠ %s\033[0m\n' "$*"; }
blad(){ printf '    \033[31m✗ %s\033[0m\n' "$*" >&2; }
zrob(){ # echo + wykonanie (albo samo echo przy --sucho)
  printf '    $ %s\n' "$*"
  [ "$SUCHO" = "1" ] || eval "$@"
}

# ---------------------------------------------------------------------------
krok "0. Warunki wstępne"
# ---------------------------------------------------------------------------
[ "$(id -u)" -ne 0 ] || { blad "Nie uruchamiaj jako root — całe środowisko żyje na userze admin."; exit 1; }

for polecenie in git sqlite3 rsync ssh-keygen; do
  command -v "$polecenie" >/dev/null 2>&1 || { blad "Brak polecenia: $polecenie"; exit 1; }
done

# node 20 z nvm — ten sam mechanizm co w skryptach deployu
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
WERSJA_NODE="$(node -v 2>/dev/null || echo brak)"
case "$WERSJA_NODE" in
  v2[0-9].*) info "node $WERSJA_NODE" ;;
  *) ostrz "node to $WERSJA_NODE — deploy wymaga ≥ 20. Sprawdź nvm przed pierwszym wdrożeniem." ;;
esac

command -v pm2 >/dev/null 2>&1 && info "pm2 jest" || ostrz "brak pm2 w PATH — deploy go potrzebuje"

[ -d "$STARY_ROOT" ] || { blad "Nie widzę starego stosu ($STARY_ROOT) — to z niego bierzemy bazę i sekrety."; exit 1; }
[ -f "$STARY_ROOT/data.db" ] || { blad "Brak produkcyjnej bazy $STARY_ROOT/data.db"; exit 1; }
[ -d "$PANEL_DIR" ] || { blad "Brak katalogu panelu ($PANEL_DIR)"; exit 1; }

if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -q ':5000 '; then
  ostrz "port 5000 jest ZAJĘTY (najpewniej stary stos). Przygotowanie i tak przejdzie —"
  ostrz "ale deploy-produkcja.sh nie wstanie, dopóki nie zrobisz: pm2 delete bridge-backend && pm2 save"
fi

[ "$SUCHO" = "1" ] && info "TRYB SUCHY — nic nie zostanie zmienione"

# ---------------------------------------------------------------------------
krok "1. Kopie bezpieczeństwa → $KOPIE"
# ---------------------------------------------------------------------------
zrob "mkdir -p '$KOPIE'"

# Katalog panelu w całości: stary bundle, .htaccess, ex-port-files z plikiem CSV.
# tar, nie cp -a — jeden plik łatwiej odłożyć i łatwiej sprawdzić, że jest kompletny.
if [ -f "$KOPIE/panel-$STEMPEL.tar.gz" ]; then
  info "kopia panelu z tego uruchomienia już jest — pomijam"
else
  zrob "tar -czf '$KOPIE/panel-$STEMPEL.tar.gz' -C '$(dirname "$PANEL_DIR")' '$(basename "$PANEL_DIR")'"
fi

# Baza produkcji przez .backup, NIE cp: baza chodzi w WAL, a kopia samego pliku .db
# byłaby niespójna (brakowałoby zapisów z pliku -wal). sqlite3 hosta ma 3.26, więc
# .backup, a nie VACUUM INTO (to drugie jest dopiero od 3.27).
zrob "sqlite3 '$STARY_ROOT/data.db' \".backup '$KOPIE/data.db.przed-cutover-$STEMPEL'\""
[ "$SUCHO" = "1" ] || info "rozmiar: $(du -h "$KOPIE/data.db.przed-cutover-$STEMPEL" | cut -f1)"

# ---------------------------------------------------------------------------
krok "2. Drzewo produkcji i klon repo na gałęzi main"
# ---------------------------------------------------------------------------
zrob "mkdir -p '$PROD_ROOT/releases' '$PROD_ROOT/data/backups'"

if [ -d "$PROD_ROOT/repo/.git" ]; then
  info "repo już sklonowane — dociągam main"
  zrob "git -C '$PROD_ROOT/repo' fetch origin main --quiet"
  zrob "git -C '$PROD_ROOT/repo' checkout main --quiet"
  zrob "git -C '$PROD_ROOT/repo' reset --hard origin/main --quiet"
else
  zrob "git clone --branch main '$REPO_URL' '$PROD_ROOT/repo'"
fi

# ---------------------------------------------------------------------------
krok "3. Baza produkcji: data-prod.db"
# ---------------------------------------------------------------------------
# UWAGA NA KOLEJNOŚĆ: to jest MIGAWKA. Jeśli stary stos jeszcze pracuje i przyjmuje
# importy, ta kopia zaczyna się starzeć od tej sekundy. Zrób ją PONOWNIE tuż przed
# przełączeniem domeny (skrypt można uruchomić drugi raz — poprosi o potwierdzenie).
if [ -f "$PROD_ROOT/data/data-prod.db" ]; then
  ostrz "data-prod.db JUŻ ISTNIEJE — nie nadpisuję automatycznie."
  ostrz "Żeby odświeżyć ją stanem ze starego stosu (np. tuż przed przełączeniem):"
  info  "  mv '$PROD_ROOT/data/data-prod.db' '$PROD_ROOT/data/data-prod.db.stara-$STEMPEL'"
  info  "  sqlite3 '$STARY_ROOT/data.db' \".backup '$PROD_ROOT/data/data-prod.db'\""
else
  zrob "sqlite3 '$STARY_ROOT/data.db' \".backup '$PROD_ROOT/data/data-prod.db'\""
  [ "$SUCHO" = "1" ] || info "produktów w kopii: $(sqlite3 "$PROD_ROOT/data/data-prod.db" 'SELECT COUNT(*) FROM products;')"
fi

# ---------------------------------------------------------------------------
krok "4. Baza testu: data-nowy.db → data-test.db"
# ---------------------------------------------------------------------------
# KOPIUJEMY, nie przenosimy. Stara nazwa zostaje jako siatka: gdyby wdrożenie testu
# z nową nazwą poszło nie tak, wracasz jedną linijką w DATA_DB. Skasujesz ją ręcznie,
# gdy test przejdzie na data-test.db i chwilę popracuje.
if [ ! -f "$TEST_ROOT/data/data-nowy.db" ]; then
  info "brak $TEST_ROOT/data/data-nowy.db — pomijam (może już przemianowana)"
elif [ -f "$TEST_ROOT/data/data-test.db" ]; then
  info "data-test.db już istnieje — pomijam"
else
  zrob "sqlite3 '$TEST_ROOT/data/data-nowy.db' \".backup '$TEST_ROOT/data/data-test.db'\""
  ostrz "Nazwa w skrypcie testu zmienia się osobno (tools/deploy-staging.sh, DATA_DB) —"
  ostrz "zmiana wchodzi przez PR do develop, nie tym skryptem."
fi

# ---------------------------------------------------------------------------
krok "5. Plik środowiska produkcji"
# ---------------------------------------------------------------------------
ENV_PROD="$PROD_ROOT/.env"
if [ -f "$ENV_PROD" ]; then
  ostrz "$ENV_PROD już istnieje — NIE nadpisuję. Sprawdź go sam:"
  info  "  for K in JWT_SECRET AGRORAMI_EMAIL AGRORAMI_PASSWORD SELLY_TRYB SELLY_SCHEDULER \\"
  info  "           SELLY_SHOP_URL SELLY_CLIENT_ID SELLY_CLIENT_SECRET IMPORT_SCHEDULER IMPORT_ARCHIVE_DIR; do"
  info  "    printf '%-24s %s\\n' \"\$K\" \"\$(grep -c \"^\$K=\" '$ENV_PROD' | sed 's/^0\$/BRAK/; s/^[1-9].*/jest/')\"; done"
else
  # Sekrety przepisujemy ze STAREGO stosu — to te same klucze, których używała produkcja.
  # Nie wypisujemy ich na ekran: skrypt bywa uruchamiany przy świadkach i trafia do logu terminala.
  ENV_STARY="$STARY_ROOT/.env"
  przepisz(){ # $1 = nazwa zmiennej; przepisuje linię ze starego .env, jeśli jest
    if [ -f "$ENV_STARY" ] && grep -q "^$1=" "$ENV_STARY" 2>/dev/null; then
      grep "^$1=" "$ENV_STARY" | head -1
    else
      echo "# $1=   # ⚠ UZUPEŁNIJ — nie znalazłem w $ENV_STARY"
    fi
  }
  if [ "$SUCHO" = "1" ]; then
    info "utworzyłbym $ENV_PROD (szkielet + sekrety przepisane ze starego .env)"
  else
    {
      echo "# Bridge — środowisko PRODUKCYJNE (panel.agritires.eu)"
      echo "# Wygenerowane przez tools/przygotuj-produkcje.sh, $STEMPEL"
      echo "# Wczytywane przez tools/deploy-produkcja.sh. NIE commitować."
      echo
      echo "# --- fundament ---"
      przepisz JWT_SECRET
      echo
      echo "# --- import ---"
      echo "IMPORT_SCHEDULER=true"
      echo "IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG=true"
      echo "IMPORT_ARCHIVE_DIR=$STARY_ROOT/import_archive"
      echo
      echo "# --- MO9 (jedyny dostawca przez API; bez tego import MO9 pada bez ostrzeżenia) ---"
      przepisz AGRORAMI_EMAIL
      przepisz AGRORAMI_PASSWORD
      echo
      echo "# --- Selly: FAZA 1 przełączenia (zapisy do sklepu zablokowane) ---"
      echo "# Po smoke-testach zmień na: SELLY_TRYB=pelny i SELLY_SCHEDULER=true"
      echo "SELLY_TRYB=tylko-odczyt"
      echo "SELLY_SCHEDULER=false"
      przepisz SELLY_SHOP_URL
      przepisz SELLY_CLIENT_ID
      przepisz SELLY_CLIENT_SECRET
      echo "SELLY_SCOPE=READWRITE"
      echo
      echo "# --- plik CSV: katalog POD docrootem panelu (chroniony przed rsync --delete) ---"
      echo "SELLY_CSV_DIR=$PANEL_DIR/ex-port-files"
      echo "SELLY_CSV_PLIK=sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv"
      echo "SELLY_CSV_URL=https://agritires.eu/panel/ex-port-files/sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv"
    } > "$ENV_PROD"
    chmod 600 "$ENV_PROD"
    info "utworzony, chmod 600"
    BRAKI="$(grep -c '⚠ UZUPEŁNIJ' "$ENV_PROD" || true)"
    [ "$BRAKI" = "0" ] || ostrz "$BRAKI pozycji do ręcznego uzupełnienia — szukaj 'UZUPEŁNIJ' w $ENV_PROD"
  fi
fi

# ---------------------------------------------------------------------------
krok "6. Klucz SSH dla deployu produkcji"
# ---------------------------------------------------------------------------
# Osobny klucz jest KONIECZNY, nie kosmetyczny: klucz stagingu ma w authorized_keys
# wymuszone `command="…deploy-staging.sh"`, a wymuszone polecenie ignoruje to, o co
# prosi klient. Tym samym kluczem nie da się uruchomić skryptu produkcji.
KLUCZ="$HOME/.ssh/deploy_prod_ed25519"
if [ -f "$KLUCZ" ]; then
  info "klucz już istnieje: $KLUCZ"
else
  zrob "ssh-keygen -t ed25519 -N '' -C 'deploy-produkcja-bridge' -f '$KLUCZ'"
fi

# ---------------------------------------------------------------------------
krok "7. Co zrobić dalej — RĘCZNIE"
# ---------------------------------------------------------------------------
cat <<KONIEC

  A. Dopisz do ~/.ssh/authorized_keys JEDNĄ linię (wymuszone polecenie = klucz nie
     daje powłoki, tylko uruchamia ten skrypt):

     printf 'command="bash $PROD_ROOT/repo/tools/deploy-produkcja.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty %s\\n' \\
       "\$(cat $KLUCZ.pub)" >> ~/.ssh/authorized_keys

  B. Sekrety w GitHubie (Settings → Secrets and variables → Actions):
       PROD_SSH_KEY          zawartość $KLUCZ   (klucz PRYWATNY)
       PROD_SSH_KNOWN_HOSTS  ssh-keyscan -p <port> <host>
       PROD_SSH_HOST / PROD_SSH_PORT / PROD_SSH_USER   jak przy stagingu

  C. Subdomena panel.agritires.eu w DirectAdmin → DocumentRoot:
       $PANEL_DIR
     plus certyfikat SSL (Let's Encrypt).

  D. Uzupełnij $ENV_PROD, jeśli skrypt zgłosił braki.

  E. Dopiero teraz: pm2 delete bridge-backend && pm2 save   (dobicie starego stosu),
     a potem pierwszy deploy:
       FORCE=1 bash $PROD_ROOT/repo/tools/deploy-produkcja.sh

  Kopie bezpieczeństwa leżą w: $KOPIE

KONIEC
