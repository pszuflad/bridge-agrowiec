# 98-FEATURE-eksport-csv-z-tabeli — P10.3: eksport CSV analityki = to, co widać w tabeli

> Status: Implemented
> Branch: `feature/98-eksport-csv-z-tabeli`
> Worktree: `.worktrees/98-FEATURE-eksport-csv-z-tabeli`
> Karta: `docs/karty/P10.3/` · Backlog: #91

## Opis ticketa
P10.3 z Iteracji 10: eksport CSV analityki ma oddawać to, co widać w tabeli (#91). Plik
powstaje w przeglądarce z wierszy, które tabela karty ma po filtrach: globalnych z paska
i lokalnych karty, np. „Bez ruchu dni” w Rotacji. Marża idzie w przekroju tabeli, a plik ma
wszystkie wiersze (limit 300 dotyczy tylko rysowania). Backend bez zmian.

## Kontekst
- `pages/analityka/eksport.tsx` — `PrzyciskCsv` robi dziś `window.location.href =
  /api/analytics/export/<view>`, bez filtrów; serwer ma dla każdego widoku własny SQL
  (`backend/src/repos/analityka-eksport.ts`), inny niż karta. Dla Marży to wiersze PER PRODUKT.
- 10 kart z przyciskiem: Stabilność, Cykl życia dostawców, Stan dostawców, EAN-porównanie,
  EAN-unikalne, Ceny 3.1, Dostępność produktów, Tempo schodzenia, Marża, Rotacja. Każda liczy
  `wiersze = useMemo(zastosujFiltry…)` (EAN-porównanie: surowe `rows`, bo karta nie ma wymiarów
  filtra) i podaje je do `TabelaAnalityki`, która robi `slice(0, 300)`.
- Kolumny: `KolumnaTabeli<T>` (`key`, `label`, opcjonalny `render`). `render` z elementem
  Reacta mają tylko dwie kolumny `dostepnoscPct` (`PasekDostepnosci`); `key` zawsze wskazuje
  pole z wartością.
- Rotacja: „Bez ruchu dni” jest w `queryKey` (`?days=`), więc `data` to już wiersze po nim.
- Pobieranie pliku w przeglądarce już istnieje: `pobierzPlik()` w `pages/katalog/eksport.ts`
  (BOM + `text/csv;charset=utf-8` + kotwica `download`, własny test w `katalog.eksport.test.ts`).
- Format serwera (`backend/src/analityka/csv.ts`, port `toCsv`/`csvEscape` z
  `analytics_module.cjs:56-57`): BOM, separator `;`, wiersze łączone `\n`, nagłówek = klucze
  pierwszego wiersza, `null` → pusta komórka, cudzysłów przy `;`, `"`, `\n`, `\r` (wewnętrzny `"`
  podwojony), liczby przez `String()` (kropka), nazwa `<view>.csv`.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa
**Brak — ticket nie dotyka API.** `GET /api/analytics/export/{view}` zostaje w backendzie i
kontrakcie bez zmian (tak, jak zostawiła go P10.1: lista widoków + 404) i przestaje być wołana
przez front. `contract/` nietknięty. Testy FE dalej biorą dane kart z fixtures (`test/msw/kontrakt.ts`).

## Decyzje
Z karty (użytkownik, 2026-09-21) — wykonujemy:
1. Plik CSV powstaje w przeglądarce z wierszy tabeli po filtrach globalnych i lokalnych.
2. Marża: plik w przekroju tabeli (grupy), bez drugiego przycisku.
3. Plik ma wszystkie wiersze po filtrach; limit 300 tylko dla rysowania.

Format (użytkownik, 2026-09-22, wszystkie zgodnie z rekomendacją):
4. **Nagłówek = etykiety kolumn tabeli** (`Śr. marża`), nie klucze pól. Kolejność kolumn jak w tabeli.
5. **Liczby dziesiętne z przecinkiem, bez separatora tysięcy** (`12,5`, `1234,56`), żeby polski
   Excel otwierał je jako liczby. Odstępstwo od formatu serwera (kropka).
6. **Do komórki idzie wartość pola `key`, nie tekst z ekranu.** Dostępność to `87,5` (bez `%`),
   a brak wartości (`null`/`undefined`/`""`) to pusta komórka, nie „—”. Reguła dotyczy wszystkich
   kolumn, także tych z `render`.
7. **EAN-y i kody zostają zwykłym tekstem**, jak na serwerze. Nic nie wymuszamy dla Excela.

Moje wybory (w granicach karty):
8. **Pusta tabela po filtrach → plik z samym nagłówkiem, przycisk aktywny.** Plik ma być tym, co
   widać, a pusta tabela z nagłówkami to też „to, co widać”. Nieaktywny przycisk bez wyjaśnienia
   wyglądałby na awarię, a plik z nagłówkiem od razu mówi „0 wierszy”.
   **Przycisk nieaktywny tylko podczas wczytywania** (tabela pokazuje wtedy „Wczytywanie…”), bo
   plik z tej chwili byłby pusty bez powodu.
9. Pozostałe elementy formatu zostają jak na serwerze: BOM, `;`, `\n`, reguła cudzysłowów,
   nazwa `<view>.csv` z tymi samymi dziesięcioma nazwami widoków.
10. Pobieranie przez istniejące `pobierzPlik()` z `pages/katalog/eksport.ts` (import, bez zmian
    w tym pliku), więc nie powstaje druga kopia mechanizmu Blob + kotwica.

**Świadome odstępstwa od produkcji:** (a) plik zna filtry i ma kolumny karty (#91 ✅, wynika z
O-10a-2); (b) nagłówek po polsku zamiast kluczy pól; (c) przecinek dziesiętny; (d) Marża w
przekroju grup zamiast listy per produkt; (e) plik bez limitu 5000 wierszy serwera: ma to, co
karta pobrała (karty i tak pobierają pełne listy z tras dashboardu).

## Plan implementacji
1. **NOWY `pages/analityka/csv.ts`** (czysta logika, bez Reacta):
   - `wartoscKomorkiCsv(v)`: `null`/`undefined`/`""` → `""`; `number` → `String(v)` z `.` → `,`
     (NaN/±Infinity → `""`); reszta → `String(v)`.
   - `escapujKomorkeCsv(tekst)`: reguła serwera `/[;"\n\r]/` → w cudzysłowach, `"` podwojony.
   - `zbudujCsvTabeli(wiersze, kolumny)`: nagłówek z `label`, wiersze z `wiersz[k.key]`,
     `;`, `\n`. Bez BOM-u (dokłada go `pobierzPlik`). Typ kolumn: `Pick<KolumnaTabeli<T>, "key" | "label">`.
2. **`eksport.tsx` przepisany**: `PrzyciskCsv<T>({ widok, wiersze, kolumny, wczytywanie })` →
   `onClick: pobierzPlik(`${widok}.csv`, zbudujCsvTabeli(wiersze, kolumny))`, `disabled={wczytywanie}`.
   Markup, `data-testid` i etykieta „CSV” bez zmian. Usuwam `adresEksportu` i import `BAZA_API`
   (bez konsumentów). `WidokEksportu` zostaje jako zamknięta lista nazw plików. Nowy nagłówek pliku:
   skąd to odstępstwo, reguła wartości, format i czemu trasa serwera zostaje nieużywana.
3. **Dziesięć kart** (`Sekcja*.tsx`): przycisk dostaje tę samą tablicę `wiersze` i te same stałe
   `KOLUMNY*`, które idą do `TabelaAnalityki`, plus flagę wczytywania karty. Przepisuję komentarze,
   które mówią, że plik różni się od tabeli (Marża, Rotacja, Dostępność…), i opisuję, co teraz jest w pliku.
4. **`TabelaAnalityki.tsx`**: tylko komentarz przy `KolumnaTabeli.key` („`key` musi wskazywać
   pole z wartością — z niego czyta eksport CSV”) i przy `LIMIT_WIERSZY` (plik go nie ma). Bez zmian logiki.
5. **`pages/analityka/README.md`**: sekcja 10f (nawigacja + cookie) oznaczona jako zastąpiona
   przez P10.3, z opisem nowego mechanizmu.
6. Testy (niżej), bramki.

## Strategia testów
- **Jednostkowe `test/analityka.csv.test.ts`** (generator): nagłówek z etykiet w kolejności kolumn;
  wartość z `key` także dla kolumny z `render`; liczby (całkowita, dziesiętna → przecinek, ujemna,
  0, NaN); `null`/`undefined`/`""` → pusto; escapowanie `;`, `"`, `\n`, `\r`; polskie znaki bez
  zmian; pusta lista → sam nagłówek; brak `\r\n`. Plus jeden test przez prawdziwe `pobierzPlik`
  (podmieniony `Blob`, jak w `katalog.eksport.test.ts`): treść zaczyna się od BOM, typ
  `text/csv;charset=utf-8`, nazwa `<view>.csv`.
- **Integracyjny `test/analityka.eksport.test.tsx` (przepisany)**, pełne `<App/>` + MSW z fixtures,
  `pobierzPlik` przechwycony na granicy modułu (wzór z `katalog.eksport-przycisk.test.tsx`):
  - każda z 10 kart: przycisk istnieje tylko tam, gdzie w oryginale; plik `<view>.csv`; nagłówek =
    nagłówki `<th>` tabeli karty; liczba wierszy pliku = liczba wierszy tabeli; pierwsza komórka
    każdego wiersza zgodna z tabelą;
  - filtr globalny (dostawca) zawęża plik w karcie, która go stosuje;
  - Rotacja: zmiana „Bez ruchu dni” (inny handler `?days`) zmienia plik;
  - zbiór > 300 (syntetyczny, np. 350 wierszy rotacji): tabela 300, plik 350;
  - Marża: plik ma kolumny i wiersze grup z tabeli, nie per produkt;
  - pusta tabela po filtrach → plik z samym nagłówkiem; przycisk nieaktywny podczas wczytywania;
  - żadne żądanie do `/api/analytics/export/*` nie wychodzi (MSW bez handlera + `onUnhandledRequest: "error"`,
    plus jawny licznik żądań).
- Bramki FE: `lint`, `typecheck`, `build`, `test`. BE: `npm test` bez zmian w kodzie (potwierdzenie).

## Poza zakresem
- Backend, `contract/`, trasa `export/:view` (zostaje martwa dla frontu; nie usuwamy jej).
- `NaglowekKpi.tsx`, `Analityka.tsx`, `api.ts` (PR.2), Pulpit (P10.2), roadmapa,
  `docs/instrukcja-testow-I10.md` (delta dla Ani to P10.4 → wejście `docs/karty/P10.4/wejscie-98.md`).
- Karty bez przycisku w oryginale (Sezonowość, Cykl życia modeli, Historia ceny, Inflacja, 2.6) — bez CSV.
- Kodowanie EAN/kodów pod Excela (decyzja 7).

## Definition of done
- [ ] Wszystkie 10 przycisków generuje plik w przeglądarce z wierszy i kolumn tabeli po filtrach; żaden nie woła serwera.
- [ ] Plik ma wszystkie wiersze (> 300), a tabela dalej rysuje 300.
- [ ] Format: BOM, `;`, `\n`, nagłówek z etykiet, przecinek dziesiętny, pusto dla braku, cudzysłowy wg reguły serwera.
- [ ] Komentarze w `eksport.tsx`, sekcjach i README nie twierdzą już, że plik ≠ tabela.
- [ ] Testy jednostkowe generatora + integracyjne 10 kart; bramki FE zielone, testy BE zielone bez zmian.
- [ ] `karta.md` P10.3 = stan, backlog #91 = status, `docs/karty/P10.4/wejscie-98.md` dla delty I10.
