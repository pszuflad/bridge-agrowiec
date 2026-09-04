# 29-FEATURE-atrybuty-backend — raport z implementacji

## Podsumowanie

Iteracja 7a dowieziona: backend atrybutów odtworzony z dwóch modułów oryginału
(`atrybuty_module.cjs` + `pending_module.cjs`) jako **13 ścieżek / 18 operacji** za
`requireAuth`, razem z kolejką pending (skan, akceptacja zwykła / jako alias / z edycją,
odrzucenie, czyszczenie) i algorytmem sugerowania aliasów. Wszystkie 6 fixtures przechodzą
GATE kształtem 1:1; pełna suita backendu (916 testów) jest zielona.

## Zmiany

- **Nowe:** `rebuild/backend/src/repos/atrybuty.ts` — CRUD słownika, `liczniki`, `uzycie`,
  slug rodzaju, seed (`zasiejSlownikAtrybutow`), 15-pozycyjna mapa `RODZAJ_KOLUMNA`.
- **Nowe:** `rebuild/backend/src/repos/atrybuty-pending.ts` — kolejka, `levenshtein` /
  `podobienstwo` / `czySugerowacAlias`, `skanujNoweWartosci`, cztery warianty rozstrzygnięcia
  pozycji + czyszczenie, 13-pozycyjna mapa `RODZAJE_KOLUMNY`.
- **Nowe:** `rebuild/backend/src/routes/atrybuty.ts` — 18 operacji, błędy w kształcie
  `{ok:false,error}`, audyt tylko dla 6 tras CRUD.
- `rebuild/backend/src/app.ts` — rejestracja `trasyAtrybutow` + wywołanie seeda przy budowie
  aplikacji (1:1 z pozycją `seed()` w `registerAtrybuty:99`).
- `rebuild/backend/src/routes/staging-mutacje.ts` — skan kolejki po udanym
  `POST /api/staging/accept` (jawne wywołanie zamiast monkey-patcha).
- `rebuild/backend/test/gate/asercje.ts` — nowa asercja `sprawdzZgodnoscZFixtureSlownika`
  dla odpowiedzi będących mapą dynamiczną.
- **Nowe testy:** `atrybuty.gate.test.ts` (13), `atrybuty.crud.test.ts` (26),
  `atrybuty.pending.test.ts` (21), `atrybuty.podobienstwo.test.ts` (9).

**Migracji nie było** — `rebuild/schema/001_schema.sql:215-256` ma już komplet czterech tabel
w wersji zunifikowanej. `ensureSchema()` z oryginału świadomie nie jest portowane.

## Odstępstwa od planu

Brak — zakres i wszystkie decyzje (D1–D6) zrealizowane zgodnie z `plan.md`.

Dwie rzeczy warte odnotowania, obie przewidziane w planie i potwierdzone w kodzie:
1. Poprawiona została **teza promptu o „13 trasach"** — ścieżek jest 13, ale operacji 18,
   bo `/api/atrybuty/pending` ma GET i DELETE. `DELETE` wszedł w zakres.
2. `requireAuth` okazał się **odtworzeniem 1:1**, nie odstępstwem — oryginał wpina `we`
   (middleware auth) w każdą trasę obu modułów (`extensions.cjs:80,105`).

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.** Sprawdzone: wszystkie 18 operacji istnieje
  w `contract/openapi.yaml` i każda oddaje 401 bez tokenu; `GET_atrybuty.json`,
  `GET_atrybuty_rodzaje.json`, `GET_atrybuty_wartosci.json`, `GET_atrybuty_pending.json`,
  `GET_atrybuty_uzycie.json` (status **400**, co do znaku z „…: undefined") — kształt 1:1 przez
  `sprawdzZgodnoscZFixture`; `GET_atrybuty_liczniki.json` — przez
  `sprawdzZgodnoscZFixtureSlownika` (decyzja D3). Bez wyjątków `WyjatekGate`.
- **Unit:** ✓ 9 (algorytm podobieństwa, wyniki policzone ręcznie ze wzoru oryginału,
  w tym odtworzenie `podobienstwo: 92` z nagrania produkcji).
- **Integration:** ✓ 47 (26 CRUD + 21 workflow pending, na prawdziwym SQLite w katalogu
  tymczasowym, bez mocków; sprawdzane skutki w tabelach, nie tylko odpowiedzi).
- **E2E:** N/D — 7a nie ma warstwy UI (widok `/atrybuty` to sesja 7b).
- **Pełna suita:** ✓ 916 testów / 58 plików. Bramki `lint`, `typecheck`, `build` — czyste.

### Czego GATE tu NIE dowodzi (jawnie)

Zamrożony `openapi.yaml` deklaruje dla każdej operacji tylko 200/401/400 — w całym pliku nie
ma ani jednego `"403"`, `"404"` czy `"409"`. Oryginał zwraca wszystkie trzy (403 przy usuwaniu
wbudowanego rodzaju, 404 „Nie znaleziono", 409 przy duplikacie), więc tych odpowiedzi nie
przepuszczamy przez asercję kontraktu — dowodzi ich `atrybuty.crud.test.ts` wprost. Wygrywa
oryginał; luka jest po stronie kontraktu, nie kodu (analogicznie do `GET /api/products/{id}`
w `katalog.gate.test.ts:187`).

Dla `GET /api/atrybuty/liczniki` gate nie porównuje LICZB ani konkretnych wartości atrybutów —
fixture ma 5348 kluczy policzonych z katalogu produkcji, a baza testowa ma inne produkty.
Sprawdzany jest kształt mapy (`<rodzaj>::<wartosc>` → dodatni int, brak klucza `ok`, rodzaje
ze zbioru z nagrania); same liczby dowodzi `atrybuty.crud.test.ts`.

## Breaking changes

Brak dla istniejących tras. Dwie zmiany zachowania procesu, obie zatwierdzone:
- `stworzApp` woła teraz `zasiejSlownikAtrybutow(db)` — przy każdym starcie backendu do
  `atrybuty_rodzaje`/`atrybuty_wartosci` dosypywane są rodzaje wbudowane i wartości
  `marka`/`bieznik` odczytane z `products` (1:1 z produkcją, D1);
- `POST /api/staging/accept` uruchamia skan kolejki przed odpowiedzią (D2). Ciało i kod
  odpowiedzi bez zmian; przy dużym katalogu akceptacja trwa nieco dłużej.

## Follow-up

Świadomie odłożone, do rozważenia w osobnych ticketach:

1. **Brak audytu dla akcji pending** (D4, 1:1 z oryginałem). `akceptuj-z-edycja` i
   `akceptuj-jako-alias` robią masowy `UPDATE products` i nie zostawiają żadnego śladu —
   nie da się później ustalić, kto i kiedy przepisał marki w katalogu. Kandydat do wpisu
   w `docs/rebuild-backlog.md`.
2. **Seed „bieżnik z modelu"** (`atrybuty_module.cjs:80-83`): słownik `bieznik` zasilany jest
   z `products.model`, mimo że `products` ma własną kolumnę `bieznik`. To źródło quirku
   widocznego wprost w `contract/fixtures/GET_atrybuty_pending.json` (pozycje sugerujące same
   siebie ze `podobienstwo: 100`). Odtworzone, nie naprawione — naprawa rozjechałaby zawartość
   słownika z produkcją.
3. **Dwie rozjeżdżone mapy rodzaj→kolumna** (15 dla liczników, 13 dla kolejki; D6). Dla pozycji
   pending rodzaju `model`/`zastosowanie` akceptacja przepisująca produkty zwróci 400 — dziś
   nieosiągalne, bo skan takich pozycji nie tworzy, ale to mina na przyszłość.
4. **Brak normalizacji przy porównywaniu wartości**: „BKT" i „bkt" mają podobieństwo 0, więc
   różnica wielkości liter nigdy nie dostanie sugestii aliasu. Zastane.
5. **`GET /api/atrybuty/pending` bez paginacji** — nagranie produkcji ma 498 pozycji, a dla
   każdej liczony jest Levenshtein wobec CAŁEGO słownika tego rodzaju (dla `marka` to tysiące
   wartości). Koszt kwadratowy; jeśli 7b zauważy wolne ładowanie widoku, to jest przyczyna.
6. **Kontrakt nie zna kodów 403/404/409** — przy najbliższym odświeżaniu `openapi.yaml` warto
   je dopisać, żeby gate mógł je obejmować.

## Review fixes applied

Po review (`review.md`, iteracja 1) — poprawione wszystkie SHOULD-FIX dotyczące kodu i testów
oraz jedno NICE-TO-HAVE:

- **`src/app.ts`** — `zasiejSlownikAtrybutow(db)` w `try/catch`. Bez tego baza bez tabel
  atrybutów (stary `DB_PATH` bez `npm run migrate`) wywracała START CAŁEGO backendu przed
  `listen()`; wcześniej taka baza pozwalała mu wstać i psuła tylko konkretne trasy. Oryginał
  problemu nie miał, bo wołał `ensureSchema()` przed `seed()` — my schematu w runtime nie
  tworzymy, więc tę samą odporność daje złapanie błędu.
- **`src/routes/atrybuty.ts`** — walidacja `wartosc` sprowadzona do warunku FALSY, 1:1
  z oryginałem (`:201`, `:222`). Wcześniej `{wartosc: 0}` i `{wartosc: false}` przechodziły
  i lądowały w słowniku jako napisy „0" i „false"; produkcja odrzuca oba `400 {ok:false,…}`.
- **`src/routes/atrybuty.ts`** — dodany handler błędów na poziomie routera: nieprzewidziany
  wyjątek oddaje `500 {ok:false, error}` zamiast `{error}` z globalnego `bladHandler`.
  Kształt (klucz `ok`) jest tym, co czyta UI. **Treść komunikatu celowo NIE jest kopią
  oryginału** — nie wypuszczamy `e.message`, zgodnie z zasadą z `middleware/errors.ts`
  obowiązującą w całej odbudowie. Odtworzony jest kształt, nie treść.
- **`src/routes/atrybuty.ts`** — zapis audytu opakowany w `audytuj()`, które połyka błąd, jak
  `try { be(…) } catch (_) {}` w oryginale. Awaria zapisu do `audit_log` nie zamienia już
  wykonanego CRUD-u w odpowiedź 500.
- **`test/gate/asercje.ts`** — asercja słownika wzmocniona: (a) pusta mapa to teraz błąd
  (pusty wynik jest realnym trybem awarii tej trasy, bo `licznikiAtrybutow` połyka wyjątek per
  kolumna), (b) zbiór dozwolonych rodzajów bierzemy z mapy w kodzie, a nie z fixture'a —
  nagranie ma 13 prefiksów, bo `sezon` i `wentyl` były w produkcji puste, więc pierwszy produkt
  testowy z `sezon` zapaliłby fałszywy STOP, (c) doszedł dowód w drugą stronę: każdy prefiks
  z fixture'a musi być w mapie, co złapie wypadnięcie wpisu.
- **`test/atrybuty.pending.test.ts`** — dołożony test `slice(0, 5)` i sortowania malejącego
  sugestii aliasów (zapowiedziany w planie, brakujący). Bez niego odwrócenie sortowania albo
  `slice(0, 4)` przechodziło całą suitę, a to pole napędza przycisk „akceptuj jako alias" w 7b.
- **`test/atrybuty.crud.test.ts`** — dowód na `ORDER BY nazwa` postawiony na trzech produktach
  (wcześniej dwa, co przy `Array.sort()` wychodziło i bez sortowania).

Świadomie NIE zmienione (odnotowane jako utwardzenia wobec oryginału, żeby nikt ich później
nie „naprawił" wstecz):
- pola ciała spoza `string` są ignorowane (`{label: 123}` → 400 „Brak label"), gdy oryginał
  wywala się na `(123||'').trim()` → 500;
- `Object.hasOwn` przy sięganiu do map rodzaj→kolumna: `?rodzaj=constructor` daje 400 „Nieznany
  rodzaj atrybutu", gdy oryginał trafiłby prototypem w interpolację SQL i oddał 500;
- `parametr()` traktuje `?rodzaj=a&rodzaj=b` (tablicę) jak brak filtra;
- `test/atrybuty.gate.test.ts` zostaje na `beforeAll` (jedno środowisko na plik) — asercje są
  odporne na kolejność, a plik jest wyraźnie szybszy niż przy `beforeEach`.

Bramki po poprawkach: `lint`, `typecheck`, `build` czyste; suita **917 testów / 58 plików**
zielona (71 w domenie atrybutów).

## Docs updates

### `docs/rebuild-roadmap.md`
- §3, wiersz „Martwe ścieżki FE": „naprawić w I7" → „naprawić w **7b**", z faktem, że trasy
  `/api/atrybuty(/rodzaje)` w odbudowie działają od 7a. Status ⬜ zostaje — front dalej woła
  martwe ścieżki.
- §4 (tablica postępu), wiersz 7: `⬜` → `🔨`; przy okazji poprawiona błędna etykieta sesji
  (`1a BE · 1b FE` → `7a BE · 7b FE`); dopisany ticket i data.
- §5 Iteracja 7 przepisana na STAN: status `🔨 iteracja w połowie` (7a ✅ 2026-09-04, 7b ⬜),
  blok rozbity na podbloki 7a/7b w stylu I4. Do 7a: zakres faktycznie dowieziony
  (13 ścieżek / 18 operacji z jawnie wypisanym `DELETE /api/atrybuty/pending`), trzy fakty
  ustalone przez ticket (brak atrybutów w rdzeniu — graf wywołań; `requireAuth` = 1:1;
  seed + hook skanu z jedynym odstępstwem) i rozliczenie gate'u.
- §5, „Ścieżki (GATE)": „atrybuty×13" doprecyzowane — 13 ścieżek, ale 18 operacji, bo
  `/api/atrybuty/pending` ma GET i DELETE.
- **Do bloku 7b** (nie do zamkniętego 7a — `CLAUDE.md` §2) wpisane sześć ustaleń, których front
  nie odgadnie: brak `utworzony` w `/rodzaje`, goła mapa bez `ok` w `/liczniki`, `count` bez
  limitu vs lista 200 w `/uzycie`, brak paginacji w `/pending`, `sugerowane_aliasy` = max 5
  malejąco (+ brak normalizacji wielkości liter), różnica skutków trzech wariantów akceptacji
  (w tym „nie ma tabeli aliasów" i „DELETE = schowaj, nie odrzuć") oraz kształt `{ok:false,error}`
  przy braku 403/404/409 w kontrakcie.
- Efekty uboczne dla I2 i I4b przepisane z warunkowych („po I7 mogą…") na „do zrobienia od
  zaraz", a noty dopisane TAM, gdzie przeczytają je właściwe sesje: I2/D3, tabela „Co I2
  świadomie odłożyła" oraz podblok 4b (`DialogReguly.tsx`).
- Nota z 3e o martwym `GET /api/atrybuty` w `/staging` — **bez zmian**, 7a jej nie ruszała.

### `docs/rebuild-backlog.md`
Potwierdzone, że wpisów o atrybutach/kolejce/aliasach nie było. Dodane pięć nowych, wszystkie
**⬜ do decyzji** (format 1:1 jak #33–#36), każdy z dowodem `plik:linia`:
- **#37** akcje kolejki pending nie zostawiają śladu w audycie (mimo masowego `UPDATE products`),
- **#38** seed słownika `bieznik` z `products.model` — z dowodem w nagraniu: wszystkie 5 pozycji
  `GET_atrybuty_pending.json` to rodzaj `bieznik` i każda sugeruje samą siebie ze `podobienstwo: 100`,
- **#39** dwie rozjeżdżone mapy rodzaj→kolumna (15 vs 13),
- **#40** porównanie wartości bez normalizacji („BKT"/„bkt" = 0),
- **#41** `openapi.yaml` nie zna kodów 403/404/409 (skierowane do zakresu I12).

### `docs/spec-backend.md`
- §2: dopisany blok „Potwierdzone w 7a" (13 ścieżek / 18 operacji; `requireAuth` jako
  odtworzenie 1:1, nie odstępstwo D1; domknięcie korekty z §1 — klaster `index.cjs:295` martwy;
  dwa kształty: `utworzony` tylko w `GET /api/atrybuty`, `liczniki` jako goła mapa bez `ok`;
  brak audytu dla pending).
- §4, wiersz „Endpointy modułowe": „Atrybuty 11" → „Atrybuty 11 **+ Pending 7** (razem 18
  operacji na 13 ścieżkach)" — stare cięcie było poprawne, ale mylące, bo pending nie miał liczby.

### `docs/spec-frontend.md`
- §2A: nota „Stan 2026-09-04 (7a)" pod tabelą martwych ścieżek — backend gotowy, 7b ma tylko
  wołać właściwe trasy, plus ostrzeżenie o różnicy pola `utworzony`.
- §2B, wiersz `pending-injection.js`: dopisane „Wyczyść wszystko" (`DELETE /api/atrybuty/pending`).

### `docs/plan.md` — bez zmian
Dokument jawnie historyczny (nagłówek: „Ten dokument jest historyczny", źródłem prawdy jest
roadmapa). Trzy wzmianki o atrybutach opisują stan sprzed odbudowy i nadal są prawdziwe.

### `CLAUDE.md` — bez zmian
Ostrzeżenie o duplikatach definicji zostaje: ticket potwierdził tylko, że w JEGO zakresie
duplikatów nie ma, co nie jest argumentem za osłabianiem reguły. Sekcja „Środowisko" aktualna.

### Korekta merytoryczna wykryta przy okazji docs
Doc-checker backlogu sprawdził obie mapy pozycja po pozycji i obalił tezę powtórzoną w planie
i w komentarzach kodu, jakoby mapa kolejki miała `wentyl`, którego nie ma mapa liczników.
**`wentyl` jest w OBU**; mapa 13-pozycyjna jest dokładnym PODZBIOREM 15-pozycyjnej, a jedyna
różnica to `model` i `zastosowanie` (zweryfikowane programowo). Poprawione w
`repos/atrybuty.ts`, `repos/atrybuty-pending.ts` i w `plan.md` (D6).

### Pre-existing issues (zgłoszone, NIE naprawiane — poza zakresem ticketa)
- `docs/rebuild-roadmap.md` §4, wiersz 8 (Selly): kolumna Sesje ma `1a BE · 1b FE`, a blok I8
  mówi `8a BE · 8b FE` — ta sama literówka co w wierszu 7 (tamten poprawiony, bo dotyczy I7).
- `docs/rebuild-roadmap.md` §3, wiersz „Skrypty injection": wskazuje „I7 / I8" bez rozróżnienia
  sesji; wchłonięcie `pending-injection.js` należy do 7b.
- `docs/rebuild-backlog.md` legenda statusów (`:22`) zna tylko `—`/`🔨`/`✔`, a wpisy #33+ używają
  rozbudowanych wariantów; rozjazd zastany.
- `docs/rebuild-backlog.md:16`: deklarowany zakres pliku to „zmiany Ani z żywej produkcji", ale
  od ok. #11 pełni też rolę rejestru zastanych defektów wykrytych przy odbudowie.
- `docs/plan.md:8`: nota nagłówkowa mówi „I1 i I2 zamknięte; kolejne w toku", a zamkniętych jest
  dziś znacznie więcej. Dokument historyczny — świadomie nietknięty.
- `docs/spec-backend.md:207`: „Unikalne pary metoda+ścieżka ~113" nie było w tym tickecie
  weryfikowane i miesza „definicje" ze „ścieżkami".
