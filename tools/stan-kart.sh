#!/usr/bin/env bash
# Stan kart z docs/karty/<ID>/karta.md — jedyne źródło stanu kart (zob. docs/karty/README.md).
# Użycie: tools/stan-kart.sh [prefiks-ID]   np. tools/stan-kart.sh P7
set -euo pipefail
cd "$(dirname "$0")/../docs/karty"
shopt -s nullglob
prefiks="${1:-}"
printf '| Karta | Stan | Wejścia |\n|---|---|---|\n'
for d in */; do
  id="${d%/}"
  [[ -n "$prefiks" && "$id" != "$prefiks"* ]] && continue
  stan=""; [[ -f "$id/karta.md" ]] && stan=$(sed -nE 's/^> \*\*Stan:\*\* *//p' "$id/karta.md" | head -1)
  wejscia=$(ls "$id" | sed -nE 's/^wejscie-(.+)\.md$/\1/p' | paste -sd, - | sed 's/,/, /g')
  printf '| %s | %s | %s |\n' "$id" "${stan:-⚠ brak karta.md}" "${wejscia:-—}"
done | sort -V
