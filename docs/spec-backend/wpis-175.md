# Wpis 175 — importer: inny symbol dostawcy to osobna pozycja

> Sesja 2026-10-01 (numer wpisu wg kolejności po 174). **Odstępstwo od produkcji — decyzja użytkowniczki.**
> Dotyczy `import/polityka/fabryka.ts` (kroki 6 „EAN” i 7 „zgodne cechy pod innym kodem”) i
> `import/polityka/tolerancja-dopasowania.ts::innySymbolDostawcy`.

**Objaw.** Pozycje o zgodnych cechach (marka, model, rozmiar, indeksy) i tym samym lub pokrewnym DOT, ale z RÓŻNYM
symbolem dostawcy, wracały do stagingu jako „Podobna opona jest już w katalogu…” / „Kilka zgodnych produktów z tym EAN”,
choć to osobne pozycje (inna partia, cena, stan).

**Pomiar na pełnych cennikach** (pliki od użytkowniczki 2026-10-01, produkcyjny parser; MO1 729, MO3 571, MO4 293, MO5 1515
rekordów): w żadnym nie ma wiersza bez kodu ani powtórzonego kodu. Grupy z RÓŻNYM DOT mają zawsze różne symbole (MO5 12/12,
MO4 3/3, MO3 2/2). Pary zgodne co do cech i z różnym symbolem, a tym samym/pokrewnym DOT: MO5 18, MO1 10, MO4 3, MO3 0.
Przykłady: Goodyear KMAX `…MKD…`/`…MKS…` (drive/steer, parser zostawia model „KMAX”), CEAT WINMILE-S `…WES0`/`…WES1`
(ten sam EAN i DOT, ceny 926/804), CEAT z `SB`/`CFO`/`CHO` i bez (różne EAN).

**Co jest.** Gdy wiersz ma własny symbol (`kodDostawcy`), a karta ma INNY (po `codeKey`), karta nie jest kandydatem do
dopasowania po EAN ani po cechach — wiersz zakłada NOWĄ kartę pod własnym kodem, bez pytania, niezależnie od tego, czy DOT jest
równy, pokrewny czy inny. Pusty symbol po którejkolwiek stronie → bez zmian. Ten sam symbol → ta sama pozycja (krok 4 nietknięty,
także JMK z kodem `MO2_JMK_<id>`).

**Sieć bezpieczeństwa.** Jeśli dostawca naprawdę ZMIENIŁ symbol tej samej pozycji, stara karta nie ma wiersza w pliku i dostaje
własny przegląd nieobecności („stara karta”) / po trzech kompletnych cennikach wycofanie — człowiek to widzi.

**Skutek uboczny.** Dwie karty mogą mieć ten sam EAN (nic w bazie ani w akceptacji tego nie blokuje). Dla Selly to osobna decyzja.

**Symulacja** (pełny MO5, 1515 rekordów, katalog ze zrzutu): pytań 1 → 0, `nowa` 89 → 90, przeglądów starej karty 5 → 4.

**Charakteryzacja.** `silnik.charakteryzacja` i `silnik.polityka-zrodla` mockują `innySymbolDostawcy` do zachowania produkcji
(zawsze `false`); regułę pokrywa `tolerancja-dopasowania.test.ts`. Dwa istniejące testy ścieżki „pytanie” używają teraz wiersza
BEZ własnego symbolu, bo z symbolem ta ścieżka już nie zachodzi.
