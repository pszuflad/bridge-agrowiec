# I15.1 — schemat `products`: kolumna blokowanych form płatności + triggery kategorii i zastosowań

> **Stan:** ⬜ gotowe (fala 1)
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #73, #75, #79, #80, #82 · **Zależy od:** —
> **Ticket:** —

Założona przez koordynatora ticketem `104-DOCS-plan-i15`, 2026-09-22. Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”.

## Zakres
Przeniesienie do `rebuild/schema/` stanu, który produkcja zakłada w bazie **przy każdym starcie procesu**
(`mirror/backend/extensions.cjs` na `origin/main`: `paymentBlocks.ensurePaymentBlocks()` i
`applicationRules.ensureApplicationRules()` — „idempotentnie dopina kolumnę, uzupełnia istniejące rekordy
i zakłada triggery”):
- kolumna `products.blokowane_formy_platnosci` + wartości dla istniejących rekordów (#73);
- 6 triggerów z produkcyjnego `db/schema.sql` (`git show origin/main:db/schema.sql`):
  `products_blokowane_formy_ai/_au` (#73), `products_zastosowanie_ai/_au` (#75, stan końcowy z #79/#80/#82),
  `manual_overrides_kategoria_ai/_au` (#79);
- model Drizzle (`rebuild/backend/src/db/schema.ts`) zna nową kolumnę.

⚠ **PUŁAPKA — idempotencja na produkcji.** Na produkcji kolumna i triggery JUŻ istnieją (zakłada je runtime).
`ALTER TABLE … ADD COLUMN` w SQLite nie ma `IF NOT EXISTS`, a runner (`db/migrate.ts`) wykonuje plik `.sql`
w transakcji — migracja wywróciłaby cutover. Rozwiązanie wybiera karta (np. triggery `CREATE TRIGGER IF NOT
EXISTS`, a kolumna — mechanizm odporny na jej obecność); musi przejść na TRZECH bazach: świeżej, kopii
`db/snapshot.db` (bez kolumny) i bazie symulującej produkcję (kolumna + triggery już są). Opisz wybór i dopisz
wejście dla koordynatora (cutover).
⚠ Triggery kopiuj **dosłownie** (także `UPPER()`/`LOWER()` ASCII-only — CLAUDE.md). Ich treść to reguły biznesowe
Ani (lista zastosowań per kategoria, blokady per dostawca) — nie upraszczaj.
⚠ Uzupełnienie istniejących rekordów to **efekt runtime'u produkcji przy każdym starcie**, nie jednorazowy backfill
z września — odtworzenie go NIE łamie D2. Jednorazowe skrypty (`normalize_widths_selly_20260918.cjs`,
backfille #79/#82/#83) zostają poza zakresem (D2).
⚠ **Kształt API się NIE zmienia w tej karcie.** Jeśli dodanie pola do modelu zmienia odpowiedź `GET /api/products`
(Drizzle `select()` bez projekcji oddaje wszystkie pola modelu — CLAUDE.md), zablokuj to jawnie; wystawienie pola
w API należy do I15.3. Triggery zmienią zapisy kategorii/zastosowań — puść WSZYSTKIE bramki BE i popraw testy,
które zamrażały stan sprzed triggerów (świadomie, z odnośnikiem do wpisu).

## Pliki (wyłączna własność)
`rebuild/schema/011_*.sql` (numer **przydzielony przez koordynatora**), README migracji, `rebuild/backend/src/db/schema.ts`
(tylko tabela `products`), testy migracji. NIE: parsery (I15.2), API/katalog/CSV (I15.3), staging (I15.4), Selly (I15.6).

## Decyzje
**Decyzje użytkownika 2026-09-22 (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na
istniejące obiekty · D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2
przenosimy · D4 błędny EAN = błąd blokujący akceptację (wersja Ani zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
**Produkcja zamrożona od 2026-09-22** — źródło prawdy to `origin/main` na commicie `7d6cfc9`; nowy kod na `main` = zgłoś.

Numer migracji `011` zarezerwowany. Druga migracja → „Do koordynatora”, nie bierz kolejnego numeru sam.

## Dowiezione
—

## Do koordynatora
—
