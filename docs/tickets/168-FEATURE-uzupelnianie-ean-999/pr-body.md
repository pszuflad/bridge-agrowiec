## Ticket
168-FEATURE-uzupelnianie-ean-999 — uzupełnianie pustych EAN (prefiks 999) + tabela par kod↔EAN

## Summary
Reguła uzupełnia puste `products.ean` EAN-ami `999` + licznik + cyfra kontrolna EAN-13. Pary `kod`↔EAN trzyma tabela `ean_pary` (migracja 017), z API w obie strony. Kolejny import nie gubi wygenerowanego EAN-u.

## Problem / Motivation
Katalog ma puste EAN-y; losowe „999 + cyfry" grozi kolizjami. Potrzebna unikalność, pamięć par i ochrona przed utratą EAN-u przy imporcie. To NOWA logika (odstępstwo od 1:1, decyzja użytkownika).

## Solution
- Migracja `017_ean_pary.sql` (UNIQUE na kod/ean/numer), model Drizzle.
- `src/ean-pary/` — generator (licznik, cyfra kontrolna) i reguła (`przydzielEan`, `uzupelnijKatalog`, status `zastapiony` po prawdziwym EAN z importu).
- Trasy: `GET /api/ean-pary/po-kodzie/:kod`, `GET /api/ean-pary/po-ean/:ean`, `POST /api/ean-pary/generuj`, `POST /api/ean-pary/uzupelnij` (`dry_run`), `GET /api/ean-pary`.
- Staging (`fabryka.ts`) uzupełnia pusty EAN z pary; akceptacja i `POST /api/products` nadają EAN nowym pozycjom (opt-in `uzupelnijEan`, domyślnie wyłączone dla testów charakteryzacji).

- Wdrożenie: `tools/deploy-produkcja.sh` uruchamia `npm run uzupelnij-ean` po migracjach — przy deployu puste EAN-y w katalogu dostają EAN z reguły (idempotentne, wynik w logu).

## Design decisions
- Klucz pary = `products.kod`; licznik zamiast losowania (brak kolizji z konstrukcji).
- Prawdziwy EAN z cennika nadpisuje 999…; numer zostaje zarezerwowany.
- EAN 999… idzie do Selly jak zwykły EAN.
- Produkt z istniejącym EAN nigdy go nie traci (także w bulku bez klucza `ean`).

## Tests
Lint, typecheck, build ✓; `npm test` — 1944 zielone (12 pominiętych jak dotąd), po synchronizacji z `develop` (823d725). Nowe: `test/ean-pary.test.ts`, `test/ean-pary.staging.test.ts`. Gate kontraktu: brak zmian w `openapi.yaml`, regresje zielone.

## Breaking changes
None.

## Follow-up
Brak UI („Uzupełnij EAN"). Po wdrożeniu: `POST /api/ean-pary/uzupelnij` z `dry_run: true`, by zmierzyć liczbę pustych EAN-ów.

## Review
Review zapisane w `docs/tickets/168-FEATURE-uzupelnianie-ean-999/review.md` (1 BLOCKER naprawiony — ochrona EAN istniejącego produktu w bulku; SHOULD-FIX: walidacja `dry_run`, kolizje pary w stagingu, docs — naprawione).

---
Ticket docs: `docs/tickets/168-FEATURE-uzupelnianie-ean-999/`
Zsynchronizowane z `develop` (823d725); bramki przebiegnięte po synchronizacji.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01MNrD1JQ8hkyXXbC9HTiHd1
