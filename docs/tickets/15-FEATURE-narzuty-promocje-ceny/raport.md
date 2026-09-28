# 15-FEATURE-narzuty-promocje-ceny — raport z implementacji

## Podsumowanie

Iteracja 4a (backend) dowieziona: osiem tras CRUD narzutów i promocji za `requireAuth`, silnik
cen przeportowany z oryginału (`__bridge*` + `recalcPricesFromRules`) i — najważniejsze —
gałąź cenowa wpięta w `acceptStaging`, co domyka lukę świadomie zostawioną przez Iterację 3.
Test charakteryzacyjny z bloku 3d-2, który do tej pory przechodził wyłącznie na pustych
tabelach `markups`/`promotions`, dostał trzynaście scenariuszy z regułami w obu tabelach
i jest zielony — port liczy ceny tymi samymi liczbami co uruchomiony oryginał.

## Zmiany

**Nowe pliki**
- `rebuild/backend/src/repos/ceny.ts` — silnik cen: `dopasujWarunek`, `narzutPasuje`,
  `promocjaPasuje`, `wybierzNarzut`, `wybierzPromocje`, `zastosujRegulyCenowe`
  (gałąź importu, reużywalna przez I12), `przeliczCenyZRegul` (masowe przeliczenie).
- `rebuild/backend/src/repos/pola-edytowalne.ts` — generyczne `odsiejPola(cialo, lista)`.
- `rebuild/backend/src/repos/markups.ts` — CRUD narzutów + `POLA_EDYTOWALNE_NARZUTU`.
- `rebuild/backend/src/repos/promotions.ts` — CRUD promocji + `POLA_EDYTOWALNE_PROMOCJI`.
- `rebuild/backend/src/routes/markups.ts` — cztery trasy `/api/markups`.
- `rebuild/backend/src/routes/promotions.ts` — cztery trasy `/api/promotions`.
- `rebuild/backend/test/narzuty.gate.test.ts` — GATE: fixtures + kontrakt + auth (7 testów).
- `rebuild/backend/test/ceny.silnik.test.ts` — silnik cen, jednostkowo (34 testy).
- `rebuild/backend/test/narzuty.patch.test.ts` — pola edytowalne, audyt, przeliczanie (18 testów).

**Zmienione**
- `rebuild/backend/src/import/akceptacja.ts` — komentarz „ŚWIADOMIE POMINIĘTE" zastąpiony
  realną gałęzią cenową, w tym samym miejscu i z tym samym `try/catch` co oryginał.
- `rebuild/backend/src/app.ts` — rejestracja `trasyNarzutow` i `trasyPromocji`.
- `rebuild/backend/src/repos/suppliers.ts` — `odsiejPolaEdytowalne` deleguje do wspólnego
  `odsiejPola` (DRY); nazwa, sygnatura i zachowanie bez zmian.
- `rebuild/backend/test/charakteryzacja/akceptacja/scenariusze.mjs` — fabryki `narzut()`
  i `promocja()` + 13 scenariuszy z regułami cenowymi.
- `rebuild/backend/test/charakteryzacja/akceptacja/scenariusze.d.mts` — pola `narzuty`/`promocje`.
- `rebuild/backend/test/akceptacja.charakteryzacja.test.ts` — zasiew obu tabel, porównanie ich
  stanu po przebiegu, rozszerzona lista wymaganych scenariuszy, **kontrola negatywna**.
- `rebuild/backend/test/gate/dane.ts` — `zasiejNarzutyZFixtures`, `PROMOCJA_TESTOWA`,
  `zasiejPromocjeTestowa`.

## Odstępstwa od planu

Brak. Wszystkie pięć decyzji (D1–D5) zrealizowane jak zapisano.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.**
  - `GET /api/markups` ↔ `contract/fixtures/GET_markups.json` — kształt 1:1, komplet
    11 kluczy, goła tablica, `warunki` jako string z JSON-em.
  - `GET /api/promotions` ↔ `contract/fixtures/GET_promotions.json` — `[]`, 200.
  - Walidacja względem `contract/openapi.yaml` na obu ścieżkach.
  - Wszystkie osiem operacji (`GET/POST/PATCH/DELETE` × markups/promotions) istnieje
    w kontrakcie i **wszystkie zwracają 401 bez tokenu** (odstępstwo D1 z I1, sprawdzone
    na każdej z ośmiu, nie tylko na wybranych).
  - ⚠ Ograniczenie nazwane w teście: kształt WIERSZA promocji nie jest pokryty żadnym
    nagraniem (fixture jest pusty) — sprawdzamy go względem schematu, i to jest słabsze
    świadectwo niż przy narzutach.
- **Charakteryzacja importu (gate z 3d-2): ✓ zielona z regułami w tabelach.**
  33 testy, w tym 13 nowych scenariuszy cenowych. **Przydatność próby zmierzona, nie
  założona:** po tymczasowym wyłączeniu wpięcia w `akceptacja.ts` 10 z 13 nowych scenariuszy
  pada, a po przywróceniu wszystkie przechodzą. Trzy, które nie padają, to te celowo
  zaprojektowane tak, żeby gałąź się NIE wykonała (reguła nieaktywna, warunki niespełnione,
  zerowa cena zakupu). Dodatkowo w pliku jest kontrola negatywna, która sprawdza wynik
  na samym ORYGINALE — zapali się, gdyby kotwice w `oryginal.mjs` przestały łapać pomocników.
- **Unit (silnik cen): ✓ 34 testy** — formuła (`floor`, VAT, `marzaPct` jako procent narzutu),
  dopasowanie warunków, specyficzność bijąca priorytet, promocje po `zasieg` i `warunki`,
  wygasła promocja, próg zapisu, brak zmiany `status` w masowym przeliczeniu, filtr po id.
- **Integracyjne (pola edytowalne + audyt): ✓ 18 testów** — filtr na PATCH i POST, podpis
  zmiany od serwera, audyt logujący SUROWE ciało łącznie z odrzuconym polem, 404 przy
  narzucie, 200 z pustym ciałem przy promocji, DELETE bez 404, przeliczanie katalogu po
  każdej mutacji.
- **Cały pakiet: ✓ 522 testy w 33 plikach.** `npm run lint`, `npm run typecheck`,
  `npm run build` — czyste.

## Breaking changes

Brak dla istniejących klientów. Zmienia się natomiast **zachowanie importu w obecności reguł**:
dopóki tabele `markups`/`promotions` były puste, `acceptStaging` liczył cenę jako
`zakup × 1,25`. Po wpisaniu pierwszej reguły cenę ustala reguła — i **nadpisuje także
`cenaSprzedazyNowa` wpisaną ręcznie w stagingu**. To jest zachowanie produkcji, nie nasza
zmiana, ale do 4a było w odbudowie nieosiągalne, bo nie dało się wpisać reguły.

## Follow-up

Rzeczy świadomie odłożone, wszystkie zapisane w `docs/rebuild-backlog.md` i roadmapie:

1. **Silnik ignoruje daty promocji (`start`/`koniec`)** — wygasła promocja nadal obniża ceny.
   Port 1:1 (D4). Naprawa wymaga decyzji i wyjątku w charakteryzacji. Nowy wpis backlogu.
2. **`PATCH /api/promotions/{id}` nie ma 404** — oddaje 200 z pustym ciałem dla nieistniejącego
   id, w odróżnieniu od bliźniaczej trasy narzutów. Port 1:1 (D5). Nowy wpis backlogu
   + nota dla sesji 4b.
3. **Rozjazd zapisu i audytu** — audyt loguje surowe `c.body`, zapis idzie przez filtr pól,
   więc dziennik może opisywać pole, które nie zostało zapisane. Świadomie wprowadzone (D2),
   do dopisania przy backlogu #14.
4. **`addProductsBulk` + `POST /api/products`** — gałąź cenowa czeka na Iterację 12; 4a
   zostawia gotową funkcję `zastosujRegulyCenowe` i wymóg wpisany DO BLOKU I12.
5. **`recalcPricesFromRules` przelicza cały katalog synchronicznie w handlerze HTTP** —
   przy ~7 400 produktach każda mutacja reguły to pełny skan. Tak działa produkcja, więc
   port 1:1; gdyby to zaczęło boleć, jest to kandydat na osobny ticket wydajnościowy.
6. **Roadmapa pisała „PUT /api/markups/{id}"** — jest `PATCH` (oryginał `:48699` + openapi).
   Sprostowane w Fazie 5.

## Review fixes applied

**SHOULD-FIX (naprawione)** — `src/routes/markups.ts`: `PATCH /api/markups/{id}` z nienumerycznym
`id` skracał drogę przez `Number.isNaN` i oddawał 404 BEZ wywołania `przeliczCenyZRegul`.
Oryginał (`:48699-48710`) tego nie robi: leci `UPDATE … WHERE id = NaN` (zero wierszy —
sprawdzone, `better-sqlite3` przyjmuje NaN i po prostu nic nie dopasowuje), po nim
`recalcPricesFromRules()` na całym katalogu, i dopiero odczyt wiersza daje 404. Przeliczenie
było więc obserwowalnym skutkiem, który port po cichu gubił — nieudokumentowane odstępstwo.
Skrót usunięty, dopisany test regresyjny („nienumeryczne id: 404, ale katalog i tak zostaje
przeliczony") mierzący cenę produktu po takim żądaniu.

**NICE-TO-HAVE** — oba przyjęte bez zmian w kodzie: brak wpisów w `rebuild-backlog.md`
i `rebuild-roadmap.md` to zaplanowana Faza 5 (doc-checker), a współdzielona `cenaSprzedazyZRegul`
jest świadomym DRY zgodnym z planem (ta sama kolejność mnożeń co w oryginale, wynik identyczny).

Po poprawce: `lint`, `typecheck`, `build` czyste, **523 testy w 33 plikach** zielone.

## Docs updates

### `docs/rebuild-roadmap.md`
- Tablica postępu §4: Iteracja 4 rozbita na sesje `4a BE · 4b FE`, status `⬜ → 🔨`, PR/data
  wskazuje ticket `15-FEATURE-narzuty-promocje-ceny` · 2026-09-02.
- **Cały blok „Iteracja 4" przepisany** i rozbity na 4a (✅ zrobione) i 4b (⬜ nie zaczęte),
  wzorem struktury sesji z Iteracji 3.
- **Usunięty błąd roadmapy:** „PUT/DELETE /api/markups/{id}" → **PATCH**, z dowodem
  (`:48699`/`:48722` + `openapi.yaml:739-751`/`:901-913`).
- Trzy nieaktualne ostrzeżenia przepisane na fakty: zaległość z I3 (domknięta dla
  `acceptStaging`), PATCH zapisujący całe ciało (listy pól), audyt (loguje `c.body` w całości —
  niespójności dostawców tu nie ma).
- **Noty dla przyszłych sesji trafiły DO ICH BLOKÓW** (zasada 2 z `CLAUDE.md`):
  - **blok 4b** — sześć pułapek portu 1:1: brak 404 w `PATCH /api/promotions/{id}`, ignorowane
    daty promocji, `aktywna` vs `aktywny`, `warunki` jako string JSON, gołe tablice w `GET`,
    koszt synchronicznego przeliczania całego katalogu;
  - **blok I12** — jawny wymóg wywołania gotowej `zastosujRegulyCenowe` przy porcie
    `addProductsBulk`, wraz z zapisem decyzji D1 i jej uzasadnieniem (graf wywołań: jedyne
    wywołanie `addProductsBulk` to nieportowana trasa `:48308`).
- Iteracja 2: „Dane kolumny «Promocja»" przekierowane z `I4` na `I4b`.
- Iteracja 3 (blok 3d-2 i sekcja „co zostaje otwarte"): dopisane domknięcie w 4a.

### `docs/rebuild-backlog.md`
- **Wpis #14** zaktualizowany (6 edycji): status `⬜ narzuty/promocje (I4)` →
  `✔ naprawione w rebuild (4a, 2026-09-02)`; tabela tras oznaczona; akapit o Iteracji 4
  przepisany z zamiaru na stan (nazwy list pól, odcięte kolumny, plik testów).
  Dopisane dwie rzeczy: filtr działa także na **POST** (różnica wobec dostawców) oraz
  **nowa niespójność wprowadzona świadomie przez 4a** — audyt loguje surowe ciało przy
  filtrowanym zapisie; zaznaczono, że to **odwrotność** sytuacji u dostawców (tam niespójność
  jest własnością oryginału, tu jest nasza i jest ceną naprawy).
- **Nowy wpis #19** — silnik cen ignoruje daty promocji (`start`/`koniec` nigdy nie czytane);
  wygasła promocja obniża ceny w nieskończoność; port 1:1, naprawa ⬜ do decyzji.
- **Nowy wpis #20** — `PATCH /api/promotions/{id}` bez 404 wobec bliźniaczej trasy narzutu,
  która 404 ma; port 1:1 + nota dla sesji 4b.
- Reszta pliku przegrepowana (`markup|promoc|narzut|recalcPrices|cena_sprzedazy|I4`) — poza
  #14 nic nieaktualnego.

### `docs/spec-backend.md`
- §2: dopisane potwierdzenie, że osiem tras narzutów/promocji stoi za `requireAuth` mimo
  `security: []` w openapi (ten sam wzorzec D1 co produkty/staging).
- §6: „narzuty i promocje czekają na Iterację 4" → „naprawione w Iteracji 4a", wraz
  z zastrzeżeniem D2 (audyt loguje surowe ciało, może pokazać pole niezapisane).

### `docs/spec-frontend.md`
- §5: nowy blok — widok `/narzuty` NIE jest zbudowany (4b), plus charakterystyka API,
  na której 4b musi się oprzeć (gołe tablice, `warunki` jako string, nazwy statusów,
  ignorowane daty, asymetria 404, synchroniczne przeliczanie katalogu).

### `docs/instrukcja-testow-I3.md`
- §3.6: zastrzeżenie, że „cena sprzedaży = zakup × 1,25" obowiązuje wyłącznie przy PUSTYCH
  tabelach `markups`/`promotions`; od 4a pasująca reguła ustala cenę i nadpisuje także
  `cenaSprzedazyNowa` wpisaną ręcznie w stagingu.
- §5 („Czego jeszcze NIE MA"): wiersz o narzutach/promocjach rozliczony — backend ✅ (4a),
  brakuje tylko widoku `/narzuty` (4b).

### Pre-existing issues
Żaden z trzech doc-checkerów nie znalazł zastanych nieścisłości poza zakresem tego ticketa.
