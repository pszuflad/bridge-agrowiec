# 38-CHORE-kontrakt-fixtures-odswiezenie — Raport z implementacji

## Summary

Siatka bezpieczeństwa GATE dostała brakującą połowę: **14 nagrań tras zapisujących**
i trzy brakujące warianty odczytu, wszystkie zdjęte z **oryginalnego backendu produkcji**
postawionego lokalnie na kopii bazy. `contract/openapi.yaml` przestał być listą ścieżek —
niesie teraz **schematy ciał dla 71 operacji** (80 schematów w `components/schemas`)
i **realne kody błędów zmierzone na oryginale**, nie założone. Samoczyszczący wyjątek
`WYJATKI_SZEROKOSC` zapalił się po przenagraniu `GET_products.json` i został usunięty —
dokładnie tak, jak zaprojektowała to sesja 3d-1.

Najważniejsze ustalenie merytoryczne: **roadmapa myliła się co do `products.uwaga_cena`**.
Ukrycie tej kolumny jest wierne produkcji, a nie długiem do spłacenia (D1).

## Changes

### Nowe narzędzia
- **Nowy:** `tools/record-write-fixtures.cjs` — nagrywarka fixtures zapisujących. Stawia
  `mirror/backend/index.cjs` na kopii `db/snapshot.db`, wygasza scheduler, stosuje własny
  skrypt migracyjny Ani, odgrywa 19 scenariuszy, sprząta po sobie. Nie importuje niczego
  z `rebuild/`.
- **Nowy:** `tools/generate-openapi-schemas.cjs` — generator schematów z fixtures do
  `openapi.yaml`. Idempotentny, z trybem `--sprawdz`.

### Kontrakt i fixtures
- `contract/fixtures/GET_products.json` — **przenagrany**: `szerokosc` jako TEXT
  z zerami końcowymi (`"8.00"`).
- **Nowe (18):** `GET_products_bez-parametrow`, `GET_products_uwagi-cena`,
  `GET_products_hold-reasons`, `GET_me_401`, `POST_login`, `POST_login_401`, `POST_logout`,
  `POST_products`, `POST_products_items`, `PUT_products_id`, `PATCH_products_id`,
  `PATCH_products_id_404`, `DELETE_products_id`, `PATCH_admin_supplier-config_kod`,
  `POST_password_change`, `POST_maintenance_usun-nieopony`, `POST_products_clear`,
  `POST_products_clear_400`.
- `contract/openapi.yaml` — `components/schemas` (80 pozycji), `$ref` przy 71 operacjach,
  8 schematów ciał żądań, `401` dla 16 operacji, `x-odbudowa-auth` przy 14.
- `contract/README.md` — przepisany: dwie nagrywarki, format nagrań zapisujących, trwałe braki,
  generowane schematy, jak czytać `x-odbudowa-auth`.

### Testy i kod
- `rebuild/backend/test/katalog.gate.test.ts` — **usunięty** `WYJATKI_SZEROKOSC` i jego
  test-strażnik; dołożone: goła tablica, różnica kształtów obu wariantów, strażnik D1.
- `rebuild/backend/test/produkty.mutacje.gate.test.ts` — gate stoi już na fixtures, nie tylko
  na kontrakcie; drugi kształt ciała `POST`; strażnik `snake_case` dla `/uwagi-cena`.
- `rebuild/backend/test/admin.gate.test.ts` — cztery mutacje 12b porównane z nagraniami
  + kształt 200 przy zmianie hasła.
- `rebuild/backend/test/auth.gate.test.ts` — rozjazd 401 domknięty, nagrania `login`/`logout`.
- `rebuild/backend/test/gate.harness.test.ts` — trzy testy mechanizmu zadeklarowanych wyjątków.
- **Nowy:** `rebuild/backend/test/kontrakt.spojnosc.test.ts` — integralność `$ref`, brak
  osieroconych schematów, aktualność wobec fixtures, zgodność adnotacji `x-odbudowa-auth`
  z zachowaniem mierzonym żądaniem.
- `rebuild/backend/src/repos/kolumny.ts` — wyłącznie komentarz (D1). **Zero zmian logiki.**

## Deviations from plan

Trzy odstępstwa, wszystkie wykryte przy pracy i wszystkie zwiększające wierność:

1. **Kolejność scenariuszy zamieniona:** plan stawiał `products/clear` przed
   `maintenance/usun-nieopony`. Odwrócone — po wyczyszczeniu katalogu `usun-nieopony`
   nie miałoby czego liczyć i nagrałoby kształt z samymi zerami.
2. **Nagrywarka zasiewa jeden wiersz `uwaga_cena`** (`zasiejUwageCeny`). Bez tego
   `GET /api/products/uwagi-cena` nagrało się jako `{ok:true, items:[]}`, a pusta tablica
   we wzorcu **nie narzuca kształtu elementów** — fixture nie chroniłby klucza `uwaga_cena`
   w snake_case, czyli dokładnie pułapki opisanej w `CLAUDE.md`. Zasiew idzie po starcie
   serwera, bo kolumnę dokłada dopiero patch przy boocie. To zasiew DANYCH w kopii; SQL trasy
   pozostaje oryginału.
3. **Dołożone trzy testy mechanizmu wyjątków GATE** (poza planem). Usunięcie
   `WYJATKI_SZEROKOSC` zostawiło `WyjatekGate` bez ani jednego użytkownika i bez testu —
   czyli furtkę w siatce, której nikt nie uruchamia. Plan zakładał, że typ „po prostu zostaje".

Plan przewidywał też rozważenie walidacji odpowiedzi względem schematów JSON Schema w GATE.
**Nie zrobione** — wymaga nowej zależności (`ajv`), a kształt jest już egzekwowany przez
fixtures, z których te schematy powstały. Trafia do Follow-up.

## Ustalenia merytoryczne

### D1 — roadmapa myliła się co do `uwaga_cena` (najważniejsze)

Roadmapa (§5, 12d pkt 1) i backlog #3 zapowiadały, że przenagranie fixtures „przy okazji
ujawni" `products.uwaga_cena`, ukrytą dziś projekcją `src/repos/kolumny.ts`.
**To było błędne.** Dowód, w kolejności rosnącej twardości:

1. `U.listProducts()` to `X.select().from(he).all()` (`deminified/backend-index.cjs:44699-44701`)
   — Drizzle bez jawnej listy kolumn, więc oddaje pola MODELU, nie kolumny tabeli.
2. Model `he` nie zna `uwagaCena`: `grep -c "uwagaCena" mirror/backend/index.cjs` = **0**
   (a to plik wysłany na produkcję, razem z łatkami).
3. `uwaga_cena_patch.cjs` monkey-patchuje `U.acceptStaging` i `U.addProductsBulk` — **nie**
   `listProducts`. Kolumna dodana runtime'owym `ALTER TABLE` jest dla Drizzle niewidoczna.
4. **Zmierzone:** oryginał uruchomiony na kopii bazy, z kolumną już dodaną przez patch przy
   starcie, oddaje **72 klucze bez `uwagaCena`** — i w `GET /api/products`, i w odpowiedzi
   `PUT`/`PATCH /api/products/{id}` (dwie niezależne trasy).

Ukrycie kolumny jest więc **odtworzeniem produkcji**; ujawnienie byłoby odstępstwem.
Decyzja użytkownika: zostawiamy ukrytą, prostujemy roadmapę i backlog, dokładamy strażnika.

### Kody błędów — zmierzone, nie założone

Probe na uruchomionym oryginale, bez tokenu:

| Wynik | Trasy | Wniosek |
|---|---|---|
| **401** | `GET /api/me` | produkcja realnie chroni (ręczny `if (!req.user)`); kontrakt 2.3 się mylił |
| **401** | `POST /api/login` (złe hasło) | produkcja; kontrakt nie deklarował |
| **200** | 14 tras z `security: []` — `alerts`, `audit-log`, `config`, `export-shoper`, `export/shoper`, `history`×3, `markups`, `overrides`, `promotions`, `spedycja`, `staging`, `waga-gabarytowa/oblicz` | naprawdę publiczne; `requireAuth` u nas to odstępstwo |

Stąd podział: dwie pierwsze dostają zwykłe `401`, czternaście pozostałych `401`
**z adnotacją `x-odbudowa-auth`**, a `security` zostaje nietknięte (D4).

### Dwie trasy mają po dwa legalne kształty

Wykryte przy generowaniu schematów: `GET /api/products` oddaje kopertę albo gołą tablicę
zależnie od parametrów, a `POST /api/products` przyjmuje tablicę albo `{items:[…]}`.
Pierwsza wersja generatora brała pierwsze nagranie i po cichu gubiła drugie — kontrakt
zamrażałby połowę prawdy i uznawał drugą połowę za niezgodną. Naprawione przez `oneOf`.

### Wiek snapshotu — domknięty kodem produkcji

`db/snapshot.db` (2026-08-13) jest starszy niż `szertxt` (19/20.08) i patch `uwaga_cena` (24.08).
Obie luki zamyka **kod produkcji, nie nasz**: kolumnę dokłada patch przy starcie, a `szerokosc`
migruje własny skrypt Ani `migrate_szer_to_text.cjs` (podmieniona wyłącznie zahardkodowana
ścieżka). Efekt potwierdzony: `szerokosc` TEXT z zerami końcowymi (`"8.00"`, `"10.0"`, `"15.0"`).

### Pułapki oryginału odkryte przy stawianiu piaskownicy

- **Scheduler rusza po URL-e dostawców w 60 s od startu** (`extensions.cjs:811-838`);
  6 z 10 dostawców ma ustawioną częstotliwość. Nagrywarka wygasza to w kopii.
- **CWD ma znaczenie:** oryginał otwiera bazę relatywnie (`new Database("data.db")`), ale
  `products/clear` robi kopię przez `path.join(__dirname, "data.db")`.
- **Moduły `atrybuty` i `pending` mają zahardkodowane produkcyjne ścieżki** i lokalnie się nie
  podnoszą — trasy `/api/atrybuty*` są w piaskownicy martwe.
- Hasło kont ze snapshotu pochodzi z **własnego seeda oryginału**, więc logowanie działa bez
  podrabiania JWT i bez nadpisywania hashy.

## Test results

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.** Sprawdzone ścieżki i pliki:
  - `GET /api/products` (oba warianty) — `GET_products.json`, `GET_products_bez-parametrow.json`
  - `GET /api/products/uwagi-cena`, `/hold-reasons` — dwa nowe fixtures
  - `POST /api/products` (oba kształty ciała), `PUT`/`PATCH`/`DELETE /api/products/{id}`, `PATCH` 404
  - `PATCH /api/admin/supplier-config/{kod}`, `POST /api/password/change`,
    `POST /api/maintenance/usun-nieopony`, `POST /api/products/clear` (200 i 400)
  - `POST /api/login` (200 i 401), `POST /api/logout`, `GET /api/me` (401)
  - `GET /api/suppliers`, `GET /api/dostawcy` — bez zmian, dalej zielone
  - **Zero zadeklarowanych wyjątków** — `WYJATKI_SZEROKOSC` usunięty, nic nie weszło na jego miejsce.
- **Unit + integracyjne:** ✓ **1199 testów / 76 plików** (przed ticketem 1192/75).
- `npm run lint` ✓ · `npm run typecheck` ✓ · `npm run build` ✓
- Nagrywarka i generator: uruchomione wielokrotnie; generator **idempotentny**
  (`md5sum` bez zmian), tryb `--sprawdz` wpięty w testy.
- **Kontrola wycieku:** zero trafień `eyJhbGciOi`/`Bearer` w `contract/fixtures/` — token
  z `POST /api/login` był w pierwszym biegu zapisany jawnie (błąd maskowania na najwyższym
  poziomie ciała), wykryty i naprawiony przed commitem.

## Breaking changes

Brak zmian zachowania backendu. Zmiany dotyczą kontraktu, fixtures, testów i dokumentacji.
`contract/openapi.yaml` urósł z ~1200 do ~19 900 linii — to świadomy skutek decyzji D5
(schematy dla wszystkiego, co ma nagranie).

## Follow-up

1. **Nagrania pozostałych tras lokalnych** (staging, dostawcy, narzuty, promocje, overrides,
   atrybuty, config, spedycja, waga) — świadomie poza zakresem (D3). Nagrywarka jest w repo,
   więc to dopisanie scenariuszy. Dla atrybutów dojdzie obejście zahardkodowanych ścieżek.
2. **Walidacja odpowiedzi względem schematów JSON Schema w GATE** — dziś schematy są
   w kontrakcie, ale kształt egzekwują fixtures. Wymaga zależności `ajv`.
3. **`GET /api/products/uwagi-cena` w produkcji ma dziś realne dane** — nasze nagranie stoi na
   zasianym wierszu. Przy najbliższym świeższym snapshocie warto przenagrać bez zasiewu.
4. **`db/snapshot.db` ma miesiąc** — nowy zrzut z VPS podniósłby wierność wartości
   (kształt jest już wierny). Wymaga decyzji, bo plik jest wspólny dla innych testów.
5. **`GET /api/export-shoper` oddaje 500 na danych snapshotu** (`export/shoper` oddaje 200) —
   zaobserwowane przy probie auth, nie badane. Może być artefaktem starych danych.
