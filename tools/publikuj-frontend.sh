#!/bin/bash
# ============================================================================
#  Bridge — publikuj-frontend.sh : kopiuje zbudowany frontend do docroota stagingu.
#  Wołany z tools/deploy-staging.sh; osobny plik, żeby dało się go przetestować
#  (rebuild/backend/test/publikacja-frontendu.test.ts) bez uruchamiania całego deployu.
#
#  Użycie: publikuj-frontend.sh <dist> <docroot> [chroniony-katalog ...]
#
#  `rsync --delete` usuwa z docroota wszystko, czego nie ma w <dist>. Poza zbudowanym
#  frontendem w docroocie żyją pliki, których build nie zna — i te trzeba wyłączyć:
#   - .htaccess — utrzymywany w repo i kopiowany osobno przez deploy;
#   - każdy <chroniony-katalog> leżący POD docrootem — dziś katalog CSV Selly
#     (SELLY_CSV_DIR = $DOCROOT/ex-port-files, ticket 34). Bez tego każdy deploy kasował
#     plik z „Wygeneruj CSV teraz" i panel wracał do „Brak pliku CSV" (ticket 93, karta PR.4).
#     Katalog poza docrootem rsync i tak omija — jest pomijany bez błędu.
# ============================================================================
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Użycie: $0 <dist> <docroot> [chroniony-katalog ...]" >&2
  exit 2
fi

DIST="${1%/}"
DOCROOT="${2%/}"
shift 2

wykluczenia=(--exclude '.htaccess')
for katalog in "$@"; do
  katalog="${katalog%/}"
  case "$katalog" in
    "$DOCROOT"/?*) wykluczenia+=(--exclude "/${katalog#"$DOCROOT"/}/") ;;
  esac
done

mkdir -p "$DOCROOT"
rsync -a --delete "${wykluczenia[@]}" "$DIST"/ "$DOCROOT"/
