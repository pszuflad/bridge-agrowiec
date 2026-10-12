# Wpis 238 — publikacja cenników do katalogów partnerów

`PARTNERZY_KATALOGI_PUBLIKACJI` (`Nazwa=/ścieżka bezwzględna;…`, nazwa bez rozróżniania wielkości liter). Po zapisaniu plików przez generator (ręcznie lub z harmonogramu) serwis kopiuje zapisane pliki do katalogu partnera (plik tymczasowy + rename). Katalog musi istnieć. Brak wpisu/zmiennej = bez publikacji. Błąd = wpis w `partner_error_log`, generowanie się nie wywraca. Nazwy plików zawsze zwykłe (bez ścieżek).
Uwaga operacyjna: środowisko testowe działa na tym samym serwerze jako ten sam użytkownik — zmienną ustawia krok wdrożenia wyłącznie w `.env` produkcji (`tylkoProdukcja`).
Wartość zmiennej w `.env` jest w cudzysłowie, bo skrypt wdrożenia czyta `.env` przez `source`, a średnik rozbiłby linię.
