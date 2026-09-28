# 150-DOCS-test-sciezki-krytycznej — Code review (iteracja 2)

> Reviewed: 2026-09-24
> Branch: `docs/150-test-sciezki-krytycznej`
> Diff: 9 plików, 8 commitów (vs `origin/develop` @ `6288066`)

## Kontekst tej iteracji

Poprzedni review dał 3 BLOCKER-y — wszystkie zaadresowane (punkt 2.2 przepisany na ścieżkę
„Szczegóły" → „Podgląd różnic", karta TEST.2 domknięta, gałąź zsynchronizowana z `origin/develop`
i bramki zielone PO synchronizacji). W trakcie ticketu na `develop` wszedł `wejscie-153.md`
(+ `wpis-153.md`), z którego wynika, że **dowód równoważności generatorów CSV z poprzedniej
iteracji był fałszywie zielony** — na bazie stagingu (kopia produkcji 23.09) ten sam pomiar daje
899 z 5396 wierszy różnych w pięciu kolumnach flagowych (błąd czytania tekstu `'Tak'` przez
Drizzle, wpis backlogu `#153.1`, blokada cutoveru). Ta iteracja skupiła się na weryfikacji, czy
korekta jest poprawna, kompletna i wszędzie spójna.

**Weryfikacja niezależna korekty (nie tylko czytanie `raport.md`):**
- **Typy w kolumnach flagowych zmierzone samodzielnie.** Skopiowałem `db/snapshot.db` do
  katalogu tymczasowego, nałożyłem migracje 001–013 (`npm run migrate`) i sprawdziłem
  `typeof()` na wszystkich dziesięciu kolumnach (`reinforced`, `extra_load`, `cut_resistant`,
  `heat_resistant`, `stubble_resistant`, `nro`, `cho`, `ms`, `snow_3pmsf`, `cfo`) — **zarówno
  przed, jak i po migracjach wszystkie wartości to `integer` albo `null`, ani jednej `text`**.
  Potwierdza to twierdzenie z `dowod-csv.md`/`karta.md`/`wpis-150.md`: na snapshocie z 13.08
  defekt „tekst `'Tak'` czytany przez Drizzle jako `false`" **nie ma jak się ujawnić** — wszedł
  do bazy po 13.08.
- **`88fa31c` vs `origin/main`** — `diff` obu wersji `mirror/backend/generate_selly_export.cjs`
  jest pusty. Potwierdzone: żywy generator produkcji faktycznie jest identyczny w obu miejscach.
- **`mirror/` na `develop` faktycznie nie ma kolumny `Blokowane-formy-platnosci`**
  (`git show origin/develop:mirror/backend/generate_selly_export.cjs | grep -c` = 0, na
  `origin/main` = 2) — potwierdza „59 vs 60 kolumn".
- **Commit `6594525`** rzeczywiście jest świadomym cofnięciem `mirror/` do 25.08 („bramki
  wierności zielone", decyzja użytkownika 2026-09-08 wpisana w treść commita) — opis „świadomie
  cofnięty", a nie „nieaktualny przez zaniedbanie", jest zgodny ze stanem repo.
- **Bramki backendu** — `npm run lint` i `npm run typecheck` uruchomione ponownie, zielone.
  Diff ticketu nie dotyka `rebuild/`/`contract/` — potwierdzone `git diff --name-only`.
- **Konkrety UI** (przycisk „Szczegóły", sekcja „Podgląd różnic", kolumny `stan`/`cenaZ`/`cenaS`
  w `KOLEJNOSC_KOLUMN`, szukajka Stagingu po `eanRaw`, etykieta „Dodatkowe (z katalogu)" i jej
  ostrzeżenie, cytaty UI) — zweryfikowane bezpośrednio w `rebuild/frontend/src/pages/staging/`
  i `rebuild/frontend/src/pages/Staging.tsx`. Wszystkie zgodne z instrukcją.

Korekta w `dowod-csv.md`, `karta.md`, `wpis-150.md`, `wejscie-150.md` (obu) i w odcinku 4
instrukcji jest **poprawna, spójna między sobą i zgodna z `wpis-153.md`** (liczby 899/5396,
750/713/52/12/10 co do jednej pozycji). Znalazłem jednak **jedno miejsce, w którym korekta nie
dotarła** — patrz BLOCKER niżej.

## BLOCKER

- [ ] `docs/instrukcja-testu-sciezki-krytycznej.md:421` — w sekcji „Do Twojej decyzji", punkt 2,
      zdanie *„Nasze zdanie: nie warto (uzasadnienie w odcinku 5 — plik jest identyczny co do
      bajtu, a test przełącza żywy sklep na dane z 23.09)"* jest resztką sprzed korekty
      #153.1 i wprost zaprzecza odcinkowi 4 tego samego dokumentu, który 60 linii wcześniej mówi
      „**Na dziś odpowiedź brzmi: jeszcze nie**" i wymienia 899 różniących się wierszy. Samo
      odcinek 5 (linie ~356–376) już NIE zawiera tego twierdzenia — poprawnie mówi „plik stagingu
      ma jeszcze błąd z odcinka 4". Odsyłacz w punkcie 2 po prostu nie został zaktualizowany
      razem z odcinkiem 5.
  - Reason: to dokładnie ta pułapka, przed którą ostrzega prompt tej iteracji — „resztka starego
    twierdzenia «identyczne bajt w bajt» postawiona bez zastrzeżenia o zawartości bazy". Ania
    czytająca tylko sekcję „Do Twojej decyzji" (naturalne miejsce, gdzie wraca się po przeczytaniu
    całości) dostanie fałszywy sygnał, że plik jest już zgodny, mimo że dokument w innym miejscu
    mówi, że to blokada cutoveru.
  - Suggestion: usunąć frazę „plik jest identyczny co do bajtu" i zastąpić odwołaniem zgodnym
    z aktualną treścią odcinka 5, np. „uzasadnienie w odcinku 5 — sposób pobierania pliku się nie
    zmienia, a test dziś pokazałby jeszcze błąd z odcinka 4".

## SHOULD-FIX

- [ ] `docs/tickets/150-DOCS-test-sciezki-krytycznej/raport.md:9` — „Podsumowanie" na górze
      raportu wciąż twierdzi bez zastrzeżeń: *„dowód CSV przeprowadzono realnie (pliki
      identyczne bajt w bajt)"*, mimo że dalej w tym samym pliku jest cała sekcja „⭐ Korekta po
      `wejscie-153.md`" tłumacząca, że ten wynik był fałszywie zielony. To nie myli Ani (raport.md
      nie jest dla niej), ale myli każdego, kto czyta tylko streszczenie na górze — a to
      naturalny punkt wejścia do dokumentu.
  - Suggestion: dopisać w „Podsumowaniu" jedno zdanie odsyłające do sekcji „Korekta", analogicznie
    do tego, co już jest zrobione w nagłówku `dowod-csv.md`.
- [ ] `docs/instrukcja-testu-sciezki-krytycznej.md`, odcinek 4 — plan (`plan.md`, Krok 2) wymagał
      „gotowy wynik z Kroku 1 + **odsyłacz do testu nagłówka jako bieżącej straży**". Ten odsyłacz
      w treści samego odcinka 4 zniknął przy przepisywaniu pod #153.1 (wzmianka o teście
      nagłówkowym pojawia się dopiero w „Do Twojej decyzji", p. 3, w innej roli — jako argument za
      zamianą w stałą straż, nie jako opis obecnego stanu ochrony). Czytelniczka odcinka 4 osobno
      nie dowie się, że COKOLWIEK jest dziś pilnowane automatycznie.
  - Suggestion: jedno zdanie w odcinku 4, np. „na stałe w testach pilnowany jest dziś tylko
    nagłówek pliku (nazwy i kolejność 60 kolumn) — to on złapałby np. usunięcie kolumny".

## NICE-TO-HAVE

- Brak nowych uwag kosmetycznych ponad to, co już poprawiono w iteracji 1.

## Plan compliance

### Done ✓
- Dowód równoważności generatorów — przeprowadzony (Krok 1), wynik i metoda w `dowod-csv.md`,
  niezależnie zweryfikowany w tej iteracji (typy kolumn flagowych, `88fa31c` vs `origin/main`,
  `6594525`).
- `docs/instrukcja-testu-sciezki-krytycznej.md` — pięć odcinków, forma zgodna z poleceniem Ani
  z 22.09 (checkboxy, krótkie „co zmieniliśmy → polecenie → rezultat"), ok. 3700 słów — mieści
  się w „jedno posiedzenie".
  Odcinek 5 opisuje oba warianty Selly i wskazuje docelowy wprost (D4).
  Osobna sekcja „czego na stagingu sprawdzić NIE MOŻNA" z trzema blokadami.
  Nazwy ekranów, przycisków i kolumn zweryfikowane w `rebuild/frontend/src/` — potwierdzone
  w tej iteracji bezpośrednio w kodzie (nie tylko na słowo raportu).
- `docs/karty/TEST.2/karta.md` domknięta, opisuje stan (nie zamiar), z sekcją „Do koordynatora"
  o rozjeździe stanu stagingu (automat importu włączony, sekrety MO9 ustawione).
- `docs/karty/TEST.1/wejscie-150.md` i `docs/karty/TEST.3/wejscie-150.md` — ustalenia dla
  przyszłych kart we właściwych plikach, roadmapa nietknięta (`git diff --stat` potwierdza).
  `docs/spec-backend/wpis-150.md` — nowy plik, nie dopisek do istniejącej sekcji.
- Gałąź zawiera całe `origin/develop` (`git merge-base --is-ancestor` = prawda); bramki
  (`lint`, `typecheck`) ponownie zielone w tej iteracji.
- Wejście `wejscie-153.md` wymagało, żeby dowód „dla nas" (komendy, SSH, podmiana stałych) nie
  trafił do dokumentu Ani — potwierdzone: odcinek 4 zawiera tylko wynik i tabelę, żadnych komend.

### Missing or deviating ✗
- Odcinek 4 nie zawiera już „odsyłacza do testu nagłówka jako bieżącej straży" wprost w swojej
  treści, jak przewidywał `plan.md` Krok 2 — patrz SHOULD-FIX wyżej. Drobne odstępstwo, wynikłe
  z przepisania odcinka pod korektę #153.1, nie z pominięcia zamierzonego.
- „Do Twojej decyzji", p. 2 zawiera zdanie sprzeczne z resztą dokumentu — patrz BLOCKER.

### Definition of done
- [x] Dowód równoważności generatorów przeprowadzony na jednej bazie, wynik w `raport.md`
      (i niezależnie zweryfikowany w review)
- [x] `docs/instrukcja-testu-sciezki-krytycznej.md` — pięć odcinków, forma z polecenia Ani z 22.09
- [ ] Odcinek 4 podaje wynik dowodu i odsyła do testu nagłówka, nie powtarza dowodu — wynik podaje,
      ale odsyłacza do testu nagłówka w samym odcinku 4 brakuje (patrz SHOULD-FIX)
- [x] Odcinek 5 opisuje oba warianty Selly i wskazuje docelowy wprost
- [x] Osobna sekcja „czego na stagingu sprawdzić NIE MOŻNA" z trzema blokadami
- [x] Nazwy ekranów, przycisków i kolumn zweryfikowane w `rebuild/frontend/src/`
- [x] `docs/karty/TEST.2/karta.md` opisuje STAN, z „Do koordynatora" o rozjeździe stanu stagingu
- [x] Ustalenia dla TEST.1/TEST.3 w `wejscie-150.md`, roadmapa nietknięta
- [x] Gałąź zsynchronizowana z `origin/develop`, bramki zielone PO synchronizacji — PR jeszcze
      nie sprawdzony w tej sesji (`gh pr view --json mergeable` poza zakresem review)

## Parallel-test concerns

None — ticket nie dodaje testów (dokumentacja + jednorazowy pomiar poza repo).

## Overall assessment

Korekta po `#153.1` jest merytorycznie solidna i — co ważne — zweryfikowałem ją niezależnie
(typy kolumn na świeżo skopiowanej bazie, a nie tylko lekturę `raport.md`): wniosek „na
snapshocie z 13.08 defekt nie ma jak się ujawnić" się potwierdza, tak samo jak fakty o
`88fa31c`/`origin/main` i o świadomym cofnięciu `mirror/` w commicie `6594525`. Dokumenty dla
przyszłych kart (`wejscie-150.md` × 2, `wpis-150.md`, `karta.md`) są spójne z `wejscie-153.md`
i między sobą. Jest jednak jedno miejsce, w którym stare twierdzenie „plik jest identyczny co do
bajtu" przetrwało przepisywanie — w sekcji, do której Ania naturalnie wraca po przeczytaniu
całości („Do Twojej decyzji"). To pojedyncza literówka logiczna, łatwa do naprawienia, ale
dokładnie tego rodzaju, który wprowadza w błąd co do gotowości do cutoveru — stąd BLOCKER, nie
SHOULD-FIX. Poza tym punktem dokument jest gotowy.
