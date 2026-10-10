# 225 — panel partnerów: logi, błędy i „Generuj teraz” (PRT-5.4)

Karta: `docs/karty/PARTNERZY/` · poziom 5 (ostatni ticket panelu) · zależy od 219 (logi), 220 (generuj), 222 (strona szczegółów).

## Zakres (frontend, strona `/partnerzy/:id`)
- **Akcje na górze strony:** status, Aktywuj/Dezaktywuj (przeniesione z listy także na stronę szczegółów), przycisk **Generuj teraz** (`POST …/generuj`): wynik per plik („zapisano (N pozycji, pominięto M)” albo „NIE zapisano — poprzedni cennik zostaje”), toast z liczbą plików/błędów/ostrzeżeń, odświeżenie logów; komunikaty serwera przy 409 (trwa) i 503.
- **Logi operacji:** jedna linia na operację (czas + opis), przycisk Odśwież, informacja o retencji 30 dni.
- **Błędy i ostrzeżenia:** lista z odznaką poziomu i filtrem (wszystkie / błędy / ostrzeżenia) wysyłanym do serwera (`?poziom=`).

## Uwaga
Generowanie z panelu zapisuje pliki do katalogu serwera (`PARTNERZY_KATALOG`), nie wysyła ich partnerowi — dostarczanie to poziom 6 (FTP) i wymaga decyzji. Dopóki `PARTNERZY_SCHEDULER` jest wyłączony, jedyną drogą jest ten przycisk.

## Zmiana zachowania produkcji
Brak — nowe sekcje strony nowego modułu; backend bez zmian.

## Testy
`test/partnerzy.logi.test.tsx` (9); starsze testy strony dostały handlery logów. Frontend: lint, typecheck, build, testy zielone.
