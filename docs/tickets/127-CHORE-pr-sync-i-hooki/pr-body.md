## Ticket
127-CHORE — synchronizacja z `develop` i PR bez konfliktów, egzekwowana mechanicznie

## Summary
PR-y z kart przychodziły z konfliktami, bo `develop` przesuwał się w trakcie roboty, a push/PR
bywał „zablokowany” bez jasnej przyczyny. Ticket dokłada procedurę (sync przed PR-em), narzędzia,
które robią to za sesję i ponawiają przejściowe blokady, oraz dwa poziomy mechanicznego
egzekwowania: hook `pre-push` i job w CI.

## Problem / Motivation
Przy kilku kartach naraz gałąź ticketa szybko przestaje zawierać `develop`. Konflikt lądował
wtedy u recenzenta (użytkownika), który musiał aktualizować gałąź ręcznie. Osobno: 46 worktree
dzieli jeden katalog `.git`, więc równoległe `fetch`/`push` dają błędy blokad — przejściowe,
ale nieodróżnialne dla sesji od błędów, które trzeba zgłosić.

## Solution
- `tools/sync-z-develop.sh` — fetch + **merge** `origin/develop` (jak cała historia repo, bez
  `--force`); kody: `0` aktualna · `10` scalone, bramki od nowa · `2` konflikty · `1` warunek
  wstępny · `3` uwierzytelnienie.
- `tools/push-i-pr.sh` — kontrola dostępu `gh` (realne `gh api user`, bo `gh auth status` bywa
  fałszywie czerwony przez keyring) → sync → push → `gh pr create --base develop` → odczyt
  scalalności; kody `0`–`6`.
- `tools/lib-ponow.sh` — ponawianie 5/15/40/90/180 s **tylko** dla blokad `.git` i limitów/awarii
  GitHuba; `auth` i `non-fast-forward` przerywają od razu. Rozróżnia świeżą blokadę od
  zwietrzałego pliku `.lock` po zabitym procesie.
- `.githooks/pre-push` — odbija push gałęzi, która nie zawiera całego `origin/develop`
  (furtka: `POMIN_SYNC=1` / `--no-verify`). Włączenie: `tools/wlacz-hooki.sh`, automatycznie
  przez `npm install` w `rebuild/backend|frontend` (skrypt `prepare`).
- Job `synchronizacja` w CI — ta sama kontrola po stronie GitHuba, niezależna od maszyny autora.
- Dokumentacja: sekcja w `CLAUDE.md`, Kroki 16–17 w `.claude/commands/feature.md`, wzmianka
  w `triaz-zmian.md`; uprawnienia `gh pr`/skryptów w `.claude/settings.json`.

## Design decisions
- **Merge zamiast rebase** — zgodne z historią repo i bezpieczne dla wypchniętej gałęzi.
- **Ponawianie tylko tego, co przechodzi samo** — żeby sesja nie zapętlała się na błędzie
  uwierzytelnienia i nie paliła kredytów.
- **Trzy poziomy** (skrypt / hook / CI) — instrukcja w CLAUDE.md działa tylko wtedy, gdy sesja
  jej przestrzega; hook i CI obejmują też człowieka i inne środowiska.
- **Furtka w hooku** — proces nie może zablokować pracy w sytuacji, której nie przewidzieliśmy.

## Tests
Piaskownica git (bare remote + klon), wszystkie ścieżki: czysty merge (`10`), brak zmian (`0`),
konflikt (`2`, bez pushu), blokada ustępująca po 2 próbach, `auth`/`non-fast-forward` bez
ponawiania, wyczerpanie prób z diagnozą, hook blokuje push gałęzi za bazą, `POMIN_SYNC=1`
przepuszcza, push po synchronizacji przechodzi. Bramki backendu: bez zmian w kodzie
(`package.json` zyskał tylko skrypt `prepare`).

## Breaking changes
Brak dla kodu. Zmiana procesu: push gałęzi nieaktualnej wobec `develop` jest teraz odbijany
lokalnie (hook) i czerwony w CI.

## Follow-up
- Branch protection na `develop` („Require branches to be up to date”) — decyzja użytkownika.
- Przegląd 46 worktree — większość to zamknięte tickety; mniej równoległych operacji na `.git`
  to mniej wyścigów.
- Podział `docs/rebuild-backlog.md` na pliki per ticket (osobny ticket) — ten plik ma dziś te
  same trzy punkty zbiorowego dopisywania, co kiedyś roadmapa i `spec-backend.md`.

## Review
Bez subagenta — zmiana narzędziowo-procesowa, sprawdzona testami w piaskownicy.
Bramki backendu po scaleniu `develop` (89 plików z bazy): lint + typecheck + build + `vitest run`
— 103 pliki testów, 1674 testy zielone.

---
Ticket docs: `docs/tickets/127-CHORE-pr-sync-i-hooki/`
