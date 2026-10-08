# Wpis do spec-backend od ticketu 197 (flagi 'Tak' w sync REST do Selly) · 2026-10-08

- `produktPoKodzie` i `produktyDoSynchronizacji` (`repos/selly.ts`) nakładają przez `naniesSuroweFlagi` prawdziwość SUROWEJ wartości
  dziesięciu kolumn flagowych (`ms`, `snow_3pmsf`, `reinforced`, `extra_load`, `cut_resistant`, `heat_resistant`, `stubble_resistant`, `nro`, `cho`, `cfo`).
  Powód: tryb `boolean` w modelu zamienia tekst `'Tak'` na `false`, więc `zbudujOpisOpony` pomijał wiersze M+S / 3PMSF / odporności.
  Semantyka jak w oryginale (`SELECT *` + `wartość ? "tak" : null`) i w generatorze CSV (ticket 154): każda niepusta, niezerowa wartość = tak.
- `schema.ts` i `GET /api/products` bez zmian (nadal `false` na `'Tak'`, zgodnie z fixture).
- Dotyczy opisu HTML (`content_html`) przy `POST /api/selly/sync-product` i `sync-supplier`. Pełna synchronizacja v2 (`mapper-v2.ts`, `yn()`) nie była dotknięta.
- Pozostaje osobna kwestia kompletności cech v2: CFO/NRO/CHO nie są w mapie cech.
