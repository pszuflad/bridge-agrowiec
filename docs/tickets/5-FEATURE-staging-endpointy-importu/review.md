# 5-FEATURE-staging-endpointy-importu — Code review

> Reviewed: 2026-08-26
> Branch: feature/5-staging-endpointy-importu
> Diff: 26 plików, 5 commitów (`0a6ffac`..`115d87f`)

## BLOCKER

- [ ] `rebuild/backend/src/routes/staging.ts:60-66` — `pageSize` w `/api/staging/paged` liczony inaczej niż w oryginale dla wartości `"0"`.
  - Oryginał (`pagination_module.cjs:19`): `Math.min(200, Math.max(1, parseInt(req.query.pageSize || req.query.limit || '50', 10)))`. `||` działa NA STRINGU, zanim wejdzie `parseInt` — string `"0"` jest prawdziwościowo TRUE (niepusty string), więc fallback do `'50'` się NIE uruchamia. `parseInt("0",10)=0` → `Math.max(1,0)=1`. Czyli `pageSize=0` w oryginale daje **1**.
  - Rebuild robi `parseInt(...) || DOMYSLNY_PAGE_SIZE` — `parseInt("0")` daje `0`, które jest falsy jako LICZBA, więc fallback się uruchamia i wychodzi **50**.
  - To nie jest udokumentowane odstępstwo (brak wpisu D-cokolwiek), a test `staging.odczyt.test.ts:133-140` aktywnie utrwala złe zachowanie z błędnym komentarzem-uzasadnieniem („zero jest falsy, więc wpada domyślna wartość" — prawda dla liczby, nieprawda dla stringu wejściowego w oryginale).
  - Ten sam błąd wzorca (`parseInt(...)||default` zamiast `str||default` przed `parseInt`) dotyczy też `page` (`routes/staging.ts:57-58`) dla wejść nieparsowalnych (np. `page=abc`): oryginał dostaje tam `NaN` (prawdopodobnie 500 przy bindowaniu do SQLite), rebuild cicho podstawia `1`. Mniej dotkliwe niż przypadek `pageSize=0`, bo dotyczy tylko śmieciowego wejścia, ale to ten sam nieprzeportowany fragment logiki.
  - Sugestia: odtworzyć dokładnie wzorzec `string-fallback-przed-parseInt` z oryginału, albo — jeśli ma to być świadome odstępstwo (rozsądne, bo omija potencjalny 500) — dopisać je do plan.md/raport.md jako D13 i poprawić komentarz testu.

## SHOULD-FIX

- [ ] `rebuild/backend/src/routes/import.ts:57-63,148-149` — wspólna funkcja `odrzucNiedozwolonegoDostawce` zwraca dla `from-url` komunikat `Nieznany dostawca: ${kod}` zamiast oryginalnego `Brak URL dla dostawcy ${kod}`.
  - Oryginał ma DWA różne komunikaty dla tego samego warunku „brak URL": `parse-file` → `Nieznany dostawca: ${kod}` (`extensions.cjs:216-218`), `from-url` → `Brak URL dla dostawcy ${kod}` (`extensions.cjs:129-130`). Scalenie obu tras w jedną bramkę pod wspólnym komunikatem cicho zmienia treść błędu dla `from-url`.
  - Brak testu na ten przypadek dla `from-url` (jest tylko dla `parse-file`, `import.test.ts:184-189`), więc rozjazd przeszedł niezauważony.
  - Sugestia: albo osobne komunikaty per trasa, albo świadomie ujednolicić i to udokumentować + dopisać test dla `from-url` z nieznanym dostawcą.

- [ ] `rebuild/backend/src/routes/import.ts:52-56` — `kodZZadania` jest dzielone między `parse-file` i `from-url`, ale akceptowane źródła kodu różnią się w oryginale.
  - Oryginał `parse-file` czyta wyłącznie `req.query.dostawcaKod || req.body.dostawcaKod` (`extensions.cjs:214`) — bez aliasu `dostawca`. Oryginał `from-url` czyta `req.body.dostawcaKod || req.body.dostawca` (`extensions.cjs:127`) — bez query.
  - Wspólna funkcja w rebuildzie akceptuje WSZYSTKIE trzy źródła dla OBU tras, czyli `parse-file` teraz przyjmuje też `body.dostawca` (czego oryginał nie robił), a `from-url` przyjmuje też `query.dostawcaKod` (nieużywane w praktyce, ale poszerza powierzchnię API). Niegroźne funkcjonalnie, ale to niezamierzone poszerzenie zachowania bez zatwierdzonej decyzji i bez testu.

- [ ] `rebuild/backend/src/routes/import.ts:196-201` — czytanie surowego strumienia (`for await (const kawalek of req)`) akumuluje CAŁE ciało w pamięci PRZED sprawdzeniem limitu 25 MB, tak samo jak oryginał (`extensions.cjs:224-230`).
  - Wiernie odtworzone, ale skoro instrukcja przeglądu prosiła o weryfikację tego punktu wprost: to jest realna słabość (DoS przez duże ciało żądania) odziedziczona z produkcji, nieodnotowana w sekcji „Znaleziska w oryginale" `raport.md` (są tam tylko 3 inne znaleziska). Warto dopisać jako czwarte, żeby przyszła sesja świadomie decydowała, czy to naprawiać (np. licznikiem bajtów w trakcie strumieniowania) czy zostawić.

- [ ] `rebuild/backend/test/staging.odczyt.test.ts:150-153` — test „`page` poniżej 1 jest podnoszony do 1" sprawdza tylko `page=-3`, nie pokrywa przypadku `page` nieparsowalnego (`page=abc`), gdzie zachowanie (patrz BLOCKER wyżej) też się różni od oryginału. Warto dopisać, skoro `limit`/`offset` mają analogiczny test dla `"abc"` w `/api/staging`.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/import/pobierz.ts:29-30,35` — dodane `odpowiedz.resume()` przy przekierowaniu/błędnym statusie to dobra poprawka (unika zawieszonego gniazda), ale nie jest opisana jako świadome (nieszkodliwe) odstępstwo — warto jedno zdanie w komentarzu, żeby nie wyglądało na przeoczenie przy następnym audycie.
- [ ] `rebuild/backend/src/import/archiwum.ts:120` — `wymusRetencje` w bloku `for (const miesiac of readdirSync(korzen))` na końcu nie sprawdza `existsSync(korzen)` ponownie (choć w praktyce katalog już istnieje, bo `archiwizujBufor` go tworzy) — czysto kosmetyczne, oryginał ma tę samą strukturę.
- [ ] `rebuild/backend/src/repos/kolumny.ts:30-38` — pętla walidująca wykluczenia (`for (const nazwa of wykluczone)`) biegnie PO zbudowaniu projekcji; przy literówce funkcja i tak najpierw budowałaby (poprawny) obiekt, a dopiero potem rzucała. Działa poprawnie (test to potwierdza), ale kolejność (walidacja przed budową) byłaby czytelniejsza.

## Plan compliance

### Done ✓
- Migracja `002_import.sql` (`suppliers.import_wylaczony`, `products.uwaga_cena`, wyłączenie MO6) — krok 1
- Jawna projekcja kontraktowa (`repos/kolumny.ts`) + użycie w `repos/products.ts`/`repos/suppliers.ts`, `katalog.gate.test.ts` zielony bez zmian — krok 1, D6
- Repozytorium stagingu z trzema projekcjami (24/20/21) + zapis wsadowy w transakcji — krok 2
- Trasy odczytu `GET /api/staging`, `/paged`, `/{id}`, `/paged` zarejestrowane przed `/:id` — krok 3
- Szew `tk()` (`silnikStagingu3b`) z jawnie oznaczoną niewiernością, filtr śmieci MO2 port 1:1, odrzucenie bez kodu/EAN — krok 4, D2
- Archiwum importu (`archiwum.ts`) — zapis, `.meta.json` 14 pól, retencja 7 dni / 5 GB, nigdy nie rzuca — krok 5, D3
- Trasy importu `parse-file`/`from-url`/`ai-fallback/parse`, strażnik D5, bezpiecznik D4, naprawa `archOk` D8, limit przekierowań D12 — krok 6
- Testy: GATE fixtures/kontrakt, odczyt, import end-to-end bez mocków (poza transportem HTTP), projekcja D6 — krok 7
- `lint`/`typecheck`/`build`/`test` przechodzą (234/234 testów, zweryfikowane lokalnie)

### Missing or deviating ✗
- Brak żadnego kroku z planu całkowicie pominiętego. Odchylenia dotyczą detali wewnątrz kroków 3 i 6 (patrz BLOCKER/SHOULD-FIX powyżej: `pageSize=0`, komunikat błędu `from-url`, poszerzone źródła `dostawcaKod`) — żadne z nich nie jest wymienione w tabeli „Świadome odstępstwa" w `raport.md`, więc formalnie są to nieudokumentowane rozjazdy z oryginałem, a nie zatwierdzone decyzje.

### Definition of done
- [x] Rekordy z parsera trafiają do `staging_items` przez Drizzle, w transakcji
- [x] `GET /api/staging` oba kształty, `/paged` z filtrami, `/{id}` z 400/404 — **z zastrzeżeniem BLOCKER** (`pageSize=0` daje inny wynik niż oryginał)
- [x] `POST /api/import/parse-file` działa na realnym cenniku
- [x] `POST /api/import/from-url` pobiera, archiwizuje, parsuje, zapisuje
- [x] `POST /api/ai-fallback/parse` odtworzony 1:1 w obu trybach
- [x] Strażnik MO6 (D5) i bezpiecznik pustego wyniku (D4) pokryte testami
- [x] Archiwum tworzy plik + `.meta.json` o poprawnych 14 polach
- [x] `GET_staging.json` i `GET_staging_paged.json` przez GATE
- [x] Zbiory kluczy 24/20/21 pokryte testami
- [x] `katalog.gate.test.ts` nadal zielony bez zmian w teście
- [x] `charakteryzacja.test.ts` nadal zielony
- [x] `lint`/`typecheck`/`build`/`test` czyste
- [x] `raport.md` opisuje podział 3b/3c i odstępstwa D1–D12 (choć nie wszystkie rzeczywiste odstępstwa znalezione w tej recenzji są w niej ujęte — patrz „Missing or deviating")

## Parallel-test concerns

None — wszystkie nowe testy używają portu efemerycznego (`import.pobierz.test.ts`: `listen(0, "127.0.0.1")`), tymczasowej bazy SQLite per `stworzSrodowiskoTestowe()` i katalogu archiwum wyprowadzonego ze ścieżki tymczasowej bazy (`test/gate/aplikacja.ts`), czyszczonego w `afterAll`/`beforeEach`. Brak twardo zakodowanych portów, ścieżek czy współdzielonego stanu między agentami.

## Overall assessment

Bardzo solidna sesja: podział 3b/3c jest trafnie postawiony, szew `tk()` jest czytelny i gotowy do podmiany w 3c, archiwum i projekcja kontraktowa (D6) są dopracowane i dobrze przetestowane, a GATE fixtures/kontrakt przechodzi bez modyfikacji fixtures. Największy realny problem to rozjazd w liczeniu `pageSize` dla `/api/staging/paged` przy wartości `"0"` — subtelny, ale dokładnie tego typu błąd, przed którym miał chronić rygor „porównaj z oryginałem linia po linii"; test, który miał to złapać, sam utrwala złe zachowanie z błędnym uzasadnieniem. Drugi wątek to scalenie bramek walidacyjnych `parse-file`/`from-url` w jedną funkcję, które ujednolica komunikaty błędów i akceptowane pola wejściowe kosztem wierności wobec dwóch osobno napisanych oryginalnych handlerów. Oba są łatwe do naprawienia bez ruszania architektury.
