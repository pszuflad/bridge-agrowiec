Dwie rzeczy zgłoszone przez użytkownika 2026-09-24.

**1. Audyt środowiska przed cutoverem** — nowy rozdział 3a w `docs/cutover.md`: tabela wszystkich zmiennych z kolumnami „staging" i „produkcja", polecenie sprawdzające obecność kluczy **bez ujawniania wartości**, tabela dostawców (czego wymaga który sposób dostarczania) oraz cztery rzeczy spoza zmiennych: cron CSV, `.htaccess` z białą listą IP, uprawnienia do katalogów, wpisy PM2.

⚠ Najważniejsze ustalenie: **`AGRORAMI_*` nie są w schemacie walidacji** (`env.ts`), więc proces wstaje bez nich, a MO9 — jedyny dostawca z API — wywala się dopiero przy imporcie. Tak samo sekrety Selly. Dlatego audyt jest listą do odhaczenia, a nie „skoro wstał, to działa".

**2. Priorytety testu** — `docs/karty/TEST.1/wejscie-145.md`: ścieżka główna (import → parsery → baza, potem eksport → CSV → Selly → sklep) dostaje 80% uwagi i rozpisane scenariusze; panel administracyjny i pozostałe ekrany to krótka lista kontrolna z odesłaniem do przeglądu widoków. Z zastrzeżeniem, że na stagingu Selly jest wyłączone, więc część eksportu da się sprawdzić dopiero na produkcji.

Tylko dokumentacja.
