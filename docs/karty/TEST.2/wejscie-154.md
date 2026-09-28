# Wejście dla TEST.2 od ticketu 154 · 2026-09-24 — dowód CSV wyszedł na zero, metoda ulepszona

## 1. Warunek z `wejscie-153.md` jest SPEŁNIONY

`FIX.1` zrobione ticketem 154 (2026-09-24). Dowód na stagingu wyszedł na zero:

| Pomiar | Wynik |
|---|---|
| Produktów aktywnych | 5396 = 5396 |
| Nagłówek | 60 kolumn, identyczny |
| Rozmiar pliku | 2 454 470 bajtów (oba) |
| MD5 | `3f8bec0d9ba03a552910971d5cef79eb` — **ta sama suma dla obu plików** |
| `diff` | pusty |
| Rozkład różnic na kolumny | brak różnic w żadnej kolumnie |

Instrukcja może już twierdzić, że plik nowego stosu jest identyczny z plikiem generatora
produkcji — z datą sprawdzenia **2026-09-24**. Szczegóły i komendy: `docs/tickets/154-BUG-csv-selly-flagi-tak/raport.md`.

## 2. Metoda z `wejscie-153.md` została ULEPSZONA — opisz TĘ wersję

Raport 153 kazał puszczać oba generatory „jeden po drugim" na żywej bazie stagingu, bo tam
chodzi scheduler importu i przerwa między przebiegami wprowadza szum w cenach i stanach. Ticket
154 zrobił zamiast tego **mrożoną kopię bazy stagingu** (`better-sqlite3` `backup()` z połączenia
otwartego `{ readonly: true }`) i puścił oba generatory na **tej samej kopii**.

Zalety:
- szum schedulera znika **całkowicie**, zamiast być tylko minimalizowany przerwą między przebiegami;
- oba generatory mają **gwarantowanie identyczne** wejście (dosłownie ten sam plik bazy);
- baza stagingu nie jest w ogóle otwierana do zapisu podczas pomiaru.

Koszt: kopia waży ~220 MB, trzeba mieć na to miejsce (na VPS było 6,7 GB wolnego). Po pomiarze
pliki wynikowe i kopię bazy trzeba usunąć — CSV zawiera kolumnę `Cena-zakupu` i leży poza
`public_html`.

## 3. Zabezpieczenia, które MUSZĄ zostać w instrukcji technicznej

Powtórzone, bo krytyczne:
- generator produkcji bierze się z **`origin/main`** (na `develop` katalog `mirror/` jest cofnięty
  do 25.08) i jest uruchamiany **wyłącznie jako kopia z podmienionymi trzema stałymi** `DB_PATH`,
  `OUT_DIR`, `OUT_FILE` — oryginał celuje w `/home/admin/private_apps/bridge/data.db` i w
  produkcyjny katalog eksportu;
- przed uruchomieniem **kontrola `grep`em**, że w kopii nie zostaje ani jedna ścieżka
  produkcyjna (`private_apps/bridge/`, `public_html`);
- nasz generator dostaje `SELLY_CSV_DIR` w katalogu pomiarowym, **nigdy** produkcyjnego
  `public_html/panel/ex-port-files`.

## 4. Rozgraniczenie z `wejscie-153.md` — pamiętaj

Ten dowód jest **dla nas**, nie dla Ani (wymaga SSH na VPS i podmieniania stałych w skrypcie).
W instrukcji dla Ani zostaje sam **wynik** plus „co sprawdzić w panelu" (plik się wygenerował, ma
dzisiejszą datę, sensowna liczba pozycji). Procedura idzie do sekcji technicznej albo odsyłacza
do `docs/tickets/154-BUG-csv-selly-flagi-tak/raport.md`.

## 5. Ostrzeżenie o czułości pomiaru — dochodzi druga rzecz

Sam `diff` nie wystarcza (to już było w 153), ale **pusty `diff` też trzeba skontrolować
pozytywnie** — bo pusty `diff` mógłby równie dobrze znaczyć „oba generatory oddały pusto".
Ticket 154 policzył, ile razy `Tak` występuje w każdej kolumnie flagowej i sprawdził, że zgadza
się to z censusem typów w bazie (`text 'Tak'` + `integer 1`):

| Kolumna CSV | Wystąpień `Tak` | = tekst `'Tak'` + `integer 1` w bazie |
|---|---|---|
| `Snieg-3PMSF` | 946 | 750 + 196 |
| `Bloto+snieg` | 913 | 713 + 200 |
| `CFO` | 60 | 52 + 8 |
| `NRO` | 25 | 12 + 13 |
| `CHO` | 12 | 10 + 2 |

Dodatkowo pomiar sprawdził własną czułość: ten sam porównawczy przebieg na kodzie SPRZED
naprawy (ta sama zamrożona kopia bazy) odtworzył dokładnie 899 różniących się wierszy z wpisu
`#153.1` — czyli metoda widzi usterkę, gdy jest, i nie widzi jej, gdy naprawiona.
