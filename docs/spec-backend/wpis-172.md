# Wpis 172 — importer: DOT to cecha zmienna tej samej pozycji, zmiana bez akceptacji

> Ticket 172 (2026-10-01). **Odstępstwo od produkcji — decyzja użytkowniczki.** Dotyczy
> `import/polityka/fabryka.ts` (kroki dopasowania po kodzie i cicha aktualizacja karty),
> `tolerancja-dopasowania.ts` (`zgodnaBezDot`, `dotZgodny`, `aktualizacjaDotWMiejscu`),
> `wyjasnienie.ts`.

**Objaw.** DOT pozycji zmienia się w czasie (`2025` → `2026`, `2025,2026` → `2026`). Produkcja traktowała
inny DOT jako inną oponę: wiersz z tym samym kodem nie dopasowywał się do karty (krok „dokładny kod”
wymagał równego DOT), więc import zakładał NOWY produkt z kodem `MO5_AUTO_…` do akceptacji — przy każdej
zmianie DOT — albo pytał o „podobną oponę pod innym kodem”.

**Dlaczego to bezpieczne (zmierzone na pliku MO5, 5115 wierszy).** Ta sama opona z innym DOT ma w pliku
dostawcy INNY symbol (`…N0` / `…N1`, `kod producenta` z końcówką `W2020`, EAN z `W2`) — w całym pliku jest
8 takich grup i w każdej symbole są różne. Zmiana DOT przy tym samym symbolu nie może więc scalić dwóch partii
w jeden produkt. 336 powtórzonych symboli w pliku to dętki z wieloma magazynami, bez związku z DOT.

**Co jest.**
- Ten sam kod (ręczny wybór, dokładny kod, kod w innej wielkości liter) = ta sama pozycja: DOT NIE jest
  kryterium dopasowania; zgodność cech liczona bez DOT (`zgodnaBezDot`).
- Cicha aktualizacja karty (obok ceny, stanu, magazynu i EAN-u) obejmuje DOT — bez zgłoszenia do akceptacji.
- NOWY symbol dostawcy z innym DOT (kolejna partia) nadal jest osobnym produktem, jak w produkcji; pokrewne
  DOT (`2026` ⊂ `2025,2026`) pozostają zgodne (wpis 169).
- Okno rozstrzygnięcia i wyjaśnienie nie pokazują DOT jako różnicy.

**Symulacja (plik MO5, 1515 rekordów, katalog ze zrzutu z 28.09; konstrukcja ujednolicona):**
produkcja 1:1 → 426 pozycji w stagingu (349 nowych, w tym 260 z kodem zastępczym, 45 pytań); obecny `develop`
→ 215 (176 nowych, 87 z kodem zastępczym, 4 pytania); DOT jako cecha → 125 (89 nowych, 0 z kodem zastępczym,
1 pytanie). Karty z cichą zmianą DOT: 302. Jedna pozycja dochodzi względem `develop` (zmiana nazwy
„FUELMAX DEMO” → „FUELMAX”, niezwiązana z DOT).

**Skutek uboczny.** Stare osobne partie `MO5_AUTO_…` zostają w katalogu, a wiersz z kodem z pliku dopasowuje się
teraz do karty z tym kodem — karty `…_AUTO_…` przestają być widziane w cenniku i po zwykłych trzech potwierdzeniach
nieobecności trafią do akceptacji jako „wycofane”.

**Charakteryzacja.** `silnik.charakteryzacja.test.ts` i `silnik.polityka-zrodla.test.ts` (żywy oryginał)
mockują `tolerancja-dopasowania` do zachowania produkcji; regułę pokrywa `tolerancja-dopasowania.test.ts`.
