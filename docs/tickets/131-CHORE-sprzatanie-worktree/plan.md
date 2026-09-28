# 131-CHORE — jedno polecenie sprzątające worktree kart

> Status: Implemented
> Branch: `chore/131-sprzatanie-worktree`

## Ticket description
Po 130 ticketach w repo zostało 49 worktree, z czego 43 to zamknięte karty. Wszystkie dzielą
jeden katalog `.git`, więc każdy z nich zwiększa szansę wyścigu o pliki blokad przy równoległych
`fetch`/`push` (powód opisany w CLAUDE.md, „Przed każdym PR”). Potrzebne jedno polecenie,
które usuwa to, co bezpieczne, i nie rusza niczego, co może być czyjąś pracą.

## Decisions
- **Domyślnie podgląd, usuwanie po `--usun`** — skrypt kasuje katalogi robocze, więc najpierw
  pokazuje decyzję z powodem dla każdego wpisu.
- **Trzy warunki bezpieczeństwa naraz:** gałąź w całości w `origin/develop`, katalog bez zmian
  (razem z plikami nieśledzonymi), zero commitów niewypchniętych na własną gałąź zdalną.
  Wystarczy, że jeden nie zachodzi — worktree zostaje, z wypisanym powodem.
- **Gałęzi nie kasujemy** — `git worktree remove` zdejmuje tylko katalog roboczy; to zgodne
  z Krokiem 18 procedury ticketa („Don't delete the local branch”).
- **Bieżący worktree i główny klon są pomijane** — skrypt nie podcina gałęzi, na której siedzi.
- **`git fetch` przed oceną** — bez świeżej bazy „zmergowane” znaczyłoby co innego; brak sieci
  przerywa działanie, zamiast oceniać na starych danych.

## Implementation plan
1. `tools/sprzataj-worktree.sh` — parsowanie `git worktree list --porcelain`, trzy kontrole,
   podgląd / `--usun`, opcjonalna gałąź bazowa jako argument, `git worktree prune` na koniec.

## Testing strategy
Piaskownica git z czterema worktree: zmergowany czysty (usuwany), niezmergowany (zostaje),
zmergowany z plikiem nieśledzonym (zostaje), zmergowany bez zdalnej gałęzi (usuwany).
Sprawdzone: gałęzie przeżywają usunięcie katalogu, uruchomienie z wnętrza worktree pomija
ten worktree, kod wyjścia 1 przy błędzie `git worktree remove`.
Na realnym repo: 43 do usunięcia, 6 zostaje — zgodnie z ręczną analizą z tej samej sesji.

## Out of scope
- Kasowanie gałęzi lokalnych (osobna decyzja użytkownika).
- Automatyczne uruchamianie sprzątania (np. z hooka) — sprzątanie ma być świadome.

## Definition of done
- [x] Jedno polecenie usuwa wszystkie niepotrzebne worktree i nic poza nimi
- [x] Każdy pominięty worktree ma wypisany powód
- [x] Gałęzie nietknięte
