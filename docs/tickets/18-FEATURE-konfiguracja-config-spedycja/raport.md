# 18-FEATURE-konfiguracja-config-spedycja — raport z implementacji

## Podsumowanie

Iteracja 11 dowieziona: backend oddaje `GET/POST /api/config` i `GET/POST /api/spedycja` za
`requireAuth`, a `/konfiguracja` nie ma już ani jednej zaślepki — wszystkie sześć zakładek jest
wypełnionych. Ania edytuje limity spedycyjne per dostawca (i te zapisy są teraz trwałe, a nie
lokalne dla przeglądarki), mapowanie CSV dla Shopera, klucz i model AI Fallback oraz domyślny
zestaw kolumn katalogu.

## Zmiany

### Backend
- **Nowy:** `rebuild/backend/src/db/seed-poczatkowy.ts` — port stałych `xR` i `vR`
  (`backend-index.cjs:45571-45644`): 10 wierszy spedycji, 11 kluczy konfiguracji. Wspólne
  źródło dla seeda deweloperskiego i harnessu GATE.
- **Nowy:** `rebuild/backend/src/repos/spedycja.ts` — `listaSpedycji` (bez `ORDER BY`, 1:1),
  `zapiszLimitSpedycji` (select-then-write jak `U.upsertSpedycja`), `odsiejPolaSpedycji`.
- **Nowy:** `rebuild/backend/src/routes/config.ts` — `GET /api/config` (płaski obiekt, bez
  maskowania), `POST /api/config` (`{klucz, wartosc}`, whitelista 13 kluczy, maskowanie
  `*klucz_api*` w audycie).
- **Nowy:** `rebuild/backend/src/routes/spedycja.ts` — `GET`/`POST /api/spedycja`, upsert po
  `dostawcaKod`, audyt `edycja_spedycji`.
- `rebuild/backend/src/repos/config.ts` — doszły `odczytajCalaKonfiguracje`,
  `zapiszKonfiguracje`, `KLUCZE_KONFIGURACJI`, `czyKluczDozwolony`.
- `rebuild/backend/src/db/schema.ts` — `spedycjaLimity.dostawcaKod` dostał `.unique()`,
  zgodnie z `001_schema.sql:206` i oryginałem (odbicie Drizzle to gubiło).
- `rebuild/backend/src/app.ts` — wpięcie obu routerów.
- `rebuild/backend/scripts/seed-dev.ts` — dosiewa spedycję i konfigurację
  (`onConflictDoNothing`, żeby ponowny seed nie nadpisał zmian z `/konfiguracja`).

### Frontend
- **Nowy:** `src/pages/konfiguracja/config.ts` — klient `/api/config`, `zapiszKlucz`,
  `zapiszKlucze` (seria PO KOLEI, jak oryginał).
- **Nowy:** `src/pages/konfiguracja/spedycja.ts` — klient `/api/spedycja`.
- **Nowy:** `src/pages/konfiguracja/Spedycja.tsx` — port `qT()`; tabela per dostawca.
- **Nowy:** `src/pages/konfiguracja/Shoper.tsx` — port `GK()`.
- **Nowy:** `src/pages/konfiguracja/Ai.tsx` — port `YT()`.
- **Nowy:** `src/pages/konfiguracja/Katalog.tsx` — port `XT()` bez części destrukcyjnej.
- `src/pages/konfiguracja/zakladki.ts` — usunięte pola `domykaBlok` **i `opis`**; oba
  opisywały wyłącznie zaślepki, a każda zakładka ma dziś własny podtytuł z oryginału.
- `src/pages/Konfiguracja.tsx` — cztery nowe `TabsContent`, usunięty blok renderujący
  zaślepki, poprawione urwane zdanie w docblocku.

### Testy
- **Nowy:** `rebuild/backend/test/konfiguracja.gate.test.ts` — GATE (10 asercji).
- **Nowy:** `rebuild/backend/test/konfiguracja.test.ts` — zachowanie tras (16 asercji).
- **Nowy:** `rebuild/frontend/test/konfiguracja.spedycja.test.tsx` (9).
- **Nowy:** `rebuild/frontend/test/konfiguracja.ustawienia.test.tsx` (12).
- `rebuild/backend/test/gate/dane.ts` — `zasiejKonfiguracjeStartowa`.
- `rebuild/frontend/test/msw/kontrakt.ts` — `konfiguracjaZFixtura`, `spedycjaZFixtura`.
- `rebuild/frontend/test/konfiguracja.test.tsx` — test zaślepek zamieniony na test
  „każda zakładka pokazuje swoją kartę"; dołożone mocki `/api/config` i `/api/spedycja`.

## Odstępstwa od planu

Trzy drobne, wszystkie w stronę spójności z zastanymi wzorcami:

1. **Audyt `edycja_spedycji` loguje SUROWE ciało, nie odsiane.** Plan mówił „szczegóły =
   odsiane ciało". W trakcie implementacji okazało się, że `routes/markups.ts` ma ten wybór
   rozstrzygnięty odwrotnie i uzasadniony wprost (audyt opisuje ZAMIAR, więc próba wysłania
   pola spoza listy zostaje w dzienniku jako sygnał). Poszedłem za istniejącym precedensem —
   to też jest port 1:1 (`be(…, c.body)`, `:48737`).
2. **`POST /api/config` odrzuca `wartosc`, która nie jest tekstem (400).** Planu to nie
   wymieniało. Kolumna jest `NOT NULL`, a cała konfiguracja to stringi — ciche rzutowanie
   liczby wpisywałoby do bazy coś innego, niż wysłał klient.
3. **Usunięte zostało też pole `opis`** w `zakladki.ts`, nie tylko `domykaBlok`. Po usunięciu
   zaślepek nikt go nie czytał, a jego treść („Połączenie ze sklepem Shoper") rozjeżdżała się
   z rzeczywistym podtytułem karty („Eksport CSV do Shoper").

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne, bez zadeklarowanych wyjątków.**
  Ścieżki: `GET /api/config`, `POST /api/config`, `GET /api/spedycja`, `POST /api/spedycja` —
  wszystkie cztery odnalezione w `contract/openapi.yaml` i zwalidowane
  (`sprawdzZgodnoscZKontraktem`). Fixtures: `contract/fixtures/GET_config.json`
  i `GET_spedycja.json` — `sprawdzZgodnoscZFixture` plus **porównanie wartości**:
  `GET /api/config` daje `toEqual` z całym nagraniem (11 kluczy co do znaku), a pierwsze
  pięć wierszy `GET /api/spedycja` `toEqual` z nagraniem (fixture przycięty z 10).
  Sprawdzone też, że zapis istniejącego klucza to UPDATE — zbiór kluczy się nie zmienia,
  więc odpowiedź nadal zgadza się z fixture'em.
- **Backend:** ✓ 629 testów w 38 plikach (w tym 26 nowych). `lint`, `typecheck`, `build` czyste.
- **Frontend:** ✓ 299 testów w 20 plikach (w tym 21 nowych). `lint`, `typecheck`, `build` czyste.
- **E2E:** pominięte — plan tego nie przewidywał; przepływ jest jednoekranowy i pokryty
  testami widoku przez MSW z `onUnhandledRequest: "error"`.

## Breaking changes

Brak w API. W kodzie frontendu: typ `OpisZakladki` stracił pola `domykaBlok` i `opis` —
poza `Konfiguracja.tsx` i testem szkieletu nikt ich nie używał, oba zaktualizowane.

## Follow-up

- **Trwałość wyboru kolumn w zakładce „Katalog" nie jest pokryta testem.** jsdom nie ma
  IndexedDB, a `lib/magazynKV` świadomie połyka błędy (port zachowania oryginału), więc
  `odczytajKV` zwraca tam `undefined`. Testy sprawdzają stan zaznaczeń, licznik, komunikat
  i BRAK ruchu sieciowego; sama serializacja do IndexedDB czeka na `fake-indexeddb` albo
  na test E2E. Dotyczy to całego `magazynKV`, nie tylko tej zakładki — dziś nie ma go
  w żadnym teście.
- **Przycisk „Usuń wszystko z katalogu"** (`POST /api/products/clear` z
  `{potwierdzenie: "WYCZYSC"}`, `frontend-index.js:26101-26130`) — świadomie odłożony
  do Iteracji 12 razem z endpointem (D3). W zakładce jest o tym adnotacja.
- **`shoper.kolumny` i `shoper.separator` są zapisywane, ale nikt ich nie czyta** do czasu
  Iteracji 8 (eksport CSV per dostawca w `/katalog`). Stan przejściowy, zgodny z planem.
- **`waga_gab.*`, `shoper.adres_sklepu`, `shoper.token_api`, `shoper.format_eksportu`
  nie mają edytora** — bo nie mają go też w oryginale (0 wystąpień w bundlu, D7). Gdyby
  Ania kiedyś chciała edytować parametry wagi gabarytowej, to jest nowa funkcja, nie
  odbudowa: `POST /api/waga-gabarytowa/oblicz` te klucze czyta (`:48750-48760`), ale żaden
  ekran ich nie ustawia.
- **Maska w audycie configu patrzy na nazwę klucza, nie na listę sekretów** — `shoper.token_api`
  trafia do dziennika jawnie. Odtworzone 1:1 (`:48746`) i pilnowane testem, żeby nikt nie
  „poprawił" tego przy okazji. Zawężenie/poszerzenie maski to decyzja do podjęcia osobno.

---

## Review fixes applied

### BLOCKER 1 — formularze Shoper i AI startowały wartościami domyślnymi *(naprawione)*

**Co było nie tak.** `Shoper.tsx` i `Ai.tsx` inicjalizowały `useState` danymi z `useQuery`,
ale hooki wykonują się PRZED wczesnym `return` na `isLoading`. Przy pierwszym wejściu
w zakładkę (config jeszcze nie w cache'u) `data` było `undefined`, więc pola zamarzały
na wartościach domyślnych i już nigdy nie przyjmowały tego, co przyszło z serwera.
Skutek jest poważny: Ania wchodzi w zakładkę, klika „Zapisz" niczego nie zmieniając —
i kasuje zapisany klucz API OpenAI oraz mapowanie kolumn Shopera.

**Dlaczego testy tego nie złapały.** Mock bez opóźnienia rozwiązywał zapytanie na tyle
wcześnie, że stan bywał już poprawny, a nagranie produkcji dobrało się złośliwie: w fixture
`ai_fallback.model` to akurat `"gpt-4o-mini"`, a `ai_fallback.klucz_api` to `""` — czyli
DOKŁADNIE wartości domyślne formularza. Asercje przechodziły z niewłaściwego powodu.
Ta sama pułapka dotyczyła Shopera, którego kluczy w nagraniu w ogóle nie ma.

**Poprawka.** Obie zakładki rozdzielone na komponent pobierający i formularz montowany
dopiero z gotowymi danymi (`FormularzAi`, `FormularzShopera`). To jest zarazem powrót
do kształtu oryginału: tam config pobiera STRONA (`eM()`, `frontend-index.js:26277-26290`)
i wstrzykuje kartom propsem `cfg`. `null` z wygasłej sesji (`zapytanieZwracajaceNullNa401`)
jest traktowane jak brak danych, więc formularz nie zamontuje się na pustce.
Późniejsze odświeżenie configu świadomie NIE nadpisuje pól — tak samo jak oryginał,
bo nadpisywanie kasowałoby niezapisane zmiany.

**Poprawiony też mylący komentarz** w `Konfiguracja.tsx`, który twierdził, że przed tym
problemem chroni leniwe montowanie `TabsContent`. Chroni tylko wtedy, gdy config jest już
w cache'u — czyli nie przy pierwszym wejściu.

### SHOULD-FIX — brak testu na ten scenariusz *(naprawione)*

Nowy blok `describe("pierwsze wejście w zakładkę (config spoza cache'u)")` w
`test/konfiguracja.ustawienia.test.tsx`: trzy przypadki z `delay()` w MSW **oraz** z configem
o wartościach JAWNIE różnych od domyślnych (`gpt-4o`, `sk-proj-zapisany-wczesniej`, `|`).
Kluczowy z nich sprawdza dokładnie scenariusz utraty danych: zapis BEZ żadnej edycji ma
odesłać wartości z serwera, nie pustkę.

Weryfikacja, że test faktycznie broni poprawki: po tymczasowym cofnięciu zmian w `Ai.tsx`
i `Shoper.tsx` te trzy testy są czerwone (3 failed / 12 passed), po przywróceniu — zielone.

### SHOULD-FIX — audyt `edycja_spedycji` loguje surowe ciało

Bez zmian, świadomie. Jest to port 1:1 (`be(…, c.body)`, `:48737`) i ten sam wybór, co przy
narzutach w I4a; powód siedzi w komentarzu przy trasie i w sekcji „Odstępstwa od planu" wyżej.

### NICE-TO-HAVE — zostawione jako follow-up

- Wspólny helper typu dla repozytoriów korzystających z `odsiejPola` (dziś każde rzutuje
  osobno — `markups.ts:97`, `spedycja.ts:67`). To refaktor dotykający kilku iteracji naraz.
- Komunikat 400 z `POST /api/config` wylicza całą listę dozwolonych kluczy. Trasa jest za
  `requireAuth`, a komunikat realnie pomaga w diagnozie, więc zostaje.

### Wyniki po poprawkach (iteracja 1)
- Backend: ✓ 629/629, frontend: ✓ **302/302** (trzy nowe testy regresyjne).
- `lint`, `typecheck`, `build` czyste w obu pakietach.

---

## Review — iteracja 2

Oba BLOCKER-y zamknięte i potwierdzone empirycznie przez reviewera (odtworzył regresję,
przywracając stary wzorzec — testy padły dokładnie tam, gdzie miały). **0 BLOCKER-ów.**

### SHOULD-FIX — wieczne „Wczytywanie…" przy wygasłej sesji *(naprawione)*

Poprzednia poprawka wprowadziła guard `if (!konfiguracja)`, który traktował jednakowo dwa
różne stany: „zapytanie jeszcze trwa" i „sesja wygasła". `zapytanieZwracajaceNullNa401`
oddaje przy 401 `null` zamiast rzucać, a `staleTime: Infinity` znaczy, że drugiej odpowiedzi
nie będzie — więc przy wygasłej sesji zakładka zostawała na spinnerze **na zawsze**, bez
żadnej informacji zwrotnej. Reszta aplikacji (`Dostawcy.tsx`, `Spedycja.tsx`) degraduje się
inaczej: pusty widok teraz, twardy błąd dopiero przy mutacji (`lib/queryClient.ts:13-16`).

Rozdzielone: spinner reaguje wyłącznie na `isLoading`, a po rozstrzygnięciu zapytania
formularz montuje się na `konfiguracja ?? {}`. To jest zarazem bliżej oryginału, który
domyśla `cfg = {}` (`frontend-index.js:26290`). Utrata danych nie wraca: przy wygasłej sesji
zapis i tak dostanie 401 i pokaże błąd.

Dołożony test `„wygasła sesja nie zostawia zakładki na wiecznym «Wczytywanie…»"`.

### Pozostałe pozycje
- SHOULD-FIX (audyt spedycji loguje surowe ciało) — świadomie bez zmian, patrz wyżej.
- 3× NICE-TO-HAVE — follow-up, patrz wyżej.

### Wyniki końcowe
- Backend: ✓ **629/629**, frontend: ✓ **303/303**.
- `lint`, `typecheck`, `build` czyste w obu pakietach.

---

## Docs updates

Cztery doc-checkery równolegle; siedem plików sprawdzonych, pięć zmienionych.

### `docs/rebuild-roadmap.md` — zaktualizowany (4 miejsca)
- **Blok „Iteracja 11" przepisany z zamiaru na stan.** Status ⬜ → ✅ 2026-09-03
  (`18-FEATURE-konfiguracja-config-spedycja`). Sprostowane `GET/PUT /api/config` →
  `POST /api/config` z `{klucz, wartosc}`; dopisane `POST /api/spedycja`, którego roadmapa
  w ogóle nie wymieniała. Poprawione błędne założenie, że zakładka „katalog" edytuje klucze
  configu — nie edytuje żadnego. Dopisane D1, D2, D4, D7, maskowanie w audycie, wynik GATE
  i testów. Usunięte nieaktualne fragmenty („ZAKRES POMNIEJSZONY", „Historyczne (3e)",
  „CZTERY zaślepki") zamiast dopisywania sprostowań obok.
- **Blok 3f, „Decyzje zaklepane 2026-09-01"** — to samo sprostowanie `GET/PUT` → `GET/POST`
  plus znacznik dowiezienia.
- **Blok Iteracji 8** — nowa nota: `shoper.kolumny`/`shoper.separator` są już zapisywane,
  ale nikt ich nie czyta do I8; rozróżnienie `/api/export/shoper` (czyta
  `shoper.format_eksportu`) od `/api/export-shoper` — to dwie różne trasy.
- **Blok Iteracji 12** — dwie noty „⚠ WEJŚCIE Z ITERACJI 11": `GET /api/audit-log` zobaczy
  nowe akcje `edycja_konfiguracji` i `edycja_spedycji` (z ich kształtem i maskowaniem);
  przycisk „Usuń wszystko z katalogu" należy do zakładki „Katalog" w `/konfiguracja`, nie do
  widoku `/katalog` — miejsce wpięcia gotowe, wraz z treścią `window.confirm` i listą
  unieważnianych zapytań.

### `docs/rebuild-backlog.md` — zaktualizowany (1375 → 1468 linii)
- **Wpis #14** (mutacje zapisują całe ciało) rozszerzony: `POST /api/spedycja` i
  `POST /api/config` naprawione w I11, dopisane do tabeli tras i plików.
- **Nowy wpis #29** — zakładka „Spedycja" połączona z backendem (✅ TAK, D2), z jawnym
  rozróżnieniem od wpisu #19 (cache promocji): tam dane realnie idą przez sieć, tu nie szło nic.
- **Nowy wpis #30** — `POST /api/config` z whitelistą (✅ TAK, D4). Dołączone do niego trzy
  fakty informacyjne: maskowanie audytu po nazwie klucza (`shoper.token_api` jawnie),
  `GET /api/config` oddaje sekrety niezamaskowane, brak edytora `waga_gab.*` (D7).

### `docs/spec-backend.md` — zaktualizowany (2 miejsca)
- §2 — nota „Potwierdzone w I11" w tej samej formie co noty I2/3b/4a/I5: oba GET-y wjechały
  pod `requireAuth` mimo `security: []`; POST-y kontrakt i tak ma za auth.
- §5 — `Jt`/`gn` oznaczone jako odtworzone w `rebuild/`.
- Sprawdzone, że fałszywa teza o `PUT /api/config` do tego pliku nie przewędrowała.

### `docs/spec-frontend.md` — zaktualizowany (2 miejsca)
- Blok „Odbudowa (3e, 3f-1, 3f-2)" — zdanie „cztery pozostałe czekają na Iterację 11"
  poprawione na stan faktyczny.
- Nowy blok „Odbudowa (I11, 2026-09-03)": `/konfiguracja` 6/6 zakładek + trzy fakty
  zapisane z góry, żeby nie urosły w błędne założenia (spedycja NIE jest portem 1:1 — D2;
  katalog NIE dotyka `/api/config` — D3; edytora `waga_gab.*` nie ma i nie będzie — D7).

### `CLAUDE.md` — zaktualizowany (1 miejsce)
Zasada nr 3 („weryfikuj grafem wywołań, nie nazwą") rozszerzona o kształt API: w I11 roadmapa
dwukrotnie opisała endpoint niezgodnie ze stanem faktycznym, więc metodę i kształt ciała
sprawdzaj w `contract/openapi.yaml` i w oryginale, zanim uwierzysz roadmapie. Rozszerzenie
istniejącej zasady zamiast dokładania nowej.

### Bez zmian (sprawdzone, nic do poprawy)
- `docs/plan.md` — jawnie oznaczony jako dokument historyczny z fazy wstępnej; nie śledzi
  statusu iteracji (nie ma tam ani I11, ani I1-I10).
- `docs/prompts/mapa-kodu-do-wiki.md` — czysta mapa starego kodu, zero odniesień do
  `rebuild/`; dopisanie ich byłoby wprowadzeniem nowej struktury pliku, nie utrzymaniem.
- `docs/instrukcja-testow-I4.md` — dotyczy innej iteracji, nie odwołuje się do
  `/konfiguracja`.

### Pre-existing issues (znalezione przy okazji, NIE naprawione)
- **`docs/spec-frontend.md:131-132` i `:178-179`** — liczniki placeholderów („8", potem „7")
  nie składają się z sekwencją; §3 tego samego pliku mówi o 6 placeholderach. Rozjazd sprzed
  tego ticketu (I11 nie zmienia liczby tras). Wymaga decyzji: poprawić liczby, czy uznać je
  za opis stanu „na moment danego bloku". **Do rozstrzygnięcia przez użytkownika.**
- **`docs/rebuild-roadmap.md:450`** — „Pełny cykl z przeglądarki domknie I11" jest już
  nieaktualne (zakres importu wydzielono do 3f), ale zdanie jest sprostowane w tym samym
  pliku przy linii 812. Zostawione świadomie.

### Follow-up wynikający z przeglądu dokumentacji
- **Brak `docs/instrukcja-testow-I11.md`** — nie było w zakresie tego ticketu, ale I11 wnosi
  realną zmianę user-facing (Ania edytuje trwałe limity spedycji, klucz AI, mapowanie CSV).
  Konwencja jest gotowa w `instrukcja-testow-I4.md`. Scenariusze, które taka instrukcja
  musiałaby objąć: edycja limitu spedycji **z podkreśleniem, że zapis idzie teraz do backendu
  i jest wspólny dla wszystkich** (D2 — to „fałszywy alarm" względem tego, co Ania zna);
  zapis AI i Shopera jako seria kilku POST-ów na jedno kliknięcie (możliwy zapis częściowy
  przy błędzie w środku serii); „Domyślne kolumny katalogu" jako operacja **czysto lokalna**;
  adnotacja przy braku przycisku czyszczenia katalogu (D3, I12).
