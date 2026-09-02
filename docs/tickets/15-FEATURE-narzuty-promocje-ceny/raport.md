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
