# TEST.3 — zasady pracy Ani z Claude Code (przeglądarka) po testach

> **Stan:** ⬜ do zrobienia (fala „dokumenty dla Ani")
> **Iteracja:** poza iteracjami (przygotowanie do cutoveru) · **Wpisy backlogu:** — · **Zależy od:** —
> **Ticket:** —

Założona przez koordynatora ticketem `148-DOCS-karty-testow`, 2026-09-24, na polecenie użytkownika.

## Po co ten dokument

Po testach Ania będzie zgłaszać uwagi i poprawki. Dotąd robiła to łatkami doklejanymi do
produkcyjnego bundla — stąd duplikaty definicji w `index.cjs`, łatki wpisane w martwy bundel
frontendu i zmiany, o których dowiadywaliśmy się z triażu. Po cutoverze **każda zmiana ma wejść
tą samą drogą co nasze karty**: research → plan → decyzje użytkownika → implementacja → review →
dokumentacja → PR.

## Wymóg twardy: każde zgłoszenie idzie przez `/feature`

Dokument ma **wymagać** od Ani komendy `/feature <opis>` (`.claude/commands/feature.md`) i nie
zostawiać furtki „popraw mi to szybko w czacie". Uzasadnienie dla Ani ma być praktyczne, nie
proceduralne — bez `/feature` znika:
- **researcher** — czytanie kontraktu, fixtures i oryginału ZANIM ktoś zacznie pisać kod,
- **pytania przed pracą** (Krok 3) — Ania decyduje o rozbieżnościach, zamiast odkrywać je po fakcie,
- **plan do zatwierdzenia** (Krok 7) — widać, co się zmieni, zanim się zmieni,
- **review** i **aktualizacja `docs/`** — inaczej dokumentacja rozjeżdża się z kodem w tydzień,
- **PR bez konfliktów zamiast pushu na gałąź główną** (`tools/push-i-pr.sh`).

## Zakres dokumentu

1. **Jak wejść** — `claude.ai/code`, wybór repozytorium i gałęzi (`develop`, nigdy `main`),
   co oznacza worktree i dlaczego jej zmiany nie psują pracy innych.
2. **Jak zgłaszać** — format zgłoszenia: co zrobiłam → co się stało → czego oczekiwałam → zrzut
   ekranu/adres. To samo, czego my od niej wymagamy przy testach.
3. **Trzy rodzaje zgłoszeń i co z nimi robić** (to jest sedno dokumentu):
   - **błąd** (jest inaczej niż w starym Bridge) → `/feature` z opisem różnicy,
   - **świadoma zmiana** (ma być inaczej niż dotąd) → `/feature`, ale najpierw wpis do backlogu
     jako decyzja — ⚠ karta ma sprawdzić i opisać aktualną drogę wpisu
     (`docs/rebuild-backlog/wpis-<ticket>.md`, `docs/rebuild-backlog/README.md`),
   - **obserwacja/pytanie** → też `/feature` (typ `DOCS`), żeby nie ginęło w czacie.
4. **Czego nie wolno** — push na `develop`/`main` z pominięciem PR-a, praca bezpośrednio na
   produkcji, `POST /api/selly/sync-supplier` z `dry_run=false`, generowanie CSV z domyślnymi
   `SELLY_CSV_*` (wskazują katalog produkcyjny), wklejanie sekretów do czatu.
5. **Czego się spodziewać** — ile trwa ticket, kiedy dostanie pytania, kiedy PR, kto merguje.

## Jak pisać

⚠ To jedyny z trzech dokumentów, który **nie jest instrukcją testu** — czyta go osoba, która zna
stary Bridge i dopiero poznaje nasz sposób pracy. Ton: krótko, konkretnie, bez żargonu z CLAUDE.md
(„gate", „fixture", „karta" wymagają jednozdaniowego wyjaśnienia przy pierwszym użyciu albo
zastąpienia polskim odpowiednikiem). Zasady, których nie umiesz uzasadnić korzyścią dla Ani,
lepiej pominąć niż wpisać jako nakaz.

Nie przepisuj `.claude/commands/feature.md` — to instrukcja dla agenta, nie dla człowieka. Ania ma
wiedzieć, CO dostanie na każdym etapie i CO ma zatwierdzić, a nie jak Master orkiestruje subagentów.

## Pliki (wyłączna własność)
`docs/instrukcja-pracy-dla-ani.md` (nowy), `docs/karty/TEST.3/karta.md`, `docs/tickets/<ID>/**`.
NIE: `.claude/commands/feature.md` (zmiana samej komendy = osobna decyzja użytkownika), `CLAUDE.md`.

## Decyzje
—

## Dowiezione
—

## Do koordynatora
—
