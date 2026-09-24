# Bridge — zasady stałe dla każdej sesji

Ten projekt to **wierna odbudowa** działającej produkcji („Bridge dla Agrowca") w nowym stosie
w `rebuild/`. Domyślna reguła: odtwarzasz udokumentowane zachowanie 1:1, nie wymyślasz nowego.
Każde odstępstwo musi być świadomą decyzją użytkownika. Pełny kontekst i kolejność źródeł
prawdy: `.claude/commands/feature.md`, sekcja „Kontekst odbudowy".

Praca idzie iteracjami i blokami (I3 → 3a, 3b, 3c…), opisanymi w `docs/rebuild-roadmap.md` §5.

---

## Roadmapa jest wejściem dla następnej sesji — utrzymuj ją na bieżąco

`docs/rebuild-roadmap.md` czyta następna sesja. Prompt, którym ją uruchamiasz, jest
jednorazowy — **roadmapa i karty (`docs/karty/`) zostają**. Z tego wynikają obowiązki:

**0. Karty równoległe piszą WYŁĄCZNIE we własnych plikach — nigdy w roadmapie.**
Od ticketu 82 (2026-09-21) stan i ustalenia karty żyją w `docs/karty/<ID>/`: `karta.md` (pisze
tylko ta karta) i `wejscie-<N>.md` (nowy plik od ticketu N dla przyszłej karty). Roadmapę
zmienia wyłącznie **koordynator** — sesja, która planuje falę i pisze prompty do kart. Powód:
każda wspólna linia roadmapy (wiersz §4, sąsiednie wiersze tabeli kart, dopisek na końcu
sekcji) kończyła się konfliktem przy merge'u — 7 razy w 2026-09-18…21. Tabela własności,
szablony, okres przejściowy: `docs/karty/README.md`; stan kart: `tools/stan-kart.sh`.
**Jako koordynator:** zanim wydasz prompty na falę, załóż `docs/karty/<ID>/karta.md` dla
KAŻDEJ karty fali i zmerguj to do `develop` (ticket `DOCS`, PR) — dopiero potem prompty. Karty
branchują wtedy z `develop`, który już ma ich pliki. Prompt do karty wskazuje jej katalog,
nie powtarza jego treści.
**Ta sama zasada dotyczy `docs/spec-backend.md`:** nowego akapitu („Potwierdzone w N”,
„Odbudowa (…)”) nie dopisuje się na koniec żadnej sekcji — ticket tworzy NOWY plik
`docs/spec-backend/wpis-<N>.md`. Wolno tylko poprawić w miejscu zdanie, które ticket obalił.
Powód: karty P10.1 i PR.1 (tickety 90, 91, 2026-09-22) dopisały się w to samo miejsce §2
i zderzyły przy merge'u. Reguła i szablon: `docs/spec-backend/README.md`.
**I to samo dotyczy `docs/rebuild-backlog.md` (od ticketu 128, 2026-09-23):** nowe wpisy, listy
„Pominięte" i podsumowania partii idą do `docs/rebuild-backlog/wpis-<numer ticketu>.md`,
identyfikator wpisu to `#<ticket>.<kolejny>` (np. `#131.1`) — nie „następny numer po #108",
bo po ten sam numer sięgały dwa równoległe triaże. Backlog miał trzy punkty zbiorowego
dopisywania (koniec listy, bloki „Pominięte", akapity podsumowań na górze) i konfliktował na
każdym z nich. W miejscu wolno tylko zmienić linię `Do nowej wersji?` (decyzja użytkownika)
albo `Status` (ten, kto wdraża). Reguła i szablon: `docs/rebuild-backlog/README.md`;
przegląd: `tools/stan-backlogu.sh`.

**1. Po każdej zamkniętej karcie jej `karta.md` opisuje STAN, nie zamiar.**
Karta oznaczona jako zrobiona (data + ID ticketa), gate rozliczony, zakres faktycznie dowieziony
zamiast planowanego. Dotyczy też `docs/rebuild-backlog.md` — statusy wpisów aktualizuje ta
sesja, która je realizuje, nie następna. Stan iteracji w roadmapie odświeża koordynator.

**2. Ustalenie dotyczące PRZYSZŁEJ karty zapisz DLA TEJ KARTY — jako `docs/karty/<jej ID>/wejscie-<N>.md`.**
Nie w karcie właśnie zamkniętej i nie w roadmapie. Sesja 3c czyta katalog 3c; nota schowana
w bloku 3b do niej nie dojdzie. To realnie się stało w 3b: konsekwencje dla 3c/3d/3e wylądowały
w opisie 3b i trzeba było je potem przenosić.

**3. Przypisanie funkcji do sesji weryfikuj GRAFEM WYWOŁAŃ, nie nazwą.**
Zanim zaczniesz blok, sprawdź `grep`em, kto naprawdę woła funkcje z jego zakresu, i popraw
roadmapę, jeśli się rozjeżdża (jako karta: zapisz dowód w „Do koordynatora” własnego
`karta.md`, poprawkę wniesie koordynator). Dwa razy przypisała `bridge_ext.cjs` do złej sesji — raz do 3a
(wykryte w 3a), raz do 3c (wykryte przy planowaniu 3c) — bo zakres pisano z nazw funkcji,
a nie z tego, gdzie są wywoływane. Ta sama nieufność dotyczy kształtu API: w I11 roadmapa
dwukrotnie opisała endpoint niezgodnie ze stanem faktycznym (`PUT /api/config` zamiast
realnego `POST /api/config` z ciałem `{klucz, wartosc}`, i pominięcie istniejącego
`POST /api/spedycja`) — metodę i kształt ciała sprawdzaj w `contract/openapi.yaml` i w
oryginale, zanim uwierzysz roadmapie.

**4. Prompt nie koryguje roadmapy — roadmapa koryguje siebie.**
Jeśli piszesz prompt do kolejnej sesji i musisz w nim zaprzeczyć roadmapie, to znak, że
najpierw trzeba poprawić roadmapę. Prompt ma pytać o decyzje, nie o fakty już ustalone.
Rozdzielaj przy tym dwie rzeczy: **fakt** (np. graf wywołań) zapisujesz jako fakt, a **zmianę
przypisania zakresu** traktujesz jako decyzję użytkownika i zapisujesz osobno.

**5. Uważaj na duplikaty definicji w zdeminifikowanym oryginale.**
`deminified/backend-index.cjs` ma funkcje zdefiniowane po dwa razy, gdzie wygrywa PÓŹNIEJSZA:
`tk` (:47378 martwe / :47584 żywe), `Lq` (:46965 licznik cyfr / :47312 generator identyfikatora).
Duplikaty są **fizycznie w wysłanym bundlu** `mirror/backend/index.cjs`, nie artefaktem naszej
deminifikacji — esbuild przy kolizji nazw by je przemianował, więc biorą się z łatek
`patch_*.cjs` doklejanych do `index.cjs` po buildzie (w `mirror/backend/` jest ich kilkanaście;
kolejna łatka Ani może dołożyć następny przypadek). Żeby wykryć: policz wystąpienia
`function <nazwa>(` w `mirror/backend/index.cjs`, nie ufaj numerowi linii w deminifikacie.
**Cieniowanie sięga dalej niż sama funkcja** — sprawdź też, KTO WOŁA zacienioną nazwę w innym
miejscu: `ZT()` (:46971) woła `Lq(i)` licząc na licznik cyfr z :46965, a trafia w generator sha1
z :47312, bo obie deklaracje `Lq` są w tym samym zakresie; efekt widoczny w produkcji: komunikat
„zapis naukowy ma tylko null cyfr znaczących". Szczegóły: `docs/rebuild-backlog.md` #11.

Ta sama nieufność dotyczy pustych odpowiedzi: `safeAll()` w module analityki zamienia błąd SQL
(np. odwołanie do nieistniejącej kolumny) w pustą listę, więc zepsuta trasa wygląda identycznie
jak trasa bez danych — nie ufaj `rows: []`, sprawdź, czy dane w bazie faktycznie są. Przykład:
`docs/rebuild-backlog.md` #32 (`historia_cen` bez kolumny `nazwa`). Ta sama pułapka ma też
postać pliku: w PRODUKCJI `GET /api/analytics/export/{view}` dla `availability-products` i
`sell-through` oddaje sam BOM (pusty CSV) zamiast `rows: []`, mimo danych w bazie — nie ufaj też
pustemu plikowi eksportu. W odbudowie od karty P10.1 (ticket 90) to naprawione: oba widoki
zwracają wiersze; morał o niedowierzaniu `rows: []`/pustemu plikowi zostaje aktualny dla innych
tras i dla samej produkcji.

Ta sama nieufność dotyczy projekcji Drizzle: `select()` bez jawnej listy pól oddaje nazwy PÓL
modelu (camelCase), a fixture nagrany z oryginału (który robi `SELECT *` przez `better-sqlite3`)
ma nazwy KOLUMN (`snake_case`) — trafiło to na `GET /api/selly/log` (siedem kluczy naraz) i
wykrył to dopiero GATE, nie code review. Dla trasy, której fixture ma klucze `snake_case`,
projekcję trzeba wypisać jawnie. Działa to też w drugą stronę: kolumna dodana runtime'owym
`ALTER TABLE` (nie migracją) jest dla Drizzle NIEWIDOCZNA, bo model jej nie zna —
`products.uwaga_cena` (dokładana patchem `uwaga_cena_patch.cjs` przy każdym starcie) NIE
wychodzi przez `GET /api/products`, mimo że fizycznie jest w tabeli (zmierzone na oryginale:
72 klucze bez `uwagaCena`). Obecność kolumny w bazie produkcji nie znaczy, że API ją oddaje —
sprawdzaj model, nie schemat tabeli.

Trzecia pułapka tej samej rodziny: **kolumna deklarowana `INTEGER` może fizycznie trzymać
TEKST, a tryb `boolean` w modelu go milcząco zjada.** Dziesięć kolumn flagowych `products`
(`reinforced`, `extra_load`, `cut_resistant`, `heat_resistant`, `stubble_resistant`, `nro`,
`cho`, `ms`, `snow_3pmsf`, `cfo`) ma w produkcji mieszane typy — obok `0`/`1` siedzi napis
`'Tak'` (powinowactwo typów SQLite konwertuje przy zapisie tylko to, co czyta się jako liczba;
`'Tak'`/`'Nie'`/`''` zostają tekstem, więc tekstowe `'0'` w tych kolumnach nie istnieje).
Mapper `integer({ mode: "boolean" })` robi `Number(v) === 1`, więc `'Tak'` → `false`, cicho —
zmierzone na kopii produkcji z 23.09: `snow_3pmsf` 750 × `'Tak'`, `ms` 713, `cfo` 52, `nro` 12,
`cho` 10. Skutek: generator CSV dla Selly (`SELECT *` po stronie oryginału) tracił te oznaczenia,
a nasz, czytający przez model, wypisywał puste pole — 899 z 5396 wierszy (17%) katalogu bez
`Śnieg 3PMSF`/`M+S`/`CFO`/`NRO`/`CHO`, bez żadnego zgłoszonego błędu; wykrył to dopiero bajtowy
pomiar porównawczy z generatorem produkcji, nie test i nie code review. Dla trasy/pliku, który ma
odwzorować `SELECT *` oryginału, samo wypisanie projekcji jawnie NIE WYSTARCZY — trzeba jeszcze
ominąć mapper: `` sql<T>`${products.<pole>}` `` w `select({...})` idzie przez `noopDecoder`, a nie
przez `column.mapFromDriverValue` (`mapResultRow` w **korzeniu** paczki `drizzle-orm`,
`utils.cjs:40`, wybór dekodera `:45-52` — NIE w `sqlite-core/`, tę ścieżkę łatwo zacytować źle).
I druga strona tej monety: nie „napraw" schematu — tryb `boolean` w modelu jest wierny (oryginał
trzyma te kolumny tak samo, `deminified/backend-index.cjs:43733-43752`), więc `GET /api/products`
ma zostać przy `false` na `'Tak'`; poprawka należy do warstwy odczytu konkretnego konsumenta
(`src/selly/generator-csv.ts`), nigdy do `src/db/schema.ts`. Ten sam błąd czeka nienaprawiony w
`src/selly/mapper.ts:197-203` (sync REST do Selly, backlog `#154.1`). Szczegóły i pomiar:
`docs/rebuild-backlog/wpis-153.md`, `docs/tickets/154-BUG-csv-selly-flagi-tak/raport.md`.

**`UPPER()`/`LOWER()` w SQLite są ASCII-only.** `UPPER('prowadząca')` daje `'PROWADZąCA'` —
małe `ą` przechodzi nietknięte. Skutek zmierzony w 13c: migracja `006_nazwa_caps.sql` zostawia
16 wierszy `staging_items`, które semantycznie SĄ case-only, ale predykat `UPPER(A)=UPPER(B)`
ich nie łapie. To NIE jest błąd do naprawy — produkcja użyła tego samego `UPPER()`, więc ma tę
samą resztkę i jest to spójne (baza ma `PROWADZąCA`, plik dostawcy z `PROWADZĄCA` nadal się od
niej różni). Morał: przy porównaniach case-insensitive w SQL sprawdź, czy dane mają polskie
znaki, i nie „popraw" tego na wariant Unicode-aware bez sprawdzenia, co zrobił oryginał.

**W `mirror/frontend/` bundli jest kilka, ale ŻYWY jest tylko ten z `index.html`.** Sprawdzaj to
zawsze: `grep -o 'src="./assets/index[^"]*"' mirror/frontend/index.html` (dziś:
`index-PRICEFMT1783512500.js`). Ania dwukrotnie łatała plik, którego produkcja nie ładuje —
pass-through `konstrukcja` z 2026-09-01 poszedł do martwego `index-BRIDGEONE21783342500.js`
(ścieżkę wpisała w `mirror/backend/CHANGELOG.md:101`), więc produkcja do dziś pokazuje „—"
w kolumnie „Konstrukcja opony". Do tego `deminified/frontend-index.js` jest bundlem z 2026-08-13,
czyli sprzed czterech łatek — zanim uznasz deminifikat za stan produkcji, przeczytaj
`deminified/README.md`.

**Nazwa kopii `.bak` daje ETYKIETĘ, nie treść.** `.bak_szer_marka_20260904_1500` brzmi jak
„kolumna szerokość/marka" i tak opisały ją roadmapa i backlog, a realnie łatka zdejmuje z formatera
szerokości gałąź „cała notacja `AxB`" (587 z 7395 pozycji zmienia zapis) i dokłada filtr „bez cyfr"
na słownikowej gałęzi listy marek. Morał: przy łatkach FE najpierw rozłóż diff bundla
(`git show main:mirror/frontend/assets/<plik>` — kopie `.bak` są tylko na `main`), dopiero potem
uwierz etykiecie. Rozkład wszystkich pięciu etykiet z I13:
`docs/tickets/47-CHORE-i13e-frontend-bridgeone/plan.md`.

**MSW z `onUnhandledRequest: "error"` (`rebuild/frontend/test/setup.ts`) nie wywala testu przy
brakującym handlerze — zamienia go w błąd zapytania.** MSW rzuca wewnątrz przechwycenia
żądania (`InternalError`), więc `fetch()` po prostu odrzuca obietnicę; React Query łapie to
i query wchodzi w stan `error` zamiast rzucić wyjątkiem z testu. Skutek: nowe zapytanie
(własny `queryFn`) dodane do widoku, który MA już testy (np. Pulpit), bez dopisania handlera do
współdzielonych mocków (`test/msw/pulpit.ts`) **nie wywala** tych testów — po cichu sprawdzają
stan błędu zamiast danych, dopóki nikt nie doda asercji na treść. Zmierzone w P6.2
(`77-FEATURE-pseudo-alerty-katalogowe`): zapytanie o statusy w `useAlertyKatalogu()` wymagało dopisania
`GET /api/alerty-katalogu/statusy` do `handleryPulpitu()`.

---

## Przed każdym PR — synchronizacja z `develop` (dotyczy KAŻDEJ sesji)

Kart chodzi kilka równolegle, więc `develop` przesuwa się w trakcie roboty. **Gałąź musi zawierać
całe `origin/develop`, zanim ją wypchniesz i otworzysz PR.** Użytkownik ma dostać PR gotowy do
merge'a — rozwiązywanie konfliktów w GitHubie („Resolve conflicts") i ręczne aktualizowanie gałęzi
to robota, której nie wolno na niego zrzucać. Obowiązuje tak samo kartę, triaż, DOCS-a i poprawkę
na szybko — w worktree i w głównym repo.

```bash
tools/sync-z-develop.sh        # uruchom z katalogu gałęzi (worktree ticketa/karty)
```

Skrypt: `git fetch origin --prune`, dociągnięcie commitów z `origin/<gałąź>` i **merge**
`origin/develop` (merge, nie rebase — taka jest cała historia repo, a gałąź bywa już wypchnięta).
Kody wyjścia: `0` aktualna/scalone czysto · `2` konflikty · `1` warunek wstępny (niezacommitowane
zmiany, HEAD odłączony, jesteś na gałęzi bazowej).

- **Konflikty rozwiązuje ta sesja, która je wywołała** — tylko ona zna swój zakres. Łącz OBIE
  strony, nie „wygrywaj" całym plikiem. Konflikt merytoryczny, którego nie umiesz rozstrzygnąć
  (dwie karty zmieniły to samo zachowanie, kolizja numeru migracji) → **STOP i pytanie do
  użytkownika**, nie zgadywanie.
- **Konflikt w pliku współdzielonym** (`docs/rebuild-roadmap.md`, `docs/spec-backend.md`,
  `docs/karty/README.md`) = ktoś złamał zasadę „karty piszą wyłącznie we własnych plikach"
  (sekcja wyżej, pkt 0). Rozwiąż zachowując oba wpisy i odnotuj to w raporcie/karcie.
- **Po scaleniu bramki lecą od nowa** (`npm run lint && npm run typecheck && npm run build &&
  npm test` w `rebuild/backend/`, plus GATE na fixtures, jeśli ticket dotyka kontraktu). Dwie
  zmiany, z których każda osobno przechodziła, razem potrafią się wykluczyć. Czerwona bramka po
  merge'u = naprawa **przed** pushem.
- **Po utworzeniu PR-a sprawdź scalalność:**
  `gh pr view --json mergeable,mergeStateStatus`. `MERGEABLE` = koniec; `CONFLICTING` = ktoś
  zmergował coś w międzyczasie → powtórz synchronizację i push. `UNKNOWN` = powtórz odczyt raz.
- PR-y ticketów idą **do `develop`** (`gh pr create --base develop`) — domyślną gałęzią repo jest
  `main`, więc bazę podawaj jawnie.

**Push i PR jednym poleceniem, z ponawianiem blokad:**

```bash
tools/push-i-pr.sh --tytul "<TICKET-ID>: tytuł" --tresc-plik docs/tickets/<TICKET-ID>/pr-body.md
```

Robi: kontrola dostępu `gh` → sync z `develop` → `git push` → `gh pr create --base develop` →
odczyt scalalności. Kody wyjścia: `0` gotowe · `1` warunek wstępny · `2` konflikty · `3`
uwierzytelnienie · `4` weszły zmiany z bazy, bramki od nowa · `5` GitHub widzi `CONFLICTING` ·
`6` blokada nie ustąpiła.

**Gdy push/PR się blokuje — najpierw rozpoznaj, co to za blokada.** Tylko dwie pierwsze
kategorie mają sens do ponawiania; skrypt robi to sam (5 s → 15 s → 40 s → 90 s → 180 s):

- **Blokada `.git` od równoległej karty** (`index.lock`, `cannot lock ref`, `packed-refs.lock`) —
  tak, to jest realny wyścig: wszystkie worktree kart (dziś ~46) dzielą JEDEN katalog `.git`,
  więc równoległe `fetch`/`push` biją się o te same pliki blokad. Mija samo. Jeśli plik blokady
  jest starszy niż 10 min, to nie wyścig, tylko pozostałość po zabitym procesie git — skrypt to
  rozróżnia i wypisuje ścieżki; usuwa je użytkownik, nie sesja.
- **Limit / awaria GitHuba** (`rate limit`, `was submitted too quickly`, HTTP 429/5xx) — czekać.
- **`[rejected] (non-fast-forward)`** — to NIE blokada, tylko nieaktualna gałąź: sync i push
  jeszcze raz (skrypt robi to automatycznie, jeden raz).
- **Uwierzytelnienie** (`gh auth login`, `Authentication failed`, `token in keyring is invalid`) —
  **ponawianie nic nie da, nie zapętlaj się**: zgłoś użytkownikowi. Na tej maszynie `gh` trzyma
  token w keyringu i `gh auth status` potrafi krzyczeć „token in keyring is invalid”, choć
  wywołania API działają — dlatego skrypt sprawdza realne `gh api user`, nie `gh auth status`.

**Zasada jest egzekwowana mechanicznie, nie tylko opisana** — na trzech poziomach, żeby działała
na każdym środowisku i dla każdego, kto tu programuje:

1. **Hook `pre-push`** (`.githooks/pre-push`) — odbija push gałęzi, która nie zawiera całego
   `origin/develop`, i wypisuje, co zrobić. Dotyczy człowieka i agenta tak samo. Git nie przenosi
   hooków przy klonowaniu, więc **na nowym klonie raz**: `tools/wlacz-hooki.sh` (robi to też
   `npm install` w `rebuild/backend` lub `rebuild/frontend` — skrypt `prepare`). Świadome
   obejście: `POMIN_SYNC=1 git push` albo `git push --no-verify`.
2. **Job `synchronizacja` w CI** (`.github/workflows/ci.yml`) — ta sama kontrola po stronie
   GitHuba, na każdym PR-ze; łapie też kogoś, kto hooków nie włączył.
3. **Skrypty** `tools/sync-z-develop.sh` i `tools/push-i-pr.sh` — robią to poprawnie za Ciebie.

Pełna procedura z krokami i tabelą kodów wyjścia: `.claude/commands/feature.md`, Kroki 16–17.

## Środowisko

- **Nowy klon repo (nowa maszyna, nowa osoba) — raz:** `tools/wlacz-hooki.sh`
  (ustawia `core.hooksPath=.githooks`, więc `pre-push` pilnuje synchronizacji z `develop`
  we wszystkich worktree tego klonu). `npm install` w `rebuild/backend` albo `rebuild/frontend`
  robi to samo automatycznie (`prepare`). Sprawdzenie: `git config --get core.hooksPath`.
- Backend wymaga **Node ≥ 20** (`better-sqlite3`). Domyślny `node` na maszynie deweloperskiej to
  v14 — przed pracą: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`.
- **Sesja w przeglądarce (`claude.ai/code`) NIE MA `gh` — to nie jest problem z logowaniem, binarki
  po prostu nie ma w kontenerze.** Zmierzone 2026-09-24 (ticket 157, konto `Devilian07`). Skutki,
  o które rozbije się każda sesja chmurowa, jeśli tego nie wie:
  - `tools/push-i-pr.sh` **nie zadziała** (cały opiera się na `gh api`/`gh pr create`).
    `tools/sync-z-develop.sh` **działa** — to czysty `git`. Push robisz `git push`, a pull requesta
    i odczyt scalalności **narzędziami MCP GitHub** (nazwy sprawdź listą narzędzi sesji; w tamtym
    przelocie działały `mcp__github__get_me`, `mcp__github__list_pull_requests`).
  - Zapis na GitHubie wymaga **zainstalowanej aplikacji Claude GitHub App na repozytorium**.
    Bez niej `git push` i `mcp__github__create_branch` dają **403** („Claude doesn't have GitHub
    access to …") — nawet gdy konto użytkownika ma `permission: write`. Prawo zapisu konta i dostęp
    aplikacji to DWIE różne rzeczy; komunikat 403 mówi o drugiej, nie o pierwszej.
    Instalacja: https://github.com/apps/claude/installations/select_target.
  - `pre-push` w takiej sesji **początkowo nie jest aktywny** (`core.hooksPath` pusty) i włącza się
    sam dopiero po `npm ci` w `rebuild/backend` (skrypt `prepare`). Sesja czysto dokumentacyjna
    zostaje bez hooka — dlatego regułę „PR do `develop`" traktujemy jako umowę, nie jako zamek.
  - Co w chmurze **działa** (sprawdzone): Node 22 i pełne bramki backendu (`npm ci`, lint,
    typecheck, build, `npm test` → 1844 testy zielone, ~86 s); atomowa rezerwacja numeru ticketa
    z Kroku 4 mimo braku lokalnego `.worktrees/.numery`; `git worktree add`; widoczność
    `CLAUDE.md` i `.claude/commands/feature.md`.
  - Czego w chmurze **nie da się zrobić**: nagrać fixtures z oryginału — `db/snapshot.db` jest
    w `.gitignore`, więc do kontenera nie jedzie.
- **`npm test` wypisuje na stderr `DB_PATH: Required` i „kopia-bazy: brak DB_PATH — nie wiem, co
  kopiować. Przerywam."** To NIE jest usterka, tylko dwa testy, które celowo sprawdzają tę gałąź:
  `test/kopia-bazy.test.ts:117` i `test/selly.csv-cli.test.ts:110`. Zielony bieg z tym szumem jest
  poprawny — nie „naprawiaj" tego i nie zgłaszaj.
- Bramki backendu: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`
  w `rebuild/backend/`.
- Zakładaj, że projekt może być uruchomiony i że równolegle pracuje ktoś inny — testy używają
  bazy w katalogu tymczasowym i portów efemerycznych, i tak ma zostać.
- Backend ma opcjonalną integrację zewnętrzną z Selly.pl (`SELLY_*` w env, od I8/8a) — testy
  NIGDY nie wołają prawdziwego Selly, klient stoi za interfejsem i jest wstrzykiwany, atrapa
  w `rebuild/backend/test/gate/selly-atrapa.ts`. Uwaga: `POST /api/selly/sync-supplier` z
  `dry_run=false` realnie modyfikuje cudzy sklep — nie odpalaj tego ręcznie bez sekretów
  testowych.
- **Oryginał da się uruchomić lokalnie** — `tools/record-write-fixtures.cjs` stawia
  `mirror/backend/index.cjs` na kopii `db/snapshot.db`; to standardowa metoda dowodzenia
  wierności (nagrania fixtures), nie tylko czytanie zdeminifikowanego kodu. Trzy pułapki:
  scheduler rusza po URL-e dostawców w ciągu 60 s od startu (`extensions.cjs:811-838`,
  6/10 dostawców ma ustawioną częstotliwość) — trzeba ją wygasić w kopii przed startem;
  proces musi startować z CWD = katalog backendu (baza otwierana relatywnie
  `new Database("data.db")`, ale `POST /api/products/clear` robi kopię przez
  `path.join(__dirname, "data.db")`); moduły `atrybuty` i `pending` mają zahardkodowane
  ścieżki produkcyjne i lokalnie się nie podnoszą (`/api/atrybuty*` w piaskownicy martwe).
