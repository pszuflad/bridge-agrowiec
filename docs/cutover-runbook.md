# Runbook przełączenia — nowe środowisko staje się produkcją

**Dla:** osoby wykonującej przełączenie na VPS (Paweł). **Data:** 2026-09-24.
**Model cutoveru:** `docs/cutover.md` rozdział 0 — środowisko testowe **staje się** produkcją.
Nie budujemy nowego release'u na starym serwerze i nie migrujemy bazy w oknie.

**Założenie tego dokumentu:** **stary Bridge został właśnie wyłączony.** Panel jest niedostępny,
stary scheduler importu nie chodzi, stary cron CSV o 6:00 jeszcze może być w `crontab` (krok 9).

> ⚠ **Czego ten dokument nie wie.** Nie mam wglądu w konfigurację Apache/DirectAdmin na VPS.
> Wszystko, co dotyczy tego, **pod jakim katalogiem i portem stanie domena produkcyjna**, jest
> tu postawione jako decyzja z wariantami (krok 1), a nie jako gotowa komenda. Reszta kroków
> wynika z kodu i skryptów w repo i jest sprawdzalna.

**Skróty używane niżej:**
- `STARY` = `~/private_apps/bridge` (stary stos, `data.db`, PM2 `bridge-backend`, port 5000,
  frontend w `~/domains/agritires.eu/public_html/panel`)
- `NOWY` = `~/private_apps/bridge-staging` (nowy stos, `repo/`, `releases/`, `current`,
  `data/data-nowy.db`, PM2 `bridge-backend-staging`, port 5001, frontend w
  `~/domains/agritires.eu/public_html/test`)

---

## Krok 1 — Wariant A: nowy stos przejmuje katalog `public_html/panel`

**Decyzja użytkownika 2026-09-24: wariant A.** Frontend trafia do `public_html/panel`, backend
na port 5000, proxy w `public_html/panel/.htaccess`. Adres feedu CSV w panelu Selly zostaje
bez zmian, zakładki Ani działają.

> **Sprostowanie wobec pierwszej wersji tego dokumentu.** Napisałem wcześniej, że wariant B
> „psuje adres feedu CSV". **To nieprawda.** Plik CSV to zasób STATYCZNY w
> `public_html/panel/ex-port-files/` z własnym `.htaccess`; Apache serwuje go wprost (reguła
> SPA-fallback ma `!-f`), niezależnie od tego, gdzie stoi panel. Wariant B psuje **zakładki
> Ani i adres panelu**, nie feed. Wariant A i tak zostaje wyborem lepszym, ale z innego powodu,
> niż podałem.

### ⚠ Wariant A wymaga MAŁEJ ZMIANY W KODZIE FRONTENDU — to nie jest sama robota na VPS

Nasz frontend jest dziś zbudowany dla **korzenia docroota**, a nie dla podkatalogu `/panel`:

| Co | Dziś | Musi być pod `/panel` | Plik |
|---|---|---|---|
| ścieżki do assetów | `base: "/"` → `/assets/index-….js` | `base: "./"` (względne, jak w produkcji) | `rebuild/frontend/vite.config.ts:10` |
| routing (wouter) | brak `<Router base=…>` → ścieżka `/panel/katalog` nie pasuje do żadnej trasy | `<Router base="/panel">` | `rebuild/frontend/src/App.tsx` |
| adres API | `BAZA_API = ""` → `fetch("/api/…")` trafia w korzeń domeny, nie w `panel/.htaccess` | `BAZA_API = "/panel"` | `rebuild/frontend/src/lib/api.ts:19` |

**To nie jest wymysł — tak działa produkcja.** `mirror/frontend/.htaccess` mówi wprost:
*„Bundle uzywa stalej Vd='/panel' -> kazde wywolanie API ma sciezke /panel/api/…"*, a
`mirror/frontend/index.html` ładuje assety **względnie** (`src="./assets/index-….js"`).
Komentarz w `lib/api.ts:16-17` przewidział dokładnie tę sytuację: *„gdyby aplikacja kiedyś
wróciła pod prefiks, jest to jedno miejsce do zmiany"*.

Bez tych trzech zmian po przełączeniu zobaczysz **białą stronę** (assety 404) — a jeśli
przypadkiem się załadują, to każde wywołanie API poleci w korzeń domeny zamiast w backend.

### ⚠ Decyzja do podjęcia przy tym tickecie: czy `panel.agritires.eu` ma dalej działać

Produkcyjny `.htaccess` obsługuje **dwa hosty naraz**: `agritires.eu/panel/…` i subdomenę
`panel.agritires.eu/…` (na subdomenie wiodący `/panel` jest zdejmowany wewnętrznym rewritem).
Stary panel tego nie odczuwał, bo używał **routingu po hashu** — ścieżka serwera była zawsze
ta sama. Nasz używa ścieżek, więc jedna stała `base` nie obsłuży obu hostów naraz.

- **Jeśli nikt nie używa `panel.agritires.eu`** — wpisujemy `base="/panel"` na sztywno, koniec.
- **Jeśli używa** — `base` trzeba wyliczać w czasie działania z `window.location`, co jest
  większym ticketem i dodatkowym miejscem na błąd.

**Ustal to z Anią, zanim ruszy ticket frontendowy.**

### 1.1 Ticket frontendowy (praca w repo, nie na VPS)

Zakres: trzy zmiany z tabeli wyżej + test, że build produkuje względne ścieżki. Po zmergowaniu
do `develop` dopiero ma sens cokolwiek wdrażać — inaczej wdrożysz build, który pod `/panel`
nie wstanie.

### 1.2 Zwiad na VPS — zanim cokolwiek podmienisz

```bash
# co dziś leży w katalogu, który przejmujemy
ls -la ~/domains/agritires.eu/public_html/panel/
ls -la ~/domains/agritires.eu/public_html/panel/ex-port-files/

# czy port 5000 zwolnił się po wyłączeniu starego stosu
ss -ltnp | grep ':5000' || echo "5000 wolny"

# kopia całego katalogu panelu — tanio, a ratuje przy pomyłce
cp -a ~/domains/agritires.eu/public_html/panel       ~/panel.przed-cutover-$(date +%F-%H%M)
```

**Ma być widać:** stary bundle (`index.html`, `assets/`), trzy skrypty injection
(`selly-injection.js`, `pending-injection.js`, `freq-injection.js`), `.htaccess`
oraz katalog `ex-port-files/` z plikiem CSV i własnym `.htaccess`.

### 1.3 Co przeżywa podmianę, a co znika

`tools/publikuj-frontend.sh` robi `rsync -a --delete` z dwoma wykluczeniami:
`--exclude '.htaccess'` oraz katalog podany trzecim argumentem (u nas `$SELLY_CSV_DIR`).

| Plik/katalog | Po podmianie |
|---|---|
| `panel/.htaccess` | **zostaje** (wykluczony) — ale i tak go podmieniasz świadomie, krok 7 |
| `panel/ex-port-files/` z plikiem CSV i `.htaccess` | **zostaje** (wykluczony jako `$SELLY_CSV_DIR`) |
| stary `index.html` i `assets/` | **znikają** — zastąpione nowym buildem |
| trzy skrypty `*-injection.js` | **znikają** — i tak mają zniknąć, są wchłonięte (I7, I8, 3f-2) |

⚠ **Warunek:** `SELLY_CSV_DIR` w `.env` musi być ustawiony **zanim** puścisz deploy (krok 4),
bo to jego wartość trafia do `publikuj-frontend.sh` jako katalog chroniony. Przy stagingowej
wartości katalog `panel/ex-port-files` nie byłby chroniony i `--delete` **skasowałby plik,
po który przychodzi Selly**.

### 1.4 Co zmienić w skrypcie wdrożenia

To jest ta sama zmiana, którą opisuje krok 5 — tu tylko wartości dla wariantu A:

| `tools/deploy-staging.sh` | Dziś | Wariant A |
|---|---|---|
| `DOCROOT=` (:24) | `…/public_html/test` | `…/public_html/panel` |
| `export PORT=5001 HOST=127.0.0.1` (:28) | staging | `PORT=5000 HOST=0.0.0.0` |
| `cp -f deploy/staging/htaccess …` (:135) | kopiuje plik na 5001, bez `/panel` | **zakomentuj** — `.htaccess` panelu utrzymujemy ręcznie (krok 7) |

### 1.5 Wzorzec `.htaccess` dla katalogu `panel/`

Nie pisz go od zera — **weź produkcyjny**, jest w repo: `mirror/frontend/.htaccess`. Obsługuje
oba hosty, proxuje `^api/(.*)$` na `127.0.0.1:5000`, ma SPA-fallback, wymuszenie HTTPS i brak
cache dla `html/js/css`. Jeśli rezygnujecie z `panel.agritires.eu`, sekcję 1 (dwie reguły
warunkowane `HTTP_HOST`) można pominąć.

```bash
cp ~/private_apps/bridge-staging/repo/mirror/frontend/.htaccess    ~/domains/agritires.eu/public_html/panel/.htaccess
```

⚠ **Nie kopiuj `mirror/frontend/ex-port-files/.htaccess` na oślep** — na VPS ten plik już jest
i jest żywy. Porównaj (`diff`) zamiast nadpisywać; wersja w repo to kopia z lipca.

---

## Krok 2 — Zatrzymaj automaty wdrożeniowe

Nowy stos ma **dwa** niezależne wyzwalacze CD, oba opisane jako używane
(`docs/deploy-setup.md`, „Wyzwalacz CD"):

- **cron-poll w DirectAdmin**, co 5 minut: `tools/deploy-staging.sh`;
- **GitHub Actions po SSH** (klucz z `command="…deploy-staging.sh"` w `~/.ssh/authorized_keys`).

Po przełączeniu każdy merge do `develop` trafiałby **prosto na żywy panel**, z `git reset --hard`
i migracjami na produkcyjnej bazie. W trakcie okna to dodatkowo może podmienić pliki pod ręką.

```bash
crontab -l                      # zapisz sobie bieżącą zawartość
crontab -e                      # zakomentuj linię z deploy-staging.sh
```

W GitHubie: Settings → Secrets/Actions → wyłącz workflow „Deploy staging" (albo tymczasowo usuń
klucz deployowy z `~/.ssh/authorized_keys` na VPS).

> **Do rozstrzygnięcia po oknie, nie w oknie:** czy chcemy automatyczny deploy na produkcję
> i czy stawiamy nowy staging. Na czas przełączenia po prostu wyłączamy automat.

**Sprawdzenie:** `crontab -l | grep -c deploy-staging` → `0` albo linia zakomentowana.

---

## Krok 3 — DECYZJA: na której bazie stoi produkcja

Dziś nowy stos chodzi na `NOWY/data/data-nowy.db` — **kopii produkcji z 23.09**. Stary stos
pracował na `STARY/data.db` do chwili wyłączenia.

- **Jeśli stary Bridge po 23.09 przyjmował realne importy albo decyzje Marty** — te dane są
  **tylko** w `STARY/data.db` i na `data-nowy.db` ich nie ma.
- „Baza zweryfikowana" z `docs/cutover.md` §3 dotyczy zgodności **schematu**, nie świeżości
  **danych**.

**Wariant zalecany: przejmujemy `STARY/data.db`** — to ta sama baza, na której pracowała
produkcja, więc nic nie ginie. Wymaga jednorazowego zastosowania migracji.

```bash
# 3.1 Kopia bezpieczeństwa — robimy ZAWSZE, niezależnie od wariantu.
#     sqlite3 hosta ma 3.26, więc .backup, nie VACUUM INTO.
sqlite3 ~/private_apps/bridge/data.db \
  ".backup '$HOME/data.db.przed-cutover-$(date +%F-%H%M)'"
ls -la ~/data.db.przed-cutover-*

# 3.2 Migracje na produkcyjnej bazie (001–013). Runner jest idempotentny.
cd ~/private_apps/bridge-staging/current
DB_PATH=/home/admin/private_apps/bridge/data.db npm run migrate

# 3.3 Kontrola po migracji — liczba produktów i sensowność kolumn
sqlite3 /home/admin/private_apps/bridge/data.db "SELECT COUNT(*) FROM products;"
sqlite3 /home/admin/private_apps/bridge/data.db \
  "SELECT kod, nazwa, marka, szerokosc, cena_zakupu FROM products LIMIT 5;"
sqlite3 /home/admin/private_apps/bridge/data.db "SELECT COUNT(*) FROM waga_gab_przewoznicy;"
```

**Ma wyjść:** liczba produktów zgodna z tym, co było przed wyłączeniem starego stosu; marka
w `marka`, cena w `cena_zakupu`; `waga_gab_przewoznicy` → **6** (migracja 007).

⚠ **Jeśli migracja padnie — STOP.** Nie improwizuj wariantu migracji w oknie. Scenariusze
awaryjne (`duplicate column name: uwaga_cena`, rozjazd na 003) i co z nimi zrobić:
`docs/cutover.md` §3, krok 5.

⚠ **`DB_PATH` jest zahardkodowany w skrypcie wdrożenia** — `tools/deploy-staging.sh:125` podaje
`DB_PATH="$DATA_DB"` wprost przy `pm2 start`, a `$DATA_DB` to `data-nowy.db`. **Wpis w `.env`
tego NIE nadpisze.** Zmiana bazy wymaga edycji skryptu (krok 5).

---

## Krok 4 — Plik środowiska

Plik: `~/private_apps/bridge-staging/.env`, `chmod 600`. Jest wczytywany przez
`tools/deploy-staging.sh:49` **po** twardych `export`ach stagingowych z linii 42–45, więc
**wygrywa** z nimi.

Docelowa zawartość (wartości sekretów weź z `~/private_apps/bridge/.env` starego stosu):

```bash
# --- fundament (bez tych dwóch proces nie wstanie) ---
JWT_SECRET=<istniejący albo nowy, ≥32 bajty>

# --- import ---
IMPORT_SCHEDULER=true
IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG=true
IMPORT_ARCHIVE_DIR=/home/admin/private_apps/bridge/import_archive

# --- MO9 (jedyny dostawca przez API) ---
AGRORAMI_EMAIL=<ze starego .env>
AGRORAMI_PASSWORD=<ze starego .env>

# --- Selly: FAZA 1 przełączenia, patrz krok 10 ---
SELLY_TRYB=tylko-odczyt
SELLY_SCHEDULER=false
SELLY_SHOP_URL=<ze starego .env>
SELLY_CLIENT_ID=<ze starego .env>
SELLY_CLIENT_SECRET=<ze starego .env>
SELLY_SCOPE=READWRITE

# --- ścieżki pliku CSV = wartości produkcyjne ---
SELLY_CSV_DIR=/home/admin/domains/agritires.eu/public_html/panel/ex-port-files
SELLY_CSV_PLIK=sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv
SELLY_CSV_URL=https://agritires.eu/panel/ex-port-files/sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv
```

**Dlaczego `SELLY_CSV_*` wpisujemy jawnie, skoro to domyślki z kodu:** bo skrypt wdrożenia
nadpisuje je wartościami stagingowymi. Samo usunięcie z `.env` nie wystarczy.

**`CORS_ORIGINS` zostaw PUSTE** — front i `/api` stoją pod jedną domeną. To stan docelowy, nie
przeoczenie (`docs/cutover.md` §4).

⚠ **`JWT_SECRET`:** jeśli wpiszesz inny niż stary, **wszystkie sesje przestają być ważne** —
Ania musi zalogować się od nowa. Hasła zostają (ta sama tabela `users`, ten sam bcrypt).

**Sprawdzenie — bez ujawniania wartości:**

```bash
ENVFILE=~/private_apps/bridge-staging/.env
for K in JWT_SECRET IMPORT_SCHEDULER IMPORT_ARCHIVE_DIR AGRORAMI_EMAIL AGRORAMI_PASSWORD \
         SELLY_TRYB SELLY_SCHEDULER SELLY_SHOP_URL SELLY_CLIENT_ID SELLY_CLIENT_SECRET \
         SELLY_CSV_DIR SELLY_CSV_PLIK SELLY_CSV_URL; do
  printf '%-28s %s\n' "$K" "$(grep -c "^$K=" "$ENVFILE" | sed 's/^0$/BRAK/; s/^[1-9].*/jest/')"
done
```

Wszystkie mają dać `jest`.

---

## Krok 5 — Dostosuj skrypt wdrożenia

Trzy rzeczy w `tools/deploy-staging.sh`, których `.env` **nie** nadpisze, bo są używane pod
innymi nazwami zmiennych albo podawane wprost:

| Linia | Dziś | Ma być (wariant A) |
|---|---|---|
| `DATA_DB=` (:23) | `$STAGING_ROOT/data/data-nowy.db` | `/home/admin/private_apps/bridge/data.db` |
| `DOCROOT=` (:24) | `…/public_html/test` | `…/public_html/panel` |
| `export PORT=5001 HOST=127.0.0.1` (:28) | staging | `PORT=5000 HOST=0.0.0.0` |

(Dwa ostatnie wiersze to powtórzenie kroku 1.4 — trzymaj je zgodne.)

`PM2_NAME` możesz zostawić (`bridge-backend-staging`) albo zmienić na `bridge-backend-nowy` —
**nie na `bridge-backend`**, żeby nie pomylić się ze starym wpisem przy sprzątaniu.

⚠ Linia 134 publikuje frontend przez `tools/publikuj-frontend.sh … "$SELLY_CSV_DIR"` — ten
argument chroni katalog CSV i `.htaccess` przed `--delete`. Po zmianie `SELLY_CSV_DIR`
w `.env` ochrona idzie za nim automatycznie. **Sprawdź to przed pierwszym uruchomieniem**, bo
pomyłka tutaj kasuje plik, po który przychodzi Selly.

⚠ Linia 135 kopiuje `deploy/staging/htaccess` do docroota. Ten plik proxuje na **5001** i jest
napisany **bez prefiksu `/panel`**. Przy wariancie A **musi być zastąpiony** wersją produkcyjną
(port 5000, prefiks `/panel`) — patrz krok 7. Najprościej: zakomentuj tę linię i utrzymuj
`.htaccess` ręcznie, dopóki nie powstanie `deploy/produkcja/htaccess` w repo.

> **Alternatywa czystsza, jeśli masz na nią czas:** skopiuj skrypt na `tools/deploy-produkcja.sh`
> i zmień w kopii. Wtedy oryginał zostaje gotowy do postawienia nowego stagingu.

---

## Krok 6 — Zbuduj i uruchom nowy stos na produkcyjnych ustawieniach

```bash
cd ~/private_apps/bridge-staging/repo
FORCE=1 bash tools/deploy-staging.sh        # albo deploy-produkcja.sh, jeśli zrobiłeś kopię
tail -40 ~/private_apps/bridge-staging/deploy.log
```

**Dlaczego przez skrypt, a nie `pm2 restart`:** pm2 **nie czyta** `.env`. Skrypt źródłuje `.env`,
eksportuje zmienne i robi `pm2 delete` + `pm2 start --update-env`, więc proces dostaje komplet.
`pm2 restart` po edycji `.env` nie zmieni niczego i będziesz szukał błędu tam, gdzie go nie ma.

**Sprawdzenie:**

```bash
pm2 list
pm2 logs <PM2_NAME> --lines 60 --nostream | grep -iE "scheduler|cors|selly|dostepnosc"
```

**Ma być widać:**
- `[scheduler]` uruchomiony (bo `IMPORT_SCHEDULER=true`);
- `[selly-scheduler] wyłączony (SELLY_SCHEDULER nie jest ustawione)` — tak ma być w fazie 1;
- **NIE ma** `[dostepnosc] niezamontowana` — przy `SELLY_TRYB=tylko-odczyt` moduł jest montowany;
- `[cors] wyłączony …`.

---

## Krok 7 — Proxy i frontend pod `/panel`

Wzorzec i polecenie: **krok 1.5** — bierzemy produkcyjny `mirror/frontend/.htaccess`, nie
piszemy nowego. Proxuje `^api/(.*)$` na `127.0.0.1:5000`, ma SPA-fallback i obsługę obu hostów.

⚠ Nie nadpisz go plikiem `deploy/staging/htaccess` — tamten jest na 5001 i bez prefiksu `/panel`.

**Sprawdzenie (jeszcze zanim ktokolwiek się zaloguje):**

```bash
curl -s https://agritires.eu/panel/api/health
# → {"ok":true}

curl -s -o /dev/null -w '%{http_code}\n' https://agritires.eu/panel/api/products
# → 401   (200 znaczyłoby, że ruch idzie do STAREGO backendu)
```

---

## Krok 8 — Katalog pliku CSV i biała lista IP

```bash
ls -la ~/domains/agritires.eu/public_html/panel/ex-port-files/
cat ~/domains/agritires.eu/public_html/panel/ex-port-files/.htaccess
```

**Ma tam być** biała lista IP, potwierdzona przez Anię 23.09 — plik przeżywa podmianę
frontendu (krok 1.3), więc normalnie nie ruszasz go wcale, tylko sprawdzasz:

```
Require ip 212.91.27.191 46.170.251.129
```

(pierwszy adres to Selly, drugi Agrowiec; kopia wzorca: `mirror/frontend/ex-port-files/.htaccess`,
z gałęzią `mod_authz_core` dla Apache 2.4 i fallbackiem `Order Deny,Allow` dla 2.2).
**Bez tego pliku CSV z kolumną `Cena-zakupu` jest publiczny.** Katalog musi być zapisywalny
przez proces backendu.

**Sprawdzenie, że generator działa i pisze we właściwe miejsce** — zaloguj się do panelu,
Selly → „Wygeneruj CSV teraz", potem:

```bash
ls -la ~/domains/agritires.eu/public_html/panel/ex-port-files/sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv
head -1 ~/domains/agritires.eu/public_html/panel/ex-port-files/sellycsv-*.csv | cut -c1-200
```

**Ma być:** świeża data modyfikacji, 60 kolumn w nagłówku. Trasa `generate-csv` nie zależy od
`SELLY_TRYB` ani od klienta Selly (`routes/selly.ts:389`), więc działa już w fazie 1.

---

## Krok 9 — Cron generujący CSV o 6:00

Stary cron odpala `mirror/backend/generate_selly_export.cjs`. **Wyłącz go** i wstaw nowy:

```bash
crontab -e
```

```
# stary — usuń albo zakomentuj:
# 0 6 * * * cd /home/admin/private_apps/bridge && node generate_selly_export.cjs

# nowy:
0 6 * * * cd /home/admin/private_apps/bridge-staging/current && \
  DB_PATH=/home/admin/private_apps/bridge/data.db \
  /home/admin/.nvm/versions/node/v20.20.2/bin/npm run selly:csv \
  >> /home/admin/private_apps/bridge-staging/selly-csv.log 2>&1
```

Uwagi:
- cron **nie dziedziczy** środowiska procesu serwera, dlatego `DB_PATH` podajemy wprost;
- `JWT_SECRET` **nie jest potrzebny** — CLI podstawia wartość zastępczą świadomie
  (`src/selly/csv-cli.ts`), żeby brak sekretu nie zatrzymał generowania pliku;
- cron musi znać pełną ścieżkę do `node`/`npm` z nvm — `PATH` crona jej nie ma;
- polecenie nadpisuje **wyłącznie sam plik CSV** (plik tymczasowy + `rename`) i **nie rusza**
  `.htaccess` w tym katalogu (pokryte testem).

**Sprawdzenie od razu, nie czekając do 6:00:**

```bash
cd ~/private_apps/bridge-staging/current && \
  DB_PATH=/home/admin/private_apps/bridge/data.db npm run selly:csv
```

---

## Krok 10 — Smoke-testy PRZED włączeniem zapisu do Selly

Pełna lista: `docs/cutover.md` §6. Minimum, które musi przejść, zanim ruszysz dalej:

- [ ] logowanie działa, w stopce sidebara widać imię Ani;
- [ ] `/katalog` — produkty są, licznik zgodny ze stanem sprzed wyłączenia starego stosu;
- [ ] `/katalog` → „Konstrukcja opony" pokazuje „Radialna"/„Diagonalna", nie „—"
      (⚠ to **świadoma** różnica wobec starej produkcji, nie usterka);
- [ ] `/historia` pokazuje wpisy sprzed przełączenia — dowód, że to ta sama baza;
- [ ] `/archiwum` pokazuje pliki importu z ostatnich 7 dni — dowód, że `IMPORT_ARCHIVE_DIR`
      wskazuje katalog starego stosu. Pusta lista = zła ścieżka;
- [ ] `/alerty` → filtr typu bez znaków zapytania w polskich nazwach;
- [ ] `/analityka` rysuje wykresy;
- [ ] sidebar jest na każdym z 13 ekranów;
- [ ] `pm2 logs` przez kilka minut — brak powtarzających się błędów;
- [ ] po pierwszym przebiegu schedulera: **MO9** zaimportowany bez alertu błędu
      (to jedyny dostawca przez API — błąd logowania = brak `AGRORAMI_*`).

---

## Krok 11 — FAZA 2: włącz zapis do Selly

Dopiero teraz, gdy powyższe przeszło.

```bash
# w ~/private_apps/bridge-staging/.env zmień dwie linie:
SELLY_TRYB=pelny
SELLY_SCHEDULER=true
```

```bash
cd ~/private_apps/bridge-staging/repo && FORCE=1 bash tools/deploy-staging.sh
pm2 logs <PM2_NAME> --lines 40 --nostream | grep -i selly
```

**Ma zniknąć** `[selly-scheduler] wyłączony`.

**Dlaczego dwie fazy.** `SELLY_TRYB=pelny` sam z siebie **już otwiera zapis do żywego sklepu** —
moduł dostępności (`src/selly/dostepnosc.ts`) po każdym imporcie, który zmienił dostępność,
regeneruje CSV **i woła Tor 1 (`syncDelta`)**, niezależnie od `SELLY_SCHEDULER`. Przy
`tylko-odczyt` ta sama ścieżka przechodzi, ale zapisy są odbijane i **lądują w logu jako błędy —
to oczekiwane w fazie 1, nie awaria.** Dzięki temu w fazie 1 masz działający plik CSV i pewność,
że nic nie poszło do sklepu przed smoke-testami.

**Co robi każdy przełącznik:**

| Zmienna | Co odblokowuje |
|---|---|
| `SELLY_TRYB=pelny` | klient Selly przestaje odmawiać zapisów; moduł dostępności realnie aktualizuje sklep po imporcie |
| `SELLY_SCHEDULER=true` | Tor 1 (co 15 min + HH:55, ceny i stany) i Tor 2 (04:30, pełna synchronizacja) |
| sekrety `SELLY_*` | sześć tras zewnętrznych; bez nich 500 „Brak konfiguracji" |

**Adresu w panelu Selly NIE ruszamy** — przy wariancie A plik leży pod tym samym URL-em.

---

## Krok 12 — Dobij starego stosa na trwałe

```bash
pm2 delete bridge-backend            # stary wpis
pm2 save                             # bez tego restart serwera go wskrzesi
pm2 list                             # ma zostać tylko nowy proces
```

⚠ **To jest krok, którego nie wolno pominąć.** Stary i nowy stos na tej samej `data.db` to dwa
schedulery importu i dwie synchronizacje Selly (decyzja D9). `pm2 save` bez `pm2 delete` zapisze
stan ze starym procesem.

**Zostawiamy na ~2 tygodnie:** katalog starego kodu i kopię bazy z kroku 3.1.

---

## Krok 13 — Pierwsza doba

- [ ] pierwszy pełny cykl importu: `/historia` notuje przebiegi, `/archiwum` przyrasta;
- [ ] **następnego dnia po 6:00** — plik CSV ma świeżą datę
      (`ls -la …/ex-port-files/sellycsv-*.csv`);
- [ ] **po 12:00** — Selly zaciągnął plik (widać po stanach w sklepie);
- [ ] `pm2 logs` — czy Tory 1 i 2 nie sypią błędami;
- [ ] kopia `data.db.przed-cutover-*` zostaje **co najmniej tydzień**;
- [ ] **pierwsza karta po oknie: `PO.0`** — przestrojenie `/feature` i trzech agentów z trybu
      „odbudowa" na „utrzymanie" (`docs/po-cutoverze-proces.md`, wpis `#162.1`, roadmapa §6b
      Blok 2). Dopiero teraz — wcześniej instrukcja musi mówić o wiernym odtwarzaniu.

---

## Czego NIE robić w oknie

- `POST /api/selly/sync-supplier` z `dry_run=false` „na próbę" — realnie zapisuje do sklepu.
- „Usuń wszystko z katalogu".
- Ręcznego importu z URL-i — zostaw to schedulerowi.
- `pm2 restart` po edycji `.env` — nie zadziała (krok 6).

## Co uprzedzić Anię

1. **Musi zalogować się od nowa**, jeśli zmieniłeś `JWT_SECRET`.
2. **Stare zakładki z `#` w adresie** (`/#/katalog`) trafią na stronę główną — odbudowa
   porzuciła routing po hashu (odstępstwo O1 z I1).
3. **Kolumna „Konstrukcja opony" zacznie pokazywać pełne słowa** zamiast „—". To poprawka,
   nie usterka.
4. **Pierwszy zapis dowolnej reguły narzutu przeliczy 2050 z 7405 cen** — zachowanie oryginału
   (znalezisko 14e), nie awaria.
5. ⚠ **Znany, nienaprawiony błąd `#154.1`:** synchronizacja REST gubi flagi zapisane w bazie
   jako tekst `'Tak'` (M+S, 3PMSF, wzmocniona i cztery inne) w **opisach** produktów. W pliku CSV
   jest to naprawione (karta FIX.1), w torach API **nie**. Od pierwszego dnia po kroku 11 opisy
   w sklepie będą bez tych oznaczeń. Naprawa zaplanowana jako pierwsza pozycja prac po cutoverze
   (`docs/rebuild-roadmap.md` §6b, Blok 3).

## Jeśli coś pójdzie źle

Rozdział 7 `docs/cutover.md` (rollback) **nie jest realizowany** — decyzja użytkownika
2026-09-24. Minimum, które i tak masz: kopia bazy z kroku 3.1 i katalog starego kodu. Decyzję
o powrocie podejmij **wcześnie** — im dłużej nowy backend pisze do bazy, tym więcej pracy
przepadnie przy odtworzeniu kopii.

**Trzy awarie, które wyglądają groźnie, a mają prostą przyczynę:**

| Objaw | Przyczyna |
|---|---|
| `/api/products` oddaje `200` bez tokenu | ruch idzie do STAREGO backendu — proxy nie przełączone (krok 7) |
| zmiana w `.env` nie działa | `pm2 restart` zamiast pełnego deployu (krok 6) |
| panel działa, ale „Archiwum importów" puste | `IMPORT_ARCHIVE_DIR` nie wskazuje katalogu starego stosu (krok 4) |
