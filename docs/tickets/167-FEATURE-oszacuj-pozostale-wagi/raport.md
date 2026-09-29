# 167-FEATURE-oszacuj-pozostale-wagi — raport implementacji

## Summary

Drugi, świadomie mniej dokładny krok dla produktów, którym „Dociągnij wagę" (ticket 155/156)
nie znalazła żadnego identycznego „bliźniaka" (marka+rozmiar+bieżnik). Nowy przycisk „Oszacuj
pozostałe wagi" liczy średnią wagę wszystkich innych produktów TEGO SAMEGO rozmiaru w katalogu
(bez względu na markę i bieżnik) i oznacza wynik jako SZACUNEK — osobna flaga `wagaSzacowana`,
osobny tooltip (żółty trójkąt ostrzegawczy, nie niebieska ikonka info), osobny przycisk i trasa.

## Changes

- `rebuild/schema/015_waga_szacowana.sql` — nowa migracja: `products.waga_szacowana`.
- `rebuild/backend/src/db/schema.ts` — nowa kolumna.
- `rebuild/backend/src/import/dziedziczenieWagi.ts` — `kluczRozmiaru`, `sredniaWagaDlaRozmiaru`,
  `oszacujWageWstecznie` (ten sam wzorzec ochrony co dziedziczenie: pomija chronione ręczną
  poprawką, jedna transakcja).
- `rebuild/backend/src/routes/maintenance.ts` — `POST /api/products/oszacuj-wage`, audyt
  `oszacowanie_wagi_wsteczne`.
- `rebuild/backend/src/repos/products.ts` — ręczna edycja `waga` resetuje też `wagaSzacowana`.
- `rebuild/backend/scripts/oszacuj-wage.ts` — cienki wrapper CLI (`npm run oszacuj-wage`).
- `contract/openapi.yaml`, `contract/fixtures/POST_products_oszacuj-wage.json` — nowy endpoint
  (fixture ręcznie napisany — produkcja go nie ma, jak przy `dziedzicz-wage`).
- Frontend: `filtrowanie.ts` (`Produkt.wagaSzacowana`), `formatowanie.tsx` (osobny tooltip
  amber `AlertTriangle`, priorytet: `wagaAutoUzupelniona` > `wagaSzacowana`), `konfiguracja/katalog.ts`
  (klient `oszacujWage()`), `konfiguracja/Katalog.tsx` (nowy przycisk + własny wynik + link do
  `/katalog?status=brak_waga`).
- Testy: `test/oszacowanie-wagi.test.ts` (10 jednostkowych), `test/maintenance.test.ts` (+5
  integracyjnych HTTP), `test/katalog.formatowanie.test.tsx` (+2), `test/konfiguracja.admin.test.tsx`
  (+4). Poprawki mechaniczne po dodaniu kolumny (73→74 kluczy): `db.migracje.test.ts`,
  `db.migracja-011.test.ts`, `db.migracje-produkcja.test.ts`, `katalog.gate.test.ts`,
  `produkty.mutacje.test.ts`, `projekcja.test.ts`, `charakteryzacja/silnik/wzorzec.mjs`.

## Test results

- Backend: `npm run lint && npm run typecheck && npm run build && npm test` —
  **1883/1883 zielone** (0 regresji, +18 nowe testy netto).
- Frontend: `npm run lint && npm run typecheck && npm run build && npm test` —
  **1011/1011 zielone** (0 regresji, +6 nowe testy netto).
- Skrypt `npm run oszacuj-wage` zweryfikowany ręcznie na tymczasowej bazie (3 produkty tego
  samego rozmiaru, różne marki/bieżniki: dwa z wagą 70/90, jeden pusty → oszacowano na 80).

## Breaking changes

Brak.

## Follow-up

Żaden nowy — mechanizm jest kompletny wobec ustaleń z Q&A (2026-09-29): przelicznik działa
tylko tam, gdzie w katalogu jest choćby jeden inny produkt tego rozmiaru z wagą; reszta zostaje
do ręcznego uzupełnienia (link do filtra „Brak wagi" z ticketu 166 nadal działa po tym kroku).
