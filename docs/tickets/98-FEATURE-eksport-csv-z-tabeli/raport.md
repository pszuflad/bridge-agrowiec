# 98-FEATURE-eksport-csv-z-tabeli — Raport z implementacji

## Podsumowanie
Dziesięć przycisków „CSV” w `/analityka` zapisuje teraz w przeglądarce dokładnie te wiersze
i kolumny, które ma tabela karty po filtrach globalnych i lokalnych, bez limitu 300. Karta P10.3,
backlog #91. Trasa `GET /api/analytics/export/{view}` zostaje w backendzie i kontrakcie bez
zmian, ale żaden przycisk jej już nie woła.

## Zmiany
- **Nowy:** `rebuild/frontend/src/pages/analityka/csv.ts` — generator: `wartoscKomorkiCsv`
  (reguła wartości, przecinek dziesiętny, pusto dla braku), `escapujKomorkeCsv` (reguła serwera),
  `zbudujCsvTabeli(wiersze, kolumny)` (nagłówek z etykiet, `;`, `\n`, bez BOM).
- `rebuild/frontend/src/pages/analityka/eksport.tsx` — `PrzyciskCsv({ widok, wiersze, kolumny,
  wczytywanie })` buduje plik i zapisuje go przez `pobierzPlik()` z `pages/katalog/eksport.ts`.
  Usunięte martwe `adresEksportu()` i nawigacja `window.location.href`. Nagłówek pliku przepisany.
- `Sekcja{Stabilnosc,CyklZycia,Stan}Dostawcow.tsx`, `SekcjaEan.tsx`, `SekcjaCeny.tsx`,
  `SekcjaDostepnosciProduktow.tsx`, `SekcjaTempaSchodzenia.tsx`, `SekcjaMarze.tsx`,
  `SekcjaRotacji.tsx` — przycisk dostaje tę samą tablicę `wiersze` i te same `KOLUMNY*` co
  `TabelaAnalityki` oraz flagę wczytywania. Przepisane komentarze, które mówiły, że plik ≠ tabela.
- `TabelaAnalityki.tsx` — tylko komentarze: `key` jest źródłem wartości pliku, a limit 300 nie dotyczy pliku.
- `pages/analityka/README.md` — wpis P10.3 w liście bloków, §7 oznacza mechanizm 10f jako
  zastąpiony, nowa §7a z formatem pliku.
- **Nowy:** `rebuild/frontend/test/analityka.csv.test.tsx` — 13 testów jednostkowych generatora i zapisu.
- `rebuild/frontend/test/analityka.eksport.test.tsx` — przepisany: 13 testów integracyjnych na `<App/>`.

## Jak wygląda plik (dla Ani / P10.4)
| Element | Zapis |
|---|---|
| nagłówek | etykiety kolumn tabeli, w kolejności tabeli |
| liczba | przecinek, bez spacji tysięcy, pełna precyzja pola: `12,5`, `1234,567` (tabela pokazuje `1 234,57`) |
| procent (Dostępność) | surowa liczba `87,5`, bez `%` |
| data | napis z API bez zmian, np. `2026-08-17T14:44:40.244Z` (tak samo jak w tabeli) |
| pusta wartość | pusta komórka (w UI „—”), np. pusta nazwa w kartach „Dostępności” po P10.1 |
| EAN / kod | zwykły tekst, jak na serwerze |
| format | BOM, `;`, `\n`, cudzysłowy przy `;`, `"`, `\n`, `\r`, nazwa `<view>.csv` |
| pusta tabela po filtrach | plik z samym nagłówkiem; przycisk nieaktywny tylko podczas wczytywania |

## Odstępstwa od planu
Brak. Jedna rzecz doprecyzowana w trakcie: `NaN` i ±∞ też dają pustą komórkę (tabela pokazałaby „NaN”).

## Wyniki testów
- **Gate odbudowy (fixtures/kontrakt):** N/D — ticket nie dotyka API. `git diff origin/develop -- rebuild/backend contract` jest pusty. Testy FE biorą dane kart z fixtures (`test/msw/kontrakt.ts`); trzy nagrania z `rows: []` (`availability/products`, `availability/sell-through`, `rotation/inactive`) zastąpiono w teście wierszami syntetycznymi o kształcie z typów `api.ts`.
- **Jednostkowe:** ✓ 13/13 (`analityka.csv.test.tsx`) — liczby, puste, escapowanie, polskie znaki, `render` → surowe pole, pusta lista, brak limitu, BOM + MIME + nazwa przez prawdziwe `pobierzPlik`, `disabled` podczas wczytywania.
- **Integracyjne:** ✓ 13/13 (`analityka.eksport.test.tsx`):
  - każda z 10 kart: plik `<view>.csv`, nagłówek = `<th>` tabeli, wiersze = wiersze tabeli komórka w komórkę;
  - filtr globalny zawęża plik, a pusta tabela daje sam nagłówek;
  - „Bez ruchu dni” zmienia plik Rotacji;
  - przy 350 wierszach tabela ma 300, a plik 350;
  - Marża ma plik zgrupowany, jak tabela;
  - zero wywołań `export/*`.
  - Kontrola mutacyjna: plik z wierszy bez filtrów plus liczby z kropką → 7/13 testów pada.
- **Bramki FE:** lint ✓, typecheck ✓, build ✓, test ✓ 53 pliki / 922 testy.
- **Backend:** bez zmian w kodzie; `npm test` ✓ 92 pliki / 1511 testów (1 pominięty jak wcześniej).
- E2E: pominięte (brak w planie).

## Zmiany łamiące zgodność
- Pliki CSV z analityki mają inny nagłówek (etykiety zamiast kluczy pól) i przecinek dziesiętny.
  Ktoś, kto automatycznie czytał stare pliki serwerowe, musi się dostosować; takiego konsumenta nie znamy.
- `GET /api/analytics/export/{view}` nie ma już konsumenta we froncie. Trasa działa dalej.

## Do zrobienia później
- `docs/instrukcja-testow-I10.md` §6.4 opisuje stary eksport („plik nie zna filtrów”). Delta dla Ani należy do P10.4, wejście w `docs/karty/P10.4/wejscie-98.md`.
- Serwerowy `export/{view}` bez konsumenta: zostawić jako API czy kiedyś wygasić? To decyzja koordynatora/użytkownika, nie tej karty.

## Poprawki po review
- **BLOCKER (dokumentacja karty/backlogu/`wejscie-98.md`)** — zrobione w fazie docs (commit „sync docs”); w chwili review ta faza jeszcze nie ruszyła.
- **SHOULD-FIX (notacja wykładnicza w `wartoscKomorkiCsv`)** — zachowanie było poprawne (`1.5e-7` → `1,5e-7`; `1e-7` nie ma części dziesiętnej), brakowało testu. Dopisany test (także `-0` → `0`); jednostkowe 14/14.
- **NICE-TO-HAVE** — `plan.md` ma status `Implemented`. Import `pobierzPlik` z katalogu zostaje: reviewer potwierdził buildem, że nie duplikuje modułu.
