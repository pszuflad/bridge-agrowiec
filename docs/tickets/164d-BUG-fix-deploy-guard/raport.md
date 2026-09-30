# 164d-BUG-fix-deploy-guard — raport implementacji

## Summary

Pierwszy deploy z blokiem z ticketu 164c (plik-znacznik „uruchom tylko raz") NIE wykonał
naprawy nazw — potwierdzone dwukrotnie: (1) w logu deployu (run 36748568641, commit 699d448)
brak jakiejkolwiek linii z tego bloku, a przerwa czasowa między `npm run migrate` a startem PM2
to ułamek sekundy — za mało na uruchomienie Node/tsx; (2) użytkowniczka sprawdziła panel
produkcyjny (zrzut ekranu) — pozycje `MO1_15126981`/`MO1_15126983` nadal mają identyczną,
sklejoną nazwę. Przyczyna leży najwyraźniej w tym, że plik-znacznik
`$PROD_ROOT/.164-napraw-nazwy-wykonano` już istniał na serwerze — nie da się tego
zdiagnozować bez dostępu SSH (użytkowniczka świadomie go nie chce udzielać, a sesja nie ma
własnych danych dostępowych do VPS).

Rozwiązanie: usunięto mechanizm pliku-znacznika. Krok naprawy wykonuje się teraz PRZY KAŻDYM
deployu produkcji, bezwarunkowo — bezpiecznie, bo sam skrypt jest idempotentny.

## Changes

- `tools/deploy-produkcja.sh` — usunięto `if [ ! -f "$NAPRAWA_NAZW_ZNACZNIK" ]; then ... fi`
  z ticketu 164c; wywołanie `npm run napraw-nazwy-sklejone` zostaje, ale bezwarunkowe.
  Komentarz opisuje, co się stało i dlaczego porzucono podejście ze znacznikiem.

## Deviations from plan

Odejście od planu 164c (jednorazowe uruchomienie) na rzecz uruchamiania przy każdym deployu —
wymuszone tym, że mechanizm jednorazowości zawiódł w praktyce, a bez SSH nie da się ustalić,
dlaczego. Ponieważ skrypt jest idempotentny, uruchamianie go przy każdym przyszłym deployu jest
bezpieczne, tylko kosztuje ułamek sekundy — zaakceptowany kompromis zamiast dalszego zgadywania.

## Test results

- Jak w 164c — zmiana w skrypcie bash uruchamianym na serwerze, nie da się jej pokryć testem
  jednostkowym backendu. Sprawdzono składnię i miejsce w pliku.
- Weryfikacja właściwa nastąpi po zmergowaniu do `main` i deployu: sprawdzenie loga (powinna
  pojawić się linia „ticket 164: naprawa nazw sklejonych opon...") oraz panelu produkcyjnego
  (pozycje MO1_15126981/MO1_15126983 powinny mieć różne, poprawne nazwy).

## Breaking changes

None.

## Follow-up

- Jeśli po tym deployu nazwy WCIĄŻ się nie zmienią, problem nie leży w mechanizmie
  uruchamiania (ten teraz na pewno wykona krok), tylko głębiej — w samym skrypcie
  `napraw-nazwy-sklejone` albo w uprawnieniach/środowisku produkcyjnym. Wtedy potrzebny będzie
  dostęp SSH (Ania) do odczytania pełnego outputu kroku wprost z logu deployu
  (`$PROD_ROOT/deploy.log` na serwerze) albo bezpośredniego sprawdzenia bazy.
- Rozważyć w kolejnym, mniejszym ticketcie: czy zostawić ten krok na stałe przy każdym deployu
  (koszt: ułamek sekundy, 174 porównania), czy po potwierdzeniu sukcesu usunąć go zupełnie.
