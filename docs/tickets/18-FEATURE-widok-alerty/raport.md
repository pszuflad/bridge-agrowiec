# 18-FEATURE-widok-alerty — raport z implementacji

## Podsumowanie

Iteracja 6 dowieziona: backend oddaje `GET /api/alerts` i `PATCH /api/alerts/{id}` (obie za
`requireAuth`), a widok `/alerty` listuje alerty **zwinięte w grupy** `(dostawca, typ, status)`
z licznikiem powtórzeń i czasem ostatniego wystąpienia, rozwijalne do pojedynczych wpisów.
Zmiana statusu idzie przez API — na całej grupie i na pojedynczym alercie, w obie strony.
Domyślny filtr `status = nowy` chowa 2127 wpisów „Synchronizacja", które w produkcji stanowią
83% tabeli.

Największe ustalenie ticketa: **oryginalny widok `/alerty` nie czytał `/api/alerts` w ogóle** —
liczył pseudo-alerty z `GET /api/products` i trzymał ich stan w IndexedDB. Budowa widoku na
realnych alertach importu jest więc świadomym odejściem od oryginału (D1), a nie portem UI.

## Zmiany

### Backend

- `rebuild/backend/src/repos/alerts.ts` — dopisane `listAlerts` (port `U.listAlerts`,
  `backend-index.cjs:44951`, `order by data desc`, bez limitu) i `updateAlertStatus` (port
  `:44957`), plus typ `Alert`. Sprostowany nagłówek `zapiszAlert`, który twierdził, że odczyt
  celowo nie powstaje w tym pliku — po tej iteracji to nieprawda.
- **Nowy:** `rebuild/backend/src/routes/alerts.ts` — `trasyAlertow({db})` z dwiema trasami.
  GET za `requireAuth` (odstępstwo D1 z I1, komentarz jak w `routes/overrides.ts`); PATCH
  odtworzony 1:1 wraz z tym, czego w nim NIE MA — bez 404, bez walidacji `status`, bez audytu.
- `rebuild/backend/src/app.ts` — import i montaż `trasyAlertow({ db })`.
- **Nowy:** `rebuild/backend/test/alerty.gate.test.ts` — 8 testów GATE.

### Frontend

- **Nowy:** `rebuild/frontend/src/pages/alerty/api.ts` — `pobierzAlerty` (pełna lista, bez
  limitu), `zmienStatusAlertu`, `zmienStatusAlertow` (zbiorczo, porcjami po 8 — kontrakt nie
  ma trasy masowej, a największa grupa w produkcji liczy 150 wpisów).
- **Nowy:** `rebuild/frontend/src/pages/alerty/grupowanie.ts` — `pogrupujAlerty`,
  `filtrujAlerty`, `wartosciFiltrow`, `sformatujOstatnia`, `FILTRY_POCZATKOWE`.
- **Nowy:** `rebuild/frontend/src/pages/alerty/TabelaAlertow.tsx` — lista grup z filtrami,
  rozwijaniem i mutacjami.
- **Nowy:** `rebuild/frontend/src/pages/Alerty.tsx` — `PageHeader` + tabela.
- `rebuild/frontend/src/App.tsx` — trasa `/alerty` wpięta w `Switch`.
- `rebuild/frontend/src/pages/placeholdery.ts` — wpis `/alerty` zdjęty, komentarz zaktualizowany.
- `rebuild/frontend/test/msw/kontrakt.ts` — `alertyZFixtura()` z notą o ograniczeniu nagrania
  (pięć wierszy, zero powtórek).
- **Nowe:** `rebuild/frontend/test/alerty.grupowanie.test.ts` (18 testów),
  `rebuild/frontend/test/alerty.test.tsx` (13 testów).

## Odstępstwa od planu

Brak — zakres i wszystkie decyzje D1–D9 zrealizowane 1:1 z `plan.md`. Jedyna korekta w trakcie
dotyczyła danych testowych, nie kodu produkcyjnego: pierwsza wersja asercji o kolejności grup
zakładała, że najświeższa jest „Synchronizacja", podczas gdy w wygenerowanym zbiorze ostatnia
próba MO3 wypada później; asercja została zastąpiona sprawdzeniem pełnej kolejności trzech grup.

## Decyzja „lokalnie vs przez API" (wymóg DoD)

**Przez API** (D3). `PATCH /api/alerts/{id}` jest jedynym źródłem prawdy o statusie alertu —
żadnego IndexedDB ani `localStorage`, mimo że oryginał trzymał obsługę pseudo-alertów właśnie
w IndexedDB (`fe.js:9165-9193`, klucz `alerty-statusy`).

Powód: alert zamknięty na jednym urządzeniu ma być zamknięty na każdym, a stan lokalny znika
przy wyczyszczeniu danych przeglądarki. Backend i tak ma tę trasę od zawsze — trzymanie stanu
lokalnie oznaczałoby, że kolumna `alerts.status` żyje własnym życiem obok UI. Koszt: każda
zmiana to request, a akcja na grupie to N requestów (stąd dławik równoległości).

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.** Sprawdzone ścieżki: `GET /api/alerts`
  (`contract/openapi.yaml:63-70`) przeciwko `contract/fixtures/GET_alerts.json` — kształt 1:1
  (goła tablica, 7 pól w każdej pozycji), kolejność `data` MALEJĄCO identyczna z nagraniem,
  walidacja względem kontraktu przez `sprawdzZgodnoscZKontraktem`; `PATCH /api/alerts/{id}`
  (`:71-84`) — 200 `{ok:true}`, 401 bez tokenu, oba kody zadeklarowane w kontrakcie.
  Fixture zasiewa bazę WPROST, bez tłumaczenia wartości.
  - ⚠ **Dla `PATCH` nie ma nagranej próbki** — `contract/fixtures/` nie zawiera pliku dla tej
    trasy. Jej kształt (`{ok:true}`, brak 404) stoi wyłącznie na kodzie oryginału
    `backend-index.cjs:48688-48691` i jest przypięty testami, żeby ta wiedza gdzieś żyła.
  - ⚠ **Świadomy rozjazd z kontraktem przy `GET`**: `openapi.yaml:67` deklaruje `security: []`
    (trasa publiczna) i wyłącznie kody 200/400. Wymagamy `requireAuth`, więc bez tokenu
    oddajemy 401 — kod spoza listy kontraktu. Test tego przypadku celowo **nie** woła
    `sprawdzZgodnoscZKontraktem`, z komentarzem: to jest odstępstwo D1, a nie zgodność.
- **Backend:** ✓ 611 testów / 37 plików (8 nowych). `lint`, `typecheck`, `build` czyste.
- **Frontend:** ✓ 309 testów / 20 plików (31 nowych). `lint`, `typecheck`, `build` czyste.
- **Integracyjne / E2E:** nie uruchamiane — ticket nie dotyka integracji z systemami
  zewnętrznymi ani przepływu wymagającego E2E; plan tego nie przewidywał.

Kluczowy test wymogu iteracji (`alerty.test.tsx`): 24 alerty ze statusem `nowy` renderują się
jako **2 wiersze grup**, a treść pojedynczych wpisów **nie jest obecna w DOM** przed
rozwinięciem — surowe renderowanie listy wywali ten test.

## Breaking changes

Brak. Nowe trasy i nowy widok; jedyna zmiana istniejącego zachowania to zdjęcie placeholdera
`/alerty` (widok „w przygotowaniu" zastąpiony realnym ekranem). Liczba tras routera bez zmian.

## Follow-up

1. **Pseudo-alerty katalogowe z oryginału** (marża ujemna, niska marża, „nie-opona";
   `fe.js:25177-25340` + `pv()` `:16631-16705`) — świadomie nieportowane (D1). Wpis do
   `docs/rebuild-backlog.md` jako ⬜ do decyzji: czy w ogóle je odtwarzamy, a jeśli tak, to
   pod jakim adresem — mieszanie ich z alertami importu na jednym ekranie jest mylące.
2. **Wyszukiwarka po treści `opis`** — odrzucona przez użytkownika w Q&A (D8). Bez niej
   odróżnienie błędu sieci od błędu parsera wewnątrz typu „Błąd pobierania" wymaga rozwinięcia
   grupy i przeczytania wpisów.
3. **Rozmiar odpowiedzi `GET /api/alerts`** — 1:1 bez limitu (D9). Dziś ~3000 wierszy; po
   włączeniu schedulera z 3f-3 (120 pobrań/dobę) tabela rośnie o ~120 wpisów dziennie, więc
   za rok będzie ich ~45 tys. Wtedy potrzebna będzie decyzja: limit czasowy w zapytaniu albo
   agregacja po stronie backendu. Nie w tej iteracji — zmieniłaby kontrakt.
4. **Brak fixture'a dla `PATCH /api/alerts/{id}`** — warto go nagrać przy najbliższej okazji
   kontaktu z żywą produkcją, żeby GATE dla tej trasy przestał stać na samym kodzie oryginału.
