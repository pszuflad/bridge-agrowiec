# 38-CHORE-kontrakt-fixtures-odswiezenie — Odświeżenie kontraktu i fixtures (Iteracja 12, sesja 12d)

> Status: Draft → Approved → Implemented → Shipped
> Branch: `chore/38-kontrakt-fixtures-odswiezenie`
> Worktree: `.worktrees/38-CHORE-kontrakt-fixtures-odswiezenie`

## Opis ticketa

Iteracja 12, sesja 12d wg `docs/rebuild-roadmap.md` §5 (obszar D „Odświeżenie kontraktu
i fixtures" + „Zaległości z I3" pkt 1 i 3), §2, §3.

Ticket typu **chore, ale o podwyższonym ryzyku**: dotyka KONTRAKTU (`contract/openapi.yaml`)
i FIXTURES (`contract/fixtures/`), czyli samej siatki bezpieczeństwa GATE — nie logiki
aplikacji. Zmieniamy **dowód**, więc dowód musi zostać **niezależny**.

⭐ **ZASADA NADRZĘDNA:** schematy ciał i fixtures powstają **z nagrań produkcji / oryginału**,
NIE z naszej implementacji w `rebuild/`. Inaczej kontrakt przestaje być niezależnym dowodem
i zaczynamy sprawdzać własną pracę własną pracą.

Zakres z promptu:
1. `openapi.yaml` — realne kody błędów (m.in. `401` dla `GET /api/me` i `POST /api/login`)
   + schematy ciał, których wersja 2.3 nie zamraża.
2. Fixtures ZAPISUJĄCE (POST/PUT/PATCH/DELETE) — nagrać przeciw **kopii bazy**, z **oryginału**.
3. `GET /api/products` **bez parametrów** (goła tablica) — dograć fixture.
4. Backlog #3 (`szerokosc` TEXT) — przenagrać `GET_products.json`, co usuwa wyjątek
   `WYJATKI_SZEROKOSC`; „przy okazji ujawnić `products.uwaga_cena`" — **patrz D1, punkt obalony**.

## Context

### Stan wejściowy (zweryfikowany, nie założony)

- **12a, 12b i 12c są zmergowane.** Baza tego ticketa to `origin/develop` = `7f3d876`
  (PR #49, ticket `37-FEATURE-katalog-edycja-produktu` = sesja 12c). Ticket 37 **nie dotknął**
  `contract/`, `test/katalog.gate.test.ts` ani `src/repos/kolumny.ts` — zakres 12d jest czysty.
- `contract/openapi.yaml`: **96 ścieżek / 113 operacji**, w tym **52 operacje zapisujące**.
  Każda operacja ma dziś `requestBody: {schema: {type: object}}` i odpowiedzi z samym
  `description`. Nie ma sekcji `components/schemas`.
- `contract/fixtures/`: **55 nagrań GET** (54×200). Zero nagrań tras zapisujących.
- GATE (`rebuild/backend/test/gate/`): `sprawdzZgodnoscZKontraktem` sprawdza wyłącznie
  istnienie ścieżki+metody, zadeklarowany kod statusu i JSON-owatość; **kształt ciała pilnują
  wyłącznie fixtures** (`sprawdzZgodnoscZFixture` → `porownajKsztalt`).
- `wczytajFixture()` (`test/gate/fixtures.ts:19-27`) czyta z pliku **tylko `body`** — nie
  porównuje `method`/`status` z żądaniem testowym. **Harness już dziś obsłuży fixture dla metody
  innej niż GET**, bez zmian; wystarczy nazwa pliku i przekazane ciało odpowiedzi.

### Dowód wykonalności mechanizmu — uruchomiony, nie założony

Przed napisaniem tego planu postawiłem oryginał lokalnie i przeszedłem pełną pętlę.
Wyniki (wszystkie empiryczne, w piaskownicy poza repo):

- `mirror/backend/index.cjs` **wstaje i serwuje**. Wymaga `npm install` (6 zależności:
  `better-sqlite3@^11.7.0`, `csv-parse`, `dotenv`, `exceljs`, `iconv-lite`, `xlsx`);
  `better-sqlite3` **zbudował się bez problemu pod Node 20.20.2**, bez ręcznego rebuildu.
- Bazę otwiera **relatywną ścieżką** `new Database("data.db")`, ale `POST /api/products/clear`
  robi kopię przez `path.join(__dirname, "data.db")` — więc proces **musi startować z CWD
  równym katalogowi backendu**, inaczej dwie ścieżki się rozjadą.
- Konfiguracja przez env: `PORT`, `JWT_SECRET` (fallback `"bridge-agrowiec-secret-2026"`).
- Logowanie działa: konta w snapshocie mają hasło z własnego seeda oryginału
  (`Wi.hashSync("Bridge2026!", 10)`, `mirror/backend/index.cjs` offset 300) — `POST /api/login`
  oddaje `{ok, user, token}`. Nie trzeba podrabiać JWT ani nadpisywać hashy.
- **Kody błędów potwierdzone na żywo:** `GET /api/me` bez tokenu → **401**
  `{"error":"Nieautoryzowany"}`; `POST /api/login` ze złym hasłem → **401**
  `{"error":"Nieprawidłowy email lub hasło"}`.
- `GET /api/products` **bez parametrów** → **goła tablica 7405 pozycji po 72 klucze**
  (potwierdza gałąź `if (l === void 0 && !f) return u.json(U.listProducts())`,
  `deminified/backend-index.cjs:48291-48295`).

### Dwie pułapki wykryte przy tym samym biegu

1. **Scheduler oryginału rusza po URL-e dostawców w ciągu 60 s od startu.**
   `startScheduler` (`mirror/backend/extensions.cjs:811-838`) tika co 60 s i odpala
   `runAutoPull` dla każdego dostawcy z ustawionym `czestotliwosc_minuty`; w snapshocie
   **6 z 10 dostawców** ma ustawioną częstotliwość (MO1 10080, MO2/3/4/5/9 po 60).
   Nagrywarka **musi** wygasić to w KOPII (`UPDATE suppliers SET czestotliwosc_minuty = NULL`)
   przed startem, inaczej nagranie wyśle ruch do serwerów dostawców.
2. **Moduły `atrybuty` i `pending` mają własne uchwyty do bazy po ścieżkach produkcyjnych**
   i przy starcie lokalnym padają („Cannot open database because the directory does not exist").
   Reszta backendu wstaje normalnie. Trasy `/api/atrybuty*` i `/api/*/pending*` są w tym
   sandboxie martwe — **poza zakresem tego ticketa** (nagrywamy tylko produkty, konto/admin
   i auth), ale musi to być zapisane, żeby kolejna sesja nie odkrywała tego drugi raz.

### Wiek snapshotu — rozwiązany, nie obchodzony

`db/snapshot.db` jest z **2026-08-13**, czyli **starszy** niż obie migracje, których dowodem
ma być przenagrany fixture:

- `szerokosc` jest w nim `REAL` (migracja `szertxt` w produkcji: 2026-08-19/20),
- kolumny `uwaga_cena` **nie ma wcale** (patch produkcji: 2026-08-24).

Obie luki domykają się **kodem produkcji, nie naszym**:

- `uwaga_cena` — oryginał **dokłada ją sam przy każdym starcie**, idempotentnym
  `ALTER TABLE products ADD COLUMN uwaga_cena TEXT` (`mirror/backend/uwaga_cena_patch.cjs:26-34`,
  wołane z `extensions.cjs:466-467`). W logu startu widać `[uwaga_cena] Dodano kolumnę`.
- `szerokosc` — **własnym skryptem migracyjnym Ani** `mirror/backend/migrate_szer_to_text.cjs`.
  Uruchomiłem go na kopii: `szerokosc` stała się TEXT, **z zachowanymi zerami końcowymi**
  (`"8.00"`, `"10.0"`, `"15.0"`) — dokładnie to, czego broniła saga `szertxt`. Ten sam rekord
  przed migracją miał `8`, po migracji `"8.00"`.
  Skrypt ma zahardkodowaną ścieżkę produkcyjną (`/home/admin/private_apps/bridge/data.db`),
  więc nagrywarka podmienia **wyłącznie tę jedną linię**; reszta skryptu leci bajt w bajt.

Dzięki temu nagranie jest **w całości z kodu produkcji** (bundle + patche + skrypt migracyjny
Ani) i **powtarzalne offline** — nie wymaga dostępu do żywej produkcji ani Twojego udziału.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Ten ticket **modyfikuje** siatkę, więc zakres poniżej to jednocześnie przedmiot pracy i jej gate.

### Fixtures do PRZENAGRANIA (istnieją, zmienią treść)

| Plik | Co się zmienia | Dlaczego |
|---|---|---|
| `GET_products.json` | `szerokosc` liczba → **TEXT** | backlog #3, stan produkcji po `szertxt`; usuwa `WYJATKI_SZEROKOSC` |

Liczba kluczy pozycji zostaje **72** — patrz D1.

### Fixtures NOWE — odczyt

| Plik | Trasa |
|---|---|
| `GET_products_bez-parametrow.json` | `GET /api/products` (goła tablica, przycięta do 5 + `_body_przyciete_z`) |
| `GET_products_uwagi-cena.json` | `GET /api/products/uwagi-cena` (12a, dziś bez nagrania) |
| `GET_products_hold-reasons.json` | `GET /api/products/hold-reasons` (12a, dziś bez nagrania) |

### Fixtures NOWE — zapis (12 operacji, decyzja D3)

Produkty (sesja 12a — cztery mutacje):
`POST /api/products` · `PUT /api/products/{id}` · `PATCH /api/products/{id}` ·
`DELETE /api/products/{id}`

Konto/admin (sesja 12b — cztery mutacje):
`POST /api/password/change` · `PATCH /api/admin/supplier-config/{kod}` ·
`POST /api/maintenance/usun-nieopony` · `POST /api/products/clear`

Auth (dwie, dają kształt 200 **i** 401):
`POST /api/login` · `POST /api/logout`

Plus nagrania **kodów błędów** tam, gdzie są tanie i realne:
`GET /api/me` bez tokenu → 401 · `POST /api/login` złe hasło → 401 ·
`POST /api/products/clear` bez `{potwierdzenie:"WYCZYSC"}` → 400 ·
mutacja nieistniejącego `id` → 404.

### Ścieżki `openapi.yaml` w zakresie

**Schematy ciał:** wszystkie operacje mające nagranie — **55 GET + ok. 12 zapisujących**
(decyzja D5), przez generator, z `components/schemas` i `$ref`.
**Kody błędów:** `401` dla `GET /api/me` i `POST /api/login` (realne, potwierdzone);
`401` + adnotacja `x-odbudowa-auth` dla tras z odstępstwem auth (decyzja D4).

### Znane rozjazdy i jak je rozstrzygamy

| Rozjazd | Rozstrzygnięcie |
|---|---|
| Roadmapa 12d pkt 1 mówi „ujawnić `products.uwaga_cena`" | **Obalone dowodem z oryginału — D1.** Prostujemy roadmapę i backlog. |
| Kontrakt ma `security: []` na 17 trasach, odbudowa ma tam `requireAuth` | **D4** — kontrakt opisuje produkcję + jawna adnotacja odstępstwa. |
| `GET_products.json` (fixture) vs kanon (`003_szerokosc_text.sql`) | Racja po stronie produkcji → przenagrywamy fixture, usuwamy wyjątek. |
| Snapshot starszy niż migracje produkcji | Domknięte kodem produkcji (patch + skrypt Ani), nie naszym — patrz Context. |

## Decisions

Wszystkie z rundy Q&A z użytkownikiem (2026-09-07).

**D1 — `products.uwaga_cena` ZOSTAJE UKRYTA; roadmapa była w błędzie.**
Roadmapa (12d pkt 1) i backlog #3 zakładały, że przenagranie fixtures „przy okazji ujawni"
`products.uwaga_cena`, dziś ukrytą projekcją `src/repos/kolumny.ts`. **Sprawdziłem oryginał —
produkcja tej kolumny NIE oddaje przez `GET /api/products`:**
- `U.listProducts()` to `X.select().from(he).all()` (`deminified/backend-index.cjs:44699-44701`)
  — Drizzle bez jawnej listy kolumn, więc zwraca **pola MODELU**, nie kolumny tabeli.
- Model `he` (tabela `products`) nie deklaruje `uwagaCena`: `grep -c "uwagaCena\|uwaga_cena"
  deminified/backend-index.cjs` = **0**, `grep -c "uwagaCena" mirror/backend/index.cjs` = **0**.
- `uwaga_cena_patch.cjs` patchuje `U.acceptStaging` i `U.addProductsBulk`, ale **nie**
  `listProducts` — jedyni czytelnicy kolumny to dwa surowe endpointy `uwagi-cena`/`hold-reasons`.
- **Potwierdzone empirycznie:** po tym, jak patch dołożył kolumnę do bazy przy starcie,
  `GET /api/products?limit=5` z żywego oryginału dalej oddaje **72 klucze bez `uwagaCena`**.

Wniosek: kolumna dodana runtime'owym `ALTER TABLE` jest dla Drizzle niewidoczna. Ukrycie jej
w `KOLUMNY_POZA_KONTRAKTEM` jest **wierne produkcji**, a nie długiem do spłacenia — „ujawnienie"
byłoby **odstępstwem od produkcji**, czyli dokładnie tym, czego ten ticket ma bronić.
*Konsekwencja:* `kolumny.ts` bez zmian funkcjonalnych (aktualizujemy tylko komentarz, który dziś
kłamie, że to stan przejściowy do I12); prostujemy roadmapę §5/12d i backlog #3; fixture
`GET_products.json` zostaje przy 72 kluczach, a test „pozycja ma dokładnie te 72 klucze" nie
wymaga zmiany liczby.

**D2 — nagrania wyłącznie z piaskownicy oryginału na kopii bazy; zero kontaktu z produkcją.**
Kopia `db/snapshot.db` → skrypt migracyjny Ani → start `mirror/backend/index.cjs` → nagranie.
*Za:* powtarzalne (każdy odtworzy wynik jednym poleceniem), nie wymaga Twoich danych logowania,
nie dotyka żywego systemu, a kształt — to, co kontrakt realnie zamraża — jest identyczny.
*Przeciw:* wartości pochodzą z danych z 2026-08-13, o miesiąc starszych niż produkcja.
*Odrzucone:* przenagranie GET-ów z żywej produkcji (`tools/record-fixtures.sh`) — wyższa
wierność wartości, ale wymaga Twojego udziału i czyni nagrania jednorazowymi, nieodtwarzalnymi.
*Odrzucone:* świeży zrzut z VPS — blokuje ticket i podmienia plik, na którym stoją inne testy.

**D3 — zakres nagrań zapisujących = zakres ticketa (12 operacji), nie wszystkie 52.**
Nagrywamy cztery mutacje produktów (12a), cztery mutacje konto/admin (12b) oraz `login`/`logout`.
*Za:* domyka konkretny dług zapisany w roadmapie („sześć operacji 12a nie ma nagrań", „cztery
mutacje 12b też nie"), przy proporcjonalnym ryzyku dla siatki, którą ten ticket i tak przebudowuje.
*Przeciw:* pozostałe trasy lokalne (staging, dostawcy, narzuty, promocje, overrides, config,
spedycja, waga) zostają bez fixtures — jak dziś. Trafia to do „Follow-up" jako kandydat na
osobny ticket; nagrywarka zostaje w repo, więc rozszerzenie zakresu to dopisanie scenariuszy.
*Trwale poza nagraniem* (nie zaległość, brak strukturalny): `POST /api/selly/{producers,
categories,sync-product,sync-supplier}` (realny sklep Selly), `POST /api/import/from-url`
i `POST /api/dostawcy/{kod}/synchronizuj-teraz` (pobierają z URL-i dostawców),
`POST /api/ai-fallback/parse` (zewnętrzne AI), `POST /api/dostawcy/{kod}/upload`
i `POST /api/import/parse-file` (wymagają plików spoza repo).

**D4 — `openapi.yaml` opisuje PRODUKCJĘ; odstępstwa auth odbudowy dostają jawną adnotację.**
`security` i kody błędów zostają produkcyjne — kontrakt ma pozostać niezależnym lustrem produkcji.
Przy trasach, gdzie odbudowa świadomie dołożyła `requireAuth` (odstępstwa D1 z I1, D2 z I8/12b),
dopisujemy `x-odbudowa-auth` z powodem **i** dopuszczamy `401` jako zadeklarowany kod.
*Za:* GATE może testować 401 jednolicie przez `sprawdzZgodnoscZKontraktem`, zamiast omijać
kontrakt osobnym testem — dziś tak stoi `GET /api/audit-log` (nota 12b w roadmapie).
*Przeciw:* kontrakt niesie jedną informację o odbudowie; jest ona jawnie oznaczona `x-`
i nie zmienia `security`, więc lustro produkcji zostaje czytelne.

**D5 — schematy ciał dla wszystkiego, co ma nagranie (55 GET + ok. 12 write), generatorem.**
Generator czyta `contract/fixtures/` i wypisuje schematy do `openapi.yaml`, z powtarzającymi się
kształtami w `components/schemas` (`$ref`), żeby 72-polowy `Produkt` nie powielił się kilka razy.
*Za:* schematy powstają **z nagrań, nie z naszego kodu** (zasada nadrzędna); praca mechaniczna
i odtwarzalna — przy kolejnym przenagraniu schematy regenerują się same, zamiast dryfować.
*Przeciw:* `openapi.yaml` urośnie z ~1200 linii do kilku tysięcy.
*Odrzucone:* schematy tylko dla tras tego ticketa (DoD „kontrakt uzupełniony o schematy ciał"
zostałby w większości niedowieziony); pisanie ręczne (67 operacji, łatwo o literówkę,
nieodtwarzalne).

**D6 — nagrywarka ląduje w repo jako narzędzie, nie jako jednorazowy skrypt w piaskownicy.**
Wynika z D2 (powtarzalność jest głównym argumentem za tym mechanizmem). Bez skryptu w repo
„nagrane z oryginału" jest twierdzeniem, którego nikt nie zweryfikuje.

### Świadome odstępstwa od zachowania oryginału

**Brak.** Ten ticket niczego w zachowaniu `rebuild/` nie zmienia — przeciwnie, D1 **usuwa**
planowane odstępstwo, zanim powstało. Zmiany dotykają kontraktu, fixtures, testów GATE
i dokumentacji.

## Implementation plan

### Krok 1 — nagrywarka fixtures zapisujących (`tools/record-write-fixtures.sh` + `tools/record-write-fixtures.cjs`)

Nowe narzędzie, obok istniejącego `tools/record-fixtures.sh` (który zostaje bez zmian — umie
tylko GET przeciw żywej produkcji i tak ma zostać). Kroki narzędzia:

1. Zbuduj piaskownicę w katalogu tymczasowym: kopia `mirror/backend/` + `db/snapshot.db`
   jako `data.db` w tym samym katalogu (wymóg `__dirname` z `products/clear`).
2. **Wygaś scheduler w KOPII:** `UPDATE suppliers SET czestotliwosc_minuty = NULL`.
   Bez tego oryginał po 60 s wyśle ruch do sześciu dostawców.
3. Zastosuj migrację produkcji: kopia `migrate_szer_to_text.cjs` z podmienioną **wyłącznie**
   linią `DB_PATH`; skrypt zapisuje w logu, że idzie o kopię.
4. `npm install --no-audit --no-fund` w piaskownicy (6 zależności).
5. Start `node index.cjs` z `PORT` (efemeryczny) i `JWT_SECRET`, CWD = piaskownica.
   Czekaj na gotowość odpytując `/api/me` (401 = wstał).
6. Zaloguj się przez `POST /api/login` — realnym żądaniem, którego odpowiedź jest jednocześnie
   nagraniem.
7. Odegraj scenariusze (Krok 2) w ustalonej kolejności; dla każdego zapisz plik fixture.
8. Zabij proces, usuń piaskownicę.

**Format pliku fixture zapisującego** — nadzbiór dzisiejszego, żeby `wczytajFixture()` działał
bez zmian (czyta tylko `body`):

```json
{
  "endpoint": "/api/products/{id}",
  "method": "PATCH",
  "request": { "cenaZakupu": 100 },
  "status": 200,
  "json": true,
  "body": { }
}
```

`request` jest nowy i to on daje schematy **ciał żądań** w `openapi.yaml`.
Przycinanie dużych tablic i adnotacja `_body_przyciete_z` — konwencja jak w istniejących
fixtures (np. `GET_alerts.json`).

**Sanityzacja:** pola hasłowe (`password`, `stareHaslo`, `noweHaslo` i pokrewne) oraz `token`
maskowane do stałych placeholderów — nagrywamy kształt, nie sekrety. Piaskownica i tak zna
wyłącznie hasło z seeda oryginału, ale maskowanie ma być regułą narzędzia, nie zależeć od tego.

### Krok 2 — scenariusze nagrań (kolejność ma znaczenie)

Operacje niszczące idą **na końcu**, bo kasują dane potrzebne wcześniejszym nagraniom.

1. `POST /api/login` (200) → `POST_login.json`; `POST /api/login` złe hasło (401) →
   `POST_login_401.json`
2. `GET /api/me` bez tokenu (401) → `GET_me_401.json`
3. `GET /api/products` bez parametrów → `GET_products_bez-parametrow.json`
4. `GET /api/products?limit=5` → **przenagranie** `GET_products.json`
5. `GET /api/products/uwagi-cena`, `GET /api/products/hold-reasons`
6. `POST /api/products` (bulk, oba kształty ciała: goła tablica **i** `{items:[…]}`)
7. `PUT /api/products/{id}`, `PATCH /api/products/{id}` na produkcie dodanym w kroku 6
8. `PATCH /api/products/{id}` na nieistniejącym id → 404
9. `DELETE /api/products/{id}`
10. `PATCH /api/admin/supplier-config/{kod}`
11. `POST /api/password/change`
12. `POST /api/logout`
13. `POST /api/products/clear` bez potwierdzenia → 400; potem z `{potwierdzenie:"WYCZYSC"}` → 200
14. `POST /api/maintenance/usun-nieopony`

### Krok 3 — generator schematów (`tools/generate-openapi-schemas.cjs`)

Czyta `contract/fixtures/*.json`, wnioskuje JSON Schema z `body` (i z `request`, gdy jest),
wpisuje do `contract/openapi.yaml`:
- powtarzalne kształty (pozycja produktu, dostawca, wpis audytu…) → `components/schemas` + `$ref`;
- typy z wartości nagrania; `null` w nagraniu → `nullable: true`;
- **nie nadpisuje** ręcznych opisów, `security` ani listy kodów statusów — dokłada `content`
  do istniejących odpowiedzi i `requestBody`.

Generator ma być **idempotentny**: drugi bieg na niezmienionych fixtures nie zmienia pliku.

### Krok 4 — kody błędów i adnotacje `x-odbudowa-auth` w `openapi.yaml`

- `401` dla `GET /api/me` i `POST /api/login` (potwierdzone empirycznie).
- Przegląd tras, gdzie odbudowa dołożyła `requireAuth` wbrew `security: []` w kontrakcie
  (m.in. `/api/audit-log`, `/api/history*`, `/api/config`, `/api/export/shoper`) — dopisanie
  `x-odbudowa-auth` z powodem i dopuszczenie `401`. Listę tras ustalam **z kodu odbudowy**
  (to fakt o nas, nie o produkcji — jedyne miejsce, gdzie źródłem jest `rebuild/`).

### Krok 5 — usunięcie wyjątku `WYJATKI_SZEROKOSC`

Po przenagraniu `GET_products.json` wyjątek przestaje cokolwiek pokrywać i test-strażnik się
zapala. **To sygnał do usunięcia wyjątku, nie do naprawy testu.** Usuwamy z
`rebuild/backend/test/katalog.gate.test.ts`: samą listę, jej przekazanie do
`sprawdzZgodnoscZFixture`, test-strażnik „GATE ma dokładnie JEDEN zadeklarowany wyjątek"
oraz nagłówkowy komentarz o odstępstwie. Sprawdzamy też, czy `WyjatekGate` ma jeszcze
jakiegokolwiek użytkownika — jeśli nie, typ **zostaje** (jest częścią harnessu, nie tym wyjątkiem).

### Krok 6 — nowe testy GATE

- `GET /api/products` bez parametrów vs `GET_products_bez-parametrow.json` (goła tablica).
- `GET /api/products/uwagi-cena`, `GET /api/products/hold-reasons` vs nowe fixtures.
- Mutacje produktów i konto/admin vs nagrane fixtures zapisujące (`sprawdzZgodnoscZFixture`
  na ciele odpowiedzi + `sprawdzZgodnoscZKontraktem` na ścieżce/kodzie).
- Test-strażnik z D1: `GET /api/products` ma dokładnie 72 klucze i **nie** zawiera `uwagaCena`.

### Krok 7 — dokumentacja

- `contract/README.md` — nowy stan: czym są fixtures zapisujące, jak je odtworzyć, co jest
  trwale poza nagraniem i dlaczego; sprostowanie akapitu „Czego wciąż NIE ma".
- `docs/rebuild-roadmap.md` §5/I12 — 12d rozliczone; **usunięty** błędny zapis o ujawnianiu
  `uwaga_cena`; ustalenia dla 12e wpisane **do bloku 12e**.
- `docs/rebuild-backlog.md` #3 i #4 — statusy + sprostowanie.
- `src/repos/kolumny.ts` — komentarz przy `products: ["uwagaCena"]` przestaje kłamać, że to
  stan przejściowy do I12; nowy powód: produkcja też tej kolumny nie oddaje (z cytatem linii).

## Testing strategy

- **GATE fixtures:** każda trasa z sekcji „Kontrakt i fixtures (zakres)" porównana z nagraniem
  przez `sprawdzZgodnoscZFixture` — kształt 1:1. Nagrania pochodzą z ORYGINAŁU, więc porównanie
  jest realnym testem odbudowy, a nie sprawdzaniem własnej pracy własną pracą.
- **GATE kontrakt:** odpowiedzi walidowane przez `sprawdzZgodnoscZKontraktem`; po Kroku 3
  kontrakt niesie także schematy, więc warto rozważyć rozszerzenie walidacji o `content`
  — **jeśli** da się to zrobić bez przebudowy harnessu; w przeciwnym razie trafia do Follow-up
  (schematy i tak są egzekwowane przez fixtures, z których powstały).
- **Walidacja samego `openapi.yaml`:** plik musi się parsować i być poprawnym OpenAPI 3.0.3.
  Dziś w repo nie ma walidatora — dokładam sprawdzenie w teście (parser + kontrola struktury),
  żeby wygenerowany plik nie mógł wjechać uszkodzony.
- **Regresja całej suity:** cały `npm test` w `rebuild/backend` — przenagrany `GET_products.json`
  dotyka testów katalogu, a schematy w kontrakcie dotykają każdego testu GATE.
- **Weryfikacja niezależności dowodu:** test/asercja, że nagrania nie powstały z `rebuild/`
  — nagrywarka zapisuje w pliku źródło (`mirror/backend`, commit snapshotu), a przegląd
  sprawdza, że żaden nowy fixture nie został wygenerowany z naszego backendu.
- **Czego NIE testujemy:** tras trwale poza nagraniem (D3) — zostają na pokryciu kontraktem
  i testach na atrapach, jak dziś.

## Out of scope

- Mutacje BE produktów (12a — zrobione), konto/admin (12b — zrobione), dialog edycji FE
  (12c — zrobione, ticket 37), finalny audyt i przegląd 12 widoków (12e).
- Nagrania tras zapisujących spoza 12 wybranych w D3 (staging, dostawcy, narzuty, promocje,
  overrides, config, spedycja, waga, atrybuty) — Follow-up.
- Trasy trwale bez nagrań (Selly zewnętrzne, import z URL, ai-fallback, uploady plików).
- Naprawa modułów `atrybuty`/`pending` w piaskownicy oryginału (padają na ścieżkach
  produkcyjnych) — nie są potrzebne w zakresie D3.
- Świeży zrzut bazy z produkcji, zmiany w `tools/record-fixtures.sh`, zmiany w logice `rebuild/`.

## Definition of done

- [ ] `tools/record-write-fixtures.*` w repo: stawia oryginał na kopii bazy, wygasza scheduler,
      stosuje migrację Ani, nagrywa scenariusze, sprząta po sobie — i da się go uruchomić ponownie
- [ ] 12 operacji zapisujących nagranych z ORYGINAŁU, z ciałem żądania (`request`) i odpowiedzi
- [ ] `GET_products.json` przenagrany — `szerokosc` jako TEXT, pozycja dalej ma 72 klucze
- [ ] `GET_products_bez-parametrow.json` (goła tablica) + fixtures `uwagi-cena` i `hold-reasons`
- [ ] `WYJATKI_SZEROKOSC` **usunięty** z `test/katalog.gate.test.ts`, test zielony bez niego
- [ ] `uwagaCena` dalej ukryta w `kolumny.ts`, z komentarzem opartym na dowodzie z oryginału,
      i test-strażnik pilnujący 72 kluczy bez `uwagaCena`
- [ ] `openapi.yaml`: `401` dla `/api/me` i `/api/login`; `x-odbudowa-auth` + `401` przy trasach
      z odstępstwem auth; schematy ciał dla wszystkich operacji mających nagranie,
      z `components/schemas` i `$ref`
- [ ] `openapi.yaml` waliduje się (test), generator idempotentny
- [ ] `contract/README.md` opisuje nowy stan siatki i sposób odtworzenia nagrań
- [ ] roadmapa (12d rozliczone, błędny zapis o `uwaga_cena` **usunięty**, ustalenia dla 12e
      w bloku 12e) i backlog (#3, #4) zaktualizowane
- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` czyste w `rebuild/backend`
