# Wejście dla I15.8 od ticketu 119 (I15.10) · 2026-09-23

- Nowy moduł `src/selly/dostepnosc.ts` wymaga montażu (`ustawDomyslnaSynchronizacjeDostepnosci`) w
  `app.ts` — do uzgodnienia z I15.4, która karta go montuje; ticket 119 celowo `app.ts` nie ruszał.
- `syncDelta` ma teraz w wyniku pole `kolizje` i `stats.kolizje_kod_importu`, a w
  `selly_sync_log.szczegoly_json` klucz `kolizje` — jeśli I15.8 wystawia trasy raportujące wynik
  synchronizacji, to pole jest do pokazania.
- Okresowa synchronizacja (harmonogram I15.8) jest JEDYNYM mechanizmem ponawiania nieudanych
  odświeżeń dostępności — moduł `dostepnosc.ts` nie ma własnego timera i celowo go nie dostał.
