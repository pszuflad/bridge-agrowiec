# 42-CHORE-i13a-resync-parserow — Code review

> Reviewed: 2026-09-08 (iteracja 2)
> Branch: chore/42-i13a-resync-parserow
> Diff: 43 pliki zmienione (9 par mirror+port, 18 wzorców charakteryzacji parserów+silnika,
> `docs/rebuild-roadmap.md`, `docs/rebuild-backlog.md`, dokumenty ticketa), 5 commitów
> (`bb020fb`, `9b26ceb`, `5887c0b`, `5f3ffc8`, `daf0c0f`)

## Kontekst tej iteracji

Iteracja 1 zgłosiła 3 BLOCKER-y i 1 SHOULD-FIX (treść zachowana w historii gita jako pierwsza
wersja tego pliku). Ta iteracja **weryfikuje niezależnie**, czy zamknięcia w commitach `5f3ffc8`
i `daf0c0f` są rzetelne, a nie tylko odhaczone. Wszystkie poniższe liczby przeliczono samodzielnie
(nie przepisano z raportu) skryptami porównującymi JSON `origin/develop` vs `HEAD`.

## BLOCKER

Brak. Wszystkie trzy BLOCKER-y z iteracji 1 są faktycznie zamknięte, ze zweryfikowanym pokryciem:

1. **Roadmapa (`docs/rebuild-roadmap.md`)** — 13a ma teraz nagłówek „✅ zrobione 2026-09-08
   (`42-CHORE-i13a-resync-parserow`)” z faktycznie dowiezionym zakresem (rozbicie na b4/b10/p2_4/
   mo9expand/odswinch/bug1/bug2/bug4/katunify/konstr, każde z liczbą rekordów). **Obowiązek #2
   z CLAUDE.md dotrzymany**: nota „Stan przejściowy odziedziczony z 13a” (konieczność re-recordu
   wzorca silnika po bumpie `index.cjs`, komenda z `BRIDGE_SNAPSHOT_DB`, ostrzeżenie o MO8 31 vs 25)
   wylądowała fizycznie WEWNĄTRZ bloku „13b” (po `**Zależy od:** 13a`), a nie w zamkniętym bloku
   13a — sprawdzone czytaniem pliku, nie tylko diffu. Analogicznie `KONSTRUKCJA_CANONICAL_MAP` i
   znalezisko o `'rolnicze małe'` trafiły do bloku 13c.
2. **Backlog (`docs/rebuild-backlog.md`)** — wszystkich 10 wpisów (#8/#9/#10/#53/#54/#55/#57/#58/
   #63/#64) ma zaktualizowany status z rozróżnieniem „sportowane i potwierdzone pomiarem” vs
   „sportowane, ale niepotwierdzone przez próbki” (#8, #55, #57 — kod jest, próbki go nie
   uruchamiają). #64 ma pełny opis realnego zakresu (+26/−1, dwa hunki w `parseSize()`).
3. **„Zero różnic strukturalnych” dla MO8** — sprostowane w `raport.md` (sekcja „Zależność
   parsery→silnik”), z ustaloną przyczyną. Zweryfikowano niezależnie: `statystyki` starego i nowego
   `silnik/MO8.expected.json` dają dokładnie `doStagingu 25→31`, `zmienione 24→30`,
   `bezZmian 600→594`; pozostałych 9 dostawców — `statystyki` bit-identyczne (potwierdzone
   programowo). Sześć nowych `kod`-ów w stagingu (`MO8_0198600`, `MO8_0198800`, `MO8_0207900`,
   `MO8_0209500`, `MO8_1159100`, `MO8_1169800`) to co do jednego `typZmiany: "blad"` z tekstem
   „konflikt z poprawka Marty” na polach `konstrukcja`/`szerokosc` — dokładnie ten sam zestaw
   kodów i pól, co podaje raport.

## SHOULD-FIX

Brak. Poprzedni SHOULD-FIX („rozbicie 72/78 to szacunek, nie zmierzona wartość”) został nie
tylko opatrzony zastrzeżeniem, ale **rzeczywiście zmierzony i zweryfikowany niezależnie**:
klasyfikacja wszystkich rekordów o zmienionej `szerokosc` (skrypt porównujący `origin/develop`
vs `HEAD` dla MO1–MO10, wzorcem pola `rozmiar`) daje **dokładnie**:

- `odswinch`: 98 (MO1 1, MO2 22, MO3 1, MO4 4, MO8 68, MO10 2)
- `p2_4`: 7 (MO2 1, MO8 6)
- `b4`: 4 (wszystkie MO8)
- razem 109, **0 niesklasyfikowanych**

— identycznie z tabelą w raporcie. Sprawdzono też pochodne sumy w roadmapie („konstr… 1837 rek.”,
„bug2… 255 rek.”) — obie to proste sumy z tabeli raportu, zgadzają się arytmetycznie i (dla bug2)
potwierdzone programowo, że rzeczywiście każdy rekord MO1/MO3/MO9 ma zmieniony `nro`/`cho`
(typ 0/1 → null/'Tak', stąd 100% pokrycie tych trzech próbek).

## NICE-TO-HAVE

- [ ] `docs/tickets/42-CHORE-i13a-resync-parserow/plan.md:3` — nagłówek statusu nadal generyczny
  „Draft → Approved → Implemented → Shipped” bez wskazania aktualnego stanu (powinno być
  pogrubione/zaznaczone „Shipped”, skoro karta zamknięta). Kosmetyka, nie wpływa na treść.

## Weryfikacja dodatkowa — sprostowania spoza pierwotnych 3 BLOCKER-ów

**b4 (#53) — sprostowanie, że weszło TYM syncem, nie przed 25.08.**
Zweryfikowano niezależnie: `git show origin/develop:mirror/backend/parsers/tyre_params.cjs | grep -c
"POPRAWKA 2026-08-31"` → **0**; ten sam grep na `HEAD` → **5** (w tym dwa fragmenty bezpośrednio
odpowiadające za logikę b4 — blok `parseSize` OD×SW-Rim i strażnik `szerokoscRaw`, reszta to B10).
Sprostowanie w raporcie i backlogu jest zasadne.

**#57 (katunify) — zmiana przypisania „→ 13b” na „13a (parser) + 13c (migracja)”.**
Zweryfikowano NIEZALEŻNIE oba źródła, na które powołuje się Master, **na stanie `origin/develop`
sprzed tego ticketa** (żeby wykluczyć, że tabela/roadmapa zostały dopisane ad hoc na potrzeby
uzasadnienia):
- Tabela mapowania w tym samym pliku backlogu (linia ok. 2544, niezmieniona w tym diffie) już na
  `origin/develop` mówiła `katunify(migracja) #57 | 13c`.
- Blok 13c w `docs/rebuild-roadmap.md` już na `origin/develop` (linia 1948, poza diffem) zawierał
  „weryfikacja czy katunify wymaga migracji historycznych kategorii”.

Obie wzmianki istniały PRZED tym ticketem i obie mówiły 13c — pole „Iteracja” we wpisie #57
(„→ 13b (migracja + fixtures)”) było więc wewnętrznie sprzeczne z resztą tego samego dokumentu.
To jest korekta faktu (usunięcie literówki numeru karty, zgodnie z obowiązkiem #3 CLAUDE.md —
przypisanie zweryfikowane niezależnie, nie na słowo), **nie zmiana zakresu** — opis w nawiasie
(„migracja + fixtures”) się nie zmienił, zmienił się tylko numer karty, do której ten opis pasuje.
Kwalifikacja jako „korekta faktu, nie decyzja użytkownika” jest prawidłowa.

**Bramki backendu — uruchomione ponownie w tej iteracji, niezależnie:**
`npm run lint` ✓ (cicho), `npm run typecheck` ✓ (cicho), `npm run build` ✓, `npm test` →
**79 plików / 1223 testy, wszystkie zielone** — identycznie z deklaracją raportu.

**Commity `5f3ffc8` i `daf0c0f` dotykają wyłącznie `docs/`** (`git show --stat` obu commitów) —
zero zmian w 9 plikach parserów i w plikach `*.expected.json`; wierność kopii bajtowej
potwierdzona w iteracji 1 pozostaje nienaruszona.

## Plan compliance

### Done ✓
- Wszystkie punkty z iteracji 1 (kopia bajtowa 9 plików, integralność drzewa `legacy/**`,
  przenagranie wzorców, bramki) — nienaruszone, bo commity tej iteracji dotyczą tylko `docs/`.
- DoD „roadmapa: 13a oznaczone jako zrobione, ustalenia dla 13b/13c DO ICH bloków” — spełnione,
  zweryfikowano fizyczne położenie akapitów w pliku (nie tylko obecność treści w diffie).
- DoD „backlog: statusy 10 wpisów zaktualizowane” — spełnione.
- DoD „raport zawiera rzetelny opis zakresu silnika (bez zaniżenia)” — spełnione, MO8 opisane
  z realną liczbą rekordów i przyczyną.

### Missing lub deviating ✗
- Brak. Wszystkie punkty DoD, które w iteracji 1 były niespełnione, są teraz spełnione i
  zweryfikowane niezależnie.

### Definition of done
- [x] 9 plików zsynchronizowanych z `main` RÓWNOLEGLE w `mirror/backend/` i `rebuild/backend/src/import/legacy/`
- [x] `cmp` mirror↔port cichy dla wszystkich 9; warstwa 1 gate'a zielona
- [x] Żaden plik spoza listy 9 nie został ruszony
- [x] `MOx.expected.json` przenagrane skryptem `charakteryzacja-nagraj.mjs`
- [x] Warstwy 2 i 3 gate'a charakteryzacji zielone (MO1–MO10)
- [x] Wzorce charakteryzacji silnika i akceptacji: świadome odstępstwo (przenagranie silnika)
      zaakceptowane przez użytkownika w trakcie, udokumentowane jako stan przejściowy w bloku 13b
- [x] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` zielone — potwierdzone
      ponownie w tej iteracji (79/1223)
- [x] `raport.md` zawiera rozłożony diffem realny zakres `odswinch`, podsumowanie przesunięć per
      dostawca (zmierzone, nie szacowane) i rzetelny opis zakresu silnika (MO8 sprostowane)
- [x] `docs/rebuild-roadmap.md` blok I13: 13a oznaczone jako zrobione, ustalenia dla 13b/13c
      wpisane DO ICH bloków — zweryfikowane fizycznym położeniem w pliku
- [x] `docs/rebuild-backlog.md`: statusy 10 wpisów zaktualizowane

## Parallel-test concerns

Brak nowych testów jednostkowych — zmiany tej iteracji to wyłącznie `docs/`. `npm test`
uruchomiony ponownie lokalnie, zielony. Brak zależności od zasobów współdzielonych.
None — wszystkie testy równoległe do innych agentów.

## Overall assessment

Zamknięcie jest rzetelne, nie kosmetyczne: każda z trzech poprawek BLOCKER i jedna SHOULD-FIX
została zweryfikowana niezależnie — nie na podstawie treści raportu, tylko przeliczeniem JSON-ów,
grepem na `origin/develop` vs `HEAD` i czytaniem fizycznego położenia akapitów w plikach roadmapy/
backlogu. Wszystkie zmierzone liczby (98/7/4 rekordów, MO8 25→31/24→30/600→594, sześć konkretnych
kodów konfliktu z Martą, 0→5 wystąpień „POPRAWKA 2026-08-31”) zgadzają się co do joty z tym, co
podaje raport. Korekta przypisania #57 jest uzasadniona dwoma źródłami istniejącymi w dokumencie
PRZED tym ticketem, więc kwalifikacja jako „fakt, nie decyzja” jest prawidłowa. Karta gotowa do
zamknięcia bez zastrzeżeń.
