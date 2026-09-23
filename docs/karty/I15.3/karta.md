# I15.3 — blokowane formy płatności w katalogu + eksport CSV Selly

> **Stan:** ✅ 2026-09-23 · 122-FEATURE-i15-3-blokady-platnosci-csv
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #73, #76, #102, #104 (nie: #77) · **Zależy od:** I15.1
> **Ticket:** 122-FEATURE-i15-3-blokady-platnosci-csv

Założona przez koordynatora ticketem `104-DOCS-plan-i15`, 2026-09-22. Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”.

## Zakres
- **#73 w CSV:** 60. kolumna `Blokowane-formy-platnosci` pełnego eksportu CSV dla Selly
  (`generate_selly_export.cjs` na `origin/main` @ `88fa31c`), z fallbackiem `blokowaneFormyDlaDostawcy`
  gdy wartość w bazie pusta.
- **#73 w API i UI:** pole `blokowaneFormyPlatnosci` **NIE wychodzi z `GET /api/products`** — pomiar
  na oryginale pokazał, że produkcja go też nie wystawia (Drizzle czyta pola modelu, kolumna jest
  dokładana runtime'owym `ALTER TABLE`, ten sam mechanizm co `uwagaCena`). Zostaje w
  `KOLUMNY_POZA_KONTRAKTEM.products`. Kolumna „Blokowane formy płatności” w `/katalog` (port
  `mirror/frontend/assets/payment-blocks-injection.js`) **liczy wartość w froncie** z mapy MO,
  nie z API — dokładnie jak robi to produkcja. Szczegóły pomiaru: `docs/tickets/122-…/raport.md`
  sekcja „Odstępstwa od planu”.
- **#76:** `toSellyCategoryName` → `nazwaKategoriiSklepu` — nazwy kategorii sklepu, mapowanie `ł`→`l`
  PO NFD (NFD nie rozkłada `ł`). Nagłówek `R/D` — odbudowa miała go już wcześniej, tu tylko
  potwierdzone testem (wartości „Radialna”/„Diagonalna”).
- **#104 (zastępuje #77 w zakresie tej karty):** eksport CSV obejmuje TYLKO `status='aktywny'`
  (filtr w odbudowie jest od I8a, więc #104 tu nic nie zmienia poza tym) + **zapis atomowy**
  (tmp w tym samym katalogu + `rename`). Pośredni stan #77 („wstrzymane ze stanem 0”, produkcja
  14–22.09) nigdy nie wszedł do odbudowy — nie ma tu czego cofać.
- **#102:** `npm run selly:csv` (+ `selly:csv:dev`) — CLI dla crona produkcji, ta sama funkcja
  `wygenerujCsvSelly()` co trasa `POST /api/selly/generate-csv`.

## Pliki (wyłączna własność)
`rebuild/backend/src/selly/generator-csv.ts`, `rebuild/backend/src/selly/csv-cli.ts`, projekcja pola
w trasie katalogu (`src/repos/kolumny.ts`), `rebuild/frontend/src/pages/katalog/**` (kolumna).
NIE: `rebuild/schema/` i model (I15.1), `src/selly/rest/**` (I15.6–I15.8), `contract/openapi.yaml`
(bez zmian — pole nie wychodzi z API, patrz „Zakres”).

## Decyzje
**Decyzje użytkownika 2026-09-22 (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na
istniejące obiekty · D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2
przenosimy · D4 błędny EAN = błąd blokujący akceptację (wersja Ani zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
**Decyzje własne tej karty (2026-09-23, pełne uzasadnienia w `docs/tickets/122-…/plan.md`):** D1 kolumna w
`/katalog` domyślnie widoczna + retrofit `uzupelnijBlokowaneFormy` · D2′ (zastępuje pierwotne D2) pole
NIE wychodzi z API, wartość liczona w froncie — rozstrzygnięte pomiarem, nie założeniem · D3 fallback CSV
portowany 1:1 · D6 pole tylko do odczytu (triggery, nie `PATCH`) · D7 stdout `Liczba produktow aktywnych:`
· D8 CLI wzorcem `migrate`/`migrate:dev`.
**Produkcja zamrożona od 2026-09-22** — źródło prawdy dla TEJ karty to `origin/main` na commicie
**`88fa31c`** (nie `7d6cfc9` — patrz #103/#104 w `wejscie-110.md`); nowy kod na `main` = zgłoś.

—

## Dowiezione

Zakres dowieziony w całości poza jedną świadomą zmianą wobec pierwotnego zakresu karty (patrz „Zakres”
wyżej — #73 w API nie wychodzi, rozstrzygnięte pomiarem D2′). Generator CSV ma 60 kolumn, linia
nagłówkowa bajt w bajt zgodna z realnym plikiem produkcji z `88fa31c`; `nazwaKategoriiSklepu` pokrywa
5 kluczy mapy + przypadek `ł`; eksport tylko `aktywny`, zapis atomowy (bez plików `.tmp-*` po
generowaniu); `npm run selly:csv` daje plik bajt w bajt identyczny z trasą i nie rusza `.htaccess`;
kolumna „Blokowane formy płatności” w `/katalog` (szerokość 420, `font-mono`, „—” dla `null`/MO6/
nieznanego dostawcy, `title` z pełną wartością), domyślnie widoczna, retrofit dla zastanych zapisów
wyboru kolumn w IndexedDB. `contract/fixtures/**` i `contract/openapi.yaml` bez zmian — pomiar
potwierdził, że nie było czego przenagrywać (72 klucze, jak dziś). Bramki zielone po obu stronach.

**Pomiar CSV — liczba wierszy przed/po (kopia `db/snapshot.db` + migracje):** 6899 wierszy z
nagłówkiem (6898 `aktywny`) **przed** zmianą i **tyle samo po**. To poprawny wynik, nie przeoczenie:
filtr `status='aktywny'` odbudowa miała od I8a, pośredni stan #77 („eksport obejmuje też wstrzymane
ze stanem 0”) nigdy do niej nie wszedł, więc z #104 zostaje tu wyłącznie zapis atomowy — nie ma co
cofać w filtrze. Fakty z plików produkcji (nie porównywalne bezpośrednio z odbudową, inna baza i inny
moment): `.bak_20260922T160912Z_availability` (przed #104) = 8209 wierszy → plik bieżący @ `88fa31c`
= 5461 wierszy; ten spadek to zmiana produkcji względem samej siebie, nie odbudowy względem produkcji.

## Do koordynatora

1. **Polecenie do crona przy cutoverze (#102):** `cd <katalog backendu> && npm run selly:csv`
   (albo wprost `node <katalog backendu>/dist/selly/csv-cli.js`). W środowisku crona wystarczy
   `DB_PATH` — `SELLY_CSV_DIR`/`SELLY_CSV_PLIK`/`SELLY_CSV_URL` mają domyślne = wartości produkcyjne.
   **`JWT_SECRET` NIE jest wymagany** — `csv-cli.ts` podstawia wartość zastępczą do `wczytajEnv()`
   (realna z `process.env`, jeśli jest, ma pierwszeństwo), świadomie, bo cron nie dziedziczy
   środowiska procesu serwera. Polecenie nadpisuje wyłącznie sam plik CSV (tmp + `rename`) i
   **nie rusza `.htaccess`** — pokryte testem `test/selly.csv-cli.test.ts`.
2. **Sygnatura funkcji dla karty I15.10** (wywołanie generatora w tym samym procesie, bez podprocesu):
   `wygenerujCsvSelly(db: Baza, sciezki: { katalog: string; plik: string; url: string }): WynikGenerowania`
   z `rebuild/backend/src/selly/generator-csv.ts`; `WynikGenerowania` = `{ ok, czas_ms, wiersze,
   rozmiar_mb, ostatnia_synchronizacja, stdout }`. Już eksportowana, synchroniczna, zapis atomowy.
   Dokładnie tej samej funkcji używają trasa `POST /api/selly/generate-csv` i CLI — jeden format,
   nie dwie kopie. Pełne ostrzeżenie (blokowanie pętli zdarzeń, kolejność z równoległymi odczytami):
   `docs/karty/I15.10/wejscie-122.md`.
3. **FAKT: `mirror/` na `develop` jest nieaktualny** (~2 tygodnie za `main`) — brak
   `payment_blocks.cjs`, `availability_sync.cjs`, `extensions.cjs` sprzed 10.09, plik CSV jeszcze
   59-kolumnowy. Skutek: `tools/record-write-fixtures.cjs` dziś nagrywa **ze złej wersji oryginału,
   bez ostrzeżenia** — pierwsze przenagranie w tym tickecie trzeba było z tego powodu wycofać.
   Propozycja z raportu: nagrywarka niech porównuje `mirror/` z `origin/main` i głośno ostrzega przy
   rozjeździe. Poza własnością tej karty (`mirror/`, `tools/` nie są jej plikami).
4. **FAKT: `payment_blocks.cjs` ma zaszytą ścieżkę produkcyjną** (`/home/admin/private_apps/bridge/data.db`),
   więc przy zwykłym lokalnym starcie oryginału `ensurePaymentBlocks()` po cichu pada („Cannot open
   database because the directory does not exist”) i piaskownica NIE MA kolumny
   `blokowane_formy_platnosci`. Każdy pomiar dotyczący tej kolumny musi ją najpierw jawnie założyć
   (`payment_blocks.ensurePaymentBlocks('<ścieżka>')`), inaczej wynik jest bezwartościowy — ten sam
   gatunek pułapki co `atrybuty`/`pending` z `CLAUDE.md`.
