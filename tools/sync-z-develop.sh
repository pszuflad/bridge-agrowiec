#!/usr/bin/env bash
# Synchronizacja gałęzi z bazą (domyślnie develop) PRZED pushem i utworzeniem PR-a.
# Użycie: tools/sync-z-develop.sh [gałąź-bazowa]      np. tools/sync-z-develop.sh develop
#
# Działa na repozytorium z BIEŻĄCEGO katalogu (w trybie kart/worktree uruchamiaj z cwd worktree).
# Kody wyjścia: 0 = gałąź była już aktualna (nic nie weszło) · 10 = scalone czysto, WESZŁY zmiany
#               (bramki od nowa przed pushem) · 2 = konflikty do ręcznego rozwiązania
#               · 1 = warunki wstępne niespełnione (nie merguje niczego).
# Operacje na .git są ponawiane przy blokadach (kilkadziesiąt worktree na jednym .git) — lib-ponow.sh.
set -uo pipefail

kat_skryptu="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tools/lib-ponow.sh
source "$kat_skryptu/lib-ponow.sh"

bazowa="${1:-develop}"

korzen=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "✗ To nie jest repozytorium git: $PWD"; exit 1; }
cd "$korzen"
echo "Repozytorium: $korzen"

galaz=$(git symbolic-ref --short -q HEAD) || { echo "✗ HEAD odłączony (detached) — przełącz się na gałąź ticketa."; exit 1; }
echo "Gałąź:        $galaz"
echo "Baza:         origin/$bazowa"

case "$galaz" in
  "$bazowa"|main|master)
    echo "✗ Jesteś na gałęzi bazowej ($galaz) — skrypt jest do gałęzi ticketa/karty."; exit 1;;
esac

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "✗ Katalog roboczy ma niezacommitowane zmiany — najpierw commit (albo stash)."
  git status --short --untracked-files=no | head -20
  exit 1
fi

if ! ponow git fetch origin --prune; then
  case "$PONOW_POWOD" in
    auth) echo "✗ git fetch odbity na uwierzytelnieniu — ponawianie nie pomoże, to do użytkownika."; exit 3;;
    *)    echo "✗ git fetch origin nie powiódł się (powód: ${PONOW_POWOD:-nieznany})."; exit 1;;
  esac
fi
git rev-parse --verify -q "origin/$bazowa" >/dev/null || { echo "✗ Brak origin/$bazowa."; exit 1; }

# 1) Gałąź mogła zostać popchnięta wcześniej i zdobyć commity na zdalnej kopii.
if git rev-parse --verify -q "origin/$galaz" >/dev/null; then
  if ! git merge-base --is-ancestor "origin/$galaz" HEAD; then
    echo "→ origin/$galaz ma commity, których nie masz lokalnie — scalam je."
    ponow git merge --no-edit "origin/$galaz" || {
      echo "✗ KONFLIKT przy scalaniu własnej gałęzi zdalnej:"; git diff --name-only --diff-filter=U; exit 2; }
  fi
fi

# 2) Właściwa synchronizacja z bazą.
if git merge-base --is-ancestor "origin/$bazowa" HEAD; then
  echo "✓ Gałąź zawiera już całe origin/$bazowa — nie ma czego scalać."
  exit 0
fi

echo "→ Za origin/$bazowa o $(git rev-list --count "HEAD..origin/$bazowa") commit(ów). Scalam."
przed=$(git rev-parse HEAD)

if ponow git merge --no-edit "origin/$bazowa"; then
  echo "✓ Merge czysty. Pliki, które weszły z bazy:"
  git diff --name-only "$przed" HEAD | head -40
  echo
  echo "⚠ Baza się zmieniła → PRZED pushem przebiegnij bramki jeszcze raz"
  echo "  (rebuild/backend: npm run lint && npm run typecheck && npm run build && npm test)."
  exit 10
fi

echo
echo "✗ KONFLIKTY — merge zatrzymany. Pliki w konflikcie:"
git diff --name-only --diff-filter=U
cat <<'POMOC'

Rozwiąż ręcznie (NIE przerywaj merge'a przez `git merge --abort`, chyba że użytkownik tak zdecyduje):
  1. otwórz każdy plik z listy, połącz OBIE strony — zmiana z bazy zostaje, Twoja zostaje;
  2. `git add <plik>` dla każdego, potem `git commit --no-edit`;
  3. przebiegnij bramki od nowa (lint / typecheck / build / test) — merge mógł zepsuć kod, który
     osobno był poprawny;
  4. uruchom ten skrypt ponownie — ma wyjść "Gałąź zawiera już całe origin/<baza>".

Konflikt w pliku współdzielonym (docs/rebuild-roadmap.md, docs/spec-backend.md) to sygnał, że
ktoś złamał zasadę „karty piszą we własnych plikach" — zob. CLAUDE.md i docs/karty/README.md.
POMOC
exit 2
