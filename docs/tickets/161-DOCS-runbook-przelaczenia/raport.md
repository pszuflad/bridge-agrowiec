# 161-DOCS-runbook-przelaczenia — raport

**Data:** 2026-09-24 · **Baza:** `origin/develop` @ `05b304d`

## Dowiezione
- **`docs/cutover-runbook.md` (nowy)** — 13 kroków od wyłączonego starego stosu do działającej
  produkcji: decyzja bramowa o docroocie, zatrzymanie automatów CD, wybór i migracja bazy, plik
  środowiska, dostosowanie skryptu wdrożenia, build i start, proxy `/panel`, katalog CSV z białą
  listą IP, cron 6:00, smoke-testy, dwufazowe włączenie Selly, dobicie starego stosu, pierwsza
  doba. Do tego: czego nie robić, co uprzedzić Anię, trzy typowe awarie z przyczyną.
- **`docs/cutover.md`** — jedno zdanie na końcu rozdziału 0 z odsyłaczem do runbooka.

## Weryfikacja twierdzeń (wszystkie sprawdzone w kodzie, nie z pamięci)

| Twierdzenie runbooka | Dowód |
|---|---|
| `.env` wygrywa z twardymi ustawieniami stagingowymi | `tools/deploy-staging.sh:42-45` (export) vs `:49` (`set -a; . .env`) |
| `DB_PATH` jest wyjątkiem — `.env` go nie zmieni | `:125` `DB_PATH="$DATA_DB"` przy `pm2 start`; `$DATA_DB` z `:23` |
| `pm2 restart` nie przeczyta `.env` | `:124-126` — `pm2 delete` + `pm2 start --update-env` ze środowiska powłoki |
| `SELLY_TRYB=pelny` otwiera zapis bez schedulera | `server.ts:90` (montaż dla trybu ≠ `wylaczony`) + `selly/dostepnosc.ts:1-20` (`syncDelta` w pętli) |
| `generate-csv` działa mimo blokady | `routes/selly.ts:372,389` — tylko `requireAuth` |
| `deploy/staging/htaccess` jest na 5001 i bez `/panel` | nagłówek pliku, `:1-3`; kopiowany przez `deploy-staging.sh:135` |
| dwa wyzwalacze CD, oba czynne | `docs/deploy-setup.md`, „Wyzwalacz CD — dwie opcje" (obie oznaczone UŻYWANA) |
| biała lista IP `212.91.27.191 46.170.251.129` | `docs/cutover.md` §3a, wynik audytu 24.09 |
| CLI CSV nie potrzebuje `JWT_SECRET` | `src/selly/csv-cli.ts` — podstawia wartość zastępczą świadomie |
| ścieżki CSV = domyślki produkcyjne | `src/config/env.ts:138-146` |

## Czego runbook świadomie NIE rozstrzyga
- **Konfiguracji Apache/DirectAdmin.** Krok 1 stawia to jako decyzję z dwoma wariantami i ich
  konsekwencjami dla adresu feedu w Selly. Nie mam wglądu w vhosty na VPS i zgadywanie tutaj
  kosztowałoby albo 404 dla Selly, albo zmianę konfiguracji cudzego sklepu.
- **Czy po przełączeniu stawiamy nowy staging** i czy zostaje automatyczny deploy z `develop`.
  Krok 2 wyłącza automaty na czas okna i odsyła decyzję poza runbook (roadmapa §6a).

## Warunek wstępny, który odpadł
Ticket `159-FEATURE-gri-upload-csv-xlsx` (PR #178, zmergowany) potwierdził to, co ten sam pomiar
statyczny pokazał przy tickecie 160: **upload CSV i XLSX dla MO10 już działał**, brakowało
wyłącznie testu i próbki `MO10.csv`. Zmian w kodzie produkcyjnym nie było. Runbook nie niesie
więc tego warunku jako blokady.

---

## Uzupełnienie 2026-09-24 — wariant A wybrany, Krok 1 rozpisany

Użytkownik wybrał **wariant A**. Krok 1 przepisany z decyzji na procedurę (1.1–1.5). Przy okazji
dwa ustalenia, które zmieniają treść dokumentu:

### 1. Sprostowanie: wariant B NIE psuje adresu feedu CSV
Pierwsza wersja runbooka twierdziła, że przy wariancie B trzeba zmienić adres w panelu Selly.
**Nieprawda.** Plik CSV to zasób statyczny w `public_html/panel/ex-port-files/` z własnym
`.htaccess`; reguła SPA-fallback w `mirror/frontend/.htaccess` ma `RewriteCond %{REQUEST_FILENAME} !-f`,
więc istniejący plik jest serwowany wprost, niezależnie od tego, gdzie stoi panel. Wariant B psuje
**zakładki Ani i adres panelu**, nie feed. Sprostowanie zapisane w treści Kroku 1.

### 2. Wariant A wymaga zmiany w kodzie frontendu — to nie jest sama robota na VPS
Zmierzone:

| Co | Stan | Dowód |
|---|---|---|
| assety | `base: "/"` → ścieżki absolutne `/assets/…` | `rebuild/frontend/vite.config.ts:10` |
| routing | wouter bez `<Router base=…>`; `App.tsx` importuje tylko `Route`, `Switch` | `rebuild/frontend/src/App.tsx:25` |
| API | `BAZA_API = ""` → `fetch("/api/…")` | `rebuild/frontend/src/lib/api.ts:19,111` |

Produkcja robi to inaczej i to jest wzorzec do odtworzenia:
- `mirror/frontend/index.html` ładuje assety **względnie**: `src="./assets/index-PRICEFMT1783512500.js"`;
- `mirror/frontend/.htaccess` (nagłówek) mówi wprost: *„Bundle uzywa stalej Vd='/panel' -> kazde
  wywolanie API ma sciezke /panel/api/…"* — i faktycznie w żywym bundlu są ciągi `"/panel/api/atrybuty…"`;
- komentarz `lib/api.ts:16-17` przewidział ten przypadek: *„gdyby aplikacja kiedyś wróciła pod
  prefiks, jest to jedno miejsce do zmiany"*.

**Bez tych trzech zmian wariant A daje białą stronę** (assety 404). To osobny ticket frontendowy,
do zrobienia i zmergowania PRZED wdrożeniem.

### 3. Decyzja, której ten ticket nie podejmuje: `panel.agritires.eu`
`mirror/frontend/.htaccess` obsługuje **dwa hosty**: `agritires.eu/panel/…` i subdomenę
`panel.agritires.eu/…` (wiodący `/panel` zdejmowany wewnętrznym rewritem, nie 301 — żeby nie
zniszczyć ciała POST). Stary panel tego nie odczuwał, bo routował po **hashu**. Nasz routuje po
ścieżce, więc jedna stała `base` nie obsłuży obu hostów. Jeśli subdomena ma żyć, `base` trzeba
wyliczać z `window.location` w czasie działania. **Pytanie do Ani przed ticketem frontendowym.**

### 4. Ochrona katalogu CSV przy podmianie frontendu — potwierdzona
`tools/publikuj-frontend.sh:30-37`: `--exclude '.htaccess'` plus każdy katalog podany trzecim
argumentem, o ile leży POD docrootem. Przy `DOCROOT=…/public_html/panel` i
`SELLY_CSV_DIR=…/public_html/panel/ex-port-files` wykluczenie zadziała. ⚠ Warunek: `SELLY_CSV_DIR`
musi być ustawiony w `.env` **przed** deployem — przy wartości stagingowej `rsync --delete`
skasowałby plik, po który przychodzi Selly.
