# Nagrania z oryginału — pliki wzorcowe, których nie da się nagrać przez HTTP

`contract/fixtures/` zamraża ODPOWIEDZI HTTP produkcji. Ten katalog jest dla wzorców, które
odpowiedziami HTTP nie są — na dziś jeden: linia nagłówkowa codziennego pliku CSV dla Selly.

## `selly-csv-naglowek.csv`

Pierwsza linia **realnego pliku, który produkcja wysyła do Selly** — 60 nazw kolumn, separator `;`,
z BOM-em i złamaniem `\r\n`, dokładnie jak w pliku na dysku.

- **Źródło:** `origin/main` @ `88fa31c` (produkcja zamrożona 2026-09-23),
  `mirror/frontend/ex-port-files/sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv`.
- **Czyta to:** `test/selly.generator-csv.test.ts` — porównuje nagłówek naszego generatora z tym
  plikiem bajt w bajt. To mocniejszy dowód formatu niż lista nazw przepisana do testu: Selly parsuje
  plik po NAGŁÓWKACH, więc literówka w jednej nazwie rozspójnia cechę w sklepie i nikt tego nie widzi,
  dopóki Ania nie zgłosi, że „coś się nie aktualizuje" (tak było z `R/D` → `Konstrukcja`, backlog #76).

### Po co kopia, skoro plik jest w repo

`mirror/` synchronizuje się na `main` commitami `sync(vps)` i na `develop` trafia z opóźnieniem —
w chwili pisania (2026-09-23) `develop` ma jeszcze wersję 59-kolumnową, sprzed backlogu #73. Test
czytający `mirror/` wprost sprawdzałby więc raz stan produkcji, a raz stan sprzed dwóch tygodni,
zależnie od tego, kiedy ostatnio przeszedł triaż. Nagranie przypina wzorzec do konkretnego commita.

### Jak przenagrać

```bash
git show <commit>:mirror/frontend/ex-port-files/sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv \
  | head -c 4096 | head -1 > rebuild/backend/test/nagrania/selly-csv-naglowek.csv
```

Przenagraj, gdy triaż wniesie zmianę kolumn CSV — i w tym samym ticketcie popraw `KOLUMNY`
w `src/selly/generator-csv.ts`. Zmiana samego nagrania bez zmiany generatora oznacza, że test
został „naprawiony" pod kod zamiast pod produkcję — tego robić nie wolno.
