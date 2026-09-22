# 107-FEATURE-products-blokady-triggery — Implementation report

## Summary
Migracja `011_blokowane_formy_i_triggery.sql` przenosi do nowego stosu to, co produkcja zakłada w bazie przy
każdym starcie procesu: kolumnę `products.blokowane_formy_platnosci`, jej uzupełnienie dla istniejących wierszy
i sześć triggerów (blokady płatności po dostawcy, kanoniczna kategoria + zamknięta lista zastosowań, kanoniczna
kategoria w poprawkach ręcznych) — triggery bajt w bajt z `7d6cfc9:db/schema.sql`. Migracja jest odporna na
istniejące obiekty (dyrektywa runnera dla kolumny, `DROP IF EXISTS` + `CREATE` dla triggerów), co udowadniają
testy na bazie świeżej, kopii `db/snapshot.db` i bazie symulującej produkcję. Kształt API bez zmian.

## Changes
- `rebuild/backend/src/db/migrate.ts` — `zastosujDyrektywy()`: linia `-- @dodaj-kolumne-jesli-brak <tabela> <kolumna> <definicja>`
  wykonywana przed treścią pliku, w tej samej transakcji (`PRAGMA table_info` → `ALTER` tylko przy braku).
  Nieznana dyrektywa / zła składnia / brak tabeli = błąd i rollback.
- **New:** `rebuild/schema/011_blokowane_formy_i_triggery.sql` — nagłówek (źródło, idempotencja, czego nie ma),
  dyrektywa kolumny, backfill `UPDATE … WHERE … IS NOT` (jak `ensurePaymentBlocks()`), 6× `DROP TRIGGER IF EXISTS`,
  6× `CREATE TRIGGER` wygenerowane skryptem z `git show 7d6cfc9:db/schema.sql | sed -n 334,385p` (`diff` = pusty).
- `rebuild/schema/README.md` — wiersz 011 + sekcja „Dyrektywy runnera”.
- `rebuild/backend/src/db/schema.ts` — `products.blokowaneFormyPlatnosci` (tylko tabela `products`).
- `rebuild/backend/src/repos/kolumny.ts` — `blokowaneFormyPlatnosci` w `KOLUMNY_POZA_KONTRAKTEM.products`
  (stan przejściowy do I15.3); `src/repos/products.ts` — typ `Produkt` liczony z listy wykluczeń.
- **New:** `rebuild/backend/test/db.migracja-011.test.ts` — dyrektywa (6 przypadków, w tym rollback), 011 na trzech
  bazach, zachowanie wszystkich triggerów (w tym ASCII-only `LEŚNE`, łańcuch zastosowań, MO6).
- `test/db.migracje.test.ts` — lista migracji + strażnik 003 dopuszcza `blokowane_formy_platnosci`.
- `test/katalog.gate.test.ts`, `test/produkty.mutacje.test.ts` — strażnicy: GET/PATCH nie oddają pola, PATCH go nie zapisuje.
- Świadome poprawki testów zamrażających stan sprzed triggerów (każda z komentarzem i odnośnikiem do 011/#75):
  - `test/atrybuty.pending.test.ts`, `test/atrybuty.niezmiennik.test.ts` — wartości `zastosowanie` przeniesione na
    zamkniętą listę kategorii `Rolnicze` (napisy spoza listy trigger zamienia na „Uniwersalne/pozostałe”); nowy test
    „edycja na wartość spoza listy → Uniwersalne/pozostałe”;
  - `test/selly.synchronizacja.test.ts` — łańcuch `Ciągnik + Koparka` na kategorii spoza czterech kanonicznych
    (w kanonicznej trigger go spłaszcza); nowy test „w kategorii kanonicznej brak `multi_cat`”;
  - `test/silnik.charakteryzacja.test.ts` — triggery zdejmowane w bazie tego testu: wzorzec nagrano z `tk()` na
    atrapach JS (bez SQLite), a test porównuje silnik, nie warstwę bazy.

## Deviations from plan
- Testy 011 w osobnym pliku `db.migracja-011.test.ts` (plan: blok w `db.migracje.test.ts`) — ten plik ma już 757 linii.
- Kroki 6–7 planu (próba na kopii produkcji, pomiar #101) — **jeszcze nie wykonane**: kopia produkcji dostępna od 23.09
  (scenariusz A). PR czeka na ten krok.

## Test results
- **Gate odbudowy (fixtures/kontrakt):** ✓ — `GET /api/products` (`GET_products.json`, 72 klucze, bez
  `blokowaneFormyPlatnosci`), odpowiedź `PATCH /api/products/{id}` (72 klucze). Pozostałe GATE przechodzą bez zmian
  fixtures; `contract/` nietknięty.
- Migracja na trzech bazach: ✓ świeża, ✓ symulacja produkcji (w tym przestarzały trigger, rozjechane blokady),
  ✓ kopia `db/snapshot.db` (`SNAPSHOT_DB=…/db/snapshot.db npx vitest run test/db.migracja-011.test.ts` — wiersz po
  wierszu zmienia się wyłącznie `blokowane_formy_platnosci`, zgodnie z niezależną kopią mapy z `payment_blocks.cjs`).
- Bramki BE: lint ✓, typecheck ✓, build ✓ (11 plików `.sql` w `dist/schema/`), `npm test` ✓ 93 pliki, 1549 passed, 3 skipped.
- Frontend: nie dotyczy (bez zmian w `contract/`).
- Próba na prawdziwej kopii produkcji: ⏳ 23.09 (scenariusz A).

## Breaking changes
Triggery zmieniają zapisy: każdy INSERT/UPDATE kategorii, zastosowania i dostawcy produktu oraz poprawki `kategoria`
jest normalizowany w bazie — tak jak na produkcji od 10–17.09. Kształt API bez zmian.

## Follow-up
- **Łańcuch zastosowań w kategorii kanonicznej spada do „Uniwersalne/pozostałe”** — trigger produkcji zna tylko
  pojedyncze wartości z listy (plus warianty Forwarder/Harwester), a JS `normalizeApplication()` produkuje łańcuchy
  `a ; b`. Odtworzone dosłownie; do pomiaru na kopii produkcji (ile wierszy ma ` ; `) i ewentualnej decyzji Ani.
  Skutek dla Selly: `multi_cat` praktycznie tylko dla kategorii niekanonicznych (I15.2, I15.6/I15.7).
- `repos/overrides.ts:73` `zapiszPoprawke()` — `INSERT … RETURNING` oddaje wiersz SPRZED triggera
  `manual_overrides_kategoria_ai`; dziś nikt nie czyta wyniku.
- 002/003 na kopii produkcji — patrz `docs/karty/I15.1/karta.md`, „Do koordynatora”.

## Review fixes applied
Review: 0 BLOCKER / 3 SHOULD-FIX / 2 NICE-TO-HAVE (`review.md`). Bez zmian w kodzie:
- adapter parsera bez normalizacji kategorii/zastosowania/blokad przed stagingiem — zakres I15.2 → `docs/karty/I15.2/wejscie-107.md`;
- pusta sekcja „Dowiezione” w karcie — uzupełniona w sync docs;
- krok 6 (kopia produkcji) — świadomie przed PR, scenariusz A (23.09).
Dodatkowo sprawdzone przez Mastera: `kategoria`/`zastosowanie` nie należą do `POLA_KLUCZOWE` (`src/import/tk.ts:125`) —
normalizacja triggerem nie generuje pozycji stagingu przy każdym imporcie.

## Docs updates
- `docs/karty/I15.1/karta.md` — Stan `🔨 ticket 107`; „Zakres” poprawiony (uzupełnianie przy starcie dotyczy tylko blokad);
  „Dowiezione” + „Zostało przed PR (scenariusz A)”; „Do koordynatora”: 002/003 (prośba użytkownika), zachowanie 011
  na produkcji (do `docs/cutover.md`), punkty kontrolne, wpis backlogu do nadania numeru (łańcuch zastosowań).
- **Nowe:** `docs/karty/I15.2/wejscie-107.md` (adapter bez normalizacji; łańcuch zastosowań; POLA_KLUCZOWE),
  `docs/karty/I15.3/wejscie-107.md` (jak wystawić pole; strażnicy; MO6 = NULL),
  `docs/karty/I15.6/wejscie-107.md` (`multi_cat` tylko dla kategorii niekanonicznych; I15.7 nie dotyczy — `mapper_v2` nie zna `multi_cat`).
- **Nowy:** `docs/spec-backend/wpis-107.md` — triggery 011 (kaskada ai→au), dyrektywa runnera, RETURNING przed triggerem AFTER.
- `docs/rebuild-backlog.md` — #73, #75, #79, #80, #82 → 🔨 (część schematowa: 107 / migracja 011); #101 — ustalenie MO6.
- Pre-existing issues: brak.

## Rozszerzenie zakresu (decyzja koordynatora 2026-09-22) — uodpornienie łańcucha migracji
- `src/db/migrate.ts` — dwie nowe dyrektywy pominięcia: `@pomin-jesli-typ-kolumny <tabela> <kolumna> <typ>` i
  `@pomin-jesli-tabela-istnieje <tabela>`; składnia wszystkich dyrektyw walidowana przed wykonaniem czegokolwiek;
  `WynikMigracji.bezTresci` (podzbiór `zastosowane`) + osobna linia w `npm run migrate` (`migrate-cli.ts`).
- `rebuild/schema/002_import.sql` — `uwaga_cena` przez `@dodaj-kolumne-jesli-brak` (reszta bez zmian;
  `suppliers.import_wylaczony` zostaje gołym `ALTER`, bo produkcja tej kolumny nie ma).
- `rebuild/schema/003_szerokosc_text.sql` — `@pomin-jesli-typ-kolumny products szerokosc TEXT` (uzasadnienie wyboru
  mechanizmu: `plan.md`, sekcja „Rozszerzenie zakresu”).
- `rebuild/schema/013_selly_products_warianty.sql` (plik karty I15.6, za zgodą użytkownika) —
  `@pomin-jesli-tabela-istnieje selly_products_old`; zaktualizowany test I15.6
  `test/migracje.selly-warianty.test.ts` („odnotowuje się bez wykonania treści” zamiast „pada”).
- **Nowe:** `test/db.migracje-produkcja.test.ts` + fixture `test/schemat-produkcji/7d6cfc9-schema.sql`
  (= `git show 7d6cfc9:db/schema.sql` bajt w bajt): pełny łańcuch 001→013 na schemacie produkcji (74 kolumny, bez
  `_migracje`) przechodzi; `bezTresci` = [003, 013]; `products`/`selly_products`/`selly_products_old`/triggery
  nietknięte; dochodzą tylko obiekty spoza produkcji; baza z 002/003 w `_migracje` nie dostaje ich nowej treści.
- `test/db.migracja-011.test.ts` — testy jednostkowe obu dyrektyw pominięcia (w tym: pominięcie obejmuje pozostałe
  dyrektywy pliku, brak kolumny = błąd i rollback).
- `rebuild/schema/README.md` — tabela trzech dyrektyw, uzasadnienie i nota, że zmiana treści zastosowanej migracji
  jest bezpieczna (runner pomija po nazwie).
- Bramki po rozszerzeniu: lint ✓, typecheck ✓, build ✓, `npm test` ✓ 98 plików, 1606 passed, 3 skipped;
  migracje z `SNAPSHOT_DB` ✓ (65 testów).
- Skutek dla cutoveru (co znika z ręcznej procedury `docs/cutover.md` §3) — opisany w „Do koordynatora”
  w `docs/karty/I15.1/karta.md`; aktualizację samego `cutover.md` wnosi koordynator.
