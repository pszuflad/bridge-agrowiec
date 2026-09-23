# 134-CHORE — praca z przeglądarki (Claude Code w chmurze): co dostosować (ZAPLANOWANY)

> Status: **Zaplanowany — do uruchomienia, gdy ktoś faktycznie zacznie pracować w przeglądarce**
> Założony: 2026-09-23, decyzją użytkownika (plan zatrudnienia osób pracujących z przeglądarki)
> Kontekst decyzji: repo **prywatne, bez ochrony serwerowej** (rulesety GitHuba nie działają
> w prywatnym repo na planie Free — sprawdzone 2026-09-23, HTTP 403)

## Po co ten ticket

Do projektu mają dołączyć osoby pracujące przez Claude Code w przeglądarce, bez lokalnego
środowiska. Trzy z czterech warstw, które pilnują procesu, pojadą tam same (są w repo).
Czwarta — hook `pre-push` — **nie**, bo `core.hooksPath` to ustawienie klonu, a nie zawartość
repozytorium. Po decyzji o prywatnym repo bez ochrony serwerowej **hook jest jedyną warstwą,
która cokolwiek blokuje**, więc ta luka jest istotna, a nie kosmetyczna.

## Co działa bez zmian (sprawdzone)

- `CLAUDE.md`, `.claude/commands/`, `.claude/settings.json` — śledzone w repo, jadą z klonem.
- `tools/*.sh` (`sync-z-develop.sh`, `push-i-pr.sh`, `sprzataj-worktree.sh`, `czas-testow.cjs`).
- CI (`backend`, `frontend`, `synchronizacja`) — po stronie GitHuba, niezależnie od autora.
  ⚠ Po decyzji o prywatnym repo CI jest **sygnałem, nie blokadą**: czerwony check nie
  powstrzyma merge'a.

## Zakres

1. **Automatyczne włączanie hooków w każdym środowisku.**
   - Hook `SessionStart` w `.claude/settings.json` uruchamiający `tools/wlacz-hooki.cjs`.
   - Samonaprawianie w `tools/sync-z-develop.sh` i `tools/push-i-pr.sh`: jeśli
     `core.hooksPath` jest pusty, a `.githooks/` istnieje — ustaw i powiedz o tym.
   - Dziś robi to wyłącznie `prepare` przy `npm install`, więc sesja pracująca tylko
     na dokumentacji zostaje bez hooka.
2. **`feature.md` w wariancie branchowym.** Cała procedura (Krok 5, „Worktree rules”) zakłada
   `.worktrees/<ID>` w jednym klonie. W chmurze każda sesja ma własny kontener i własny klon —
   worktree są zbędne, wystarczy `git checkout -b`. Rozdzielić oba warianty, bez kasowania
   lokalnego. Uwaga pozytywna: wyścigi o wspólny `.git` (i ponawianie z `lib-ponow.sh`)
   w chmurze nie występują; ponawianie limitów GitHuba zostaje przydatne.
3. **Weryfikacja środowiska chmurowego** — do wykonania w pierwszej sesji, wyniki dopisać tutaj:
   ```bash
   gh --version && gh api user -q .login   # czy gh jest i ma dostęp (push-i-pr.sh tego wymaga)
   node -v                                  # ≥ 20 dla better-sqlite3
   git config --get core.hooksPath          # ma dać .githooks
   ```
   Jeśli `gh` nie będzie zalogowany, `push-i-pr.sh` kończy się kodem 3 — wtedy dołożyć wariant
   awaryjny (PR mechanizmem platformy) albo instrukcję logowania.
4. **Czego w chmurze się nie zrobi — spisać wprost w `CLAUDE.md`.** `db/snapshot.db` (32 MB,
   `.gitignore`) nie jedzie z repo, więc odpada nagrywanie fixtures i uruchamianie oryginału —
   a to standardowa metoda dowodzenia wierności w tym projekcie. Takie zadania zostają przy
   sesji lokalnej albo trzeba ustalić źródło pliku dla chmury. Podobnie sekrety `SELLY_*`:
   testy używają atrapy, ale nic dotykającego prawdziwego Selly nie powinno tam trafiać.
5. **Umowa zamiast ochrony serwerowej.** Skoro rulesety nie działają, zapisać w `CLAUDE.md`
   minimalną regułę dla wszystkich: na `develop` tylko przez PR, merge dopiero przy zielonych
   `backend`, `frontend` i `synchronizacja`.

## Out of scope

- Wykupienie GitHub Pro ani zmiana repo na publiczne (decyzja użytkownika z 2026-09-23:
  zostajemy prywatni bez ochrony serwerowej).
- Konfiguracja samego środowiska chmurowego po stronie claude.ai (to nie jest treść repo).

## Definition of done

- [ ] Hooki włączają się same w świeżym klonie, bez `npm install`
- [ ] `feature.md` ma jasny wariant „worktree lokalnie / branch w chmurze”
- [ ] Wyniki weryfikacji środowiska chmurowego dopisane do tego planu
- [ ] `CLAUDE.md` mówi, czego w chmurze nie da się zrobić i jaka jest umowa o merge'ach
