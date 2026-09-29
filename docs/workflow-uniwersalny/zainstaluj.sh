#!/usr/bin/env bash
# Instaluje workflow (skille, agentów, skrypty, hook, CI, uprawnienia) w INNYM repozytorium.
# Użycie:  docs/workflow-uniwersalny/zainstaluj.sh <katalog-repo-docelowego> [gałąź-bazowa=develop]
# Nie nadpisuje istniejących plików (pomija je i wypisuje) — bezpieczne przy ponownym uruchomieniu.
set -euo pipefail

zrodlo="$(cd "$(dirname "${BASH_SOURCE[0]}")/szablony" && pwd)"
cel="${1:?Podaj katalog repozytorium docelowego}"
baza="${2:-develop}"

cel="$(cd "$cel" && pwd)"
git -C "$cel" rev-parse --show-toplevel >/dev/null 2>&1 || { echo "✗ $cel nie jest repozytorium git"; exit 1; }
cel="$(git -C "$cel" rev-parse --show-toplevel)"

skopiowane=0; pominiete=0
while IFS= read -r -d '' plik; do
  rel="${plik#"$zrodlo"/}"
  if [[ -e "$cel/$rel" ]]; then
    echo "  = pomijam (istnieje): $rel"; pominiete=$((pominiete+1)); continue
  fi
  mkdir -p "$(dirname "$cel/$rel")"
  sed "s/{{BAZA}}/$baza/g" "$plik" > "$cel/$rel"
  [[ -x "$plik" ]] && chmod +x "$cel/$rel"
  echo "  + $rel"; skopiowane=$((skopiowane+1))
done < <(find "$zrodlo" -type f -print0 | sort -z)

# .gitignore: worktree ticketów i lokalne ustawienia Claude Code
for linia in ".worktrees/" ".claude/settings.local.json"; do
  grep -qxF "$linia" "$cel/.gitignore" 2>/dev/null || { echo "$linia" >> "$cel/.gitignore"; echo "  + .gitignore: $linia"; }
done

# Hooki (git nie przenosi ich przy klonowaniu)
( cd "$cel" && git config core.hooksPath .githooks && echo "  ✓ core.hooksPath = .githooks" )

echo
echo "Skopiowano: $skopiowane, pominięto: $pominiete. Baza: $baza."
echo
echo "ZOSTAŁO DO UZUPEŁNIENIA (placeholdery {{…}}):"
grep -rn --include='*.md' --include='*.sh' --include='*.yml' '{{' "$cel/CLAUDE.md" "$cel/.claude" "$cel/tools" "$cel/docs/wpisy" 2>/dev/null \
  | grep -v '\${{' | sed "s|$cel/||" | cut -c1-140 || true
echo
echo "Następne kroki: patrz docs/workflow-uniwersalny/README.md, sekcja „Instalacja”."
