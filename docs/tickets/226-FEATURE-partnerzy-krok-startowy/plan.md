# 226 — krok wdrożenia: partnerzy startowi (PRT-9.1, część przygotowawcza)

Karta: `docs/karty/PARTNERZY/` · zależy od 208 (model) i całego silnika/panelu.

## Zakres
Krok `2026-10-10-partnerzy-startowi` na końcu `KROKI_WDROZENIA` (`src/kroki/rejestr.ts`): zakłada partnerów **TyreWorld** i **Adtyres** jako **nieaktywnych**, z ustawieniami domyślnymi
(stan minimalny 2, zaokrąglanie do grosza, CSV, brak harmonogramu). **Bez krajów, magazynów i kolumn** — to dane, które musi podać użytkownik (arkusze GEIS, narzuty, kolumny wzorcowe).

## Co zrobi po wdrożeniu (produkcja i środowisko testowe)
- Migracje `024`–`027` założą puste tabele modułu (`npm run migrate` przed krokami).
- Krok doda **2 wiersze** w `partnerzy` (nieaktywne). Niczego nie generuje, nie aktywuje, nie rusza katalogu produktów, nazw ani Selly.
- `PARTNERZY_SCHEDULER` zostaje wyłączony (domyślnie), więc żadne pliki nie powstają same. Ręczne „Generuj teraz” zapisuje wyłącznie w katalogu serwera.
- Nowa pozycja „Partnerzy” w menu panelu.

## Reguły
Idempotentny: partner o tej nazwie już istnieje (np. dodany ręcznie) → bez zmian; krok zapisuje się raz (`kroki_wdrozenia`). Bez sekretów; nie jest `tylkoProdukcja`, więc ruszy też na `training.agroopony.eu` (tam to nic nie psuje).

## Wymaga zgody użytkownika
Merge `develop` → `main` uruchamia `deploy-produkcja.yml`. **Nie robię go bez wyraźnego „tak”.** `deploy-produkcja.sh` bez zmian.

## Testy
`test/kroki.runner.test.ts` (+4): zakłada dwóch nieaktywnych, idempotencja, zapis raz, nie jest tylkoProdukcja.
