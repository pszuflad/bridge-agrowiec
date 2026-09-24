# 157-DOCS-przelot-chmurowy-wyniki — wyniki przelotu diagnostycznego w sesji przeglądarkowej

> Status: Implemented → Shipped
> Branch: `docs/157-przelot-chmurowy-wyniki`
> Worktree: `.worktrees/157-DOCS-przelot-chmurowy-wyniki`
> Kontynuacja ticketów `152` i `156` (karta TEST.3)

## Ticket description

Ania uruchomiła w sesji Claude Code w przeglądarce (`claude.ai/code`, konto `Devilian07`) przelot
diagnostyczny i oddała raport. Zadanie: nanieść wyniki na bazę wiedzy, tak żeby żadna następna sesja
— ani chmurowa, ani lokalna — nie odkrywała tego od nowa.

## Context — co przyniósł przelot

**Działa w chmurze (zmierzone):** Node 22.22.2, npm 10.9.7, git 2.43.0; pełne bramki backendu
(`npm ci` 10 s, lint 7 s, typecheck 7 s, build 4 s, `npm test` → **1844 testy zielone, 12 pominiętych,
111/112 plików, ~86 s**); atomowa rezerwacja numeru ticketa z Kroku 4 (wyliczyła 157) mimo braku
lokalnego `.worktrees/.numery`; `git worktree add` z trackingiem `origin/develop`; widoczność
`CLAUDE.md` (19 861 B) i `.claude/commands/feature.md` (36 016 B); zero zmiennych
`SELLY_*`/`AGRORAMI_*` w środowisku; `db/snapshot.db` nieobecny.

**Nie działa — dwie niezależne rzeczy, obie wcześniej nieznane:**
1. **`gh` nie istnieje w kontenerze** („command not found"). To nie kwestia logowania, więc
   `tools/push-i-pr.sh` i cały Krok 17 w dotychczasowym kształcie są tam bezużyteczne. Dostęp
   do GitHuba idzie wyłącznie narzędziami MCP; odczyt działa (`get_me` → `Devilian07`,
   `list_pull_requests` → realne PR-y #171, #170, #165).
2. **Zapis wraca 403** — `git push` przez proxy sesji i `mcp__github__create_branch`:
   „Claude doesn't have GitHub access to pszuflad/bridge-agrowiec for your organization. An org
   admin can install the Claude GitHub App…". Hook `pre-push` nie zdążył się odezwać, bo żądanie
   padło wcześniej.

**Rozstrzygnięte przeze mnie w tej sesji (raport tego nie zawierał):**
- **403 NIE jest brakiem uprawnień konta Ani.** `gh api repos/pszuflad/bridge-agrowiec/collaborators`
  → `Devilian07`: `permission: write`, `push: true`, `admin: false`. Brakuje **instalacji aplikacji
  Claude GitHub App na repozytorium** — to dwie różne warstwy i komunikat 403 mówi o drugiej.
- **Szum `DB_PATH: Required` / „kopia-bazy: brak DB_PATH" na stderr w `npm test` to nie usterka.**
  To dwa testy, które celowo sprawdzają tę gałąź: `rebuild/backend/test/kopia-bazy.test.ts:117`
  („brak DB_PATH przerywa deploy zamiast po cichu nic nie zrobić") i
  `rebuild/backend/test/selly.csv-cli.test.ts:110` („bez `DB_PATH` kończy się błędem, a nie plikiem
  z przypadkowej bazy"). Zielony bieg z tym szumem jest poprawny.

## Kontrakt i fixtures (zakres)

**Brak (nie dotyka kontraktu).** Ticket zmienia wyłącznie bazę wiedzy: `CLAUDE.md`,
`.claude/commands/feature.md`, `docs/karty/TEST.3/karta.md`, artefakty ticketa. Zero zmian
w `rebuild/`.

## Decisions

1. **Fakty o środowisku chmurowym idą do `CLAUDE.md` → „Środowisko", nie do karty.** Karta TEST.3
   dotyczy jednego dokumentu dla Ani; brak `gh` i wymóg aplikacji GitHub dotyczą **każdej** sesji
   w przeglądarce, więc miejscem jest plik czytany na starcie każdej sesji.
2. **`.claude/commands/feature.md` dostaje wariant Kroku 17 bez `gh`.** Bez tego sesja chmurowa
   dojdzie do Kroku 17 i padnie na `command not found`, nawet po zainstalowaniu aplikacji.
   Zmiana komendy była dotąd oznaczona jako „osobna decyzja użytkownika" (karta TEST.3) — podstawą
   jest polecenie użytkownika z 2026-09-24: „zaktualizujesz tutaj całą dokumentację i całą bazę".
3. **Rozróżnienie „uprawnienie konta ≠ dostęp aplikacji" wpisane WPROST, razem z adresem
   instalacji.** Powód: komunikat 403 sam z siebie kieruje diagnozę w złą stronę („dajmy jej
   uprawnienia"), a uprawnienia już są. Bez tego zdania następna sesja i następny człowiek stracą
   na tym godzinę.
4. **Dokumentu dla Ani NIE zmieniamy.** Jej rozdział „Jak włączyć zmianę i sprawdzić, że jest na
   teście" opisuje to, co robi ONA na GitHubie — i to działa. Zepsuty był krok wcześniejszy, po
   stronie sesji.
5. **Szum `DB_PATH` opisany jako oczekiwany**, z numerami linii testów, zamiast zakładania wpisu
   w backlogu — nie ma tu defektu do śledzenia.
6. **Brak wpisu w backlogu i brak `docs/spec-backend/wpis-157.md`** — to ustalenia o środowisku
   pracy, nie o produkcie ani o produkcji.

## Implementation plan

1. `CLAUDE.md` → „Środowisko": nowy punkt o sesji w przeglądarce (brak `gh`, co robić zamiast,
   403 vs uprawnienia konta, hooki po `npm ci`, co działa, czego nie da się zrobić) + punkt
   o oczekiwanym szumie `DB_PATH` w `npm test`.
2. `.claude/commands/feature.md` → Krok 17: „Wariant dla sesji w przeglądarce — tam NIE MA `gh`"
   (sync i push normalnie, PR i odczyt scalalności przez MCP, 403 = stop i zgłoszenie z adresem
   instalacji, ostrzeżenie o nieaktywnym hooku).
3. `docs/karty/TEST.3/karta.md` → „Do koordynatora" punkt 2: lista „do sprawdzenia empirycznie"
   zamieniona **w miejscu** na wyniki przelotu (nieaktualne zadanie nie może zostać jako zadanie).

## Testing strategy

- GATE odbudowy: **N/D**, bramki backendu nie dotyczą — zero zmian w `rebuild/`.
- Weryfikacja: uprawnienia konta przez `gh api repos/.../collaborators`; źródło szumu `DB_PATH`
  przez `grep` po `rebuild/backend/test/` (dwa pliki, numery linii). Reszta faktów pochodzi
  z raportu przelotu i jest oznaczona datą oraz kontem, na którym zmierzono.
- Kontrola, czy `docs/instrukcja-pracy-dla-ani.md` pozostał nietknięty.

## Out of scope

- **Instalacja aplikacji Claude GitHub App** — działanie po stronie użytkownika (admin repo),
  nie do wykonania z tej sesji.
- Zmiana `tools/push-i-pr.sh`, żeby sam wykrywał brak `gh` i szedł ścieżką MCP — sensowne, ale
  skrypt nie ma dostępu do narzędzi MCP (to warstwa sesji, nie basha). Zostaje wariant opisany
  w komendzie.
- Powtórzenie przelotu po instalacji aplikacji (potwierdzenie push + PR + reakcji hooka) — osobne
  zadanie, wymaga sesji w przeglądarce.

## Definition of done

- [ ] `CLAUDE.md` opisuje brak `gh` w chmurze, ścieżkę MCP, rozróżnienie 403 vs uprawnienia konta
      i adres instalacji aplikacji
- [ ] `CLAUDE.md` opisuje szum `DB_PATH` jako oczekiwany, z numerami linii testów
- [ ] `feature.md` Krok 17 ma wariant bez `gh` i jawne „403 = stop, nie ponawiaj"
- [ ] Karta TEST.3 ma wyniki przelotu w miejscu listy „do sprawdzenia"
- [ ] `docs/instrukcja-pracy-dla-ani.md` bez zmian
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE`
