## Ticket
131-CHORE — jedno polecenie sprzątające worktree kart

## Summary
`tools/sprzataj-worktree.sh` usuwa katalogi worktree zamkniętych kart: te, których gałąź jest
w całości w `origin/develop`, katalog jest czysty i nic nie czeka na push. Domyślnie pokazuje
podgląd z powodem dla każdego pominiętego wpisu; usuwa po `--usun`. Gałęzi nie kasuje.

## Problem / Motivation
W repo jest 49 worktree, z czego 43 to zamknięte tickety. Wszystkie dzielą jeden katalog `.git`,
więc każdy dokłada się do wyścigów o pliki blokad (`index.lock`, `cannot lock ref`) przy
równoległych `fetch`/`push` — to ten sam problem, który w PR #141 dostał ponawianie.
Ręczne usuwanie 43 katalogów z oceną „czy na pewno nic tam nie ma” nie jest realne.

## Solution
Trzy kontrole, wszystkie muszą przejść, żeby worktree poszedł do usunięcia:
1. `git merge-base --is-ancestor <gałąź> origin/develop` — praca jest w bazie;
2. `git status --porcelain` pusty — **łącznie z plikami nieśledzonymi** (to one giną bezpowrotnie);
3. zero commitów w `origin/<gałąź>..<gałąź>` — nic nie czeka na push.

Pominięty worktree dostaje powód w wyjściu (ile commitów poza bazą, ile brudnych plików).
Główny klon i worktree, z którego skrypt jest uruchomiony, są pomijane z definicji.
Argumenty: `--usun` (wykonanie), nazwa gałęzi bazowej (domyślnie `develop`).

## Design decisions
- **Podgląd domyślnie** — polecenie kasuje katalogi, więc najpierw pokazuje, co zrobi.
- **Gałęzie zostają** — `git worktree remove` zdejmuje tylko katalog; zgodnie z Krokiem 18
  procedury ticketa.
- **`git fetch` przed oceną, twardy stop przy braku sieci** — „zmergowane” na starych danych
  to zły powód do kasowania.

## Tests
Piaskownica git z czterema przypadkami (zmergowany czysty, niezmergowany, zmergowany z plikiem
nieśledzonym, zmergowany bez zdalnej gałęzi): usuwane są dokładnie dwa właściwe, gałęzie
przeżywają, uruchomienie z wnętrza worktree pomija ten worktree. Na realnym repo podgląd daje
43 do usunięcia i 6 pozostających (105 — nieśledzony plik, 119/124 — commity poza bazą,
129/130 — brudne katalogi aktywnych kart, 131 — bieżący), zgodnie z ręczną analizą.

## Breaking changes
Brak — nowy skrypt, nic istniejącego nie zmienia.

## Follow-up
Brak.

## Review
Bez subagenta — jeden skrypt narzędziowy, sprawdzony w piaskownicy i podglądem na realnym repo.

---
Ticket docs: `docs/tickets/131-CHORE-sprzatanie-worktree/`
