# Wpis 169 — importer: dopasowanie po poprawkach karty i z pokrewnymi DOT

> Ticket 169 (2026-10-01). **Odstępstwo od produkcji — decyzja użytkowniczki.** Dotyczy
> `import/polityka/fabryka.ts` (kroki dopasowania 1, 3–7 i końcowe „kod zajęty") i nowego
> `import/polityka/tolerancja-dopasowania.ts`.

**Objaw.** Pozycja `MIRD160E650063TF0` (Mitas TF-03 6.50-16) wracała do stagingu jako „Oznaczenie
wskazuje inną oponę", choć cennik i katalog opisują tę samą oponę (ten sam EAN, rozmiar, waga).
Okno pokazywało „Różnią się: model, DOT".

**Przyczyny (obie zmierzone na pliku `agrowiec_mw_5.csv` i katalogu MO5).**
1. *Poprawka ręczna nakładana za późno.* Karta ma `model = TF03` (poprawka w `manual_overrides`,
   `acknowledgedSourceValue = TF-03`), cennik podaje `TF-03`. Importer porównywał surowy wiersz z kartą
   (`compatibility`, `separateDotBatch`), a poprawki nakładał dopiero po dopasowaniu.
2. *DOT jako zbiór lat.* Karta ma `2025,2026`, cennik `2026`. `norm(d.dot) !== norm(p.dot)` uznawało
   to za osobną partię — stąd albo fałszywy alarm, albo (przy zgodnych pozostałych cechach) nowy produkt
   z kodem `MO5_AUTO_…` obok istniejącej karty.

**Co jest.** `tolerancja-dopasowania.ts`: (1) pole karty z poprawką ręczną porównuje się po poprawce,
ale TYLKO gdy cennik nadal podaje wartość z `acknowledgedSourceValue` — jeśli dostawca zmienił ją
jeszcze raz, poprawka nie przesłania prawdziwej zmiany; (2) DOT-y są pokrewne, gdy zbiór lat jednego
zawiera się w drugim (`2026` ⊂ `2025,2026`; `23` = `2023`). `2026` vs `2025` i `2024,2025` vs
`2025,2026` zostają osobnymi partiami — jak w produkcji. Zmienia WYŁĄCZNIE decyzję „czy to ta karta";
dane zapisywane do karty i krok `nieobecne` (alternatywy dla kart nieobecnych w cenniku) bez zmian.

**Pomiar** (plik MO5 z 1515 rekordów na katalogu ze zrzutu, konstrukcja ujednolicona do formy
długiej): zgłoszeń „do ręcznej decyzji" **45 → 4**, pozycji w stagingu 426 → 215, `nowa` 349 → 176
(nie powstają już duplikaty kart z kodem `MO5_AUTO_…`). Pozostałe zestawy MO1–MO10: MO3 10 → 6,
MO4 16 → 14, MO5 20 → 10 pozycji w stagingu; reszta bez zmian. Próbki innych dostawców są małe —
pomiar na pełnych plikach MO2–MO4, MO9 wymaga ich cenników.

**Charakteryzacja.** `silnik.charakteryzacja.test.ts` dalej porównuje z oryginałem 1:1 — mockuje
nowy moduł do zachowania produkcji (jak przy regule DEMO). Nową regułę pokrywa
`tolerancja-dopasowania.test.ts`.

**Poza zakresem (ustalone, nienaprawione).** (a) Fixture katalogu trzyma `konstrukcja` jako `R`/`D`,
a parser podaje `Radialna`/`Diagonalna`; zrzut jest nieaktualny w tym polu (produkcja ma formę długą).
(b) 14 EAN-ów w pliku MO5 ma doklejony przez dostawcę sufiks (`…_D`, `…W2`) — importer słusznie
odrzuca je jako „znaki inne niż cyfry"; nie zdejmujemy sufiksu (reguła „nie obcinaj EAN"). (c) MO9
(9 pozycji) ma inną przyczynę: „Ten EAN występuje w katalogu", różny rozmiar i konstrukcja.
