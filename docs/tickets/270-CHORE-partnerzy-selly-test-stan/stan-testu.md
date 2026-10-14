# 270 — stan testu „Utwórz w Selly” (2026-10-14)

Test na zamówieniu `TEST-SELLY-20261014` (Adtyres, 1 szt., założone krokiem wdrożenia 267). Selly (`POST https://agroopony.selly24.pl/api/orders`) sprawdza pola po kolei i odrzuca pierwszy błąd — poprawiamy po jednym.

| # | Komunikat Selly (HTTP 400) | Przyczyna | Poprawka |
|---|---|---|---|
| 1 | „Brak statusu zamówienia o id: 101” | w polu „Selly: ID statusu nowego zamówienia” stało 101 (to ID VAT „0 % WDT”) | użytkowniczka wpisała 3 w ustawieniach partnera |
| 2 | „Niedozwolone pole: currency” | sklep prowadzi zamówienia w PLN; `currency` i `exchange_rate` są tylko do odczytu | ticket 268: ceny w PLN (EUR × kurs NBP), bez pól waluty |
| 3 | „Brak metody wysyłki zamówienia o id: 101” | `delivery_id` w danych partnera = 101 (ID VAT w złym polu; pola nie ma w panelu) | ticket 269: płatność 1 (przelew), dostawa 209 (kurierska); krok wdrożenia zastąpił 10/101 |
| 4 | „Brakuje wymaganego argumentu: ship_postcode” | zamówienie testowe nie ma adresu dostawy (`ship_postcode`, `ship_city`, `ship_address` puste) | **OTWARTE** |

## Ciało wysłane przy próbie 4 (po poprawkach 1–3)

Płatność 1, dostawa 209, status 3, ceny w PLN (43,71 zł = 10 EUR × kurs), dane do faktury Adtyres (kraj DE → nr VAT DE), `ship_company` = „TEST - do usuniecia”, `delivery_country_iso2` = DE, produkt 560/560, `vat_rate_id` 101. Bez `currency` i `exchange_rate`.

## Dalsze kroki

- Adres dostawy: zamówienia z pliku partnera mają dane odbiorcy (`DELIVERY`); testowe ich nie ma. Zdecydować: (a) uzupełnić zamówienie testowe adresem i ponowić; (b) dla zamówień bez adresu wpisywać „-” zamiast pustego (Selly wymaga pola). Do rozstrzygnięcia z użytkowniczką.
- Selly może zgłosić kolejne wymagane pola (np. `ship_city`, `ship_address`) — każdy odrzut jest bezpieczny (zamówienie nie powstaje, wraca do „przyjęte”).
- Po udanym teście: usunąć zamówienie w Selly ręcznie. NIE klikać „Zapisz i wyślij tracking” na zamówieniu testowym (plik trafiłby do katalogu Adtyres).
- Tryb automatyczny tworzenia w Selly — dopiero po udanym teście ręcznym.
- Wejście zamówień: odbiór plików z `orders` co 10 min jest włączony na produkcji (266); kanał e-mail wyłączony (zamówienia przychodzą też jako powiadomienia na zamowienia@ — samo powiadomienie, bez XML).
