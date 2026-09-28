# 3-FEATURE-katalog-odczyt — Iteracja 2: Katalog (odczyt)

> Status: Draft → **Approved** → Implemented → Shipped
> Branch: `feature/3-katalog-odczyt`
> Worktree: `.worktrees/3-FEATURE-katalog-odczyt`

## Opis ticketa

> Iteracja 2 — Katalog (odczyt) (wierna odbudowa Bridge)
>
> Realizuj Iterację 2 wg `docs/rebuild-roadmap.md` (§5 „Iteracja 2" + §1a środowiska + §3 zasady).
> Buduje na I1 — backend, frontend, auth i shell już są w `rebuild/`. To pierwszy widok z realnymi danymi.
>
> ZAKRES (backend + frontend w jednej sesji):
> - Backend: `GET /api/products` (lista: filtry + paginacja) oraz `GET /api/products/{id}` — wiernie wg
>   `contract/openapi.yaml` (ścieżki products) i `contract/fixtures/GET_products.json`. Odczyt z istniejącej
>   bazy (tabela `products` = „he", 72 kolumny). Auth wymagany (zasada §3).
> - Frontend: widok `/katalog` — tabela opon, filtry, wyszukiwarka, szczegół produktu. Wpięty w istniejący
>   shell/router z I1.
> - POZA ZAKRESEM: `POST /api/products/clear` (destrukcyjne) — to I12.
>
> ⚠ WAŻNE — baza staging to SNAPSHOT PRODUKCJI, ze schematem produkcji rozjechanym z kanonem:
> `products.szerokosc` jest TEXT (po zmianie „szertxt", backlog #3), a kanoniczny schemat/Drizzle w `rebuild/`
> ma REAL. Fixtures nagrano w Fazie 2 (przed sagą szerokości) → mają STARE wartości `szerokosc`. Rozjazd
> WARTOŚCI `szerokosc` to ZNANE, odłożone odstępstwo (backlog #3), NIE błąd. Kształt (klucze i typy
> pozostałych pól) musi się zgadzać 1:1.
>
> GATE: odpowiedź `/api/products` zgodna KSZTAŁTEM z `GET_products.json` + walidacja wg openapi.
>
> DEFINITION OF DONE: katalog renderuje realne dane ze staging; filtry/wyszukiwarka/szczegół działają;
> fixtures przez GATE (z odnotowanym odstępstwem `szerokosc`); po merge do develop auto-deploy na
> test.agritires.eu; Ania widzi katalog opon jak w oryginale.

## Kontekst

Pierwszy widok z realnymi danymi. Wszystko, co potrzebne, stoi już po I1: fabryka `stworzApp`, `requireAuth`,
warstwa Drizzle + better-sqlite3, harness GATE, shell FE z routerem Wouter i `queryClient` z `on401:returnNull`.
I2 dokłada jeden endpoint odczytu produktów, jeden endpoint dostawców i jeden ekran.

### Co realnie robi oryginał (zweryfikowane w kodzie, nie w spec)

**`GET /api/products`** — `deminified/backend-index.cjs:48280-48294`. Obsługuje **tylko trzy** parametry:

| Parametr | Zachowanie |
|---|---|
| `limit` | `Math.min(parseInt(limit) ‖ 200, 2000)`; **gdy nie podano → `undefined`** (nie 200!) |
| `offset` | `parseInt(offset ?? "0") ‖ 0` |
| `dostawca` | dokładne dopasowanie `eq(products.dostawca, …)` |

Rozgałęzienie, które trzeba odtworzyć dosłownie:
- `limit === undefined && !dostawca` → **goła tablica** wszystkich produktów (`listProducts()`),
- w przeciwnym razie → `{ items, total, limit: limit ?? 200, offset }`, gdzie `total` to `count(*)`
  **po filtrze `dostawca`** (`listProductsPaged`, `backend-index.cjs:44702-44721`).

Brak `search`, brak `sort`, brak `page`. Brak jawnej ścieżki 400 (kontrakt ją deklaruje — patrz niżej).

**`GET /api/products/{id}` NIE ISTNIEJE.** Ani w `contract/openapi.yaml:834-870` (tylko `delete`/`patch`/`put`),
ani w routingu oryginału. `U.getProduct()` istnieje, ale wołają go wyłącznie handlery mutacji. Frontend nigdy
nie pobiera detalu per-id — operuje na obiekcie już wczytanym z listy (`frontend-index.js:23780`).

**Frontend `/katalog`** (`frontend-index.js:23214-23900`) woła `["/api/products"]` **bez żadnych parametrów**,
czyli wariant „goła tablica" → ładuje komplet ~7405 rekordów (~15 MB JSON) i robi **wszystko po stronie
klienta**: zakładki dostawców, szukajkę, filtry marki/kategorii/statusu, sortowanie, paginację, wirtualizację
i eksport CSV. Dodatkowo woła `["/api/suppliers"]`, `["/api/config"]`, `["/api/atrybuty"]`.

**`GET /api/suppliers`** (`backend-index.cjs:48213-48216`, `45011-45036`) — ta sama funkcja obsługuje
`/api/dostawcy` i `/api/suppliers`. Zwraca wiersze `suppliers` posortowane po `kod`, wzbogacone o trzy
pola liczone w locie:
- `liczbaProduktow` = `count(*) from products where dostawca = kod` (**nadpisuje** kolumnę z bazy),
- `status` przeliczony: jest `ostatniPlik` → starszy niż 30 dni ⇒ `wstrzymany`, inaczej `liczbaProduktow === 0`
  ⇒ `blad`, inaczej `aktywny`; brak `ostatniPlik` **i** `liczbaProduktow === 0` ⇒ `wstrzymany`
  (brak `ostatniPlik` przy niezerowej liczbie produktów ⇒ status z kolumny zostaje),
- `ostatniaAktualizacjaCeny` / `ostatniaAktualizacjaStanu` — z zapytania okienkowego (`LAG`) po `historia_cen`,
  opakowanego w `try/catch` zwracający `[]` przy błędzie.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

| Ścieżka (openapi) | Fixture | Uwagi |
|---|---|---|
| `GET /api/products` (`openapi.yaml:802-810`) | `contract/fixtures/GET_products.json` | nagrane `?limit=5` → `{items[5], total:7405, limit:5, offset:0}`; **nie jest przycięte** (brak `_przyciete`) |
| `GET /api/suppliers` (`openapi.yaml:1137-1145`) | `contract/fixtures/GET_suppliers.json` | 17 pól, 5 pozycji |
| `GET /api/dostawcy` (`openapi.yaml:560-568`) | `contract/fixtures/GET_dostawcy.json` | bajt w bajt identyczny z `GET_suppliers.json` (ten sam handler) |

Wszystkie trzy operacje deklarują w kontrakcie `security: [bearerAuth, cookieAuth]` oraz kody `200/401/400` —
czyli zasada §3 („auth wymagany na trasach danych") jest tu **zgodna z kontraktem**, nie jest odstępstwem.

### Znane rozjazdy i sposób ich rozstrzygnięcia

1. **`GET /api/products/{id}` z opisu ticketa nie istnieje** — ani w produkcji, ani w kontrakcie.
   Wzorcem jest produkcja ⇒ **nie tworzymy go**. Zatwierdzone przez użytkownika w fazie pytań.
2. **`szerokosc` REAL ↔ TEXT** — kanon (`rebuild/schema/001_schema.sql:44`), Drizzle (`schema.ts:42`),
   `db/snapshot.db` (13.08, 7405 poz., `typeof` = `real` w 7395 wierszach + 10 `null`) i fixture zgodnie
   mówią „liczba". Aktualna produkcja po `szertxt` (`db/schema.sql:258`) ma **TEXT**. Backlog #3 ma status
   `🕒 PÓŹNIEJ` — decyzja należy do ticketu importu/schematu, nie do tego. **Rozstrzygnięcie: pass-through**
   (Decyzja D1) — rozjazd wartości na stagingu to świadome, odłożone odstępstwo; rozjazdu **typu** w GATE
   nie będzie, bo baza testowa powstaje z kanonu.
3. **Kontrakt deklaruje `400` dla `GET /api/products`, a handler nie ma ścieżki 400.** Nie produkujemy 400 na
   siłę — kontrakt wymienia dozwolone kody, nie wymagane. Harness (`test/gate/kontrakt.ts`) sprawdza tylko,
   czy zwrócony status jest zadeklarowany.
4. **`snow3Pmsf` w Drizzle vs `snow3pmsf` w fixture** — patrz Decyzja D5 (błąd introspekcji, do naprawy).
5. **Kolumny boolean** — patrz Decyzja D5.

## Decyzje

**D1 — `szerokosc`: pass-through bez konwersji.** API zwraca dokładnie to, co trzyma baza. SQLite jest
dynamicznie typowany, a Drizzle `real()` nie ma mapowania z drivera, więc ta sama linia kodu zwróci `620`
(number) na kanonie/lokalnym snapshocie i `"10.00"` (string) na stagingu po `szertxt`. GATE zielony (baza
testowa z kanonu = REAL = number). *Alternatywy odrzucone:* normalizacja do liczby cofałaby intencję
`szertxt` na stagingu („10.00" → 10), a normalizacja do stringa łamałaby fixture na poziomie TYPU — czyli
byłaby już twardym rozjazdem GATE, a nie odłożonym rozjazdem wartości. Pełne domknięcie backlogu #3
(schemat → TEXT + przenagranie fixtures) zostaje tam, gdzie backlog sam je odsyła.

**D2 — pobieranie danych 1:1 + kompresja transportu.** Backend odtwarza oba warianty oryginału (goła tablica
oraz `{items,total,limit,offset}`), frontend woła `/api/products` bez parametrów i filtruje/sortuje/paginuje
klient-side — dokładnie jak produkcja. Dodatkowo włączamy `compression` (gzip/brotli) na odpowiedziach:
identyczny JSON, ~10× mniej bajtów w locie. To warstwa transportu — **zero zmian w kontrakcie i w zachowaniu
API**. *Alternatywa odrzucona:* paginacja/filtry serwerowe wymagałyby parametrów, których produkcja nie ma —
wyjście poza wierną odbudowę i utrata siatki fixtures.

**D3 — z endpointów pobocznych katalogu dokładamy tylko dostawców.** `GET /api/suppliers` + `GET /api/dostawcy`
(jeden handler, dwie trasy — jak w oryginale) wchodzą do I2, bo zakładki dostawców to widoczny element ekranu,
a oba mają fixtures. `GET /api/config` (I11) i `GET /api/atrybuty` (I7) **zostają na swoje iteracje**.
Konsekwencja, świadomie przyjęta: listy marek i kategorii budujemy z samych produktów, więc nie pokażą się
wartości słownikowe bez ani jednego produktu; eksport CSV (zależny od `shoper.separator`/`shoper.kolumny`
z `/api/config`) → follow-up.

**D4 — „szczegół produktu" jako modal podglądu read-only.** W oryginale nie ma podglądu — jest modal EDYCJI
otwierany z „Edytuj". Odtwarzamy jego układ pól, ale wszystko zablokowane i bez zapisu. Mutacje
(`PATCH`/`DELETE`, wstrzymaj/aktywuj) i „Historia" zostają poza I2. *Odstępstwo w drugą stronę:* dokładamy
sposób obejrzenia pełnego rekordu, którego oryginał nie ma w trybie odczytu — zatwierdzone, bo realizuje
punkt „szczegół produktu" z opisu ticketa.

**D5 — naprawa dwóch defektów introspekcji w `src/db/schema.ts`** (sekcja „dopieszczenia"; `001_schema.sql`
zostaje nietknięty, bo typy kolumn w bazie się nie zmieniają):
- `snow3Pmsf` → `snow3pmsf`. `drizzle-kit pull` scamelizował `snow_3pmsf` inaczej niż oryginał
  (`backend-index.cjs:43775`). Bez tej poprawki GATE zgłosiłby jednocześnie brakujący i nadmiarowy klucz.
- 10 kolumn dostaje `{ mode: "boolean" }`: `reinforced`, `extraLoad`, `cutResistant`, `heatResistant`,
  `stubbleResistant`, `nro`, `cho`, `ms`, `snow3pmsf`, `cfo` — dokładnie te, które oryginał ma w trybie
  boolean (`backend-index.cjs:43733-43780`). Fixture ma tam `false`, a `integer()` zwróciłby `0` ⇒ twardy
  rozjazd typu. `NULL` zostaje `null` (Drizzle nie mapuje nulli) — zgodnie z fixture, gdzie `reinforced`
  jest `null`. **`eanIsValid` celowo ZOSTAJE zwykłym `integer()`** — oryginał też go nie boolean-uje,
  a fixture ma tam `1`.

**D6 — brak `GET /api/products/{id}`** (uzasadnienie w „Kontrakt i fixtures", pkt 1).

**Świadome odstępstwa od oryginału w tym tickecie:** D2 (kompresja — transport, nie zachowanie),
D4 (modal podglądu, którego oryginał nie ma), D3 (degradacja list marek/kategorii bez `/api/atrybuty`),
D5 (naprawa defektu naszej introspekcji — przywraca zgodność z oryginałem, nie odchodzi od niego).

## Plan implementacji

### Backend

1. **`src/db/schema.ts`** — dopieszczenia D5 (`snow3pmsf` + 10× `mode:"boolean"`), z komentarzem
   wskazującym `backend-index.cjs:43733-43780`. Test-strażnik: zbiór kluczy `products.$inferSelect`
   musi być równy zbiorowi kluczy pozycji z `GET_products.json`.
2. **`src/repos/products.ts`** — odpowiednik `U.listProducts` / `U.listProductsPaged`
   (`backend-index.cjs:44699-44721`):
   - `listaProduktow(db)` → wszystkie wiersze,
   - `listaProduktowStronicowana(db, limit, offset, dostawca?)` → `{ items, total }`, `total` = `count(*)`
     po tym samym filtrze co `items`.
3. **`src/routes/products.ts`** — `Router` w stylu `routes/auth.ts`: `GET /api/products` + `requireAuth`,
   parsowanie parametrów 1:1 (`Math.min(parseInt ‖ 200, 2000)`, `parseInt(offset ?? "0") ‖ 0`),
   rozgałęzienie goła tablica / obiekt. Komentarz z cytatem linii oryginału.
4. **`src/repos/suppliers.ts`** — odpowiednik `U.listSuppliers` (`backend-index.cjs:45011-45036`):
   wiersze `suppliers` ORDER BY `kod`, `liczbaProduktow` z `count(*)`, przeliczony `status` (próg 30 dni),
   `ostatniaAktualizacjaCeny`/`Stanu` z zapytania okienkowego po `historia_cen` w `try/catch` → `[]`.
5. **`src/routes/suppliers.ts`** — jeden handler, dwie trasy (`/api/dostawcy`, `/api/suppliers`),
   obie za `requireAuth`.
6. **`src/app.ts`** — rejestracja `trasyProduktow` i `trasyDostawcow`; `compression()` wpięte **przed**
   trasami, po CORS (D2). Nowa zależność: `compression` + `@types/compression`.

### Frontend

7. **`src/lib/magazynKV.ts`** — IndexedDB `bridge-store-v2` / store `kv` (`frontend-index.js:9161-9192`),
   funkcje `odczytajKV` / `zapiszKV`, oba z `try/catch` (oryginał połyka błędy).
8. **`src/components/ui/`** — dołożenie komponentów shadcn używanych przez katalog: `table`, `tabs`,
   `badge`, `dropdown-menu`, `dialog`, `checkbox`, `scroll-area` (tylko te, które ekran realnie użyje —
   zasada z I1: nie wnosimy martwych providerów).
9. **`src/pages/katalog/kolumny.ts`** — 59 definicji kolumn (`$r`, `frontend-index.js:22732-23021`:
   `key`, `label`, `width`, `align`) + `KOLUMNY_DOMYSLNE` (`Nn`, 15 pozycji, z `promocja` włącznie).
10. **`src/pages/katalog/filtrowanie.ts`** — **czyste funkcje** (najlepiej testowalny kawałek):
    - `filtrujSzukajka(produkty, fraza)` — tokeny po białych znakach, każdy token musi trafić w któreś
      z 16 pól (`kod, nazwa, sku, kodDostawcy, magazyn, ean, marka, model, rozmiar, rozmiarAlternatywny,
      indeksy, indeks1, indeks2, dot, kategoria, dostawca`), substring, case-insensitive
      (`frontend-index.js:23298-23304`),
    - `filtrujStatus(produkty, tryb)` — `all` / `dostepne` (`typeof stan === "number" && stan > 0`) /
      `brak_ean` (puste `ean`) / dosłowna wartość kolumny `status`,
    - `sortuj(produkty, kolumna, kierunek)` — numerycznie gdy **obie** wartości są liczbami, inaczej
      `String(a).localeCompare(String(b))`; brak wartości → `""` (`frontend-index.js:23307-23311`).
      Tu wchodzi D1: `szerokosc` jako string sortuje się tekstowo — zachowanie zgodne z oryginałem
      dla mieszanych typów.
11. **`src/pages/Katalog.tsx`** + podkomponenty (`ZakladkiDostawcow`, `PasekFiltrow`, `TabelaProduktow`,
    `PaginacjaKatalogu`, `ModalPodgladu`):
    - `useQuery({ queryKey: ["/api/products"] })` i `["/api/suppliers"]` — bez parametrów (D2),
    - zakładki dostawców z licznikami z danych + podtytuł
      (`"{n} pozycji w bazie · scal danych z 10 dostawców"` / `"{nazwa} · {email‖—} · format {FORMAT}"`),
    - filtry: szukajka (bez debounce — 1:1), multi-select marki i kategorii, single-select statusu,
    - sortowanie po kliknięciu nagłówka (asc/desc), konfigurator widoczności 59 kolumn zapisywany
      w IndexedDB pod kluczem `konfig-domyslne-kolumny`,
    - paginacja 25/50/100/Wszystkie (domyślnie 25), „Poprzednia"/„Następna",
      `Strona X z Y · N poz.`,
    - wirtualizacja gdy widocznych > 150 wierszy (wysokość wiersza 37 px, overscan 20, spacery
      `<tr>` góra/dół — `frontend-index.js:23312, 23816-23827`),
    - stany: „Wczytuję katalog…", „Brak produktów spełniających filtry",
      „Brak produktów od dostawcy X",
    - modal podglądu read-only (D4) otwierany z wiersza.
12. **`src/pages/placeholdery.ts` + `src/App.tsx`** — usunięcie `/katalog` z placeholderów, dodanie
    realnej trasy. Liczba tras routera zostaje 12 (test-strażnik z I1 tego pilnuje).

## Strategia testów

**GATE odbudowy** — `rebuild/backend/test/katalog.gate.test.ts`, na harnessie z I1
(`test/gate/index.ts`; baza z kanonu `001_schema.sql`, aplikacja bez `listen()`, prawdziwy SQLite
w katalogu tymczasowym — bez mocków i bez zajmowania portu):

- rozszerzenie `test/gate/baza.ts` o `zasiejProdukty()` i `zasiejDostawcow()` — kilka realistycznych
  wierszy pokrywających **oba warianty typów**: `eanIsValid` jako `1` (INTEGER) oraz kolumny boolean
  jako `0/1` i `NULL`, żeby `porownajKsztalt` faktycznie zweryfikował mapowanie z D5;
- `GET /api/products?limit=5` → `sprawdzZgodnoscZKontraktem` + `sprawdzZgodnoscZFixture("GET_products.json")`;
- `GET /api/suppliers` i `GET /api/dostawcy` → kontrakt + `GET_suppliers.json` / `GET_dostawcy.json`;
- `total` z fixture (7405) nie musi się zgadzać co do wartości — harness porównuje **typy**, nie treść
  (`test/gate/ksztalt.ts`); seedujemy kilka wierszy.

**Testy jednostkowe / integracyjne backendu** (`test/produkty.test.ts`, `test/dostawcy.test.ts`):
- brak `limit` i brak `dostawca` → **tablica**, nie obiekt (wariant niepokryty żadnym fixture — musi mieć
  własny test, bo to główna ścieżka używana przez frontend),
- `?limit=5` / `?limit=0` / `?limit=abc` → `200` (fallback `‖ 200`), `?limit=99999` → cap `2000`,
- `?offset=` niepoprawny → `0`; `?dostawca=MO9` bez `limit` → obiekt z `limit: 200` i `total` **po filtrze**,
- `401 {"error":"Nieautoryzowany"}` bez tokenu dla wszystkich trzech tras,
- **test-strażnik D1**: wiersz z `szerokosc` zapisaną jako TEXT (`'10.00'`) w bazie o kolumnie REAL
  przechodzi przez endpoint bez konwersji — utrwala pass-through i pokazuje, co zobaczymy na stagingu,
- **test-strażnik D5**: zbiór kluczy odpowiedzi == zbiór kluczy pozycji z `GET_products.json` (72),
- `listaDostawcow`: przeliczanie `status` (4 gałęzie) i `liczbaProduktow` na prawdziwej bazie.

**Testy frontendu** (Vitest + Testing Library + MSW, jak w I1):
- `test/katalog.filtrowanie.test.ts` — czyste funkcje z kroku 10 (tokeny AND, pola OR, tryby statusu,
  sortowanie mieszane liczba/tekst, `szerokosc` jako string i jako number),
- `test/katalog.test.tsx` — render z MSW: lista się rysuje, szukajka zawęża, zakładka dostawcy filtruje,
  paginacja przełącza strony, modal podglądu pokazuje pola, stany pusty/ładowanie,
- `test/shell.test.tsx` — aktualizacja: `/katalog` nie jest już placeholderem, liczba tras dalej 12.

**Czego nie testujemy:** wirtualizacji na poziomie pikseli (jsdom nie mierzy layoutu — sprawdzamy tylko,
że przy > 150 wierszach renderuje się podzbiór plus spacery) i IndexedDB w jsdom (funkcje `magazynKV`
mają `try/catch` i test sprawdza degradację do wartości domyślnych).

## Poza zakresem

- `POST /api/products`, `POST /api/products/clear`, `PATCH`/`PUT`/`DELETE /api/products/{id}` — mutacje, I12.
- `GET /api/products/{id}` — nie istnieje w produkcji ani w kontrakcie (D6).
- Akcje wierszowe: Edytuj, Wstrzymaj/Aktywuj, Usuń, „Historia" (w oryginale i tak `disabled`).
- Eksport CSV do Shopera — wymaga `GET /api/config`; → I8/follow-up.
- `GET /api/config` (I11) i `GET /api/atrybuty` (I7).
- Kolumna „Promocja" jest w domyślnym zestawie, ale dane do niej przychodzą z I4 — w I2 renderuje się
  pusto, dokładnie jak w oryginale bez wyliczonych promocji.
- Domknięcie backlogu #3 (`szerokosc` → TEXT w kanonie + przenagranie fixtures) — ticket importu/schematu.

## Definition of done

- [ ] `GET /api/products` odtwarza oba warianty oryginału (goła tablica / `{items,total,limit,offset}`),
      cap `limit` = 2000, filtr `dostawca`, `requireAuth`
- [ ] `GET /api/suppliers` i `GET /api/dostawcy` zwracają 17 pól z przeliczonymi `liczbaProduktow`,
      `status`, `ostatniaAktualizacja*`
- [ ] `src/db/schema.ts` naprawiony (D5) — 72 klucze zgodne co do nazwy i typu z fixture
- [ ] Kompresja odpowiedzi włączona (D2)
- [ ] **GATE:** `GET_products.json`, `GET_suppliers.json`, `GET_dostawcy.json` zielone
      (kształt 1:1 + walidacja wg `openapi.yaml`)
- [ ] Widok `/katalog` wpięty w router (12 tras bez zmian), renderuje realne dane
- [ ] Szukajka tokenowa, filtry marka/kategoria/status, zakładki dostawców, sortowanie po nagłówkach,
      paginacja 25/50/100/Wszystkie, konfigurator 59 kolumn w IndexedDB, wirtualizacja > 150 wierszy
- [ ] Modal podglądu read-only (D4)
- [ ] `lint`, `typecheck`, `test` zielone po obu stronach
- [ ] Rozjazd `szerokosc` opisany w `raport.md` wraz z propozycją domknięcia backlogu #3
- [ ] Po merge do `develop` auto-deploy stawia katalog na `test.agritires.eu`; Ania potwierdza wygląd
