# 212 — transport GEIS i paliwo dla partnerów (PRT-2.2)

Karta: `docs/karty/PARTNERZY/` · poziom 2 · zależy od 208 (`paliwo_historia`).

## Zakres
Migracja `026_geis.sql` (`geis_kraje`, `geis_stawki`), `src/partnerzy/transport.ts` (waga rozliczeniowa, stawka, paliwo z historią, koszt przesyłki,
import z JSON), skrypt `npm run importuj-geis -- plik.json`.

## Reguły (z karty)
- V1: stawka CAŁEGO KRAJU (kolumna 1), koszt dla **1 sztuki**, w całości wchodzi do ceny opony. Strefy 2–N i kody pocztowe — poza zakresem.
- Waga rozliczeniowa = max(rzeczywista, dł×szer×wys [m³] × współczynnik kraju). Stawka = pierwszy próg ≥ waga rozliczeniowa; progi są per kraj.
- Paliwo: ręczny PROCENT z historią okresów (`obowiazuje_od`); zmiana nie przelicza wstecz; brak wpisu = 0 %.
- Brak wagi/wymiarów, wymiary ponad limit kraju, waga ponad najwyższy próg, brak tabeli kraju → `BladTransportu` (pozycja pomijana i logowana przez kalkulator), nigdy koszt 0.
- Wzór: `koszt = stawka × (1 + paliwo%/100) + koszt pakowania`.

## Dane
**Pliku `GEIS_tabele_13_krajow.xlsx` nie ma w repo**, a jego układ znamy tylko ze streszczenia w karcie, więc importer czyta ustalony JSON (przykład: `geis-przyklad.json`, tylko punkty znane z karty). Konwersję xlsx → JSON i wgranie danych 13 krajów trzeba zrobić po dostarczeniu pliku (pytanie do użytkownika). Do tego czasu tabele są puste i kalkulator zgłosi „brak tabeli”.

## Zmiana zachowania produkcji
Brak — nowy moduł, puste tabele, nikt go jeszcze nie woła. Nazw produktów nie dotyka.

## Testy
`test/partnerzy.transport.test.ts` — wycena wzorcowa z karty (półpaleta 56 kg, FR: próg 200 kg, stawka 163, +11 % ≈ 181 EUR), brak gabarytów daje niższy próg, historia paliwa, błędy, import. Bilans migracji: 51 tabel, 25 indeksów.
