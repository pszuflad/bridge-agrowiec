# 98-FEATURE-eksport-csv-z-tabeli — Code review

> Reviewed: 2026-09-22
> Branch: feature/98-eksport-csv-z-tabeli
> Diff: 17 plików, 3 commity (`eaeeec1`, `5914ab1`, `12dca51`)

## BLOCKER

- [ ] `docs/karty/P10.3/karta.md`, `docs/rebuild-backlog.md:4148` (#91), brak
      `docs/karty/P10.4/wejscie-98.md` — DoD z `plan.md:124` nie jest spełnione.
  - Reason: `plan.md` w punkcie 6 Definition of done wymaga wprost: „`karta.md` P10.3 = stan,
    backlog #91 = status, `docs/karty/P10.4/wejscie-98.md` dla delty I10". Żaden z tych trzech
    plików nie zmienił się w tym diffie — `karta.md` dalej ma `Stan: ⬜ gotowe (po P10.1)` (czyli
    „gotowa do startu", nie „zrobiona"), `Dowiezione` puste, backlog #91 dalej pisze „karta P10.3
    gotowa do startu po P10.1", a `docs/karty/P10.4/` w ogóle nie ma pliku `wejscie-98.md`, mimo
    że `raport.md:62` sam obiecuje jego istnienie („Delta dla Ani należy do P10.4, wejście w
    `docs/karty/P10.4/wejscie-98.md`"). To jest dokładnie sytuacja, przed którą ostrzega
    `CLAUDE.md` (zasady 0–1): następna karta/koordynator czyta te pliki jako wejście i dostanie
    nieaktualny stan.
  - Suggestion: dopisać w `karta.md` P10.3 datę + ID ticketu 98, sekcję „Dowiezione" z realnym
    zakresem, w backlogu #91 zmienić `Status` na zamknięty, i dorzucić brakujący
    `docs/karty/P10.4/wejscie-98.md` z notatką o delcie dla Ani (`instrukcja-testow-I10.md §6.4`).

## SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/analityka/csv.ts:39-45` — `wartoscKomorkiCsv` nie obsługuje
      notacji wykładniczej z `String()` (np. `String(1e-7)` = `"1e-7"`, `String(1e21)` =
      `"1e+21"`) — `replace(".", ",")` nic tu nie zmienia, bo w takim zapisie nie ma kropki.
  - Reason: dla wartości spoza zakresu `[1e-6, 1e21)` funkcja oddałaby tekst niekonwertowany na
    przecinek, niespójny z resztą pliku i potencjalnie czytany przez polski Excel jako tekst.
    Ryzyko w praktyce niskie — dane analityki (marże, %, ceny) nie osiągają takich rzędów
    wielkości — ale reguła nie jest przetestowana i nie jest udokumentowana jako świadome
    odstępstwo (plan wymienia tylko `NaN`/±∞).
  - Suggestion: dopisać test dokumentujący zachowanie (świadomie zaakceptowane albo naprawione),
    żeby przyszła zmiana nie natknęła się na to przypadkiem.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/analityka/eksport.tsx:25` — import `pobierzPlik` z
      `pages/katalog/eksport.ts` łączy domenowo dwa niezwiązane katalogi stron; zweryfikowane
      buildem (`npm run build`), że nie duplikuje modułu w chunku `Analityka-*.js` (Katalog jest
      importowany statycznie w `App.tsx`, więc `pobierzPlik` i tak ląduje w chunku głównym) —
      akceptowalne i zgodne z decyzją 10 z planu, ale warto to zostawić jako świadomą notatkę,
      gdyby kiedyś Katalog też trafił do lazy-loadingu.
- [ ] `docs/tickets/98-FEATURE-eksport-csv-z-tabeli/plan.md:3` — `Status: Draft` nie został
      podniesiony mimo zaimplementowanego i przetestowanego ticketu; niekrytyczne (część innych
      shipped ticketów w repo też zostaje przy `Draft`), ale przy okazji poprawek z BLOCKER-a
      warto ujednolicić.

## Plan compliance

### Done ✓
- Nowy generator `pages/analityka/csv.ts` (`wartoscKomorkiCsv`, `escapujKomorkeCsv`,
  `zbudujCsvTabeli`) — reguła wartości, przecinek dziesiętny, escapowanie 1:1 z
  `backend/src/analityka/csv.ts` (`/[;"\n\r]/`), bez BOM-u (dokłada go `pobierzPlik`).
- `eksport.tsx` przepisany: `PrzyciskCsv<T>({ widok, wiersze, kolumny, wczytywanie })`,
  `onClick` buduje plik i woła `pobierzPlik()`; usunięte `adresEksportu()`, `BAZA_API`,
  nawigacja `window.location.href`.
- Wszystkich 10 kart (`Sekcja*.tsx`) zweryfikowanych diffem — każda podaje przyciskowi
  DOKŁADNIE tę samą tablicę `wiersze`/`dane` i tę samą stałą `KOLUMNY*`, którą dostaje
  `TabelaAnalityki` w tej samej karcie, oraz tę samą flagę `wczytywanie`/`isPending`/`ladowanie`,
  od której tabela pokazuje „Wczytywanie…" (sprawdzone: Stabilność, Cykl życia, Stan dostawców,
  EAN-porównanie, EAN-unikalne, Ceny 3.1, Dostępność, Tempo schodzenia, Marża, Rotacja).
- Rotacja: „Bez ruchu dni" jest w `queryKey`, plik bierze wiersze już po `?days` — potwierdzone
  testem integracyjnym zmieniającym pole i porównującym zawartość pliku.
- Marża: plik ma przekrój tabeli (grupy), nie listę per produkt z serwera — zweryfikowane testem.
- Pusta tabela po filtrach → plik z samym nagłówkiem; przycisk nieaktywny tylko podczas
  wczytywania — oba przypadki mają test.
- Limit 300 dotyczy tylko rysowania — test syntetyczny na 350 wierszach Rotacji potwierdza
  300 w tabeli i 350 w pliku.
- Zero wywołań `GET /api/analytics/export/{view}` z żadnego przycisku — licznik w teście
  integracyjnym równy 0 we wszystkich scenariuszach.
- `TabelaAnalityki.tsx` dostał wyłącznie komentarze (`key` jako źródło CSV, `LIMIT_WIERSZY`
  nie dotyczy pliku) — bez zmiany logiki, zgodnie z planem.
- `README.md` §7 oznacza mechanizm 10f jako zastąpiony, nowa §7a opisuje format pliku bez
  twierdzenia, że plik różni się od tabeli.
- Zakazane pliki (`NaglowekKpi.tsx`, `Analityka.tsx`, `api.ts`, backend, `contract/`,
  `docs/rebuild-roadmap.md`, `docs/instrukcja-testow-I10.md`) — diff wobec `origin/develop`
  pusty dla wszystkich (`git diff origin/develop...HEAD -- <te pliki>` nic nie zwraca).
- Bramki FE: `lint` ✓, `typecheck` ✓, `build` ✓ (2 chunki, `Analityka-*.js` 445 kB / `index-*.js`
  613 kB, bez ostrzeżeń o duplikacji), `test` ✓ 53 pliki / 922 testy — zgodne z liczbami z
  `raport.md`.

### Missing or deviating ✗
- Dokumentacja procesowa (karta P10.3, backlog #91, `docs/karty/P10.4/wejscie-98.md`) — patrz
  BLOCKER wyżej. Kod i testy są kompletne, brakuje tylko aktualizacji stanu „na zewnątrz" ticketu.

### Definition of done
- [x] Wszystkie 10 przycisków generuje plik w przeglądarce z wierszy i kolumn tabeli po
      filtrach; żaden nie woła serwera.
- [x] Plik ma wszystkie wiersze (> 300), a tabela dalej rysuje 300.
- [x] Format: BOM, `;`, `\n`, nagłówek z etykiet, przecinek dziesiętny, pusto dla braku,
      cudzysłowy wg reguły serwera.
- [x] Komentarze w `eksport.tsx`, sekcjach i README nie twierdzą już, że plik ≠ tabela.
- [x] Testy jednostkowe generatora + integracyjne 10 kart; bramki FE zielone, testy BE zielone
      bez zmian.
- [ ] `karta.md` P10.3 = stan, backlog #91 = status, `docs/karty/P10.4/wejscie-98.md` dla delty
      I10 — nie zrobione (patrz BLOCKER).

## Parallel-test concerns

None — testy jednostkowe (`analityka.csv.test.tsx`) i integracyjne (`analityka.eksport.test.tsx`)
nie używają współdzielonej bazy, stałego portu ani pliku tymczasowego ze sztywną ścieżką;
`pobierzPlik` jest przechwycone przez `vi.mock` na granicy modułu, MSW stoi na efemerycznym
serwerze testowym, stan resetowany w `beforeEach`.

## Overall assessment

Implementacja jest solidna i dokładnie zweryfikowana: generator CSV wiernie portuje regułę
serwera (separator, escapowanie, BOM), wszystkie 10 sekcji podaje przyciskowi tę samą tablicę
i te same kolumny co tabeli (zweryfikowane diffem plik po pliku, nie tylko deklaracją raportu),
a testy jednostkowe i integracyjne realnie dowodzą „plik = tabela" (nagłówek, wiersze komórka
w komórkę, licznik wywołań serwera, test mutacyjny 7/13 z raportu). Jedyny realny problem to
brak aktualizacji stanu procesowego (`karta.md`, backlog #91, brakujący `wejscie-98.md`) —
kod jest gotowy do merge'a, ale dokumentacja karty nie odzwierciedla jeszcze zrobionej pracy,
co wprost łamie DoD z `plan.md` i zasadę projektu o aktualizowaniu kart przez sesję, która je
realizuje.
