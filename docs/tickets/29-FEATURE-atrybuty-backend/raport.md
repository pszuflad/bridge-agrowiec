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
