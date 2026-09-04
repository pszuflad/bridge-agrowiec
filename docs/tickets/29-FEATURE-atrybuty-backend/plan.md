# 29-FEATURE-atrybuty-backend — Iteracja 7a: Atrybuty (backend)

> Status: Draft
> Branch: `feature/29-atrybuty-backend`
> Worktree: `.worktrees/29-FEATURE-atrybuty-backend`

## Opis ticketa

Realizacja Iteracji 7, sesja **7a (BACKEND)** wg `docs/rebuild-roadmap.md` §5 („Iteracja 7" —
cały blok + nota z 3e; §3). Frontend `/atrybuty` to osobna sesja 7b PO merge tej. Zależy od I2
(gotowe). Niezależny od I8 → bezpieczny do biegu równoległego.

**Cel:** komplet endpointów atrybutów (CRUD rodzajów/wartości + kolejka pending) za `requireAuth`,
gotowych pod natywny widok 7b.

**Poza zakresem (z promptu):** widok `/atrybuty`, naprawa martwych ścieżek `/api/attributes` (7b),
ożywianie martwego `GET /api/atrybuty` w `/staging` (nota z 3e — to byłaby nowa decyzja).

## Kontekst

Atrybuty NIE SĄ w rdzeniu backendu. `docs/spec-backend.md:31` mówi, że „6 tras usunięto z rdzenia
(06.08); Atrybuty rejestruje wyłącznie Extensions" — **potwierdzone grafem wywołań**:
`grep "'/api/atrybuty" mirror/backend/index.cjs` = 0 trafień. Klaster atrybutów w
`mirror/backend/index.cjs:295` (`ATTR_CORE_KINDS`, `listAtrybuty`, `upsertAtrybutRodzaj`…) jest
**martwy** — żadna trasa go nie rejestruje. Nie odtwarzamy go.

Żywe źródło to dwa moduły ładowane przez `mirror/backend/extensions.cjs:114,121`:

- **`mirror/backend/atrybuty_module.cjs`** (308 linii) — 11 tras: `/api/atrybuty`, rodzaje×4,
  wartosci×4, `liczniki`, `uzycie`, plus `ensureSchema()` i `seed()`.
- **`mirror/backend/pending_module.cjs`** (393 linie) — 7 tras pending + `scanForNewValues()`,
  `levenshtein()`/`similarity()`/`shouldSuggestAlias()` + hook na `POST /api/staging/accept`.

Oba dostają ctx `{we, be}`, gdzie **`we` to middleware auth** (`extensions.cjs:80,105`) —
czyli w produkcji WSZYSTKIE trasy atrybutów są już chronione. `requireAuth` w odbudowie jest
zatem odtworzeniem 1:1, **nie odstępstwem** (inaczej niż D1 z I1 dla promocji/narzutów).

`be` (audyt) dostaje tylko moduł atrybutów; `pending_module.cjs:199` destrukturyzuje wyłącznie
`we` — pending **nie loguje niczego** do audytu.

**Schemat bazy jest gotowy** — `rebuild/schema/001_schema.sql:215-256` ma komplet czterech tabel
(`atrybuty_rodzaje`, `atrybuty_wartosci` z `origin`+`utworzono`, `atrybuty_wartosci_pending`,
`atrybuty_wartosci_odrzucone`), a `rebuild/backend/src/db/schema.ts:263-329` ma ich definicje
Drizzle. **Nowa migracja NIE jest potrzebna**; `ensureSchema()` z oryginału nie jest portowane
(w produkcji były dwie rozjeżdżone definicje `atrybuty_wartosci`, kanon ma wersję zunifikowaną
z dumpu).

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**13 ścieżek / 18 operacji** w `contract/openapi.yaml:333-530`:

| # | Metoda + ścieżka | Fixture |
|---|---|---|
| 1 | `GET /api/atrybuty` | `GET_atrybuty.json` |
| 2 | `GET /api/atrybuty/liczniki` | `GET_atrybuty_liczniki.json` |
| 3 | `GET /api/atrybuty/uzycie` | `GET_atrybuty_uzycie.json` (400!) |
| 4 | `GET /api/atrybuty/rodzaje` | `GET_atrybuty_rodzaje.json` |
| 5 | `POST /api/atrybuty/rodzaje` | — |
| 6 | `PUT /api/atrybuty/rodzaje/{value}` | — |
| 7 | `DELETE /api/atrybuty/rodzaje/{value}` | — |
| 8 | `GET /api/atrybuty/wartosci` | `GET_atrybuty_wartosci.json` |
| 9 | `POST /api/atrybuty/wartosci` | — |
| 10 | `PUT /api/atrybuty/wartosci/{id}` | — |
| 11 | `DELETE /api/atrybuty/wartosci/{id}` | — |
| 12 | `GET /api/atrybuty/pending` | `GET_atrybuty_pending.json` |
| 13 | `DELETE /api/atrybuty/pending` | — |
| 14 | `POST /api/atrybuty/pending/{id}/akceptuj` | — |
| 15 | `POST /api/atrybuty/pending/{id}/akceptuj-jako-alias` | — |
| 16 | `POST /api/atrybuty/pending/{id}/akceptuj-z-edycja` | — |
| 17 | `POST /api/atrybuty/pending/{id}/odrzuc` | — |
| 18 | `POST /api/atrybuty/scan-pending` | — |

**Rozstrzygnięcie „13 vs 14 tras" z promptu:** nie ma sprzeczności. Ścieżek jest 13
(roadmapa `:1010` mówi „atrybuty×13" i to się zgadza), ale `/api/atrybuty/pending` ma DWIE
operacje: GET i DELETE. **`DELETE /api/atrybuty/pending` realnie istnieje**
(`pending_module.cjs:377-390` — dopisany po backupie `.bak_pre_clear_1784022259`, w którym go nie
ma) i **jest wołany przez UI** (`mirror/frontend/assets/pending-injection.js:990`). Wchodzi
w zakres 7a. Roadmapa `:1008` pomija go w wyliczeniu backendu — do poprawki w Kroku 13.

### Kształty odpowiedzi (1:1 z SQL-em oryginału)

1. **`GET /api/atrybuty`** (`atrybuty_module.cjs:103-111`) →
   `{ok, rodzaje:[{value,label,opis,core,utworzony}], wartosci:[{id,rodzaj,wartosc}]}`.
   `ORDER BY core DESC, label` / `ORDER BY rodzaj, wartosc`.
2. **`GET /api/atrybuty/rodzaje`** (`:114-121`) → `{ok, rodzaje:[{value,label,opis,core}]}` —
   **brak `utworzony` jest REALNY**, SELECT `:116` go nie pobiera. To NIE artefakt sanityzacji
   fixture'a; różnica pól między trasami 1 i 4 zostaje odtworzona dosłownie.
   `_przyciete.rodzaje:15` w fixture to marker rejestratora (`contract/README.md:29`), nie pole
   produkcji — harness i tak pomija klucze `_*` (`test/gate/ksztalt.ts:21`).
3. **`GET /api/atrybuty/wartosci?rodzaj=`** (`:185-196`) → `{ok, wartosci:[{id,rodzaj,wartosc}]}`;
   z `rodzaj` → `ORDER BY wartosc`, bez → `ORDER BY rodzaj, wartosc`.
4. **`GET /api/atrybuty/liczniki`** (`:270-286`) → **gołe body, BEZ `ok`** (`res.json(wynik)`):
   płaska mapa `"<rodzaj>::<wartosc>": <int>`. Liczone z `products`, per kolumna z mapy
   `RODZAJ_KOLUMNA` (`:251-267`, **15 wpisów**): `SELECT <kol> AS w, COUNT(*) FROM products
   WHERE <kol> IS NOT NULL AND <kol> != '' GROUP BY <kol>`. Wyjątek per kolumna połykany
   (`continue`).
5. **`GET /api/atrybuty/uzycie?rodzaj=&wartosc=`** (`:289-303`) → 200
   `{ok:true, count, products:[{dostawca,kod,nazwa,marka,rozmiar,stan}]}`, `ORDER BY nazwa
   LIMIT 200`, `count` z osobnego `COUNT(*)` **bez limitu**. Błędy verbatim:
   `400 {ok:false,error:"Nieznany rodzaj atrybutu: ${rodzaj}"}` i `400 {ok:false,error:"Brak wartosc"}`.
   Fixture nagrał ścieżkę błędu (rejestrator wołał bez parametrów → `…: undefined`) — gate
   sprawdza dokładnie ten kształt 400.
6. **`GET /api/atrybuty/pending?rodzaj=`** (`pending_module.cjs:218-250`) →
   `{ok, count, items:[{id,rodzaj,wartosc,ile_wystapien,pierwszy_import,ostatni_import,dostawcy,
   sugerowane_aliasy:[{wartosc,podobienstwo}]}]}`. `ORDER BY rodzaj, ile_wystapien DESC, wartosc`,
   **bez limitu/paginacji**, `count = items.length`.

### Znane rozjazdy i jak je rozstrzygamy

- **Roadmapa `:1008` pomija `DELETE /api/atrybuty/pending`** → wygrywa oryginał + kontrakt;
  trasa wchodzi w zakres, roadmapa do poprawki (Krok 13).
- **`docs/spec-backend.md` nie ma sekcji o atrybutach** (§5 to silnik `tk()`); jedyna wzmianka
  `:31` potwierdza, że atrybuty żyją wyłącznie w Extensions. Całe zachowanie pochodzi z oryginału.
- **`docs/spec-backend.md:192` „Atrybuty 11"** — inne cięcie (tylko `atrybuty_module.cjs`),
  pending liczony osobno. Nie jest to sprzeczność.
- **`docs/rebuild-backlog.md`** — ZERO wpisów dotyczących atrybutów/pending/aliasów
  (sprawdzone grepem). Nic do naniesienia.
- **Ostrzeżenie z `CLAUDE.md` o duplikatach funkcji NIE dotyczy tego zakresu** — zweryfikowane:
  `grep -c "function <nazwa>(" mirror/backend/index.cjs` = 0 dla `registerAtrybuty`,
  `registerPending`, `scanForNewValues`, `shouldSuggestAlias`, `similarity`, `levenshtein`;
  każda ma dokładnie jedną definicję we własnym module.
- **`id` wartości to zwykły AUTOINCREMENT** (`lastInsertRowid`, `:207-209`) — ostrzeżenie
  o generatorze `Lq` z `CLAUDE.md` tu nie ma zastosowania. Duże `id` w fixture (411058260 obok
  230887) to historia produkcji, nie hash.

## Decyzje

**D1 — Seed przy każdym starcie, 1:1** (Q&A, wariant A). Odtwarzamy `seed()`
(`atrybuty_module.cjs:61-84`), wołane w `registerAtrybuty:99` czyli przy budowie aplikacji:
6 rodzajów core (`INSERT OR IGNORE … core=1`), wartości `kategoria`/`konstrukcja`/`vfIf`
z `CORE_WARTOSCI`, wartości `marka` z `SELECT DISTINCT products.marka` oraz — **sic** —
wartości `bieznik` z `SELECT DISTINCT products.model`. Oba SELECT-y w `try/catch` (oryginał:
„products może nie istnieć w testach").
*Za:* wierność; seed realnie steruje wynikiem `scan-pending` i sugestiami aliasów (wartość
obecna w katalogu jest przy skanie pomijana). *Przeciw:* efekt uboczny przy starcie, powielamy
dziwactwo „bieżnik z modelu" — opisujemy je komentarzem, nie naprawiamy.

**D2 — Hook skanu po akceptacji stagingu: TAK, jawnym wywołaniem** (Q&A, wariant A).
Produkcja monkey-patchuje handler (`pending_module.cjs:145-192`, `res.on('finish')` + 2xx).
W odbudowie robimy to **jawnie**: po udanej `POST /api/staging/accept` w
`src/routes/staging-mutacje.ts:167` wołamy `skanujNoweWartosci(db)`.
*Za:* kolejka pending żyje jak w produkcji (bez tego Ania musiałaby klikać skan ręcznie);
jawne wywołanie zamiast grzebania w `router.stack` jest czytelne i testowalne.
*Przeciw:* ticket dotyka pliku z I3 — diff jest mały i izolowany.
**Różnica techniczna do odnotowania:** oryginał skanuje PO wysłaniu odpowiedzi (`finish`),
u nas skan pójdzie w tej samej obsłudze żądania, przed `res.json`. Skutek dla klienta:
odpowiedź przychodzi po skanie (nieco później), stan kolejki jest natomiast spójny od razu.
Odpowiedź i jej kształt bez zmian. Błąd skanu nie może wywrócić akceptacji — łapiemy go
i logujemy, jak oryginał (`:154-156`).

**D3 — GATE dla `liczniki`: nowa asercja „słownik dynamiczny"** (Q&A, wariant A).
Fixture ma **5348 dynamicznych kluczy** liczonych z konkretnych danych produkcji, a
`test/gate/ksztalt.ts:56-75` porównuje obiekty klucz-po-kluczu (brak/nadmiar = twardy błąd) —
dosłowne porównanie zapaliłoby ~5348 różnic. Dopisujemy do `test/gate/asercje.ts` asercję
`sprawdzZgodnoscZFixtureSlownika(...)`: każdy klucz odpowiedzi pasuje do `^<znany rodzaj>::`,
każda wartość to dodatni int, zbiór prefiksów-rodzajów zawiera się w zbiorze z fixture'a,
body NIE ma klucza `ok`. *Za:* gate realnie coś dowodzi. *Przeciw:* ~30 linii helpera.

**D4 — Audyt akcji pending: BEZ audytu, 1:1** (Q&A, wariant A). CRUD rodzajów/wartości pisze
audyt (`atrybut_rodzaj_dodano|zmieniono|usunieto`, `atrybut_wartosc_dodano|zmieniono|usunieto`),
pending — nie, mimo że `akceptuj-z-edycja` i `akceptuj-jako-alias` robią masowy `UPDATE products`.
Odnotowane jako świadoma luka produkcji w „Follow-up".

**D5 — `requireAuth` na wszystkich 18 operacjach to 1:1, nie odstępstwo.** Oryginał wpina `we`
(middleware auth) w każdą trasę obu modułów. W przeciwieństwie do I1/I2 nie ma tu żadnego
odstępstwa do odnotowania.

**D6 — Dwie ODDZIELNE mapy rodzaj→kolumna, odtworzone osobno.** `liczniki`/`uzycie` używają
`RODZAJ_KOLUMNA` (**15** rodzajów, `atrybuty_module.cjs:251-267`, w tym `model` i `zastosowanie`),
a scan i akceptacje pending — `RODZAJE_KOLUMNY` (**13** rodzajów, `pending_module.cjs:22-36`,
BEZ `model` i `zastosowanie` — dokładny podzbiór tamtej, `wentyl` jest w obu). Konsekwencja produkcyjna: dla wpisu pending
rodzaju `model`/`zastosowanie` `akceptuj-z-edycja` zwróciłby 400 — ale takie wpisy nie powstają,
bo scan ich nie tworzy. Nie unifikujemy map; komentarz opisuje, dlaczego.

**Odstępstwa od oryginału — pełna lista:** D2 (moment wywołania skanu: przed odpowiedzią zamiast
`res.on('finish')`; sam monkey-patch zastąpiony jawnym wywołaniem). Nic więcej. `ensureSchema()`
nie jest portowane, bo kanon `001_schema.sql` już ma te tabele w wersji zunifikowanej — to nie
zmiana zachowania API.

## Plan implementacji

Kolejność = kolejność commitów.

### Krok 1 — `src/repos/atrybuty.ts` (słownik: CRUD + agregaty + seed)
- `RODZAJ_KOLUMNA` (15 pozycji, port `:251-267`) + `KOLUMNY_PRODUKTOW` — whitelista nazw
  kolumn; dynamiczne nazwy kolumn budujemy WYŁĄCZNIE z tej mapy (nigdy z wejścia użytkownika).
- `listaRodzajow(db)` / `listaRodzajowZeZnacznikiem(db)` — dwa SELECT-y, bo różnią się polami
  (patrz „Kształty" 1 vs 4).
- `listaWartosci(db, rodzaj?)`, `dodajRodzaj`, `zmienRodzaj`, `usunRodzaj`, `dodajWartosc`,
  `zmienWartosc`, `usunWartosc` — z kodami błędów jak w oryginale (patrz niżej).
- `licznikiAtrybutow(db)` — pętla po `RODZAJ_KOLUMNA`, surowy `sql\`\`` jak
  `repos/analityka.ts:65,142`; wyjątek per kolumna połykany (`continue`).
- `uzycieAtrybutu(db, rodzaj, wartosc)` — `COUNT(*)` + `LIMIT 200 ORDER BY nazwa`.
- `zasiejSlownikAtrybutow(db)` — port `seed()` (D1).
- `slugRodzaju(label)` — port `:132-136` (polskie znaki → ASCII, `[^a-z0-9]+`→`_`, trim `_`,
  `slice(0,32)`).

Kody i komunikaty błędów do odtworzenia dosłownie:
`POST rodzaje` → 400 `Brak label`, 400 `Nie udało się wygenerować value z label`,
409 `Rodzaj '<value>' już istnieje`; `PUT rodzaje` → 404 `Nie znaleziono` (COALESCE, **core NIE
blokuje edycji**); `DELETE rodzaje` → 404 `Nie znaleziono`, **403 `Nie można usunąć wbudowanego
rodzaju`** dla `core=1`, kaskada wartości przez FK (`foreign_keys=ON` jest w `db/index.ts:18`);
`POST wartosci` → 400 `Brak rodzaj lub wartosc`, 400 `Rodzaj '<x>' nie istnieje`,
400 `Pusta wartość` (po `trim`), 409 `Taka wartość już istnieje dla tego rodzaju`;
`PUT wartosci` → 400 `Brak wartosc`, 404 `Nie znaleziono`, 409 `Taka wartość już istnieje`;
`DELETE wartosci` → 404 `Nie znaleziono`.

### Krok 2 — `src/repos/atrybuty-pending.ts` (kolejka + podobieństwo + scan)
- `levenshtein(a,b)` (pełna macierz DP, port `:41-55`), `podobienstwo(a,b)` = `1 - dist/maxLen`
  (port `similarity`, `:57-62`), `czySugerowacAlias(nowa, kanoniczna)` (port `shouldSuggestAlias`,
  `:65-72`): próg `≥ 0.9` ORAZ odrzucenie przypadku „różnica tylko `+`".
  **Bez normalizacji wielkości liter i spacji** — oryginał jej nie ma.
- `listaPending(db, rodzaj?)` — sortowanie + doklejenie `sugerowane_aliasy`: dla każdej pozycji
  wszystkie wartości katalogu tego rodzaju, sort malejąco po `podobienstwo`, **`slice(0,5)`**,
  `Math.round(sim*100)`.
- `RODZAJE_KOLUMNY` (13 pozycji, port `:22-36`) — osobna mapa (D6).
- `skanujNoweWartosci(db)` — port `scanForNewValues` (`:77-138`): `GROUP_CONCAT(DISTINCT dostawca)`,
  filtr `(dostawca IS NULL OR dostawca != 'MO6')`, pomija wartości w katalogu i w odrzuconych,
  istniejący pending AKTUALIZUJE (`ile_wystapien`, `ostatni_import`, `dostawcy`; `pierwszy_import`
  zostaje), **nie czyści kolejki przed skanem**. Zwraca
  `{skanowano_rodzajow, nowych_wartosci, zaktualizowano}`.
- `akceptujPending` / `akceptujZEdycja` / `akceptujJakoAlias` / `odrzucPending` / `wyczyscPending`
  — każda w `db.transaction`, kroki dokładnie jak w `:253-390`.

### Krok 3 — `src/routes/atrybuty.ts` (18 operacji) + rejestracja
- Router wg wzorca `src/routes/promotions.ts`; `requireAuth` na każdej trasie; audyt przez
  `zapiszAudyt` (`repos/audit.ts`) tylko dla 6 tras CRUD (D4).
- **Błędy zwracamy lokalnie jako `{ok:false,error}`**, nie przez globalny `bladHandler`
  (który oddaje `{error}`) — inaczej złamalibyśmy kształt z oryginału.
- ⚠ **Kolejność rejestracji tras**: `/api/atrybuty/pending` musi być zarejestrowane przed
  ewentualnymi wzorcami z parametrem, a `POST /api/atrybuty/scan-pending` nie może zostać
  przechwycone przez `/api/atrybuty/pending/:id/...`. W Express 5 ścieżki statyczne i tak nie
  kolidują z tymi wzorcami, ale kolejność trzymamy jak w oryginale i pokrywamy testem.
- `src/app.ts`: `app.use(trasyAtrybutow({ db }))` po `trasyWagiGabarytowej` + wywołanie
  `zasiejSlownikAtrybutow(db)` w `stworzApp` (D1 — 1:1 z pozycją `seed()` w `registerAtrybuty:99`).

### Krok 4 — hook skanu w `src/routes/staging-mutacje.ts` (D2)
Po udanej akceptacji (`:167-182`) wołamy `skanujNoweWartosci(db)` w `try/catch` (błąd logujemy,
nie wywracamy akceptacji), przed `res.json({ok:true, accepted})`. Odpowiedź bez zmian.

### Krok 5 — asercja GATE dla słownika dynamicznego (D3)
`test/gate/asercje.ts`: `sprawdzZgodnoscZFixtureSlownika(nazwaFixture, body, { prefiksy })`.

### Krok 6 — testy (szczegóły w „Strategia testów")

## Strategia testów

Baza testowa jak w całym projekcie: świeży SQLite w katalogu tymczasowym z kanonicznego
`001_schema.sql` (`test/gate/baza.ts`), aplikacja bez `listen()` (supertest) — **żadnych mocków,
żadnych portów**, bezpieczne przy równoległej pracy.

**`test/atrybuty.gate.test.ts` — GATE (obowiązkowy):**
- wszystkie 18 operacji istnieją w `contract/openapi.yaml` (`wczytajKontrakt().znajdzOperacje`);
- 6 fixtures kształtem 1:1 (`sprawdzZgodnoscZFixture`), z wyjątkiem `liczniki` idącego przez
  asercję z D3: `GET_atrybuty.json`, `_rodzaje` (i dowód, że NIE ma `utworzony`, a tabela 1 ma),
  `_wartosci`, `_pending` (z `sugerowane_aliasy`), `_uzycie` (**400** + dokładny tekst błędu),
  `_liczniki` (D3);
- `sprawdzZgodnoscZKontraktem` dla każdej odpowiedzi;
- 401 bez tokenu na wszystkich 18 operacjach (D5).

**`test/atrybuty.crud.test.ts`** — CRUD rodzajów i wartości na bazie testowej: slug z polskich
znaków i `slice(0,32)`, `core=0` dla nowych, 409 na duplikacie rodzaju, 403 na usunięciu core,
kaskada wartości przy usunięciu non-core rodzaju, 400/404/409 dla wartości, `trim`, audyt
w `audit_log` dla 6 akcji.

**`test/atrybuty.pending.test.ts`** — workflow end-to-end na realnych danych:
`scan-pending` (wykrycie nowych, filtr `MO6`, pominięcie katalogu i odrzuconych, aktualizacja
istniejącego wpisu z zachowaniem `pierwszy_import`), `akceptuj` (katalog + zniknięcie z pending,
`products` NIETKNIĘTE), `akceptuj-z-edycja` (`UPDATE products` + `produktow_zaktualizowano`),
`akceptuj-jako-alias` (400 gdy kanoniczna spoza katalogu; `UPDATE products`; brak wpisu w katalogu
— alias to jednorazowe przepisanie, nie ma tabeli aliasów), `odrzuc` (wpis w `_odrzucone`
i pominięcie przy kolejnym skanie), `DELETE /api/atrybuty/pending` (z `?rodzaj=` i bez),
404 „Pozycja pending nie istnieje" dla każdej z 4 akcji, hook po `POST /api/staging/accept` (D2).

**`test/atrybuty.podobienstwo.test.ts`** — jednostkowo `levenshtein`/`podobienstwo`/
`czySugerowacAlias` na przykładach policzonych ręcznie z kodu oryginału, w tym reguła „+"
i próg 0.9, oraz `slice(0,5)` i sortowanie malejące.

**Czego NIE testujemy:** wartości liczbowych z `GET_atrybuty_liczniki.json` (pochodzą z danych
produkcji, u nas baza testowa) — stąd D3; kolejności w `GROUP_CONCAT(DISTINCT dostawca)`
(SQLite jej nie gwarantuje, fixture ma `"MO5,MO3,MO2,MO1"`) — asertujemy zbiór, nie kolejność.

**Bramki:** `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` w `rebuild/backend/`
(Node ≥ 20 — `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`).

## Poza zakresem

- Widok `/atrybuty` i cokolwiek we froncie (sesja 7b).
- Naprawa martwych ścieżek `/api/attributes` / `/api/attributes-kinds` (7b — front ma wołać
  właściwe trasy).
- **NIE ożywiamy** martwego `GET /api/atrybuty` w widoku `/staging` (nota z 3e,
  `docs/rebuild-roadmap.md:1001-1005`) — to byłaby nowa decyzja.
- Martwy klaster atrybutów z `mirror/backend/index.cjs:295` (`ATTR_CORE_KINDS` itd.).
- Podpięcie `/api/atrybuty` pod `/katalog` (D3 z I2) i `DialogReguly.tsx` (I4b) — efekty uboczne
  opisane w roadmapie `:1012-1018`, należą do tamtych widoków.
- Zaległość `products.zastosowanie` / `__restoreZastosowanie()` (backlog #12) — właściciel
  ustalany między I7 a I8, nie dotyka tras atrybutów.

## Definition of done

- [ ] 18 operacji na 13 ścieżkach działa za `requireAuth`, kształty 1:1 z oryginałem
- [ ] Workflow pending kompletny: scan / akceptuj / jako-alias / z-edycją / odrzuć / wyczyść
- [ ] Tabele `atrybuty_wartosci_pending` i `_odrzucone` używane zgodnie z oryginałem
- [ ] Seed słownika przy starcie (D1) + hook skanu po akceptacji stagingu (D2)
- [ ] GATE: 6 fixtures zgodnych (kształt 1:1; `liczniki` przez asercję słownika z D3),
      wszystkie odpowiedzi walidują się względem `contract/openapi.yaml`
- [ ] Testy workflow pending i CRUD na bazie testowej — zielone
- [ ] `npm run lint`, `typecheck`, `build`, `test` czyste
- [ ] Roadmapa §5 I7: blok 7a oznaczony jako zrobiony, `DELETE /api/atrybuty/pending` dopisane
      do wyliczenia backendu, ustalenia dla 7b wpisane DO bloku 7b
