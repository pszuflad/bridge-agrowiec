# 18-FEATURE-widok-alerty — Iteracja 6: odczyt i obsługa alertów

> Status: Draft → Approved → Implemented → Shipped
> Branch: `feature/18-widok-alerty`
> Worktree: `.worktrees/18-FEATURE-widok-alerty`

## Opis ticketa

Realizacja **Iteracji 6 — Alerty** wg `docs/rebuild-roadmap.md` §5. Jedna sesja BE+FE.

> CEL (Ania klika): otwiera `/alerty`, widzi i obsługuje alerty (zmiana statusu).
>
> ZAKRES — TYLKO ODCZYT + ZMIANA STATUSU (pisanie alertów NIE należy tu — robi je import,
> bloki 3f):
> - Backend: `GET /api/alerts`, `PATCH /api/alerts/{id}` (`Ki`). Za `requireAuth`.
>   Repo `src/repos/alerts.ts` JUŻ ISTNIEJE (z 3f-1: `zapiszAlert` + typy
>   `PoziomAlertu`/`StatusAlertu`) — DOPISZ do niego `listAlerts` i `updateAlertStatus`,
>   NIE twórz drugiego pliku.
> - Frontend: widok `/alerty`, wpięty w istniejący shell/router.
>
> ⭐ NAJWAŻNIEJSZE — WIDOK MUSI ZWIJAĆ POWTÓRKI. Import pisze alert przy KAŻDEJ nieudanej
> próbie, bez dławika (liczba powtórzeń = sygnał diagnostyczny — świadoma decyzja z 3f-2).
> Skala zmierzona w `db/snapshot.db`: 339× „Błąd pobierania" (MO3: 150, MO5: 102, MO4: 83,
> MO2: 4) wobec 4× „Błąd HTTP" i 2127× „Synchronizacja"; do 23 alertów/dobę dla jednego
> dostawcy. Surowa lista jest bezużyteczna. WYMÓG: grupuj po (dostawca, typ, status) →
> „MO3 — Błąd pobierania, 23 razy, ostatnio 14:45", z rozwinięciem do pojedynczych wierszy.
>
> Uwaga: typ „Błąd pobierania" obejmuje TAKŻE błędy parsera (jeden blok `catch` w oryginale,
> `:48100`) — przyczyna jest w `opis`, nie w `typ`. NIE „naprawiaj" tego zmianą typu przy
> zapisie — to port 1:1, widok ma się dostosować.
>
> DECYZJA (spec-frontend §4): status/obsługa lokalnie czy przez API → rekomendacja: przez API.
>
> POZA ZAKRESEM: pisanie alertów (import — zrobione); `/api/audit-log` jako osobny widok (I12).
>
> GATE: `GET /api/alerts` + `PATCH /api/alerts/{id}` zgodne z fixtures/openapi (kształt 1:1);
> widok ZWIJA powtórki (test na danych z powtórkami); lint/typecheck/build czyste.

## Kontekst (ustalenia researchu)

### Backend oryginału — dwie linijki, zero niespodzianek

`deminified/backend-index.cjs:48688-48691`:

```js
e.get("/api/alerts", (c, u) => u.json(U.listAlerts())),
e.patch("/api/alerts/:id", we, (c, u) => {
  U.updateAlertStatus(parseInt(c.params.id), c.body.status), u.json({ ok: !0 })
})
```

Repo (`:44951-44961`):

```js
listAlerts() { return X.select().from(Ki).orderBy(Ii(Ki.data)).all() },   // Ii = desc
updateAlertStatus(t, e) { X.update(Ki).set({ status: e }).where(se(Ki.id, t)).run() },
```

Z tego wynika komplet zachowań do odtworzenia:

- **GET** jest w oryginale **PUBLICZNY** (brak `we`) — zgodne z `contract/openapi.yaml:67`
  (`security: []`). `select * from alerts order by data DESC`, **bez LIMIT i bez paginacji**.
  Fixture `GET_alerts.json` ma `"_body_przyciete_z": 3042` — to przycięcie NAGRYWARKI, nie
  limit API; produkcja zwraca wszystkie wiersze gołą tablicą.
- **PATCH** ma `we` (auth), przyjmuje `{status}` jako **dowolny string** (kolumna `alerts.status`
  nie ma `CHECK`), **zawsze** zwraca `{ok:true}` — także dla nieistniejącego `id` (brak 404),
  i **nie pisze do `audit_log`** (odwrotnie niż `PATCH /api/overrides|markups`).
- Innych tras alertów oryginał nie ma (brak DELETE, brak akcji masowej).

Kształt wiersza (`contract/fixtures/GET_alerts.json`, `rebuild/schema/001_schema.sql:122-130`,
`rebuild/backend/src/db/schema.ts:152-160`) — 7 pól, zgodne we wszystkich trzech źródłach:
`id:number, poziom:string, typ:string, opis:string, dostawca:string|null, status:string,
data:string (ISO 8601)`.

### Jakie dane realnie są w bazie

`db/snapshot.db` (2562 wiersze; fixture to nowsza migawka, id do 3042) — tylko **cztery**
kombinacje `(typ, poziom, status)`:

| typ | poziom | status | ile |
|---|---|---|---|
| Synchronizacja | info | rozwiazany | 2127 |
| Błąd pobierania | ostrzezenie | nowy | 339 |
| Ręczny upload | info | rozwiazany | 92 |
| Błąd HTTP | ostrzezenie | nowy | 4 |

`poziom: "krytyczny"` i `status: "przejrzany"` **nie występują nigdy** — mimo że operuje nimi
stary widok (patrz niżej). Rozkład „Błędu pobierania" po dostawcy: MO3 150, MO5 102, MO4 83,
MO2 4.

### ⚠ Oryginalny widok `/alerty` NIE czyta `/api/alerts`

Kluczowe ustalenie tego ticketa. `HT()` (`deminified/frontend-index.js:25177-25340`) pobiera
`GET /api/products` i wylicza **pseudo-alerty katalogowe** (`pv()`, `:16631-16705`): marża
ujemna, niska marża, „nie-opona". Status obsługi trzyma w **IndexedDB** (`cn/un`, `:9165-9193`,
klucz `alerty-statusy`) i operuje poziomem `krytyczny` oraz statusem `przejrzany`, których
backend nigdy nie produkuje. `02_WIDOKI.md` §/alerty pkt 6 potwierdza: „Nie potwierdzono
w komponencie wywołania `/api/alerts`, mimo że backend obsługuje GET/PATCH tej trasy".

Czyli decyzja „lokalnie vs przez API" ze `spec-frontend.md` §4 **nie jest niuansem stanu** —
to wybór innego zestawu danych. Budowa widoku na `/api/alerts` jest ŚWIADOMYM ODEJŚCIEM od
oryginału (decyzja D1 niżej), a nie portem UI. Skutkiem jest też to, że **nie ma layoutu
do skopiowania 1:1** — kolumny i filtry projektujemy pod realny kształt danych.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

| Ścieżka (openapi) | Fixture | Uwagi |
|---|---|---|
| `GET /api/alerts` (`contract/openapi.yaml:63-70`) | `contract/fixtures/GET_alerts.json` | Goła tablica, 7 pól/wiersz, `order by data DESC`, bez limitu. Zasiew testu WPROST z fixture'a. |
| `PATCH /api/alerts/{id}` (`contract/openapi.yaml:71-84`) | **brak nagranej próbki** | Kształt odpowiedzi (`{ok:true}`) i kody (200/401) potwierdzone wyłącznie kodem oryginału `:48688-48691`. GATE opiera się tu na kontrakcie + kodzie, nie na fixture. |

Znane rozjazdy i sposób rozstrzygnięcia:

1. **`openapi.yaml:67` mówi `security: []` dla GET, ticket każe `requireAuth`.** To nie jest
   nowy konflikt: rebuild ma od I1 zasadę `requireAuth` na wszystkich trasach danych,
   z identycznym precedensem przy `GET /api/overrides` (`routes/overrides.ts`, komentarz
   „ODSTĘPSTWO ŚWIADOME (D1)"), `GET /api/markups` i `GET /api/history*`. Kontynuujemy
   i oznaczamy tym samym komentarzem. Kształt odpowiedzi bez zmian.
2. **`_body_przyciete_z: 3042`** — porównanie z fixture'em dotyczy KSZTAŁTU i kolejności,
   nie liczby wierszy produkcji; test zasiewa dokładnie te wiersze, które są w pliku.
3. **`spec-frontend.md` §4** („status/obsługa trzymane lokalnie") opisuje stan faktyczny
   oryginału, ale mylnie sugeruje, że chodzi o miejsce przechowywania statusu tych samych
   alertów. Doc-checker prostuje ten zapis (Faza 5).

## Decyzje

Wszystkie z rundy Q&A z użytkownikiem (2026-09-03).

- **D1 (ODSTĘPSTWO ŚWIADOME) — widok stoi wyłącznie na `/api/alerts`.** Pseudo-alerty
  katalogowe z `HT()`/`pv()` (marża ujemna, niska marża, „nie-opona") **nie są portowane**.
  Za: Ania dostaje to, co realnie boli — błędy importu; przeciw: to nowa funkcja pod starym
  adresem. Pominięcie zostaje odnotowane jako **nowy wpis w `docs/rebuild-backlog.md`
  (⬜ do decyzji)**, żeby wiedza o porzuconej funkcji nie zginęła.
- **D2 (ODSTĘPSTWO ŚWIADOME, precedens I1/D1) — `requireAuth` na `GET /api/alerts`**, mimo że
  oryginał i `openapi.yaml` mają tę trasę publiczną. Kontynuacja zasady z I1; kształt bez zmian.
- **D3 — obsługa alertu idzie PRZEZ API, nie lokalnie.** `PATCH /api/alerts/{id}` jest jedynym
  źródłem prawdy o statusie; żadnego IndexedDB/localStorage. Za: spójność stanu między
  przeglądarkami i sesjami, backend i tak ma tę trasę; przeciw: każda zmiana to request.
  (To odpowiedź na pytanie postawione w `spec-frontend.md` §4 i w roadmapie.)
- **D4 — PATCH odtworzony 1:1**: bez `audit_log`, bez walidacji enuma `status`, zawsze
  `{ok:true}` (także dla nieistniejącego `id`, bez 404). Za: brak fixture'a dla PATCH sprawia,
  że kod oryginału jest jedynym wzorcem — każde „ulepszenie" byłoby zgadywaniem; przeciw:
  literówka w statusie zapisze się po cichu. Świadomie przyjęte.
- **D5 — grupowanie: domyślnie WSZYSTKO zwinięte.** Grupa = klucz (`dostawca`, `typ`, `status`);
  wiersz grupy pokazuje etykietę, licznik i znacznik ostatniego wystąpienia
  („MO3 — Błąd pobierania · 23× · ostatnio 14:45"). Klik rozwija pojedyncze wpisy. Grupa
  jednoelementowa renderuje się jako zwykły wiersz **bez strzałki rozwijania**. Grupy sortowane
  po dacie ostatniego wystąpienia MALEJĄCO — zgodnie z `order by data DESC` z backendu.
- **D6 — akcje statusu: na grupie ORAZ na pojedynczym wpisie, w obie strony** (`nowy` ↔
  `rozwiazany`). Akcja grupowa = N równoległych `PATCH`-y (kontrakt nie ma trasy masowej),
  z **ograniczoną równoległością** (patrz plan, krok B4) — zamknięcie grupy MO3 to 150 żądań.
- **D7 — domyślny filtr: `status = nowy`.** Ania po wejściu widzi wyłącznie niezamknięte awarie;
  2127 „Synchronizacja" (info/rozwiazany) jest schowane za zdjęciem filtra. Zgodne również
  z oryginałem, którego dashboard filtrował alerty po statusie `nowy` (`02_WIDOKI.md` §/ pkt 5).
- **D8 — filtry: `status`, `dostawca`, `typ`.** Wartości list wyliczane z pobranych danych
  (nie zaszyte na sztywno), żeby nowy typ alertu z importu pojawił się sam.
  **Szukajka po `opis` ODRZUCONA** przez użytkownika — rozróżnienie „błąd sieci vs błąd
  parsera" wewnątrz typu „Błąd pobierania" pozostaje widoczne dopiero po rozwinięciu grupy,
  w treści `opis`. Odnotowane jako follow-up.
- **D9 — `GET /api/alerts` bez limitu, 1:1.** Goła tablica wszystkich alertów; grupowanie
  i tak potrzebuje kompletu, a obcięty zbiór kłamałby licznikami („23×" zamiast „150×").
  Wzrost odpowiedzi po włączeniu schedulera (3f-3, 120 pobrań/dobę) → follow-up, nie ten ticket.

## Plan implementacji

### A. Backend

**A1. `rebuild/backend/src/repos/alerts.ts` — DOPISAĆ (nie tworzyć drugiego pliku).**
- `export type Alert = { id, poziom, typ, opis, dostawca, status, data }` — typ wiersza
  zwracanego przez API (7 pól, kolejność jak w fixture).
- `listAlerts(db): Alert[]` — port `U.listAlerts` (`:44951`): `select * from alerts
  order by data desc`. Bez limitu (D9).
- `updateAlertStatus(db, id, status): void` — port `U.updateAlertStatus` (`:44957`):
  `update alerts set status = ? where id = ?`. Zwraca `void`, **nie sprawdza istnienia
  wiersza** (D4) — komentarz musi to nazwać wprost, żeby nie wyglądało na przeoczenie.
- Zaktualizować nagłówkowy komentarz `zapiszAlert`, który dziś mówi „Odczyt (`listAlerts`,
  `updateAlertStatus`) należy do Iteracji 6 i celowo nie powstaje tutaj" — po tym ticketcie
  to zdanie jest nieprawdą.

**A2. `rebuild/backend/src/routes/alerts.ts` — NOWY.**
Wzorzec: `routes/overrides.ts`. `export function trasyAlertow({ db }: ZaleznosciAlertow): Router`.
- `GET /api/alerts` + `requireAuth` (D2, komentarz „ODSTĘPSTWO ŚWIADOME (D1)" jak w overrides)
  → `res.json(listAlerts(db))`.
- `PATCH /api/alerts/:id` + `requireAuth` → `updateAlertStatus(db, parseInt(id,10), String(body.status))`,
  `res.json({ ok: true })`. Bez audytu, bez walidacji, bez 404 (D4) — komentarz z powodem
  i wskazaniem, że overrides/markups audytują, a ta trasa świadomie nie.

**A3. `rebuild/backend/src/app.ts`** — `import { trasyAlertow }` + `app.use(trasyAlertow({ db }))`
w bloku pozostałych tras (obok `trasyOverrides`).

### B. Frontend

**B1. `rebuild/frontend/src/pages/alerty/api.ts` — NOWY.** Wzorzec: `pages/narzuty/api.ts`.
- `export type Alert` (7 pól, komentarz: kształt z `GET_alerts.json`).
- `pobierzAlerty(): Promise<Alert[]>` — `fetch` + `naglowki(false)` + `credentials:"include"`
  + `rzucGdyBlad` (własny `fetch`, nie domyślny `queryFn`, bo widok musi odróżnić pustą listę
  od braku sesji — dokładnie jak `pobierzNarzuty`).
- `zmienStatusAlertu(id, status): Promise<void>` — `zadanie("PATCH", `/api/alerts/${id}`, {status})`.
  Odpowiedź `{ok:true}` nie niesie informacji, więc `void`.

**B2. `rebuild/frontend/src/pages/alerty/grupowanie.ts` — NOWY, czysta logika (testowalna bez DOM).**
- `type GrupaAlertow = { klucz: string; dostawca: string|null; typ: string; status: string;
  poziom: string; liczba: number; ostatnia: string; wpisy: Alert[] }`.
- `pogrupujAlerty(alerty: Alert[]): GrupaAlertow[]` — klucz `(dostawca, typ, status)`;
  `liczba` = długość, `ostatnia` = maksymalna `data` w grupie; wpisy posortowane `data` DESC;
  grupy posortowane po `ostatnia` DESC (D5). `poziom` brany z najnowszego wpisu grupy
  (poziom jest funkcją typu w praktyce, ale nie ma na to gwarancji schematu).
- `filtrujAlerty(alerty, { status, dostawca, typ })` — `null`/`""` = brak filtra (D8).
- `wartosciFiltrow(alerty)` — unikalne, posortowane listy `status`/`dostawca`/`typ` z danych.

**B3. `rebuild/frontend/src/pages/alerty/TabelaAlertow.tsx` — NOWY.**
Wzorzec: `pages/narzuty/TabelaNarzutow.tsx` (react-query `useQuery`/`useMutation`,
`queryClient.invalidateQueries`, toast na błędzie).
- `useQuery({ queryKey: ["/api/alerts"], queryFn: pobierzAlerty })`.
- Stan lokalny: filtry (start: `status: "nowy"` — D7) + `Set` rozwiniętych kluczy grup.
- Render: nagłówek grupy (ikona poziomu, „`dostawca` — `typ`", badge statusu, `N×`,
  „ostatnio HH:MM" dla dziś / pełna data wcześniej), przycisk akcji; po rozwinięciu — wiersze
  z `data`, `opis` i akcją pojedynczą.
- `data-testid` na grupie, wierszu i akcjach (spójnie z resztą widoków).

**B4. Mutacje.** `useMutation` dla pojedynczego wpisu oraz dla grupy. Grupa: `PATCH` dla
każdego `id` z **limitem równoległości** (prosta pętla po porcjach, np. 8 naraz — 150 żądań
na raz zapchałoby połączenie i przeglądarkę). Po zakończeniu jedna `invalidateQueries`,
jeden toast z podsumowaniem („Oznaczono 23 alerty jako rozwiązane"). Błąd choćby jednego
żądania → toast błędu, i tak invalidacja (część mogła przejść).

**B5. `rebuild/frontend/src/pages/Alerty.tsx` — NOWY.** `PageHeader` + `TabelaAlertow`,
wzorzec `pages/Narzuty.tsx`.

**B6. Wpięcie w router.** `App.tsx`: import + `<Route path="/alerty" component={Alerty} />`;
`pages/placeholdery.ts`: usunąć wpis `/alerty` i zaktualizować komentarz nagłówkowy
(liczba tras routera bez zmian — dalej 12). Link w sidebarze (`components/nawigacja.ts:35`)
już istnieje, nic tam nie trzeba.

### Kolejność commitów

1. `18-FEATURE-widok-alerty: repo alertów — listAlerts i updateAlertStatus`
2. `18-FEATURE-widok-alerty: trasy GET/PATCH /api/alerts + montaż w app`
3. `18-FEATURE-widok-alerty: GATE — fixtures i kontrakt dla alertów`
4. `18-FEATURE-widok-alerty: klient API i logika grupowania alertów`
5. `18-FEATURE-widok-alerty: widok /alerty z grupowaniem powtórek`
6. `18-FEATURE-widok-alerty: testy widoku i grupowania`

## Strategia testów

**GATE odbudowy — `rebuild/backend/test/alerty.gate.test.ts`** (wzorzec:
`test/overrides.gate.test.ts`, harness `test/gate/index.ts`):
- zasiew tabeli `alerts` WPROST z `contract/fixtures/GET_alerts.json`;
- `GET /api/alerts` → `sprawdzZgodnoscZKontraktem` + `sprawdzZgodnoscZFixture`;
- odpowiedź jest **gołą tablicą** (nie kopertą), każdy wiersz ma dokładnie 7 kluczy;
- **kolejność jest częścią kontraktu**: `data` malejąco, identyczna sekwencja `id` jak w pliku;
- `GET` bez tokenu → 401 (dowód na D2);
- `PATCH /api/alerts/{id}` → 200 `{ok:true}`, status w bazie zmieniony;
- `PATCH` dla **nieistniejącego id** → 200 `{ok:true}`, brak 404 (dowód na D4);
- `PATCH` bez tokenu → 401 (jak w oryginale, `we`).

**Backend, jednostkowo** — pokryte przez GATE (repo to dwa zapytania); osobnych testów repo
nie dublujemy.

**Frontend, jednostkowo — `rebuild/frontend/test/alerty.grupowanie.test.ts`:**
- **test na danych z powtórkami (wymóg GATE ticketa)**: zbiór odwzorowujący realny rozkład
  (MO3 × wiele „Błąd pobierania"/nowy + pojedyncze „Synchronizacja") → oczekiwana liczba grup
  ≪ liczba alertów, poprawne `liczba`/`ostatnia`, kolejność grup po `ostatnia` DESC;
- rozdzielenie po statusie: te same (dostawca, typ) z różnym `status` = **osobne** grupy;
- `dostawca: null` nie wywala grupowania i daje własną grupę;
- filtry + `wartosciFiltrow`.

**Frontend, komponent — `rebuild/frontend/test/alerty.test.tsx`** (wzorzec `narzuty.test.tsx`,
`fetch` podmieniony na poziomie `globalThis`):
- lista renderuje ZWINIĘTE grupy, nie surowe wiersze — przy 23 alertach jednego rodzaju
  widoczny jest jeden wiersz z „23×", a pojedyncze `opis`y **nie są** w DOM przed rozwinięciem;
- klik rozwija grupę i pokazuje wpisy;
- domyślny filtr `status=nowy` — „Synchronizacja"/rozwiązany niewidoczna po wejściu (D7);
- akcja na grupie wysyła `PATCH` dla każdego `id` grupy; akcja na wierszu — jeden `PATCH`.

Czego **nie** testujemy: renderu `PageHeader`/sidebara (pokryte `shell.test.tsx`), stylowania.

**Bramki:** `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`
w `rebuild/backend/` i `rebuild/frontend/`.

## Poza zakresem

- **Pisanie alertów** — robi je import (bloki 3f-1/3f-2, zamknięte).
- **Port pseudo-alertów katalogowych** z `HT()`/`pv()` (marża ujemna, niska marża, „nie-opona")
  — świadomie pominięty (D1), trafia do backlogu jako ⬜ do decyzji.
- **`/api/audit-log` jako osobny widok** — Iteracja 12.
- **Wyszukiwarka po treści `opis`** — odrzucona przez użytkownika (D8), follow-up.
- **Paginacja / limit na `GET /api/alerts`** — 1:1 bez limitu (D9), follow-up przy schedulerze.
- **Zmiana typu alertu przy zapisie** („Błąd pobierania" obejmuje błędy parsera) — zakazana
  wprost przez roadmapę i `rebuild-backlog.md` #16.

## Definition of done

- [ ] `GET /api/alerts` zwraca gołą tablicę 7-polowych wierszy, `data` DESC, bez limitu —
      zgodne 1:1 z `contract/fixtures/GET_alerts.json` i `contract/openapi.yaml`.
- [ ] `PATCH /api/alerts/{id}` zwraca `{ok:true}` (także dla nieistniejącego id), zmienia
      status w bazie, wymaga auth, nie pisze do `audit_log`.
- [ ] Obie trasy za `requireAuth`; brak tokenu → 401.
- [ ] `listAlerts` i `updateAlertStatus` dopisane do ISTNIEJĄCEGO `src/repos/alerts.ts`.
- [ ] Widok `/alerty` wpięty w router (placeholder zdjęty), listuje **ZWINIĘTE grupy**
      (dostawca, typ, status) z licznikiem i czasem ostatniego wystąpienia, rozwijalne do wpisów.
- [ ] Domyślny filtr `status = nowy`; filtry status/dostawca/typ działają.
- [ ] Zmiana statusu przez API, na grupie i na pojedynczym wpisie, w obie strony.
- [ ] Test na danych z powtórkami dowodzi zwijania (grup ≪ alertów).
- [ ] GATE fixtures/kontrakt zielony; lint/typecheck/build/test czyste w BE i FE.
- [ ] Decyzja „lokalnie vs API" (D3) zapisana w planie i raporcie; D1 wpisana do backlogu.
