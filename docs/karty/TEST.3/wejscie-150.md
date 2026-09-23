# Wejście dla TEST.3 od ticketu 150 (karta TEST.2) · 2026-09-24

## „Czego nie wolno" — generowanie CSV z domyślnymi `SELLY_CSV_*` jest potwierdzone twardo

Punkt 4 karty TEST.3 wymienia jako zakaz *„generowanie CSV z domyślnymi `SELLY_CSV_*` (wskazują
katalog produkcyjny)"*. Ticket 150 to potwierdził konkretem, nie ogólnikiem — może go
zacytować wprost:

- `rebuild/backend/src/config/env.ts:138-146` — domyślne `SELLY_CSV_DIR`/`SELLY_CSV_PLIK`/
  `SELLY_CSV_URL` to wprost ścieżki produkcyjne (ta sama ścieżka, pod którą pisał stary
  generator `generate_selly_export.cjs`).
- Staging je nadpisuje: `tools/deploy-staging.sh:43-45`.
- Skutek, gdyby ktoś odpalił `npm run selly:csv` lokalnie bez override'u zmiennych: plik
  wylądowałby pod ścieżką produkcyjną, mimo że komenda została wywołana z laptopa deweloperskiego.

## Dodatkowy konkret do tej samej listy: `mirror/` na `develop` nie jest wiarygodną kopią produkcji

`mirror/backend/generate_selly_export.cjs` na `develop` ma **59 kolumn**, bez
`Blokowane-formy-platnosci` — wersja produkcyjna (60 kolumn) jest na `88fa31c`. To pułapka
konkretnie dla kogoś, kto sięga po `mirror/` jako po „oryginał" do porównania albo do
skopiowania logiki: `develop` może być nieaktualny względem zamrożonej produkcji. Warto, żeby
TEST.3 dodał to jako przykład przy zasadzie „sprawdzaj w źródle, nie z pamięci" (jeśli taka
zasada w dokumencie występuje) albo przy liście rzeczy, których nie wolno brać za pewnik bez
sprawdzenia commita. Dowód i metoda: `docs/tickets/150-DOCS-test-sciezki-krytycznej/dowod-csv.md`.
