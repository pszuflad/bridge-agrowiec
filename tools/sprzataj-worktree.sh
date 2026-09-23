#!/usr/bin/env bash
# Usuwa worktree kart, które są już niepotrzebne: gałąź w całości w bazie (domyślnie develop),
# katalog czysty, nic niewypchniętego. Gałęzi NIE kasuje — znika tylko katalog roboczy.
#
# Użycie:
#   tools/sprzataj-worktree.sh              # podgląd: co poszłoby do usunięcia i co zostaje (z powodem)
#   tools/sprzataj-worktree.sh --usun       # faktyczne usunięcie
#   tools/sprzataj-worktree.sh --usun main  # inna gałąź bazowa
#
# Po co: każdy worktree dzieli JEDEN katalog .git, więc im ich więcej, tym częstsze wyścigi
# o pliki blokad przy równoległych `fetch`/`push` (CLAUDE.md, „Przed każdym PR").
set -uo pipefail

usun=0; baza=develop
for arg in "$@"; do
  case "$arg" in
    --usun) usun=1;;
    --*) echo "✗ Nieznany argument: $arg"; exit 1;;
    *) baza="$arg";;
  esac
done

korzen=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "✗ To nie jest repozytorium git: $PWD"; exit 1; }
glowny=$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')
biezacy="$korzen"

git fetch -q origin --prune || { echo "✗ git fetch origin nie powiódł się — bez świeżej bazy nie oceniam."; exit 1; }
git rev-parse --verify -q "refs/remotes/origin/$baza" >/dev/null || { echo "✗ Brak origin/$baza."; exit 1; }

echo "Baza: origin/$baza · tryb: $([ $usun = 1 ] && echo USUWANIE || echo podgląd)"
echo

do_usuniecia=(); zostaja=0; usuniete=0; bledy=0

while IFS='|' read -r sciezka galaz; do
  [[ -z "$sciezka" ]] && continue
  nazwa=$(basename "$sciezka")

  if [[ "$sciezka" == "$glowny" ]]; then continue; fi
  if [[ "$sciezka" == "$biezacy" ]]; then
    printf '  ZOSTAJE  %-48s %s\n' "$nazwa" "pracujesz w nim teraz"; ((zostaja++)); continue
  fi
  if [[ -z "$galaz" ]]; then
    printf '  ZOSTAJE  %-48s %s\n' "$nazwa" "HEAD odłączony — oceń ręcznie"; ((zostaja++)); continue
  fi

  g="${galaz#refs/heads/}"

  if [[ -n "$(git -C "$sciezka" status --porcelain 2>/dev/null)" ]]; then
    ile=$(git -C "$sciezka" status --porcelain | wc -l)
    printf '  ZOSTAJE  %-48s %s\n' "$nazwa" "$ile niezacommitowanych/nieśledzonych plików"; ((zostaja++)); continue
  fi

  if ! git merge-base --is-ancestor "$galaz" "refs/remotes/origin/$baza" 2>/dev/null; then
    przed=$(git rev-list --count "refs/remotes/origin/$baza..$galaz" 2>/dev/null)
    printf '  ZOSTAJE  %-48s %s\n' "$nazwa" "$przed commit(ów) poza origin/$baza — praca niezmergowana"; ((zostaja++)); continue
  fi

  if git rev-parse --verify -q "refs/remotes/origin/$g" >/dev/null; then
    nie=$(git rev-list --count "refs/remotes/origin/$g..$galaz" 2>/dev/null)
    if (( nie > 0 )); then
      printf '  ZOSTAJE  %-48s %s\n' "$nazwa" "$nie commit(ów) niewypchniętych na origin/$g"; ((zostaja++)); continue
    fi
  fi

  do_usuniecia+=("$sciezka")
done < <(git worktree list --porcelain | awk '
  /^worktree /{p=$2; b=""}
  /^branch /{b=$2}
  /^detached/{b=""}
  /^$/{if (p != "") print p"|"b; p=""}
  END{if (p != "") print p"|"b}')

echo
for s in "${do_usuniecia[@]}"; do
  nazwa=$(basename "$s")
  if (( usun == 0 )); then
    printf '  do usunięcia  %s\n' "$nazwa"
    continue
  fi
  if wynik=$(git worktree remove "$s" 2>&1); then
    printf '  usunięto      %s\n' "$nazwa"; ((usuniete++))
  else
    printf '  ✗ NIE UDAŁO SIĘ %-44s %s\n' "$nazwa" "$(head -1 <<< "$wynik")"; ((bledy++))
  fi
done

echo
if (( usun == 0 )); then
  echo "Podgląd: ${#do_usuniecia[@]} do usunięcia, $zostaja zostaje."
  echo "Wykonanie: tools/sprzataj-worktree.sh --usun"
else
  git worktree prune
  echo "Usunięto: $usuniete · zostaje: $zostaja · błędy: $bledy"
  echo "Gałęzie zostały nietknięte (git branch --list), zniknęły tylko katalogi robocze."
fi
exit $(( bledy > 0 ? 1 : 0 ))
