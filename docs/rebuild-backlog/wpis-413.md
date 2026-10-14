# Wpisy backlogu od PR 413 · 2026-10-14

Kontekst: poprawka kosztu zakupu Selly (CSV brutto, ochrona kosztu wspólnego produktu, odświeżanie
CSV po cichej zmianie ceny). Ustalenia: `docs/spec-backend/wpis-413.md`. Numer `413` to numer PR, nie
ticketu. Identyfikatory `#413.N`.

- **#413.1 (develop nie ma poprawki):** ⚠ PR 413 został scalony prosto do `main` (`8a50415`); `develop`
  go NIE zawiera (`git merge-base --is-ancestor 8a50415 origin/develop` → nie; w `origin/develop..origin/main`
  było 25 commitów). Pliki `selly/koszt-zakupu.ts`, `selly/rest/koszt-produktu.ts` i test
  `selly.koszt-zakupu.test.ts` są tylko na `main`. Następny PR `develop` → `main` albo gałąź z `develop`
  może poprawkę cofnąć. Do zrobienia: scalić `main` do `develop` (osobny PR, z bramkami).
- **#413.2 (weryfikacja po imporcie 12:00):** ⏳ odczytać po imporcie Selly wariant 5865 (oczekiwane
  zakup 830,93 netto / 1022,04 brutto; sprzedaż 1083; stan 8) i sprawdzić, że nie powstały nowe karty.
- **#413.3 (jednostka `price_purchase`):** ⏳ ustalić w panelu Selly, czy koszt produktu głównego jest
  netto czy brutto (produkt 5088: 919,94). Do czasu ustalenia `SELLY_KOSZT_PRODUKTU_JEDNEGO_WARIANTU` zostaje `false`.
- **#413.4 (historyczne `cena_zakupu_wyslana`):** ⏳ stare potwierdzenia (np. 830,93 dla 5088) mogą
  blokować wybór do delty mimo błędnego kosztu w Selly. Naprawa tylko ograniczonymi partiami (limiter
  250/min), nie zbiorczym unieważnieniem snapshotów.
- **#413.5 (ścieżki edycji bez odświeżenia CSV):** ⏳ odświeżenie dotyczy cichej aktualizacji importera.
  Ręczne i stagingowe zmiany ceny nadal nie regenerują pliku — rozstrzygnąć, czy dołożyć (A) odświeżenie
  po każdej zmianie ceny, czy (B) cykliczne `npm run selly:csv` przed importem Selly.
- **#413.6 (MO1: `stan_wyslany IS NULL`):** ❓ hipoteza z kodu, niezweryfikowana: oferta bez stanu jest
  „do wysłania" w każdym cyklu Toru 1. Sprawdzić na kopii produkcji liczbę pozycji MO1 z
  `stan_wyslany IS NULL` i czasy biegów `sync_delta` w `selly_sync_log`, zanim ktokolwiek ruszy kod.
- **#413.7 (rentowność):** ⏳ po zmianie kosztu w Selly sprawdzić raporty rentowności i reguły Selly
  używające kosztu zakupu (wartości mogą się zmienić — to oczekiwane).
