# 180 · Handlopex EAN, słownik modeli producenta, duplikaty AUTO — raport (2026-10-01)

Zlecenie: Ania (sesja Perplexity Computer, 2026-10-01) — dokończenie SPEC „Naprawa kolejki stagingu” po ticketach 176–179.

## Decyzje użytkowniczki (wiążące)
1. „Dostawca nic nie zmieni w Handlopexie — to są ich oznaczenia i mają być traktowane jako prawidłowe.”
2. `9996118002103` (LingLong KLD200, MO5) — „jako EAN mimo błędu” (zła cyfra kontrolna).
3. Kilka kart AUTO → jedna karta R: zostaje ta z bieżącej oferty; ta ze stanem 0 — usunąć całkowicie z Bridge i z Selly
   („jak wróci, wpadnie jako nowy produkt”).
4. Słownik zapisu producenta: Trelleborg T539, Cultor RD-01 / AS-AGRI 10/13/19, Mitas EM-22, LingLong L-T20/L-S20/L-D20/L-T10/R-D30.

## Zmiany
- `src/import/polityka/ean-dostawcy.ts` (nowy): `kanonicznyEanDostawcy` (MO4/MO5: 13 cyfr z poprawną sumą + 1–3 litery,
  opcjonalnie `_`/`-`/spacja i cyfra → same cyfry; surowy zapis w `_supplierEanOriginal`), `validateEanDostawcy`
  (MO4/MO5: błąd WYŁĄCZNIE cyfry kontrolnej → prawidłowy). Podpięte w `fabryka.ts` (import, indeks EAN katalogu, aktualizacja EAN
  w miejscu), `blokady.ts`, `akceptacja.ts`, `ean-bledny.ts`. Legacy `adapter.cjs` nietknięty (charakteryzacja bajt w bajt);
  w `silnik.charakteryzacja.test.ts` odstępstwo zamockowane jak 176/178.
- `src/import/slowniki/modele-producenta.ts`: wpisy z decyzji 4. KLT200/KLS200/KLD200/KTD300 mają inny klucz — test pilnuje.
- `src/import/migracje/scal-karty-auto.ts`: grupy „kilka kart AUTO” — zwycięzca z oferty (albo jedyny ze stanem > 0),
  reszta ze stanem 0 → decyzja `usun_duplikat` (Bridge: archiwum `products_scalone` z `usunietyDuplikat:true`, usunięcie karty,
  poprawek, kolejki; Selly: wiersz do `selly_products_scalone` z `do_usuniecia=1`). Para bez odczytu oferty: dane handlowe R z
  aktywnej karty A (stan > 0), żeby sklep nie stracił towaru do najbliższego importu. `usunDuplikatySelly` + flaga CLI
  `--usun-duplikaty-selly`: DELETE wariantu, a gdy to jedyny wariant i brak innych mapowań — DELETE produktu; 404 = już usunięte.
  `--zeruj-selly` pomija wiersze do usunięcia.
- `src/selly/klient.ts` + `tryb.ts`: `deleteVariant`, `deleteProduct` (metody zapisujące, blokada `SELLY_TRYB`).
- `rebuild/schema/020_scalone_duplikaty_do_usuniecia.sql`: kolumny `do_usuniecia`, `usunieto_at` w `selly_products_scalone`.

## Bramki
`npm run lint`, `npm run typecheck`, `npm test` (131 plików, 2080 testów) — zielone.

## Kolejność na danych (po wdrożeniu)
`normalizuj-katalog --apply` → `scal-karty-auto --apply` → `npm run selly:csv` → delta sync → `--zeruj-selly` → `--usun-duplikaty-selly`.
