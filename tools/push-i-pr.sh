#!/usr/bin/env bash
# Wypchnięcie gałęzi + utworzenie PR-a do `develop`, z ponawianiem przy blokadach.
#
# Użycie:
#   tools/push-i-pr.sh --tytul "<TICKET-ID>: tytuł" --tresc-plik docs/tickets/<ID>/pr-body.md \
#                      [--baza develop] [--bez-sync]
#
# Kody wyjścia:
#   0 — wypchnięte, PR istnieje i jest MERGEABLE (URL na końcu wyjścia)
#   1 — warunek wstępny (niezacommitowane zmiany, HEAD odłączony, jesteś na gałęzi bazowej, zły argument)
#   2 — konflikty z bazą do ręcznego rozwiązania (nic nie wypchnięto)
#   3 — uwierzytelnienie (`gh`/git) — ponawianie nic nie da, potrzebna reakcja użytkownika
#   4 — baza wniosła zmiany: przebiegnij bramki i uruchom ponownie (nic nie wypchnięto)
#   5 — PR utworzony/istnieje, ale GitHub widzi konflikt (CONFLICTING)
#   6 — blokada nie ustąpiła mimo ponawiania (inna karta trzyma .git albo limit GitHuba)
set -uo pipefail

kat_skryptu="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tools/lib-ponow.sh
source "$kat_skryptu/lib-ponow.sh"

baza=develop; tytul=""; tresc_plik=""; bez_sync=0
while (( $# )); do
  case "$1" in
    --tytul) tytul="${2:-}"; shift 2;;
    --tresc-plik) tresc_plik="${2:-}"; shift 2;;
    --baza) baza="${2:-}"; shift 2;;
    --bez-sync) bez_sync=1; shift;;
    *) echo "✗ Nieznany argument: $1"; exit 1;;
  esac
done

if [[ -n "$tresc_plik" && ! -f "$tresc_plik" ]]; then
  echo "✗ Brak pliku z treścią PR-a: $tresc_plik (sprawdzam to teraz, żeby nie wypchnąć i dopiero polec)."; exit 1
fi

korzen=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "✗ To nie jest repozytorium git: $PWD"; exit 1; }
cd "$korzen"
galaz=$(git symbolic-ref --short -q HEAD) || { echo "✗ HEAD odłączony — przełącz się na gałąź ticketa."; exit 1; }
case "$galaz" in "$baza"|main|master) echo "✗ Jesteś na gałęzi bazowej ($galaz)."; exit 1;; esac
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "✗ Niezacommitowane zmiany — najpierw commit."; git status --short --untracked-files=no | head -20; exit 1
fi

# --- 1. Uwierzytelnienie: sprawdzamy ZANIM cokolwiek zrobimy ---------------------------------
# `gh auth status` bywa czerwony (np. „token in keyring is invalid”) mimo działającego tokenu —
# rozstrzyga dopiero realne wywołanie API.
if ! ponow gh api user -q .login >/dev/null; then
  cat <<'POMOC'
✗ `gh` nie ma działającego dostępu do GitHuba — ponawianie tego NIE naprawi.
  Sprawdź: gh auth status   →   napraw: gh auth login -h github.com
  (typowa przyczyna na tej maszynie: token trzymany w keyringu, a keyring w tej sesji
   nie jest odblokowany — wtedy `gh auth status` mówi „token in keyring is invalid”).
POMOC
  exit 3
fi

# --- 2. Synchronizacja z bazą ----------------------------------------------------------------
if (( bez_sync == 0 )); then
  "$kat_skryptu/sync-z-develop.sh" "$baza"; kod_sync=$?
  case "$kod_sync" in
    0)  ;;                                   # aktualna — idziemy dalej
    10) echo; echo "✗ Baza wniosła zmiany do gałęzi. Przebiegnij bramki (lint/typecheck/build/test"
        echo "  + GATE na fixtures, jeśli ticket dotyka kontraktu) i uruchom ten skrypt ponownie."
        exit 4;;
    2)  echo; echo "✗ Konflikty z $baza — rozwiąż je, potem uruchom ten skrypt ponownie."; exit 2;;
    *)  echo; echo "✗ Synchronizacja nie powiodła się (kod $kod_sync) — nic nie wypycham."; exit "$kod_sync";;
  esac
fi

# --- 3. Push (ponawiany przy blokadach .git i problemach sieci) -------------------------------
wypchnij() {
  if ponow git push -u origin "$galaz"; then return 0; fi
  case "$PONOW_POWOD" in
    auth) cat <<'POMOC'
✗ git push odbity na uwierzytelnieniu — ponawianie nic nie da.
  Remote jest po HTTPS, więc sprawdź poświadczenia gita (`credential.helper`, ~/.git-credentials)
  albo ustaw świeży token. To decyzja użytkownika, nie zgaduję.
POMOC
          exit 3;;
    nieaktualna)
          echo "→ origin/$galaz poszedł do przodu (ktoś/coś dopchnęło) — synchronizuję i próbuję raz jeszcze."
          "$kat_skryptu/sync-z-develop.sh" "$baza"; local k=$?
          case "$k" in
            0) ;;
            10) echo "✗ Przy okazji weszły zmiany z $baza — bramki od nowa, potem uruchom ponownie."; exit 4;;
            2)  echo "✗ Konflikty — rozwiąż i uruchom ponownie."; exit 2;;
            *)  exit "$k";;
          esac
          ponow git push -u origin "$galaz" || { echo "✗ Push nie przeszedł również za drugim razem."; exit 6; };;
    blokada|sieć) echo "✗ Push zablokowany mimo ponawiania."; exit 6;;
    *) echo "✗ Push nie przeszedł (powód: ${PONOW_POWOD:-nieznany})."; exit 6;;
  esac
}
wypchnij

# --- 4. PR: użyj istniejącego albo utwórz -----------------------------------------------------
url_pr=$(gh pr list --head "$galaz" --state open --json url -q '.[0].url' 2>/dev/null)
if [[ -n "$url_pr" ]]; then
  echo "→ PR dla $galaz już istnieje: $url_pr (nie tworzę drugiego)."
else
  [[ -n "$tytul" && -n "$tresc_plik" ]] || { echo "✗ Do utworzenia PR-a potrzebne --tytul i --tresc-plik."; exit 1; }
  [[ -f "$tresc_plik" ]] || { echo "✗ Brak pliku z treścią PR-a: $tresc_plik"; exit 1; }
  if ! ponow gh pr create --base "$baza" --head "$galaz" --title "$tytul" --body-file "$tresc_plik"; then
    [[ "$PONOW_POWOD" == auth ]] && { echo "✗ gh: problem z uwierzytelnieniem."; exit 3; }
    echo "✗ Nie udało się utworzyć PR-a (powód: ${PONOW_POWOD:-nieznany})."; exit 6
  fi
  url_pr=$(gh pr list --head "$galaz" --state open --json url -q '.[0].url' 2>/dev/null)
fi

# --- 5. Scalalność: GitHub liczy ją asynchronicznie -------------------------------------------
stan=""; for i in 1 2 3; do
  stan=$(gh pr view "$url_pr" --json mergeable -q .mergeable 2>/dev/null)
  [[ "$stan" != "UNKNOWN" && -n "$stan" ]] && break
  sleep $((i*4))
done
echo
echo "PR:        ${url_pr:-<brak URL>}"
echo "Scalalny:  ${stan:-NIEZNANY}"
case "$stan" in
  MERGEABLE) exit 0;;
  CONFLICTING)
    echo "✗ GitHub widzi konflikt — w międzyczasie coś weszło do $baza."
    echo "  Uruchom: tools/sync-z-develop.sh $baza → rozwiąż → bramki → ten skrypt ponownie."
    exit 5;;
  *) echo "⚠ GitHub jeszcze nie policzył scalalności. Sprawdź za chwilę:"
     echo "  gh pr view $url_pr --json mergeable,mergeStateStatus"
     exit 0;;
esac
