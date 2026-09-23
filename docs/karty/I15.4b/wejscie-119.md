# Wejście dla I15.4b od ticketu 119 (I15.10) · 2026-09-23 — punkt wpięcia modułu dostępności

Karta I15.10 dołożyła moduł `src/selly/dostepnosc.ts`, celowo NIEWPIĘTY — montaż i wołanie robi ta karta
(staging, auto-wstrzymania).

## Co wołać

`zadajOdswiezenie(dostawca)` z `src/selly/dostepnosc.ts` — odpowiednik produkcyjnego
`require('./availability_sync.cjs').request(db, supplier)`.

## Gdzie w oryginale jest punkt wpięcia

`mirror/backend/staging_policy.cjs:131-134`:
```js
function refreshAvailability(supplier){
  if(require('path').resolve(db.name)!=='/home/admin/private_apps/bridge/data.db')return;
  require('./availability_sync.cjs').request(db,supplier);
}
```
wołane z `importer()` (`:614`, warunek `availabilityChanged && !options.reconcileOnly`) oraz jako
`U.refreshAbsenceAvailability` (`:331`) przy decyzjach „brak karty".

## Montaż

Zanim `zadajOdswiezenie()` cokolwiek zrobi, ktoś musi zawołać
`ustawDomyslnaSynchronizacjeDostepnosci(stworzSynchronizacjeDostepnosci({db, discovery, sciezkiCsv}))`.
Bez tego wywołanie jest ŚWIADOMYM no-opem (odpowiednik produkcyjnej bramki „to nie produkcyjna baza →
wracaj"). Uzgodnij z I15.8, która karta robi montaż w `app.ts` — ticket 119 celowo `app.ts` nie ruszał.

## ⚠ Ostrzeżenie (potwierdzone eksperymentalnie) — gdzie NIE wołać

Hook NIE MOŻE wołać `zadajOdswiezenie()` bezwarunkowo z WNĘTRZA biegu `syncDelta`. Moduł drenuje kolejkę
w pętli `while`, więc bezwarunkowe zgłoszenie z wnętrza delty daje pętlę nieskończoną — w testach ticketa
119 wysypało to proces Node na OOM, zanim dołożono bezpiecznik. Produkcja jest bezpieczna, bo woła
`refreshAvailability` z KOŃCA `importer()`, a nie ze środka synchronizacji. Trzymaj się tego miejsca —
wołaj po zakończeniu importu/decyzji, nie w trakcie.

## Semantyka kolejki, którą trzeba znać

Zgłoszenie przychodzące PO skompletowaniu bieżącej partii czeka na kolejny obrót pętli i nie ginie.
Dostawca, który JEST w partii przerwanej wyjątkiem, PRZEPADA w tym obrocie (pętla czyści zbiór
oczekujących przed przetwarzaniem) — nadrabia to dopiero okresowa synchronizacja (harmonogram I15.8).
To zachowanie oryginału, nie błąd.

## Świadome odstępstwo do wiadomości

Generator CSV wołany jest w TYM SAMYM procesie (`wygenerujCsvSelly`), a nie przez `execFileSync` z
timeoutem 60 s jak w produkcji. Konsekwencja: brak izolacji błędu i twardego timeoutu — ryzyko ocenione
jako niskie (generator czyta lokalny SQLite i pisze plik, bez wywołań sieciowych).
