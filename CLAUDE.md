# Bridge — zasady stałe dla każdej sesji

Ten projekt to **wierna odbudowa** działającej produkcji („Bridge dla Agrowca") w nowym stosie
w `rebuild/`. Domyślna reguła: odtwarzasz udokumentowane zachowanie 1:1, nie wymyślasz nowego.
Każde odstępstwo musi być świadomą decyzją użytkownika. Pełny kontekst i kolejność źródeł
prawdy: `.claude/commands/feature.md`, sekcja „Kontekst odbudowy".

Praca idzie iteracjami i blokami (I3 → 3a, 3b, 3c…), opisanymi w `docs/rebuild-roadmap.md` §5.

---

## Roadmapa jest wejściem dla następnej sesji — utrzymuj ją na bieżąco

`docs/rebuild-roadmap.md` czyta następna sesja. Prompt, którym ją uruchamiasz, jest
jednorazowy — **roadmapa zostaje**. Z tego wynika pięć obowiązków:

**1. Po każdym zamkniętym bloku roadmapa opisuje STAN, nie zamiar.**
Blok oznaczony jako zrobiony (data + ID ticketa), gate rozliczony, zakres faktycznie dowieziony
zamiast planowanego. Dotyczy też `docs/rebuild-backlog.md` — statusy wpisów aktualizuje ta
sesja, która je realizuje, nie następna.

**2. Ustalenie dotyczące PRZYSZŁEGO bloku wpisz DO TEGO BLOKU.**
Nie do bloku właśnie zamkniętego. Sesja 3c czyta blok 3c; nota schowana w bloku 3b do niej nie
dojdzie. To realnie się stało w 3b: konsekwencje dla 3c/3d/3e wylądowały w opisie 3b i trzeba
było je potem przenosić.

**3. Przypisanie funkcji do sesji weryfikuj GRAFEM WYWOŁAŃ, nie nazwą.**
Zanim zaczniesz blok, sprawdź `grep`em, kto naprawdę woła funkcje z jego zakresu, i popraw
roadmapę, jeśli się rozjeżdża. Dwa razy przypisała `bridge_ext.cjs` do złej sesji — raz do 3a
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
postać pliku: `GET /api/analytics/export/{view}` dla `availability-products` i `sell-through`
oddaje sam BOM (pusty CSV) zamiast `rows: []`, mimo danych w bazie — nie ufaj też pustemu
plikowi eksportu.

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

---

## Środowisko

- Backend wymaga **Node ≥ 20** (`better-sqlite3`). Domyślny `node` na maszynie deweloperskiej to
  v14 — przed pracą: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`.
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
