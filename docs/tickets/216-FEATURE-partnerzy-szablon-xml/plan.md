# 216 — szablon XML cennika partnera, wzorzec Ceneo (PRT-3.3)

Karta: `docs/karty/PARTNERZY/` · poziom 3 · zależy od 214, 215.

## Zakres
`src/partnerzy/plik-xml.ts`: `zbudujXml({kolumny, wiersze, kraj})`, `escapujXml`. Ta sama konfiguracja kolumn co CSV. Bez zapisu na dysk (3.4), tras i migracji.

## Decyzje
- Ceneo ma jedną cenę oferty, więc XML powstaje w układzie **plik na kraj** (cena kraju → `price`).
- Mapowanie po polu katalogu: `kod` → `o@id`, `nazwa` → `<name>`, `stan` → `o@stock`, `kategoria` → `<cat>`; reszta kolumn → `<attrs><a name="…">`. Bez tych kolumn wartości domyślne z pozycji (Ceneo wymaga id, ceny, nazwy). `avail=1` dla stanu > 0.
- Tekst escapowany (bez CDATA), znaki niedozwolone w XML 1.0 usuwane. Cena `0.00`. Wiersz bez ceny kraju wypada.
- Pełnego schematu Ceneo (zdjęcia `imgs`, opis `desc`, `url`, `weight`) nie odwzorowujemy — katalog Bridge nie ma tych danych dla partnerów; po dostarczeniu wzorca od partnera rozszerza się to w jednym miejscu. **Wzorca XML od partnera nie ma w repo** — struktura jest zgadywana z publicznego formatu Ceneo (do potwierdzenia).

## Zmiana zachowania produkcji
Brak — nowy moduł, nikt go jeszcze nie woła.

## Testy
`test/partnerzy.plik-xml.test.ts` — dokładny wynik, wypadanie wierszy, escapowanie, wartości domyślne, błąd pola obliczeniowego, dobrze uformowanie.
