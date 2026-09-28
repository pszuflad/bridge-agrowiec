# 100-DOCS-instrukcja-testow-i10-v2 — Implementation report

## Summary
Powstała delta `docs/instrukcja-testow-I10-v2.md` dla Ani: trzy decyzje z rundy 2 (karty 4.1/4.2,
kafel „Ostatni eksport CSV”, CSV = tabela), zgłoszenie z przeglądu (kafle KPI), dwie rzeczy „przy
okazji” i tabela 20 unieważnionych zdań pierwszej wersji. Przy weryfikacji w kodzie obalone zostały
dwa wejścia (scenariusz kafla eksportu jest niewykonalny z UI; plik CSV ma sufit karty 500/1000), więc
kartka opisuje stan faktyczny i zadaje Ani trzy pytania.

## Changes
- **Nowy:** `docs/instrukcja-testow-I10-v2.md` — delta w formacie I7-v2/I9-v2.
- `docs/instrukcja-testow-I10.md` — tylko banner „częściowo nieaktualne” z listą unieważnionych §.
- `docs/instrukcja-testow-I8.md` — dwie notki (§10.4 i wiersz tabeli) z odesłaniem do I10-v2 §1.2.
- `docs/karty/P10.4/karta.md` — stan ✅, decyzje K0–K4, dowiezione, „Do koordynatora”.
- `docs/tickets/100-DOCS-instrukcja-testow-i10-v2/{plan,raport,review}.md`.

## Deviations from plan
Brak.

## Test results
- **Gate odbudowy (fixtures/kontrakt):** N/D — DOCS; `git diff origin/develop -- rebuild contract` pusty.
- **Weryfikacja treści:** każde twierdzenie o zachowaniu sprawdzone w kodzie `develop` (`fde7697`):
  `pages/Pulpit.tsx`, `pages/pulpit/{kpi,czas}.ts`, `pages/Katalog.tsx`, `pages/katalog/eksport.ts`,
  `pages/analityka/{NaglowekKpi,eksport,TabelaAnalityki,Sekcja*}.tsx`, `pages/historia/dane.ts`,
  `backend/src/repos/analityka.ts`, `routes/{export-shoper,suppliers,staging-mutacje}.ts`,
  `pages/alerty/silnik-katalogu.ts`. Liczby z `db/snapshot.db` (odczyt): EAN wspólne 769,
  pozycje unikalne 5109, `historia_cen` 14 513, audyt: 0 eksportów, 92 × `upload_pliku`
  (ostatni 2026-07-27).
- **Cytaty §4.1/§4.3:** skrypt sprawdził, że każdy cytat „…” występuje w I10.md znak w znak (0 braków
  po poprawce jednego).
- Unit / Integration / E2E: N/D (DOCS).

## Breaking changes
Brak.

## Wymagane na stagingu przed wysłaniem
Na https://test.agritires.eu musi działać `develop` co najmniej z `fde7697` (P10.1, P10.2, P10.3,
PR.2, P6.2) na bazie z historią cen (kopia produkcji).

## Follow-up
- Sufity plików CSV po P10.3 (2.5: 1000 z ~5100; 4.1/4.2: 500 z ~5200) — kandydat na backlog, zależnie
  od odpowiedzi Ani na pytanie A (I10-v2 §1.3). Opisane w „Do koordynatora” karty.
- Eksport z Katalogu bez wpisu w Historii → kafel eksportu nigdy nie pokaże daty — zależnie od
  odpowiedzi Ani (I10-v2 §1.2).
- Plik marży per produkt — zależnie od odpowiedzi Ani na pytanie B.
- Roadmapa: Iteracja 10 do zamknięcia (koordynator).

## Review fixes applied
- NICE-TO-HAVE: banner I10 — §7.4 wydzielone z grupy „plik zna filtry” (unieważniona treść dotyczy sesji).
- NICE-TO-HAVE: I10-v2 §1.3 pytanie A — dopisane pozostałe karty z sufitem (2.1-2.4, Marża, Rotacja, 1.2, 3.1).

## Docs updates
Ticket jest sam w sobie zmianą dokumentacji; osobnych doc-checkerów nie uruchamiałem. Karta
`docs/karty/P10.4/karta.md` opisuje stan. Backlog (#32, #34, #91 — już ✅), roadmapa, spec-y — bez zmian:
ticket nie zmienia zachowania aplikacji, a zamknięcie Iteracji 10 i kandydat na backlog (sufity CSV)
idą przez koordynatora („Do koordynatora” karty).
