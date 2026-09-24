# 154-BUG — generator CSV dla Selly gubi flagi zapisane jako tekst `'Tak'`

> Status: Draft → Approved → Implemented → Shipped
> Branch: `fix/154-csv-selly-flagi-tak`
> Worktree: `.worktrees/154-BUG-csv-selly-flagi-tak`
> Karta: `docs/karty/FIX.1/karta.md` · Wpis backlogu: `#153.1` (`docs/rebuild-backlog/wpis-153.md`)

## Opis ticketu

Napraw generator CSV dla Selly — gubi flagi zapisane w bazie jako tekst `'Tak'`.

Objaw: porównanie plików CSV wygenerowanych z tej samej bazy przez generator produkcji i przez nasz
stos daje 5396 = 5396 produktów i identyczny nagłówek, ale **899 wierszy różni się w pięciu flagach**
(`Snieg-3PMSF`, `Bloto+snieg`, `CFO`, `NRO`, `CHO`) — produkcja wypisuje „Tak", my pustkę.

Przyczyna: w `products` te kolumny mają mieszane typy, obok `0`/`1` siedzi tekst `'Tak'`. Czytamy je
przez Drizzle w trybie boolean, gdzie mapper robi `Number(value) === 1`, więc tekst daje `false`.
Produkcyjny generator to osobny skrypt czytający `SELECT *` przez `better-sqlite3` i dostaje wartość
surową.

Poprawić należy **wszystkie dziesięć** kolumn z `KOLUMNY_BOOL`, nie tylko pięć, w których tekst
wystąpił — kolejny import może wstawić go do każdej. Dowód wierności na stagingu jest obowiązkowy
i nie wystarczy do niego test jednostkowy.

## Kontekst

`zbudujCsvSelly()` (`rebuild/backend/src/selly/generator-csv.ts:253-278`) czyta produkty przez
pełną projekcję Drizzle:

```ts
db.select().from(products).where(eq(products.status, "aktywny")).orderBy(asc(products.id)).all()
```

a potem stosuje `if (KOLUMNY_BOOL.has(pole)) wartosc = wartosc ? "Tak" : "";` (`:263`).
Kolumny są w modelu zadeklarowane `integer({ mode: "boolean" })` (`src/db/schema.ts:71-77`), więc
Drizzle mapuje je przez `Number(v) === 1` **przed** dojściem do tego warunku — tekst `'Tak'` staje
się `false` i wychodzi puste pole.

**Oryginał (potwierdzone w `origin/main:mirror/backend/generate_selly_export.cjs`):**
- `:76` — `const boolCols = new Set(['reinforced','extra_load','cut_resistant','heat_resistant','stubble_resistant','nro','cho','ms','snow_3pmsf','cfo']);` — dokładnie te same dziesięć kolumn co nasze `KOLUMNY_BOOL`, różni się tylko notacja nazw;
- `:127-131` — `let v = row[sqlCol]; if (boolCols.has(sqlCol)) { v = v ? 'Tak' : ''; }`;
- `row` pochodzi z `db.prepare("SELECT * FROM products WHERE status='aktywny' ORDER BY id").all()`
  przez `better-sqlite3`, czyli wartości **surowe** (`number`, `string`, `null`).

Logika formatowania jest w obu generatorach identyczna — różni się **wyłącznie warstwa odczytu**.

**Pomiar na bazie stagingu wykonany w tym tickecie (2026-09-24, read-only, `status='aktywny'`)** —
potwierdza wpis `#153.1` i zgadza się z jego tabelą różnic co do wiersza:

| Kolumna | `null` | `integer 0` | `integer 1` | `text 'Tak'` | różnic w CSV wg #153.1 |
|---|---|---|---|---|---|
| `snow_3pmsf` | 4386 | 64 | 196 | **750** | 750 |
| `ms` | 4420 | 63 | 200 | **713** | 713 |
| `cfo` | 5240 | 96 | 8 | **52** | 52 |
| `nro` | 5270 | 101 | 13 | **12** | 12 |
| `cho` | 5283 | 101 | 2 | **10** | 10 |
| `stubble_resistant` | 5297 | 99 | — | — | — |
| `reinforced`, `extra_load`, `cut_resistant`, `heat_resistant` | 5396 | — | — | — | — |

Razem 5396 produktów aktywnych. Liczba `text 'Tak'` w każdej kolumnie jest **równa** liczbie
różniących się wierszy z pomiaru 153 — czyli tekst `'Tak'` wyjaśnia różnicę w całości, bez reszty.

⚠ **`db/snapshot.db` w repo (13.08) NIE odtwarza usterki** — ma tylko `integer 0/1` i `null`, zero
tekstu. Dowód lokalny na tym snapshocie dałby pusty `diff` z niewłaściwego powodu, dlatego dowód
idzie na staging, gdzie baza jest kopią produkcji z 23.09.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Ticket NIE dotyka kształtu żadnej odpowiedzi API.** Zmiana siedzi wyłącznie w warstwie odczytu
generatora pliku CSV, który nie jest odpowiedzią HTTP.

- `contract/fixtures/` — **brak fixture'a z treścią CSV** (to plik na dysku, nie odpowiedź). Istnieją
  `GET_selly_csv-status.json`, `GET_selly_status.json`, `GET_selly_log.json`, `GET_selly_ping.json`,
  `GET_selly_dictionaries.json` — żaden nie niesie treści pliku i żadnego nie ruszamy.
- `contract/openapi.yaml` — `POST /api/selly/generate-csv` i `GET /api/selly/csv-status` zostają bez
  zmian (kształt odpowiedzi, kody, `stdout`, `LICZBA_KOLUMN`).
- `contract/fixtures/GET_products.json` — **celowo NIE zmieniamy**. Ma te dziesięć pól jako
  `boolean`/`null` (`"cfo": false`, `"ms": null`, `"stubbleResistant": false`). Produkcja na wartości
  `'Tak'` zwraca z `GET /api/products` dokładnie to samo `false` co my, bo oryginał też trzyma te
  kolumny w trybie boolean (`deminified/backend-index.cjs:43733-43752`). API jest wierne i ma takie
  zostać.
- Wzorzec treści pliku w repo: `rebuild/backend/test/nagrania/selly-csv-naglowek.csv` — **sam
  nagłówek**, nagrany z `origin/main` @ `88fa31c`. Test porównujący go z naszym nagłówkiem musi dalej
  przechodzić (nagłówek się nie zmienia).

**Gate dla tego ticketu to nie fixture, a ręczny pomiar porównawczy na stagingu** (sekcja „Testing
strategy"). Brak rozjazdów spec↔oryginał↔fixtures do rozstrzygania: wpis `#153.1`, karta `FIX.1`
i oryginał mówią to samo, a pomiar na bazie stagingu to potwierdził liczbowo.

## Decisions

**D1. Modelu Drizzle nie ruszamy** (z karty `FIX.1`, potwierdzone przez użytkownika). Kolumny zostają
`integer({ mode: "boolean" })`. Uzasadnienie: oryginał ma je w tym samym trybie, więc produkcyjne
`GET /api/products` zwraca na `'Tak'` to samo `false`; zmiana schematu naprawiłaby CSV kosztem
rozjazdu z `contract/fixtures/GET_products.json`. Poprawka siedzi w warstwie odczytu generatora.

**D2. Technika odczytu: nadpisanie dziesięciu pól wyrażeniem `sql<…>` w projekcji** (decyzja
użytkownika; warianty odrzucone niżej). Potwierdzone w źródle Drizzle 0.45 — `mapResultRow`
(`sqlite-core/utils.cjs:40-75`) wybiera dekoder po typie pola:

```js
if (is(field, Column)) decoder = field;            // → mapFromDriverValue: Number(v) === 1
else if (is(field, SQL)) decoder = field.decoder;  // → noopDecoder: (v) => v
```

`noopDecoder.mapFromDriverValue = (v) => v` (`sql/sql.cjs:297`), więc pole zbudowane jako
``sql`${products.ms}` `` **omija** mapper boolean i oddaje wartość surową z drivera — to samo, co
dostaje produkcyjny `SELECT *`.

- Plusy: jedno zapytanie, klucze zostają `camelCase` (tablica `KOLUMNY` bez zmian), sygnatura
  `zbudujCsvSelly(db: Baza)` bez zmian, `csv-cli.ts` i `dostepnosc.ts` nietknięte.
- Minus przyjęty: pierwszy taki wzorzec w repo (`getTableColumns` jest używane w
  `src/repos/staging.ts:5` i `src/repos/kolumny.ts`, ale tylko do WYBORU pól, nie do nadpisania
  dekodera). Kompensujemy komentarzem z cytatem z Drizzle i testem, który pilnuje wszystkich dziesięciu.
- Odrzucone: **(b) osobne surowe `SELECT *` przez `better-sqlite3`** — najbliżej oryginału, ale `Baza`
  nie niesie uchwytu sqlite (`src/db/index.ts`), więc trzeba by rozszerzyć sygnaturę o
  `sqlite: BazaSqlite`, ruszyć dwa miejsca wywołania i przepisać całą tablicę `KOLUMNY` na
  `snake_case`. **(c) drugie zapytanie o dziesięć kolumn + `id`** — dwa przebiegi po 5,4 tys. wierszy
  i dodatkowy stan do utrzymania bez zysku wobec (b)/(a).

**D3. Reguła prawdziwości odtworzona wiernie, bez wyjątków** (decyzja użytkownika). Warunek zostaje
gołym `wartosc ? "Tak" : ""` na wartości **surowej**:

| Wartość w bazie | Wynik | Uwaga |
|---|---|---|
| `1` (integer) | `Tak` | |
| `0` (integer) | pusto | |
| `'Tak'` (text) | `Tak` | **to naprawiamy** |
| `NULL` | pusto | |
| `''` (text pusty) | pusto | jedyny falsy string w JS |
| `'0'` (text) | **`Tak`** | niepusty string jest truthy — tak robi oryginał |
| `'Nie'` (text) | **`Tak`** | oryginał nie patrzy na treść, tylko na pustość |

Świadomie **nie** zawężamy tego do `v === 1 || v === 'Tak'` — zawęziłoby regułę względem oryginału.
Ani `'0'`, ani `'Nie'` nie zostały w bazie zmierzone (ani w snapshocie, ani w pomiarze `#153.1`), więc
to dziś przypadek teoretyczny; jeśli wystąpi, zachowamy się jak produkcja.

**D4. `mapper.ts` — zgłaszamy, nie naprawiamy** (decyzja użytkownika). `src/selly/mapper.ts:197-203`
ma **ten sam błąd**: buduje tabelę atrybutów wysyłaną do Selly przez sync REST z tego samego typu
`ProduktWewnetrzny` (`p.ms ? "tak" : null`, `p.snow3pmsf`, `p.reinforced`, `p.extraLoad`,
`p.cutResistant`, `p.heatResistant`, `p.stubbleResistant`), więc dla tych samych produktów gubi te
flagi. Karta `FIX.1` daje na wyłączną własność tylko `generator-csv.ts` + jego test, a sync REST jest
zakresem kart Selly REST. Zapis: dowód (numery linii, lista pól, skutek) w sekcji „Do koordynatora"
karty `FIX.1` **oraz** nowy wpis backlogu `docs/rebuild-backlog/wpis-154.md` ze statusem do decyzji.

**D5. Żadne odstępstwo od zachowania oryginału nie jest w tym tickecie wprowadzane.** Ticket
PRZYWRACA wierność, nie zmienia zachowania — dlatego wpis `#153.1` ma `Do nowej wersji? ✅ TAK`.

## Implementation plan

Wszystko w `rebuild/backend/`. Jeden plik produkcyjny, jeden plik testowy.

### Krok 1 — surowa projekcja dziesięciu flag (`src/selly/generator-csv.ts`)

1. `import { asc, eq, getTableColumns, sql } from "drizzle-orm";` (dziś `asc, eq`).
2. Nad `KOLUMNY_BOOL` (`:113-121`) **wymienić komentarz**, który dziś twierdzi nieprawdę obaloną tym
   ticketem:
   > „⚠ W drizzle te pola są już `boolean` … Warunek `v ? "Tak" : ""` działa tak samo dla obu — `false`
   > i `0` dają puste pole, `true` i `1` dają `"Tak"`."

   Nowy komentarz ma powiedzieć: w bazie te kolumny mają MIESZANE typy (obok `0`/`1` tekst `'Tak'`),
   mapper boolean Drizzle zamienia tekst na `false`, dlatego czytamy je surowo; plus liczby z pomiaru
   i odsyłacz do wpisu `#153.1`. (`grep` po `„działa tak samo dla obu"` daje tylko ten jeden plik —
   innych kopii tej nieprawdy w repo nie ma.)
3. Wprowadzić **jedno** źródło prawdy o dziesiątce, żeby lista nie mogła się rozjechać z projekcją:

   ```ts
   /** Surowa wartość flagi — tak jak ją oddaje SQLite, bez mappera boolean. */
   type WartoscSurowaFlagi = string | number | null;

   /** Dziesięć kolumn z `boolCols` oryginału (`generate_selly_export.cjs:76`), czytanych SUROWO. */
   const FLAGI_SUROWE = {
     reinforced: sql<WartoscSurowaFlagi>`${products.reinforced}`,
     extraLoad: sql<WartoscSurowaFlagi>`${products.extraLoad}`,
     cutResistant: sql<WartoscSurowaFlagi>`${products.cutResistant}`,
     heatResistant: sql<WartoscSurowaFlagi>`${products.heatResistant}`,
     stubbleResistant: sql<WartoscSurowaFlagi>`${products.stubbleResistant}`,
     nro: sql<WartoscSurowaFlagi>`${products.nro}`,
     cho: sql<WartoscSurowaFlagi>`${products.cho}`,
     ms: sql<WartoscSurowaFlagi>`${products.ms}`,
     snow3pmsf: sql<WartoscSurowaFlagi>`${products.snow3pmsf}`,
     cfo: sql<WartoscSurowaFlagi>`${products.cfo}`,
   } satisfies Partial<Record<keyof ProduktWewnetrzny, SQL<WartoscSurowaFlagi>>>;
   ```

   i **wyprowadzić z niego** `KOLUMNY_BOOL`:
   `const KOLUMNY_BOOL: ReadonlySet<keyof ProduktWewnetrzny> = new Set(Object.keys(FLAGI_SUROWE) as (keyof ProduktWewnetrzny)[]);`
   — wtedy dopisanie kolumny do projekcji automatycznie dopisuje ją do warunku „Tak"/pusto i odwrotnie;
   nie ma dwóch list do utrzymania. `satisfies` pilnuje, że klucze są realnymi polami modelu.
4. W `zbudujCsvSelly()` (`:253`) zamienić `db.select()` na projekcję:
   ```ts
   db.select({ ...getTableColumns(products), ...FLAGI_SUROWE })
   ```
   Reszta pętli (`:257-277`) **bez zmian** — warunek `wartosc ? "Tak" : ""` zostaje dosłownie taki, jaki
   jest, bo teraz dostaje już surową wartość. `ProduktWewnetrzny = typeof products.$inferSelect`, więc
   klucze projekcji są dokładnie kluczami tego typu i indeksowanie `produkt[pole]` typuje się dalej.
5. `npm run lint && npm run typecheck` po kroku.

**Czego NIE ruszamy:** `src/db/schema.ts` (D1), `src/selly/mapper.ts` (D4), `mirror/**`, tablicy
`KOLUMNY`, `esc()`, `nazwaKategoriiSklepu()`, `blokowaneFormyDlaDostawcy()`, `statusPlikuCsv()`,
`zapiszAtomowo()`, `LICZBA_KOLUMN`, sygnatur publicznych i `csv-cli.ts`/`dostepnosc.ts`.

### Krok 2 — test jednostkowy (`test/selly.generator-csv.test.ts`)

Rozszerzyć istniejący blok „kolumny boolowskie oddają „Tak” albo PUSTE pole, nigdy 0/1" (`:142-152`)
i dodać nowe przypadki. Wzorzec wstrzykiwania wartości poza typowaniem Drizzle jest w tym pliku już
używany (`:100-101`): `baza.sqlite.prepare("UPDATE products SET konstrukcja = ? WHERE kod = ?").run(...)`
— `zasiejProdukty()` idzie typowanym insertem Drizzle, który zmapowałby `boolean` z powrotem na `0/1`,
więc tekst musi wejść surowym SQL-em.

Przypadki:
1. **Regresja wprost z `#153.1`:** tekst `'Tak'` w `ms`, `snow_3pmsf`, `cfo`, `nro`, `cho` → w CSV
   kolumny `Bloto+snieg`, `Snieg-3PMSF`, `CFO`, `NRO`, `CHO` dają `Tak` (dziś: pustka).
2. **Wszystkie dziesięć, nie tylko pięć:** pętla po `KOLUMNY_BOOL`/`FLAGI_SUROWE` wstawiająca `'Tak'`
   surowym `UPDATE` do każdej z dziesięciu kolumn i sprawdzająca, że każda odpowiadająca kolumna CSV
   niesie `Tak`. To jest zabezpieczenie przed rozjazdem listy z projekcją (gdyby ktoś dodał kolumnę do
   jednej, a nie do drugiej) — mapowanie pole → nagłówek bierzemy z tablicy `KOLUMNY`.
3. **Reguła prawdziwości (D3), tabelka przypadków:** `1` → `Tak`; `0` → pusto; `NULL` → pusto;
   `''` → pusto; `'0'` → `Tak`; `'Nie'` → `Tak`. Test dokumentuje regułę oryginału razem z jej
   nieintuicyjnym brzegiem, żeby nikt jej później „nie poprawił".
4. **Nieregresja:** nagłówek dalej identyczny z `test/nagrania/selly-csv-naglowek.csv`, `LICZBA_KOLUMN`
   dalej 60, a kolumny NIE-boolowskie dalej nie wpadają w gałąź „Tak" (istniejące testy `:47`, `:73`,
   `:263` muszą przechodzić bez zmian).

### Krok 3 — bramki lokalne

`npm run lint && npm run typecheck && npm run build && npm test` w `rebuild/backend/`.

### Krok 4 — dowód wierności na stagingu (obowiązkowy, opis w „Testing strategy")

### Krok 5 — `raport.md`, review, docs (karta `FIX.1`, wpis `#153.1`, nowy wpis o `mapper.ts`)

## Testing strategy

### Test jednostkowy — konieczny, ale niewystarczający

Krok 2 wyżej. Pilnuje reguły i listy dziesięciu kolumn w CI, ale **nie dowodzi wierności** — chodzi na
bazie testowej, którą sami zasialiśmy, nie na danych produkcji.

### GATE ODBUDOWY — pomiar porównawczy na stagingu (to jest właściwy dowód)

Powtórzenie procedury z `docs/tickets/153-DOCS-flagi-tak-w-csv/raport.md`, tym razem z naprawionym
generatorem. Wymaganie z karty `FIX.1`: **pusty `diff`**.

Kroki:
1. Zbudować gałąź `fix/154-csv-selly-flagi-tak` na VPS w **osobnym katalogu roboczym**, nie przez
   `tools/deploy-staging.sh` — skrypt robi `git reset --hard origin/develop` (`:26,57,61`), więc sam
   z siebie nie weźmie naszej gałęzi, a deployu stagingu ten ticket ruszać nie ma po co.
2. Generator produkcji z `origin/main`, jako **kopia z podmienionymi trzema stałymi** (`DB_PATH`,
   `OUT_DIR`, `OUT_FILE`) + `payment_blocks.cjs` z `origin/main` obok, z `node_modules` dowiązanym
   z wydania stagingu. **Kontrola `grep`em przed uruchomieniem.**
3. Oba generatory na **tej samej bazie, jeden po drugim** (scheduler importu na stagingu chodzi, więc
   przerwa wprowadza szum w cenach i stanach).
4. Porównanie: liczba wierszy, nagłówek, `diff`, a przy różnicach **rozkład na kolumny** — sam `diff`
   mówi „899 linii" i nic więcej.
5. Wynik (liczby, pusty `diff`, SHA obu wersji) do `raport.md`.

Zabezpieczenia, których pilnujemy przy każdym kroku:
- ⚠ **Oryginału nie uruchamiamy nigdy wprost** — ma zaszyty produkcyjny `DB_PATH` i produkcyjny
  katalog eksportu, nadpisałby plik, po który Selly przychodzi o 12:00. Tylko kopia po `grep`ie.
- ⚠ Nasz generator dostaje `SELLY_CSV_DIR` w katalogu pomiarowym, **nigdy** produkcyjnego
  `public_html/panel/ex-port-files`.
- Baza stagingu **tylko do odczytu** — żadnych `UPDATE`, żadnego `ensurePaymentBlocks()`
  (`ALTER TABLE`); z `payment_blocks.cjs` oryginał woła wyłącznie `getBlockedPaymentForms()`.
- Pliki pomiarowe zawierają kolumnę `Cena-zakupu` → leżą poza `public_html` i lecą `rm -rf` po pomiarze.
- Staging stoi na **tym samym VPS co produkcja** — nie dotykamy `~/private_apps/bridge` (produkcja),
  PM2 produkcji ani crona.

### Czego nie robimy

- **Nie ruszamy `contract/fixtures/`** — ticket nie zmienia żadnej odpowiedzi API (D1).
- **Bez testu integracyjnego trasy** `POST /api/selly/generate-csv` — kształt odpowiedzi i `stdout` się
  nie zmieniają, a istniejące testy trasy to już pokrywają.
- **Bez E2E** — brak przepływu użytkownika w tej zmianie.
- **Bez dowodu dla `mapper.ts`/sync REST** — poza zakresem karty (D4).

## Out of scope

- `src/db/schema.ts` — tryb boolean kolumn zostaje (D1).
- `src/selly/mapper.ts:197-203` i sync REST do Selly — ten sam błąd, zgłaszany koordynatorowi (D4).
- `contract/fixtures/GET_products.json` i zachowanie `GET /api/products` — wierne, zostaje.
- `mirror/**` (w tym cofnięcie `mirror/` do 25.08 na `develop`) — nie ruszamy.
- `docs/rebuild-roadmap.md`, w tym wiersz `⛔ przed cutoverem | FIX.1 | ⬜ BLOKADA` (`:3489`) —
  własność koordynatora; prośba o przestawienie idzie do „Do koordynatora" karty.
- Deploy stagingu na naszą gałąź — pomiar robimy w osobnym katalogu roboczym.
- Tekstowe `'0'`/`'Nie'` jako fałsz — odrzucone, byłoby odstępstwem od oryginału (D3).

## Definition of done

- [ ] Wszystkie dziesięć kolumn z `KOLUMNY_BOOL` czytane surowo; `KOLUMNY_BOOL` i projekcja mają jedno
      wspólne źródło, więc nie mogą się rozjechać
- [ ] Reguła D3 odtworzona dosłownie (`1`, `'Tak'`, `'0'`, `'Nie'` → `Tak`; `0`, `NULL`, `''` → pusto)
- [ ] Model Drizzle, `contract/fixtures/` i `contract/openapi.yaml` bez zmian
- [ ] Kłamliwy komentarz nad `KOLUMNY_BOOL` zastąpiony prawdą z pomiaru
- [ ] Test jednostkowy: regresja `#153.1`, wszystkie dziesięć kolumn, tabelka reguły prawdziwości
- [ ] Nagłówek dalej zgodny z `test/nagrania/selly-csv-naglowek.csv`, `LICZBA_KOLUMN` = 60
- [ ] `npm run lint && npm run typecheck && npm run build && npm test` zielone
- [ ] **Pomiar na stagingu: 5396 = 5396 wierszy, nagłówek identyczny, `diff` PUSTY** — wynik w `raport.md`
- [ ] Pliki pomiarowe z `Cena-zakupu` usunięte z VPS; produkcja nietknięta
- [ ] `docs/karty/FIX.1/karta.md`: `Stan: ✅`, „Dowiezione", „Do koordynatora" (`mapper.ts` + wiersz roadmapy)
- [ ] `docs/rebuild-backlog/wpis-153.md`: `Status` wpisu `#153.1` zaktualizowany
- [ ] Nowy wpis backlogu o `mapper.ts` (`docs/rebuild-backlog/wpis-154.md`)
- [ ] Gałąź zsynchronizowana z `origin/develop`, bramki zielone PO synchronizacji, PR `MERGEABLE`
