# 18-FEATURE-konfiguracja-config-spedycja — Iteracja 11: konfiguracja i limity spedycji

> Status: Draft → Approved → Implemented → Shipped
> Branch: `feature/18-konfiguracja-config-spedycja`
> Worktree: `.worktrees/18-FEATURE-konfiguracja-config-spedycja`

## Opis ticketa

Iteracja 11 wg `docs/rebuild-roadmap.md` §5. Jedna sesja, BE+FE. Cel biznesowy: Ania otwiera
`/konfiguracja`, edytuje ustawienia (spedycja, Shoper, katalog, AI) i limity spedycji.

Zakres MOCNO POMNIEJSZONY względem pierwotnej I11: dostawcy, wgrywanie i częstotliwość importu
wyszły do bloków 3f-1/3f-2 i są zrobione. Szkielet `/konfiguracja` z sześcioma zakładkami
istnieje; „dostawcy" i „wgrywanie" są wypełnione. Ta iteracja dowozi **cztery pozostałe
zakładki + endpointy config/spedycja**.

## Kontekst

### Co pokazał research (zweryfikowane osobiście w oryginale)

Prompt i roadmapa opisują tę iterację w trzech miejscach **niezgodnie ze stanem faktycznym**.
Wszystkie trzy rozjazdy potwierdziłem w zdeminifikowanym oryginale i w kontrakcie:

1. **Nie ma `PUT /api/config`.** Jest `POST /api/config` z ciałem `{klucz, wartosc}` —
   **jeden klucz na żądanie** (`deminified/backend-index.cjs:48740-48748`). Ani oryginał,
   ani `contract/openapi.yaml:541-560` nie znają metody PUT dla tego zasobu. Zakładka AI
   wysyła przy zapisie trzy osobne POST-y, zakładka Shoper dwa.
   `docs/incoming/frontend-perplexity/.../02_WIDOKI.md:144` twierdzi „POST body to obiekt
   konfiguracji" — to **błąd dokumentacji**, wygrywa oryginał.

2. **Zakładka „spedycja" w produkcji nigdy nie łączy się z backendem.**
   `Ee.setQueryDefaults(["/api/spedycja"], { queryFn: async () => [...an] })`
   (`frontend-index.js:10381`) — całość żyje w module-level tablicy `an` i w IndexedDB
   (`un("spedycja", …)`, `:10365-10371`). Backend `GET/POST /api/spedycja` istnieje i działa
   (`:48735-48739`), ale UI go nie dotyka. To NIE jest to samo, co cache IndexedDB przy
   promocjach (backlog #19) — tam dane realnie idą przez sieć, tu nie idzie nic.

3. **Zakładka „katalog" nie ma nic wspólnego z `/api/config`.** To „Domyślne kolumny
   katalogu" (IndexedDB, klucz `konfig-domyslne-kolumny`, `XT()` `:26020-26145`),
   „Przywróć fabryczne" i destrukcyjny „Usuń wszystko z katalogu"
   (`POST /api/products/clear` z `{potwierdzenie: "WYCZYSC"}` — endpoint przypisany do I12).
   Kluczy `waga_gab.*` **nie edytuje w oryginale nic** — 0 wystąpień `waga_gab`
   w `frontend-index.js`. Podtytuł ekranu o „osobnej zakładce wagi gabarytowej" jest martwy.

### Czego dotknie

- **Backend:** nowe `src/routes/config.ts`, `src/routes/spedycja.ts`, nowe `src/repos/spedycja.ts`,
  rozszerzenie `src/repos/config.ts`, wpięcie w `src/app.ts`, drobna korekta `src/db/schema.ts`,
  seed w `scripts/seed-dev.ts`.
- **Frontend:** cztery nowe komponenty zakładek + dwa moduły klienta w
  `src/pages/konfiguracja/`, zmiana `zakladki.ts` i `Konfiguracja.tsx`.
- **Nie dotykamy:** `Dostawcy.tsx`, `Wgrywanie.tsx`, `dostawcy.ts`, `wgrywanie.ts`, `detekcja.ts`
  (zakres 3f-1/3f-2, zamknięty).

### Stan bazy — już gotowy

`rebuild/schema/001_schema.sql:204-215` ma obie tabele, zgodne z oryginałem
(`backend-index.cjs:43952-43968`):

```sql
CREATE TABLE spedycja_limity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dostawca_kod TEXT NOT NULL UNIQUE,
  prog_netto REAL, koszt_ponizej REAL, koszt_powyzej REAL, dodatkowe_reguly TEXT);
CREATE TABLE config (klucz TEXT PRIMARY KEY, wartosc TEXT NOT NULL);
```

Drizzle-owe odbicie w `src/db/schema.ts:246-253` **gubi `UNIQUE`** na `dostawca_kod` —
do uzupełnienia, bo upsert po tym kluczu na nim stoi.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

| Operacja | `contract/openapi.yaml` | Fixture |
|---|---|---|
| `GET /api/config` | `:542-547` (`security: []`) | `contract/fixtures/GET_config.json` |
| `POST /api/config` | `:550-560` (bearer/cookie) | brak (mutacja) |
| `GET /api/spedycja` | `:1020-1025` (`security: []`) | `contract/fixtures/GET_spedycja.json` |
| `POST /api/spedycja` | `:1027-1035` (bearer/cookie) | brak (mutacja) |

**`GET_config.json`** — płaski obiekt `{klucz: string}`, 11 kluczy, same stringi, bez
zagnieżdżeń. Puste wartości przy `ai_fallback.klucz_api`, `shoper.adres_sklepu`
i `shoper.token_api` to **realne wartości seeda** (`vR`, `backend-index.cjs:45633-45644`),
a nie sanityzacja ani maskowanie w kodzie — oryginał nie maskuje niczego na odczycie.

**`GET_spedycja.json`** — goła tablica, 5 wierszy z `_body_przyciete_z: 10`. Produkcja ma
10 wierszy (`xR`, `:45571-45632`), fixture przycięto do pięciu. Nasz `porownajKsztalt`
scala szablon z elementów i pomija klucze `_*`, więc dłuższa tablica gate'a nie wywróci.

**⚠ Pułapka gate'a dla configu.** `porownajKsztalt` dla obiektów porównuje **zbiory kluczy**,
a w `/api/config` klucze SĄ danymi. Gate musi więc zasiać dokładnie 11 kluczy z `vR` — ani
mniej, ani więcej. Klucze `shoper.kolumny`/`shoper.separator` (zapisywane przez UI, patrz D5)
pojawiają się dopiero po zapisie użytkownika i w świeżej bazie gate'a ich nie ma. To zgadza
się z produkcją: fixture ich nie zawiera właśnie dlatego, że nikt ich tam jeszcze nie zapisał.

**Znane rozjazdy i ich rozstrzygnięcie:** patrz „Decyzje" — D1 (auth), D6 (metoda zapisu),
D2 (spedycja przez sieć), D3 (zakres zakładki katalog).

## Decyzje

### D1 — `requireAuth` na wszystkich czterech trasach *(odstępstwo świadome, dziedziczone)*
Kontrakt ma dla obu GET-ów `security: []`, bo produkcja ma je publiczne
(`backend-index.cjs:48735,48739` — brak `we`). Stosujemy `requireAuth`, kontynuując decyzję
zaklepaną w I1a (`docs/spec-backend.md:57-84`) i potwierdzoną w I2, 3b, 3d-2, 4a i I5.
Kształt odpowiedzi bez zmian, więc GATE fixture'owy nietknięty. Nie było to pytaniem do
użytkownika — to utrwalona zasada projektu, nie nowa decyzja.

### D2 — zakładka „spedycja" gada z backendem *(odstępstwo świadome, decyzja użytkownika)*
Wybrano **realny backend**: odczyt `GET /api/spedycja`, zapis wiersza `POST /api/spedycja`.
Rezygnujemy z portu mechanizmu IndexedDB.
*Za:* dane trwałe i wspólne dla wszystkich, cel „Ania edytuje limity spedycji" faktycznie
spełniony, backend i tak dowozimy w tej iteracji.
*Przeciw (przyjęte świadomie):* to odstępstwo od 1:1; w produkcji limity żyją tylko
w przeglądarce Ani. Wpis do backlogu.

### D3 — zakładka „katalog" bez przycisku czyszczenia *(decyzja użytkownika)*
Portujemy „Domyślne kolumny katalogu" + „Przywróć fabryczne". Destrukcyjny
„Usuń wszystko z katalogu" (`POST /api/products/clear`) zostaje **poza zakresem** — roadmapa
przypisuje ten endpoint do Iteracji 12. W zakładce zostaje jawna adnotacja.
*Za:* nie wchodzimy w cudzy zakres destrukcyjną operacją na `products`; część kolumnowa jest
w pełni DRY (`lib/magazynKV` z `KLUCZ_KOLUMN_KATALOGU` i `pages/katalog/kolumny.ts`
z `KOLUMNY`/`KOLUMNY_DOMYSLNE` już istnieją).
*Przeciw:* zakładka niepełna do czasu I12.

### D4 — whitelista kluczy configu *(odstępstwo świadome, decyzja użytkownika)*
Oryginał przyjmuje **dowolny** klucz (`U.setConfig(l, p)` bez walidacji, `:48745`).
Wprowadzamy zamkniętą listę **13 kluczy**: 5× `waga_gab.*`, 3× `ai_fallback.*`,
`shoper.adres_sklepu`, `shoper.token_api`, `shoper.format_eksportu` (11 z seeda `vR`)
+ `shoper.kolumny` i `shoper.separator` (zapisywane przez zakładkę Shoper, w produkcji
jeszcze nienagrane). Klucz spoza listy → `400`.
*Za:* ten sam wzorzec, co `odsiejPola` przy dostawcach, narzutach i promocjach
(`repos/pola-edytowalne.ts`, backlog #14); bez niego każdy zalogowany zaśmieca `config`
literówką, która trafia do bazy jako nowy wiersz.
*Przeciw:* nowy klucz wymaga zmiany kodu.
*(W pytaniu do użytkownika napisałem omyłkowo „12 kluczy" w podsumowaniu opcji — wyliczenka
przy niej była pełna i poprawna; wiążąca jest lista 13 kluczy powyżej.)*

### D5 — filtr pól także dla `POST /api/spedycja`
Konsekwencja D4 na drugim zasobie: ciało idzie przez `odsiejPola` z listą
`dostawcaKod, progNetto, kosztPonizej, kosztPowyzej, dodatkoweReguly`. Oryginał podaje
`c.body` wprost do `upsertSpedycja` (`:48736`), więc pole spoza schematu wywracało zapis.
To ten sam ruch, co przy `POST /api/markups` w I4a.

### D6 — `POST {klucz, wartosc}`, nie `PUT` *(korekta roadmapy)*
Budujemy dokładnie to, co ma oryginał i kontrakt. Roadmapa mówi „GET/PUT /api/config" —
to jej **błąd**, poprawiam go w Kroku 13. Zakładki AI i Shoper wysyłają serię POST-ów,
jak produkcja.
*Za:* zgodność z zamrożonym kontraktem i z kształtem audytu `edycja_konfiguracji`.
*Przeciw:* kilka żądań na jeden zapis zakładki — tak jak w produkcji.

### D7 — brak edytora dla `waga_gab.*` i martwych kluczy Shopera *(port 1:1, bez pytania)*
`waga_gab.*` (5 kluczy), `shoper.adres_sklepu`, `shoper.token_api` i `shoper.format_eksportu`
nie mają w oryginale **żadnego** edytora (0 wystąpień w bundlu). Nie budujemy dla nich UI —
to byłoby wymyślanie nowego zachowania. Klucze zostają w bazie, w odpowiedzi `GET /api/config`
i na whiteliście (D4), bo czyta je backend: `waga_gab.*` przez
`POST /api/waga-gabarytowa/oblicz` (`:48750-48760`), `shoper.format_eksportu` przez
`/api/export/shoper` (`:48853`).

## Plan implementacji

Kolejność: backend → gate → frontend → testy frontendu. Jeden krok = jeden commit.

### Krok 1 — schemat i seed *(backend)*
- `src/db/schema.ts:247` — `dostawcaKod: text("dostawca_kod").notNull().unique()`, żeby
  odbicie Drizzle zgadzało się z `001_schema.sql:206` (upsert stoi na tym UNIQUE).
- `scripts/seed-dev.ts` — dosiać 10 wierszy `spedycja_limity` (`xR`, `:45571-45632`)
  i 11 kluczy `config` (`vR`, `:45633-45644`), wartości 1:1.

### Krok 2 — repozytoria *(backend)*
- `src/repos/config.ts` (rozszerzenie istniejącego): `odczytajCalaKonfiguracje(db)`
  → `Record<string, string>` (port `U.allConfig()`, `:45090-45095`);
  `zapiszKonfiguracje(db, klucz, wartosc)` — UPSERT po `klucz` (port `U.setConfig`);
  eksport `KLUCZE_KONFIGURACJI` (13, D4) + `czyKluczDozwolony`.
  Istniejące `odczytajKonfiguracje` zostaje bez zmian (używa go `POST /api/ai-fallback/parse`),
  usuwam tylko adnotację „pełne GET/PUT należy do Iteracji 11".
- `src/repos/spedycja.ts` (nowy): `listaSpedycji(db)` — `SELECT *`, **bez `ORDER BY`**,
  jak `U.listSpedycja()` (`:45074`); `zapiszLimitSpedycji(db, wiersz)` — UPSERT po
  `dostawcaKod` (port `U.upsertSpedycja`, `:45077-45085`); `odsiejPolaSpedycji` (D5).

### Krok 3 — trasy *(backend)*
- `src/routes/config.ts` (nowy), wzorzec `routes/markups.ts`:
  - `GET /api/config` + `requireAuth` → płaski obiekt.
  - `POST /api/config` + `requireAuth` → `{klucz, wartosc}`; klucz spoza whitelisty → 400;
    audyt `edycja_konfiguracji`, encja `config`, `encjaId = klucz`, szczegóły
    `{ wartosc: klucz.includes("klucz_api") ? "***" : wartosc }` — **maskowanie 1:1
    z oryginałem** (`:48746`); odpowiedź `{ ok: true }`.
- `src/routes/spedycja.ts` (nowy):
  - `GET /api/spedycja` + `requireAuth` → goła tablica.
  - `POST /api/spedycja` + `requireAuth` → upsert; audyt `edycja_spedycji`, encja `spedycja`,
    `encjaId = dostawcaKod`, szczegóły = odsiane ciało; odpowiedź `{ ok: true }`.
- `src/app.ts` — `app.use(trasyKonfiguracji({ db }))`, `app.use(trasySpedycji({ db }))`.

### Krok 4 — GATE *(backend, `test/konfiguracja.gate.test.ts`)*
Wzorzec `test/narzuty.gate.test.ts`. Cztery operacje, dwa fixtures. Szczegóły w „Strategia testów".

### Krok 5 — testy zachowania backendu *(`test/konfiguracja.test.ts`)*
Whitelista, maskowanie w audycie, upsert po `dostawcaKod`, bramka auth.

### Krok 6 — klienci API *(frontend)*
- `src/pages/konfiguracja/config.ts` (nowy): typ `Konfiguracja = Record<string, string>`,
  `zapiszKlucz(klucz, wartosc)` → `POST /api/config` przez `lib/api.zadanie`,
  `KLUCZ_QUERY = ["/api/config"]`.
- `src/pages/konfiguracja/spedycja.ts` (nowy): typ `LimitSpedycji` (kształt
  `GET_spedycja.json`), `zapiszLimit(wiersz)` → `POST /api/spedycja`.

### Krok 7 — cztery zakładki *(frontend)*
Wszystkie na wzorcu `Dostawcy.tsx` (`useQuery` + `useMutation` + `useQueryClient`,
`data-testid` 1:1 z oryginałem, komunikat inline zamiast toasta — jak reszta rebuildu).

- **`Spedycja.tsx`** (port `qT`, `:25808-25938`): karta „Limity spedycyjne per dostawca",
  podtytuł „Próg netto i koszty dostawy. Po przekroczeniu progu — dostawa gratis lub ze
  zniżką.". Tabela iteruje po **dostawcach** (`GET /api/dostawcy`), nie po wierszach
  spedycji — dostawca bez limitu ma puste pola. Kolumny: Dostawca / Próg netto (zł) /
  Koszt poniżej (zł) / Koszt powyżej (zł) / Dodatkowe reguły. `data-testid`:
  `row-sped-<KOD>`, `input-sped-prog-<KOD>`, `input-sped-pon-<KOD>`, `input-sped-pow-<KOD>`,
  `input-sped-reguly-<KOD>`, `button-sped-save-<KOD>`. Przycisk „Zapisz" pojawia się dopiero
  po zmianie w wierszu (1:1). Konwersje 1:1: `progNetto` pusty → `null`,
  `kosztPonizej`/`kosztPowyzej` niepoprawny → `0`. Zapis → `POST /api/spedycja` (D2).
- **`Shoper.tsx`** (port `GK`, `:26208-26277`): „Eksport CSV do Shoper", podtytuł
  „Mapowanie kolumn: klucz_wewnetrzny:Naglowek_CSV (jedna linia = jedna kolumna)".
  Textarea `shoper.kolumny` (13 wierszy, domyślne mapowanie 1:1 ze stałej w `:26211`),
  input `shoper.separator` (domyślnie `;`). Licznik „N kolumn" liczy linie z `:`.
  „Zapisz konfigurację" → dwa `POST /api/config`; „Przywróć domyślne" → reset lokalny.
  `data-testid`: `input-shoper-kolumny`, `input-shoper-separator`.
- **`Katalog.tsx`** (port `XT`, `:26020-26145`, bez części destrukcyjnej — D3):
  „Domyślne kolumny katalogu", licznik „Zaznaczone: N / M", siatka checkboxów po `KOLUMNY`,
  „Zapisz jako domyślne" → `zapiszKV(KLUCZ_KOLUMN_KATALOGU, …)`, „Przywróć fabryczne
  (N kolumn)" → `KOLUMNY_DOMYSLNE`. `data-testid`: `row-kolumna-<key>`,
  `button-save-default-cols`, `button-restore-default-cols`.
- **`Ai.tsx`** (port `YT`, `:25940-26018`): „AI Fallback (OpenAI ChatGPT)", podtytuł
  „Gdy parser nie rozpozna kolumn — OpenAI ChatGPT próbuje odgadnąć strukturę cennika.".
  Pola: „Klucz API OpenAI" (`type=password`, placeholder `sk-proj-...`, `input-openai-key`),
  „Model" (`input-openai-model`), odznaka statusu **AKTYWNY/SYMULACJA** wyliczana z tego,
  czy klucz jest niepusty (1:1, `:25944`). „Zapisz" → trzy `POST /api/config`, przy czym
  `ai_fallback.aktywny` = `"true"`/`"false"` **wyprowadzone z klucza**, nie z osobnego pola
  (1:1, `:26000`). `data-testid`: `button-save-ai`.

### Krok 8 — spięcie zakładek *(frontend)*
- `zakladki.ts` — wszystkie sześć wpisów ma teraz wypełnioną zakładkę, więc pole
  `domykaBlok` i typ `OpisZakladki.domykaBlok` **znikają** (były tylko po to, by opisać
  zaślepkę).
- `Konfiguracja.tsx` — cztery nowe `<TabsContent>`; usunięcie bloku renderującego zaślepki
  (`.filter((z) => z.domykaBlok !== null)`), bo staje się martwy. Naprawiam też urwane
  zdanie w docblocku pliku („Pozostałe cztery istnieją, / jest osiągalnych…").

### Krok 9 — testy frontendu
`test/konfiguracja.spedycja.test.tsx` i `test/konfiguracja.ustawienia.test.tsx`
(shoper + ai + katalog), wzorzec `konfiguracja.dostawcy.test.tsx`. Nowe helpery
w `test/msw/kontrakt.ts`: `konfiguracjaZFixtura()`, `spedycjaZFixtura()`.

## Strategia testów

### GATE odbudowy (obowiązkowy — ticket dotyka API)
`rebuild/backend/test/konfiguracja.gate.test.ts`, harness `test/gate/index.ts`:

1. **Kontrakt** — `sprawdzZgodnoscZKontraktem` dla wszystkich czterech operacji:
   `GET/POST /api/config`, `GET/POST /api/spedycja` (ścieżka i metoda istnieją
   w `openapi.yaml`, status zadeklarowany, `content-type` JSON).
2. **Fixtures** — `sprawdzZgodnoscZFixture("GET_config.json", …)` po zasianiu dokładnie
   11 kluczy `vR` (patrz pułapka w „Kontrakt i fixtures") oraz
   `sprawdzZgodnoscZFixture("GET_spedycja.json", …)` po zasianiu 10 wierszy `xR` —
   tablica dłuższa niż przycięty fixture, co harness obsługuje.
   **Zero zadeklarowanych wyjątków (`WyjatekGate`)** — nie przewiduję rozjazdu.
3. Wartości: dla configu porównanie kluczy jest zarazem porównaniem wartości
   deterministycznych (seed = `vR` co do znaku, łącznie z `"DPD 1/6000 (1 m³ = 167 kg)"`).

Rozbieżność = STOP, fixture'a nie ruszam.

### Testy jednostkowe / integracyjne backendu (`test/konfiguracja.test.ts`)
Prawdziwa baza SQLite w katalogu tymczasowym i prawdziwy Express przez `stworzSrodowiskoTestowe`
— bez mocków, jak reszta backendu:
- `POST /api/config` z kluczem spoza whitelisty → 400, **wiersz nie powstaje** (D4);
- `POST /api/config` na `ai_fallback.klucz_api` → wartość w `config` prawdziwa,
  a w `audit_log.szczegoly_json` zamaskowana `"***"`; na `ai_fallback.model` → niezamaskowana
  (test na granicy warunku `includes("klucz_api")`);
- `POST /api/spedycja` dwa razy na ten sam `dostawcaKod` → **jeden** wiersz (upsert po UNIQUE),
  wartości z drugiego żądania;
- `POST /api/spedycja` z polem spoza listy → pole nie trafia do bazy, reszta zapisana (D5);
- wszystkie cztery trasy bez tokenu → 401 (D1).

### Testy frontendu (vitest + Testing Library + MSW, `onUnhandledRequest: "error"`)
Dane z fixtures przez nowe helpery w `test/msw/kontrakt.ts` — widok sprawdzany przeciwko
kształtowi, który realnie oddaje produkcja:
- **spedycja**: tabela pokazuje limit z fixture'a przy właściwym dostawcy; dostawca bez limitu
  ma puste pola; „Zapisz" pojawia się dopiero po zmianie; zapis leci `POST /api/spedycja`
  z pełnym wierszem i `dostawcaKod`; pusty próg jedzie jako `null`, nie `0` ani `""`;
- **ai**: pola wypełniają się z `GET /api/config`; odznaka SYMULACJA przy pustym kluczu
  i AKTYWNY po wpisaniu; „Zapisz" wysyła **trzy** POST-y, w tym `ai_fallback.aktywny: "true"`;
- **shoper**: textarea startuje z wartości z configu, a przy jej braku z domyślnego mapowania;
  licznik kolumn liczy linie z `:`; „Zapisz" wysyła **dwa** POST-y; „Przywróć domyślne"
  nie wysyła nic;
- **katalog**: checkboxy startują z `KOLUMNY_DOMYSLNE`, zapis trafia do `magazynKV`,
  „Przywróć fabryczne" wraca do zestawu fabrycznego; **żadnego żądania sieciowego**
  (MSW wywali test, gdyby jakieś poszło).

### Czego nie testujemy i dlaczego
- Renderu zakładek „dostawcy"/„wgrywanie" — pokryte w 3f-1/3f-2, nietknięte.
- E2E — plan tego nie przewiduje; przepływ jest jednoekranowy i pokryty testami widoku.

## Poza zakresem

- `POST /api/products/clear` i przycisk „Usuń wszystko z katalogu" → **Iteracja 12** (D3).
- Przycisk „Pobierz CSV (Shoper)" w `/katalog` i trasy `/api/export/shoper` → **Iteracja 8**.
  Zakładka Shoper zapisuje `shoper.kolumny`/`shoper.separator`, których w I8 użyje eksport;
  do tego czasu klucze są zapisywane, ale nieczytane.
- Zakładki „dostawcy" i „wgrywanie", `PATCH /api/dostawcy/{id}`, upload, częstotliwość
  importu → zrobione w 3f-1/3f-2, **nie powtarzamy**.
- Edytor `waga_gab.*` i martwych kluczy Shopera → w oryginale nie istnieje (D7).
- `POST /api/waga-gabarytowa/oblicz` — czyta `waga_gab.*`, ale to osobna trasa spoza
  zakresu I11.

## Definition of done

- [ ] `GET /api/config` zwraca płaski obiekt zgodny 1:1 z `contract/fixtures/GET_config.json`
- [ ] `POST /api/config` przyjmuje `{klucz, wartosc}`, odrzuca klucz spoza 13-elementowej
      whitelisty (400) i maskuje `*klucz_api*` w audycie
- [ ] `GET /api/spedycja` zwraca gołą tablicę zgodną 1:1 z `GET_spedycja.json`
- [ ] `POST /api/spedycja` robi upsert po `dostawcaKod` i filtruje pola
- [ ] Wszystkie cztery trasy za `requireAuth` (401 bez tokenu)
- [ ] Cztery zakładki renderują się i zapisują: spedycja → `POST /api/spedycja`,
      shoper → 2× `POST /api/config`, ai → 3× `POST /api/config`, katalog → IndexedDB
- [ ] Znikły zaślepki i pole `domykaBlok`; sześć zakładek `/konfiguracja` jest wypełnionych
- [ ] GATE zielony: cztery operacje kontraktu + dwa fixtures, bez zadeklarowanych wyjątków
- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` czyste w `rebuild/backend`
      i `rebuild/frontend`
- [ ] Roadmapa: blok I11 oznaczony jako zrobiony, sprostowane „PUT" → `POST {klucz, wartosc}`;
      backlog: wpisy o D2 (spedycja przez sieć) i D4 (whitelista configu)
