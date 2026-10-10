# 218 — test zgodności cenników z układem plików wzorcowych (PRT-3.5)

Karta: `docs/karty/PARTNERZY/` · poziom 3 · zależy od 217.

## Zakres
`test/partnerzy.zgodnosc.test.ts` + jedna zmiana w kodzie: `wybierzPozycje` pomija pozycje z **pustym numerem katalogowym** (`pominiete.bezKodu`) — w plikach wzorcowych 30/31 takich wierszy to defekt.

## Czego plik NIE ma (ważne)
Plików wzorcowych `tyreworld_agrowiec.csv` i `adtyres_agrowiec_at.csv` **nie ma w repo**. Test używa danych syntetycznych z układem kolumn i defektami opisanymi w karcie. Dowodzi własności, nie zgodności z konkretnymi liczbami: porównanie z prawdziwymi plikami (cena AT identyczna dla 3428 EAN-ów) wymaga ich dostarczenia — pytanie do użytkownika. Kolumna `MfrCode` z pliku TyreWorld jest pominięta (karta nie opisuje jej źródła w katalogu).

## Co test sprawdza
- Układ TyreWorld: jeden plik, kolumny `… euro nett` dla 6 krajów, nagłówki bez spacji na końcu, jeden wiersz na pozycję (ten sam EAN w dwóch magazynach = dwa wiersze, bez agregacji).
- Brak defektów: puste CatNumber, spacje na brzegach komórek, `-` w cenach (zawsze `\d+.\d{2}`), stan < 2, pozycja bez wagi (zalogowana, nie wyzerowana), pusty/„spacjowy” wiersz końcowy, BOM, CRLF.
- Układ Adtyres: plik na kraj, `Warehouse` i `PriceEurNet`, brak powtórzonych par EAN×magazyn.
- **Jeden silnik cen:** cena AT w pliku TyreWorld = `PriceEurNet` w pliku Adtyres dla tej samej pozycji.
- Skala ~2300 pozycji w kilka sekund.

## Zmiana zachowania produkcji
Brak — moduł nie jest jeszcze wołany. Nazw produktów nie dotyka.
