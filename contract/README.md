# Kontrakt API — Bridge

Zamrożony kontrakt backendu — cel dla odbudowy i siatka bezpieczeństwa przy
przepisywaniu.

## Zawartość

| Plik | Co | Stan |
|---|---|---|
| `openapi.yaml` | 99 ścieżek / 116 operacji: metoda, ścieżka, auth, parametry, **kody błędów i schematy ciał** | ✅ **zamrożone** (2.3 + odświeżenie w sesji 12d; +3 ścieżki Selly Tor 1 w 13d-1, bez fixtures) |
| `fixtures/` | 73 nagrania: **59 GET** + **14 tras zapisujących** | ✅ Krok 2.4 + sesja 12d |

## Co jest zamrożone

Z `docs/spec-backend.md` + `01_ENDPOINTY.md` (cytaty `plik:linia`, nie pamięć):
- **ścieżki i metody** wszystkich operacji,
- **auth** per operacja (`security` = wymaga JWT; brak `security` = **publiczne**),
- **parametry ścieżki** (`{id}`, `{kod}`, `{value}`, `{view}`),
- **kody odpowiedzi**, w tym realne kody błędów dopisane w 12d,
- **schematy ciał** żądań i odpowiedzi — dla każdej operacji, która ma nagranie.

## Fixtures

Każdy plik ma ten sam kształt:
```json
{ "endpoint": "...", "method": "GET", "status": 200, "json": true, "body": {...} }
```
Nagrania tras zapisujących dokładają `"request"` (ciało żądania) oraz `_zrodlo`/`_opis`.
Klucze zaczynające się od `_` są **techniczne** — porównanie kształtu w GATE je pomija
(`rebuild/backend/test/gate/ksztalt.ts`).

**To są fixtures KSZTAŁTU, nie pełne snapshoty danych.** Duże tablice przycięto do
5 elementów (`_body_przyciete_z` dla gołej tablicy, `_przyciete: {klucz: ile}` dla tablicy
w obiekcie), bo celem jest zamrożenie **struktury odpowiedzi**, nie archiwum danych.

**Ustalenie kontraktowe:** API zwraca **camelCase** (`cenaZakupu`, `cenaSprzedazy`,
`marzaPct`, `kodDostawcy`), mimo że baza jest snake_case (`cena_zakupu`). Warstwa
API konwertuje — nowy backend musi to zachować. **Wyjątkiem są trasy, które produkcja
czyta surowym `better-sqlite3`** (`/api/products/uwagi-cena`, `/hold-reasons`,
`/api/selly/log`) — te oddają nazwy KOLUMN i fixture jest tego jedynym dowodem.

Sanityzacja: brak sekretów (config: klucze puste; users: bez hashy; zero JWT/Bearer —
nagrywarka maskuje `token` i pola hasłowe do `"***"`).

### Skąd się biorą nagrania — dwie różne nagrywarki

| Narzędzie | Co nagrywa | Przeciw czemu |
|---|---|---|
| `tools/record-fixtures.sh` | **tylko GET** | ŻYWA produkcja (`panel.agritires.eu`), wymaga logowania |
| `tools/record-write-fixtures.cjs` | **GET + POST/PUT/PATCH/DELETE** | ORYGINAŁ (`mirror/backend/index.cjs`) na KOPII `db/snapshot.db` |

Pierwsze narzędzie celowo nie umie nic zapisać — wysłanie POST-a modyfikowałoby dane
produkcji. Drugie (sesja 12d) odwraca układ: stawia oryginalny backend lokalnie, więc
zapisy są bezpieczne, a nagranie **odtwarzalne bez sekretów i bez dostępu do produkcji**:

```bash
node tools/record-write-fixtures.cjs
```

Co robi krok po kroku i dlaczego to jest wierne:
1. kopiuje `mirror/backend/` i `db/snapshot.db` do katalogu tymczasowego (baza jako `data.db`
   **obok** `index.cjs` — oryginał otwiera ją relatywnie, ale `products/clear` robi kopię przez
   `__dirname`, więc CWD musi się zgadzać);
2. **wygasza scheduler w kopii** (`czestotliwosc_minuty = NULL`). Bez tego `startScheduler`
   (`extensions.cjs:811-838`) po 60 s realnie poszedłby po pliki sześciu dostawców;
3. uruchamia **własny skrypt migracyjny Ani** `migrate_szer_to_text.cjs` (podmieniona wyłącznie
   linia z zahardkodowaną ścieżką produkcyjną) — snapshot jest z 2026-08-13, starszy niż
   migracja `szertxt` z 19/20.08;
4. **(od 13c) doprowadza kopię do stanu produkcji po 09-01** — `migrujKonwencje()`: `kategoria`
   idzie WŁASNYM skryptem Ani `apply_kategoria.cjs` (podmieniona wyłącznie ścieżka do bazy,
   dokładnie jak w kroku 3 dla `migrate_szer_to_text.cjs`); `konstrukcja` i CAPS (`nazwa`)
   idą SQL-em przepisanym z `mirror/backend/CHANGELOG.md` (wpisy 2026-09-01 11:35 i 12:30),
   bo literalnego skryptu Ania dla nich w repo nie zostawiła. **Zasada:** stan wejściowy
   piaskownicy doprowadzamy do stanu produkcji artefaktami PRODUKCJI, nigdy plikami
   `rebuild/schema/00X_*.sql` — inaczej nagranie byłoby dowodem na naszą własną migrację,
   a nie na zachowanie oryginału. Wyjątek: `DELETE` wierszy `staging_items` CASE_ONLY (CHANGELOG
   09-01 12:30) nagrywarka celowo NIE odtwarza — CHANGELOG podaje ten `DELETE` w skrócie
   z placeholderami (`UPPER(A)=UPPER(B)`), więc przepisanie byłoby zgadywaniem wpływającym
   na kształt `GET /api/staging`.
5. startuje oryginał; ten sam dokłada kolumnę `uwaga_cena` (`uwaga_cena_patch.cjs:26-34`);
6. loguje się i odgrywa scenariusze, operacje niszczące na końcu.

**Odtwarzalne znaczy „ten sam KSZTAŁT", nie „bajt w bajt"** — `PUT`/`PATCH /api/products/{id}`
oddają zapisany rekord z `dataAktualizacji` z zegara.

⚠ Dwa moduły oryginału (`atrybuty`, `pending`) mają zahardkodowane produkcyjne ścieżki do bazy
i lokalnie się nie podnoszą. Trasy `/api/atrybuty*` są więc w piaskownicy martwe — nie blokuje
to zakresu 12d, ale rozszerzenie nagrań o atrybuty będzie wymagało obejścia tych ścieżek.

### Czego NIE MA i dlaczego

**Trwałe braki strukturalne** (nie zaległość do domknięcia):
- `GET /api/export-shoper` i `GET /api/export/shoper` — `text/csv`/`application/zip`; nagrywarka
  zapisuje JSON. Pokrycie: kontrakt + test formatu bajtowego.
- `POST /api/selly/{producers,categories,sync-product,sync-supplier}` — wołają zewnętrzne API
  Selly, nagranie zmieniałoby cudzy sklep. Pokrycie: kontrakt + atrapa klienta
  (`rebuild/backend/test/gate/selly-atrapa.ts`).
- `GET /api/selly/sync-status`, `POST /api/selly/sync-delta-supplier`, `POST /api/selly/sync-delta-all`
  (Tor 1, ticket 45, decyzja D6) — dopisane do `openapi.yaml` **bez** nagrania, wyjątkowo bez
  szans na domknięcie: kształty odpowiedzi Selly dla `GET /api/products?ean=`, `GET/POST
  .../variants`, `PUT .../variants/{vid}` nie są nigdzie w repo udokumentowane, a odpytanie
  żywego, cudzego Selly jest zakazane (`CLAUDE.md`). `tools/record-write-fixtures.cjs` nagrywa
  zapisy do bazy Bridge, nie odpowiedzi zewnętrznego API — tu nie ma czego uruchomić lokalnie.
  Świadomie NIE wstawiono syntetycznego fixture'a, żeby nie podważać wiarygodności tego
  katalogu. Weryfikacja: testy za atrapą + walidacja metody/statusu/content-type wobec
  `openapi.yaml`. Szczegóły: `docs/tickets/45-FEATURE-selly-rest-sync-tor1/plan.md` (D6).
- `POST /api/import/from-url`, `POST /api/dostawcy/{kod}/synchronizuj-teraz` — realnie pobierają
  pliki z URL-i dostawców.
- `POST /api/ai-fallback/parse` — zewnętrzne AI.
- `POST /api/dostawcy/{kod}/upload`, `POST /api/import/parse-file` — multipart, wymagają plików
  wejściowych spoza repo.

**Zaległość świadoma (kandydat na osobny ticket):** pozostałe trasy zapisujące działające
wyłącznie na SQLite — staging, dostawcy, narzuty, promocje, overrides, atrybuty, config,
spedycja, waga-gabarytowa. Sesja 12d objęła zakresem 12 operacji (produkty z 12a, konto/admin
z 12b, `login`/`logout`); nagrywarka jest w repo, więc rozszerzenie to dopisanie scenariuszy.

## Schematy ciał — generowane, nie pisane ręcznie

`tools/generate-openapi-schemas.cjs` wnioskuje schematy z `contract/fixtures/` i wstawia je do
`openapi.yaml` jako `$ref` do `components/schemas`.

```bash
node tools/generate-openapi-schemas.cjs            # przebuduj
node tools/generate-openapi-schemas.cjs --sprawdz  # tylko kontrola aktualności
```

- ⭐ **Źródłem są nagrania produkcji, nigdy `rebuild/`.** Gdyby schematy powstawały z naszej
  implementacji, kontrakt przestałby być niezależnym dowodem.
- Generator **edytuje tekst chirurgicznie**, a nie przez `yaml.dump()` — inaczej skasowałby
  komentarze kontraktu. `paths` zmienia się o jedną linię na operację.
- Jest **idempotentny**; tryb `--sprawdz` pilnuje dryfu i jest wpięty w testy
  (`rebuild/backend/test/kontrakt.spojnosc.test.ts`).
- Operacja z kilkoma legalnymi kształtami dostaje `oneOf` — tak jest z `GET /api/products`
  (koperta `{items,total,limit,offset}` z parametrem, **goła tablica** bez) oraz
  z `POST /api/products` (ciało jako tablica albo jako `{items: […]}`).

## ⚠ Uwaga bezpieczeństwa wbudowana w kontrakt

Operacje z `security: []` są **publiczne bez logowania** — to **stan faktyczny produkcji**,
nie rekomendacja.

**Zmierzone na uruchomionym oryginale (sesja 12d), nie wywnioskowane:** 14 z tych tras
(m.in. `GET /api/export/shoper` = pełny katalog CSV, `/api/audit-log`, `/api/history*`,
`/api/config`, `/api/staging`, `/api/markups`, `/api/promotions`) faktycznie oddaje **200 bez
tokenu**. Odbudowa chroni je `requireAuth` — to świadome odstępstwo (roadmap §3, D1 z I1).
Kontrakt tego **nie zaciera**: `security` zostaje puste (opisuje produkcję), a odstępstwo
niesie jawna adnotacja **`x-odbudowa-auth`** przy operacji, razem z zadeklarowanym `401`.
Dzięki temu GATE sprawdza odstępstwo kontraktem, zamiast obchodzić go osobnym testem.

Spójność tych adnotacji z rzeczywistym zachowaniem backendu pilnuje test — mierzy je
żądaniem, nie wierzy deklaracji.

**Dwa `401` to NIE odstępstwo, tylko produkcja:** `GET /api/me` (oryginał chroni tę trasę
ręcznym `if (!req.user)` zamiast wspólnym middlewarem, więc inwentarz 2.3 uznał ją za
publiczną) i `POST /api/login` przy złym haśle. Kontrakt 2.3 nie deklarował żadnego z nich;
oba dopisane w 12d na podstawie pomiaru i nagrania.

## Jak używać przy odbudowie

1. Nowy backend implementuje ścieżki z `openapi.yaml`.
2. Nagrane fixtures puszczamy na nowy backend → odpowiedzi muszą się zgadzać.
3. Rozbieżność = błąd, zanim dotknie produkcji.

Mechanizm z punktów 2-3 istnieje jako harness **GATE** (`rebuild/backend/test/gate/`,
`sprawdzZgodnoscZFixture` i `sprawdzZgodnoscZKontraktem`), odpalany przez `npm test`
w `rebuild/backend` i wpięty w CI. `wczytajFixture()` czyta z pliku wyłącznie `body`, więc
obsługuje nagrania każdej metody bez zmian w harnessie.

**Zadeklarowane wyjątki.** Gdy rozjazd jest znany i udokumentowany, GATE dopuszcza wyjątek
(`WyjatekGate`: wzorzec ścieżki + powód + co go domyka). Wyjątek jest **samoczyszczący**:
gdy przestaje cokolwiek pokrywać, zapala test i żąda usunięcia. Tak zniknął jedyny wyjątek
odbudowy — `WYJATKI_SZEROKOSC` — po przenagraniu `GET_products.json` w 12d. Sam mechanizm
pokrywają dziś testy w `test/gate.harness.test.ts`.

**Zakres walidacji kontraktem** (`sprawdzZgodnoscZKontraktem`): istnienie ścieżki i metody,
zadeklarowany kod statusu, JSON-owatość odpowiedzi. Schematy ciał są w pliku od 12d, ale GATE
egzekwuje kształt **przez fixtures**, z których te schematy powstały — nie przez walidator
JSON Schema. Nie czytaj „zgodne z openapi" jako gwarancji kształtu odpowiedzi.
