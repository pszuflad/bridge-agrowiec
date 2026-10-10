# 215 — szablon CSV cennika partnera (PRT-3.2)

Karta: `docs/karty/PARTNERZY/` · poziom 3 · zależy od 208 (`partner_kolumny`, `partner_pola_obliczeniowe`), 211 (formuły), 214 (wyceniane wiersze).

## Zakres
`src/partnerzy/plik-csv.ts`: `wczytajKolumny(db, partnerId, kraje)` (wczytanie i skompilowanie kolumn partnera, błąd konfiguracji = `BladFormuly`), `zbudujCsv({...})`
(tekst pliku + liczniki + błędy pól obliczeniowych). Bez zapisu na dysk (to 3.4), bez tras i migracji.

## Reguły
- Format: UTF-8, **LF, bez BOM**, nagłówek w pierwszym wierszu, separator z ustawień partnera (`;` domyślnie), nazwy kolumn przycięte (bez spacji na końcu — defekt plików wzorcowych).
- Źródło kolumny: `katalog` (pole z białej listy `POLA_KATALOGU`; nic poza nią, np. `haslo_hash`, nie wycieknie), `cena` (EUR dla kraju, 2 miejsca po kropce), `pole` (własne pole obliczeniowe; zmienne `zakup, stan, waga, dlugosc, szerokosc_paczki, wysokosc, cena_<KRAJ>`).
- Układy: `kolumny-krajow` (jeden plik, kolumna na kraj; wiersz wypada tylko gdy brak ceny w KAŻDYM kraju; brak ceny w kraju = pusta komórka) i `plik-na-kraj` (wiersz bez ceny w tym kraju wypada).
- Komórki: cudzysłowy przy separatorze/cudzysłowie, nowe linie → spacja, **ochrona przed wstrzyknięciem formuły** (`= + @` na początku → apostrof) — nazwy pochodzą z plików dostawców.
- Błąd liczenia pola obliczeniowego: pusta komórka + wpis w `bledy` (do logu), plik powstaje dalej.

## Zmiana zachowania produkcji
Brak — nowy moduł, nikt go jeszcze nie woła. Nazw produktów nie dotyka (nazwa trafia do pliku taka, jaka jest w katalogu).

## Testy
`test/partnerzy.plik-csv.test.ts` — oba układy, format, cytowanie, wstrzyknięcie formuły, pola obliczeniowe, wczytywanie i walidacja konfiguracji kolumn.
