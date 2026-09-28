# 156-DOCS-ania-merguje-i-sprawdza-wdrozenie — raport wdrożenia

## Summary

`docs/instrukcja-pracy-dla-ani.md` przypisuje teraz włączanie zmian Ani, nie Pawłowi, i dostał nowy
rozdział „Jak włączyć zmianę i sprawdzić, że jest na teście": cztery kroki na GitHubie plus
sprawdzenie biegu „Deploy staging" w zakładce Actions. Dokument domyka się na tym, czego Ania
oczekuje — po jej kliknięciu zmiana sama jedzie na `test.agritires.eu` w ok. minutę.

## Changes

- `docs/instrukcja-pracy-dla-ani.md`:
  - „Czego się spodziewać po drodze", punkt 4: *„Włączenie zmiany robi Paweł"* → **„Włączenie zmiany
    robisz Ty"** + odesłanie do nowego rozdziału;
  - **nowy rozdział „Jak włączyć zmianę i sprawdzić, że jest na teście"** — 4 kroki (otwórz PR →
    poczekaj na zielone ✓ → „Merge pull request" + „Confirm merge" → Actions, bieg „Deploy staging"),
    reakcja na żółty / zielony / czerwony przy obu biegach, `Ctrl+Shift+R` po wdrożeniu, wyjątek
    „tylko dokumenty → brak biegu «Deploy staging»", zdanie o tym, że wdrożenie nie kasuje danych
    na teście;
  - dwa miejsca poprawione na spójność: „dopóki jej nie włączysz" (rozdział „Jak wejść") i „którą
    włączasz sama — po sprawdzeniu, że automatyczne sprawdzenia świecą na zielono" (zakaz 1
    w „Czego nie robimy").
- `docs/karty/TEST.3/karta.md` — „Dowiezione": linia o zmianie ról wniesionej tym ticketem;
  „Do koordynatora" punkt 2: dopisana **lista rzeczy do sprawdzenia empirycznie w sesji
  przeglądarkowej** (`gh` i prawo merge'a, Node ≥ 20 i kompilacja `better-sqlite3`, `git worktree
  add` + rezerwacja numeru bez lokalnego `.worktrees/.numery`, `core.hooksPath`, brak sekretów
  `SELLY_*`/`AGRORAMI_*`, brak `db/snapshot.db`).
- **Nowe:** `docs/tickets/156-DOCS-ania-merguje-i-sprawdza-wdrozenie/{plan,raport,pr-body}.md`

## Deviations from plan

Brak. Zakres 1:1 z planem.

## Test results

- **Gate odbudowy: N/D** — ticket nie dotyka API ani schematu; zero zmian w `rebuild/`.
- **Bramki backendu: nie dotyczą** (jak wyżej). Kontrola: `git diff --name-only origin/develop HEAD`
  → wyłącznie ścieżki w `docs/`.
- **Weryfikacja faktograficzna — każda liczba i nazwa w nowym rozdziale sprawdzona:**
  - workflow nazywa się **„Deploy staging"**, odpala się na `push` do `develop` z filtrem `paths`
    `rebuild/**`, `deploy/staging/**`, `tools/deploy-staging.sh` →
    `.github/workflows/deploy-staging.yml:1,13-20`; SSH + `tools/deploy-staging.sh` → `:29-40` ✓
  - **~1 min na wdrożenie** — realne biegi: 1m11s (po PR #169), 59 s (po PR #161), oba sukces ✓
  - sekrety `STAGING_SSH_*` ustawione od 2026-08-25 (`gh secret list`) ✓
  - **trzy sprawdzenia CI o nazwach `synchronizacja`, `backend`, `frontend`**, Node 20 →
    `.github/workflows/ci.yml:17,36,67,47,78`; **~2 min** — realne biegi 2m05s–2m22s ✓
  - **`develop` nie ma ochrony gałęzi** (brak wymogu review, przycisk merge nie jest blokowany przy
    czerwonym CI) — dlatego dokument nazywa Anię ostatnim sprawdzeniem ✓
  - **wdrożenie nie kasuje danych na teście** — `tools/deploy-staging.sh:23`
    (`DATA_DB=.../data-nowy.db  # baza staging (przeżywa podmiany)`) ✓
- **Kontrola śladów po starym podziale ról:** `grep -n 'Paweł\|ktoś włącza'` — pozostałe wystąpienia
  „Pawłowi/Paweł" są celowe i dotyczą innych spraw (sekrety wklejone do czatu, awaria, czerwony
  bieg, wariant zapasowy z „Do Twojej decyzji"). Zero zdań o włączaniu zmiany przez Pawła ✓

## Breaking changes

None.

## Follow-up

1. **Przelot testowy w chmurze** — jedyna niewiadoma, która może urwać łańcuch po cichu: czy `gh`
   jest w sesji przeglądarkowej zalogowany i czy bramki się tam uruchomią. Lista kontrolna wpisana
   do „Do koordynatora" w karcie TEST.3. Do rozstrzygnięcia przed wydaniem dokumentu Ani.
2. **Wariant `/feature` dla zgłoszeń Ani** — pytania biznesowe zamiast technicznych + jawny krok
   tworzący wpis w backlogu. Zmiana `.claude/commands/feature.md`, osobna decyzja użytkownika.
3. Punkty 3–5 z ticketa 152 (błędny odsyłacz w `CLAUDE.md`, brak bramki na `SELLY_CSV_DIR`,
   odsyłacz z `docs/cutover.md`) — bez zmian, wciąż w „Do koordynatora".
