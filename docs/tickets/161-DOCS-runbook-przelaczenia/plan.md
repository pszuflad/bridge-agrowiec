# 161-DOCS-runbook-przelaczenia — instrukcja krok po kroku dla wykonawcy przełączenia

**Typ:** DOCS. **Zero zmian w `rebuild/` i `contract/`.**
**Zlecenie użytkownika (2026-09-24):** „Napisz instrukcję krok po kroku, co mam zrobić, żeby
środowisko nowe było produkcyjnie działające, przy założeniu, że stare produkcyjne właśnie
zostało wyłączone."

## Dlaczego nowy plik, a nie rozdział w `cutover.md`

`docs/cutover.md` po zmianie modelu (rozdział 0, PR #176) jest **źródłem faktów** — schemat bazy,
tabele zmiennych, smoke-testy, uzasadnienia — ale jego rozdziały 5 i 7 są jawnie oznaczone jako
nieaktualne, a to, co trzeba zrobić, jest rozsiane po §0, §2, §3a, §4, §6 i §8. Wykonawca w oknie
potrzebuje **jednej kolejności**, nie sześciu miejsc. Do tego `cutover.md` jest edytowany
równolegle przez sesje Ani — nowy plik nie konkuruje o te same linie.

Wskaźnik z `cutover.md` → runbook: jedno zdanie na końcu rozdziału 0 (jedyna edycja cudzego pliku).

## Ustalenia z kodu, na których stoi runbook (wszystkie zweryfikowane w tym tickecie)

1. **`.env` wygrywa z twardymi ustawieniami stagingowymi** — `deploy-staging.sh:42-45` eksportuje
   `SELLY_TRYB=wylaczony` i stagingowe `SELLY_CSV_*`, ale `:49` źródłuje `$STAGING_ROOT/.env`
   przez `set -a` **później**. Komentarz `:33` potwierdza, że to celowe.
2. **`DB_PATH` jest wyjątkiem — `.env` go NIE nadpisze.** `:125` podaje `DB_PATH="$DATA_DB"`
   wprost przy `pm2 start`, a `$DATA_DB` (`:23`) to `data-nowy.db`. Zmiana bazy = edycja skryptu.
3. **`pm2 restart` nie przeczyta `.env`** — pm2 nie czyta plików env; skrypt robi `pm2 delete` +
   `pm2 start --update-env` ze środowiska powłoki, która `.env` już źródłowała (`:124-126`).
4. **`SELLY_TRYB=pelny` sam z siebie otwiera zapis do żywego sklepu**, niezależnie od
   `SELLY_SCHEDULER`: `server.ts:90` montuje moduł dostępności dla każdego trybu poza `wylaczony`,
   a `selly/dostepnosc.ts` po imporcie regeneruje CSV **i woła `syncDelta`** (Tor 1).
   Stąd dwufazowe włączanie w kroku 11.
5. **`generate-csv` i `csv-status` nie zależą od `SELLY_TRYB` ani od klienta** (`routes/selly.ts:372,389`)
   — plik da się wytworzyć i sprawdzić już w fazie 1.
6. **`deploy/staging/htaccess` proxuje na 5001 i jest „bez prefiksu /panel"** (nagłówek pliku),
   a `deploy-staging.sh:135` kopiuje go do docroota — przy wariancie A trzeba tę linię ubić.
7. **Dwa wyzwalacze CD, oba opisane jako używane** (`docs/deploy-setup.md`, „Wyzwalacz CD"):
   cron-poll co 5 min i GitHub Actions po SSH. Po przełączeniu oba celowałyby w żywy panel.

## Decisions

- **D1. Krok 1 to decyzja bramowa z wariantami, nie gotowa komenda.** Nie mam wglądu w Apache/
  DirectAdmin na VPS, a od tego, czy nowy panel stanie pod `public_html/panel` czy `public_html/test`,
  zależy, czy adres feedu CSV w panelu Selly zostaje bez zmian. Zgadywanie tutaj kosztowałoby
  albo 404 dla Selly, albo niepotrzebne wciąganie integratora w okno. Rekomendacja: wariant A.
- **D2. Zalecam przejęcie produkcyjnej `data.db`, nie pozostanie na `data-nowy.db`.** Kopia
  stagingu jest z 23.09; wszystko, co stary Bridge przyjął później, jest tylko w `data.db`.
  Runbook prowadzi przez kopię bezpieczeństwa + migracje na produkcyjnej bazie.
- **D3. Dwufazowe włączanie Selly** (`tylko-odczyt` → smoke-testy → `pelny` + scheduler).
  Wynika wprost z ustalenia 4 wyżej: inaczej pierwszy import po starcie może zapisać do żywego
  sklepu, zanim ktokolwiek sprawdzi, czy panel w ogóle działa. W fazie 1 odbite zapisy lądują
  w logu jako błędy — runbook mówi wprost, że to oczekiwane.
- **D4. Rollback opisany jako „nie realizujemy, ale masz kopię"** — decyzja użytkownika z 24.09
  zdjęła rozdział 7, a przy wyłączonym starym stosie kopia bazy z kroku 3.1 jest jedynym
  zabezpieczeniem, jakie zostaje. Pominięcie jej byłoby nieuczciwe wobec wykonawcy.
- **D5. `cutover.md` ruszony jednym zdaniem.** Plik jest edytowany równolegle; dopisek na końcu
  rozdziału 0 to najmniejsza możliwa ingerencja, a bez niego runbook jest nie do znalezienia.

## Tests
Nie dotyczy — wyłącznie `docs/`.
