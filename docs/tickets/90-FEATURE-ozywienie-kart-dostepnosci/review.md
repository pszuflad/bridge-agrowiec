# 90-FEATURE-ozywienie-kart-dostepnosci — Code review

> Reviewed: 2026-09-22
> Branch: feature/90-ozywienie-kart-dostepnosci
> Diff: 15 plików, 8 commitów (vs `origin/develop`)

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/backend/src/repos/analityka.ts:1385` (`dostepnoscProduktow`, gałąź z historią) —
  `SELECT h.kod, h.ean, h.dostawca, …` z `GROUP BY h.dostawca, h.kod` wybiera `h.ean` jako
  kolumnę GOŁĄ (bez agregatu) spoza `GROUP BY` — dokładnie ta sama klasa problemu co #33
  (`stan` gołe obok `GROUP BY … zarejestrowano_at`), tylko dla `ean`. Jeśli w historii ten sam
  `(dostawca, kod)` ma różne wartości `ean` w różnych migawkach (np. korekta EAN-u), SQLite
  wybierze `ean` z arbitralnego wiersza grupy — wynik zależny od implementacji/kolejności
  wstawiania, tak jak `stan` było przed naprawą #33.
  - Reason: To 1:1 port zapytania oryginału (potwierdzone w `mirror/backend/analytics_module.cjs:161-165`),
    więc samo istnienie problemu nie jest regresją tego ticketu — ale naprawa #32 właśnie
    „odsłania” go tak samo, jak odsłoniła #33 (co ten ticket poprawnie wychwycił i rozstrzygnął
    decyzją użytkownika). Ten wariant tej samej pułapki NIE został rozpoznany ani opisany w
    `Deviations from plan` / `Follow-up` raportu — tylko podwójne liczenie `COUNT(*)` przy
    duplikacie klucza jest tam odnotowane, nie niejednoznaczność `ean`. Bez odnotowania
    następna sesja może uznać kartę 4.1 za w pełni rozliczoną wobec #33/GROUP BY, choć nie jest.
  - Suggestion: nie naprawiać teraz (wymagałoby nowej decyzji użytkownika, analogicznie do #33) —
    dopisać obserwację do `Follow-up` w `raport.md` (albo nowy wpis w `docs/rebuild-backlog.md`)
    obok już istniejącego akapitu o `COUNT(*)` po surowej historii, żeby nie zgubić faktu przy
    kolejnej karcie dotykającej `availability/products`. Ten sam mechanizm dotyczy pośrednio
    `GROUP_CONCAT(… ) AS miesiaceBrakow` (kolejność elementów niegwarantowana przez standard) —
    zaakceptowane 1:1, ale warto to samo zdanie objąć.
- [ ] `docs/tickets/90-FEATURE-ozywienie-kart-dostepnosci/plan.md:122-127` — sekcja „Definition
  of done” ma wszystkie punkty jako `[ ]` (niezaznaczone), mimo że `raport.md` i testy dowodzą
  ich spełnienia, a nagłówek planu już ma `Status: Implemented`.
  - Reason: drobna niespójność dokumentacyjna — kolejna sesja czytająca sam plan.md (bez
    raportu) może błędnie uznać, że coś zostało niedowiezione.
  - Suggestion: zaznaczyć `[x]` przy każdym spełnionym punkcie DoD w plan.md.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/repos/analityka-eksport.ts:283` (`eksportDostepnosciProduktow`,
  `GROUP BY h.dostawca, h.kod, h.ean, p.nazwa`) — komentarz nad funkcją dobrze tłumaczy, czemu
  dołożenie `p.nazwa` do `GROUP BY` nie rozbija grup (jest funkcją pary klucza), ale warto by ten
  sam komentarz (albo odwołanie do niego) stał też przy `dostepnoscProduktow` w `analityka.ts`,
  żeby czytelnik od razu widział asymetrię: eksport grupuje po `ean`, dashboard nie.

## Plan compliance

### Done ✓
- #32 (wariant a): `LEFT JOIN products` po `(dostawca, kod)` w obu kartach dashboardu i obu
  eksportach CSV; `nazwa: string | null`; usunięty produkt → `null` / kreska w UI.
- #33: wspólne CTE `HISTORIA_BEZ_DUPLIKATOW_KLUCZA` (`MAX(id)` per klucz), użyte identycznie
  w `tempoSchodzenia` (dashboard) i `eksportTempaSchodzenia` (eksport) — `LAG` liczy się na
  zwiniętej historii w obu miejscach, zgodnie z wymaganiem. Pomiar „co zostaje w `products`
  przy duplikacie z prawdziwego importu” wykonany przed kodem i potwierdzony testem na
  prawdziwym silniku importu (`import/tk.ts`).
- #31: `zbudujSnapshotBiezacy` dostał `AND id NOT IN (… WHERE produkt_id IS NOT NULL AND
  substr(zarejestrowano_at,1,10) = <dzień UTC>)`; test pokrywa granicę dnia (23:59/00:01 UTC),
  oba pisarze historii, `NULL` w `produkt_id`, format domyślki schematu, per-produkt izolację.
  Bez indeksu unikalnego, bez migracji — zgodnie z decyzją.
- #35: `widokEksportu()` na `Object.hasOwn` (jedyne źródło listy widoków), trasa → 404 z JSON,
  `Content-Disposition` budowany wyłącznie z nazwy już zwalidowanej jako klucz mapy,
  `openapi.yaml` ma `404` z komentarzem „ODSTĘPSTWO OD PRODUKCJI”, generator `--sprawdz` czysty.
- Fixtures `contract/fixtures/` nietknięte — zweryfikowane (`git diff --stat` puste).
- Testy zmienione jawnie z komentarzem „świadome odstępstwo, #3x, 2026-09-21” we wszystkich
  wskazanych plikach; nowe testy realnie dowodzą (konkretne wartości `toEqual`, nie tylko
  `toBeGreaterThan`), w tym przypadek „kod u dwóch dostawców” (zastąpiony wariantem, bo
  `products.kod` jest globalnie `UNIQUE` — opisane i uzasadnione w `raport.md`).
- FE: zmiana WYŁĄCZNIE komentarzy nagłówkowych dwóch sekcji + README + nowy test widoku
  (kreska dla `nazwa: null`) — kod komponentów nietknięty, zgodnie z planem.
- Zakres plików: żadna zmiana poza własnością karty P10.1 (`repos/analityka*.ts`,
  `routes/analytics.ts`, `contract/openapi.yaml`, testy analityki, dwie sekcje FE + README) —
  `import/tk.ts`, Pulpit/alerty, kafle KPI, `docs/instrukcja-testow-I10.md`,
  `docs/rebuild-roadmap.md` nietknięte.

### Missing or deviating ✗
- Brak — plan zrealizowany 1:1, jedyne odejście („test dwóch dostawców z tym samym kodem”
  zamieniony na równoważny wariant) jest jawnie uzasadnione w `Deviations from plan` raportu
  i wynika z ograniczenia schematu (`products.kod UNIQUE`), nie z pominięcia.

### Definition of done
- [x] Obie karty i oba eksporty zwracają wiersze na danych `historia_cen` — potwierdzone testem
  i pomiarem na `db/snapshot.db` (tabela w raporcie).
- [x] Nazwa z katalogu po dostawca+kod, usunięty → pusto / „—” — testy BE i FE.
- [x] Duplikat klucza → `MAX(id)`, stabilnie — testy „duplikat z importu” i „stabilność między
  wywołaniami” w obu miejscach (dashboard `tempoSchodzenia` i eksport `sell-through`).
- [x] Bootstrap idempotentny w obrębie dnia UTC, `inserted` bez zmiany kształtu.
- [x] Nieznany widok → 404, opisane w `openapi.yaml` — generator `--sprawdz` czysty.
- [x] Fixtures nietknięte, gate zielony; bramki BE i FE zielone — potwierdzone lokalnie:
  backend lint/typecheck/build zielone, `npm test` 90 plików / 1481 testów ✓; frontend
  lint/typecheck/build zielone, `npm test` 51 plików / 892 testy ✓ (zgodne z liczbami
  w `raport.md`).

## Parallel-test concerns

None — wszystkie nowe/zmienione testy używają albo `stworzTestowaBaze()` (SQLite w
`mkdtempSync(tmpdir(), …)`, sprzątane w `finally`), albo istniejącego `stworzSrodowiskoTestowe()`
tej samej rodziny; testy dnia UTC w `analityka.agregaty.test.ts` używają `vi.useFakeTimers()` z
`afterEach(() => vi.useRealTimers())` — brak zależności od zegara systemowego czy portów.
Testy HTTP w plikach `*.gate.test.ts` idą przez istniejącą, już wcześniej używaną infrastrukturę
efemerycznych portów — bez zmian w tym zakresie.

## Overall assessment

Bardzo solidna realizacja czterech zatwierdzonych odstępstw: SQL jest poprawny (JOIN po parze
`dostawca`+`kod` nie mnoży wierszy, bo `products.kod` jest globalnie unikalny; `LAG` liczy się
konsekwentnie na zwiniętej historii w obu miejscach, które go używają), komentarze w kodzie
rzetelnie odróżniają „port 1:1” od „świadome odstępstwo” z odwołaniem do numeru backlogu i daty
decyzji, a testy realnie dowodzą nowego zachowania (konkretne wartości, nie tylko „niepuste”).
Fixtures i zakres plików pozostały nietknięte zgodnie z zasadami projektu, wszystkie cztery
bramki (BE+FE) i generator OpenAPI są zielone. Jedyne odkryte ryzyko — niejednoznaczna kolumna
`ean` w `dostepnoscProduktow`, ta sama klasa problemu co naprawione #33, tylko nieodkryta i
nieudokumentowana — nie blokuje merge'a (to 1:1 port zastanego zachowania produkcji), ale warto
ją zapisać, żeby nie zgubić się jak inne „odsłonięte przez #32” pułapki.
