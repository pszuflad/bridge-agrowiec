# 127-CHORE — synchronizacja z `develop` i PR bez konfliktów, egzekwowana mechanicznie

> Status: Implemented
> Branch: `chore/127-pr-sync-i-hooki`

## Ticket description
Przy kilku kartach naraz `develop` przesuwa się w trakcie roboty i PR-y przychodzą z konfliktami,
które rozwiązuje użytkownik zamiast autora. Dodatkowo push/PR bywa „zablokowany” i nie było
wiadomo, kiedy czekać, a kiedy zgłaszać problem.

## Context
- 46 worktree kart dzieli JEDEN katalog `.git` → równoległe `fetch`/`push` biją się o pliki
  blokad (`index.lock`, `cannot lock ref`, `packed-refs.lock`). To przechodzi samo.
- `gh auth status` na maszynie użytkownika zwraca „token in keyring is invalid”, choć wywołania
  API działają → kontrola dostępu musi opierać się na realnym `gh api user`.
- Historia repo scala bazę **mergem** (`Merge branch 'develop' into <gałąź>` × kilkanaście),
  więc synchronizacja ma być mergem, nie rebasem (gałąź bywa już wypchnięta).

## Decisions
- **Merge, nie rebase** — zgodnie z historią repo i bez `--force` na wypchniętej gałęzi.
- **Ponawiamy tylko blokady i sieć**; `auth` i `non-fast-forward` przerywają natychmiast
  (czekanie ich nie naprawi, a zapętlona sesja pali kredyty).
- **Trzy poziomy egzekwowania** zamiast samego opisu w instrukcji: hook `pre-push` (lokalnie,
  dla człowieka i agenta), job `synchronizacja` w CI (serwerowo, dla każdego), skrypty (wygoda).
- **Hook z furtką** (`POMIN_SYNC=1` / `--no-verify`) — blokada procesu nie może uniemożliwić
  pracy w sytuacji, której nie przewidzieliśmy.

## Implementation plan
1. `tools/lib-ponow.sh` — klasyfikacja błędu + ponawianie 5/15/40/90/180 s.
2. `tools/sync-z-develop.sh` — fetch + merge bazy; kody 0 / 10 / 2 / 1 / 3.
3. `tools/push-i-pr.sh` — sync → push → `gh pr create --base develop` → scalalność; kody 0–6.
4. `.githooks/pre-push` + `tools/wlacz-hooki.sh` + `tools/wlacz-hooki.cjs` (npm `prepare`).
5. Job `synchronizacja` w `.github/workflows/ci.yml`.
6. Opis w `CLAUDE.md`, Kroki 16–17 w `.claude/commands/feature.md`, wzmianka w `triaz-zmian.md`,
   uprawnienia `gh` i skryptów w `.claude/settings.json`.

## Testing strategy
Piaskownica git (bare remote + klon): czysty merge (`10`), brak zmian (`0`), konflikt (`2`,
bez pushu), blokada ustępująca po 2 próbach, `auth` i `non-fast-forward` bez ponawiania,
wyczerpanie prób z diagnozą blokady, hook blokujący push gałęzi za bazą, `POMIN_SYNC=1` jako
furtka, push po synchronizacji przechodzący.

## Out of scope
- Branch protection na GitHubie („Require branches to be up to date”) — ustawienie repo,
  decyzja użytkownika.
- Przegląd 46 worktree (większość to zamknięte tickety) — osobne zadanie.

## Definition of done
- [x] Skrypty przetestowane na wszystkich ścieżkach wyjścia
- [x] Hook blokuje push nieaktualnej gałęzi i ma udokumentowaną furtkę
- [x] CI sprawdza to samo niezależnie od maszyny autora
- [x] Zasada opisana w CLAUDE.md (każda sesja) i w procedurze ticketa (Kroki 16–17)
