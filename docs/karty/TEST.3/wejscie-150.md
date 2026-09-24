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
`Blokowane-formy-platnosci` — o jedną mniej niż wersja produkcyjna. **To nie jest zaniedbanie,
tylko stan celowy:** `mirror/` w `develop` jest cofnięty do stanu z 25.08 (commit `6594525`,
bramki wierności) — ustalenie z `docs/karty/TEST.2/wejscie-153.md`. **Żywy oryginał bierze się
z `origin/main`**, nie z gałęzi roboczej.

To jest dobry, konkretny przykład dla TEST.3 przy zasadzie „sprawdzaj w źródle, nie z pamięci":
zarówno ticket 153, jak i ticket 150 opisały tę różnicę najpierw jako „`mirror/` jest
nieaktualny", zanim wyszło, że jest cofnięty świadomie. Morał dla Ani jest praktyczny: **nazwa
katalogu nie mówi, z którego momentu pochodzi jego treść** — to ten sam rodzaj pomyłki co
„etykieta kopii `.bak` daje etykietę, nie treść" z `CLAUDE.md`.
Dowód i metoda: `docs/tickets/150-DOCS-test-sciezki-krytycznej/dowod-csv.md`.
