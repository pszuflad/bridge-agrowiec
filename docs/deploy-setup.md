# Deploy staging — konfiguracja i obsługa (Iteracja 0)

Środowisko **STAGING** nowej wersji Bridge: `https://test.agritires.eu`.
Izolowane od produkcji na tym samym VPS (cyber_Folks, DirectAdmin, user `admin`, bez roota).

## Architektura

```
Internet ──HTTPS 443──► Apache (test.agritires.eu, docroot public_html/test)
                         ├─ /                → pliki frontendu (rebuild/frontend build)
                         └─ /api/*  [.htaccess mod_proxy [P]] ─► 127.0.0.1:5001
                                                                  Node (PM2 bridge-backend-staging)
                                                                  baza: data-nowy.db (osobna!)
```

- **Deploy = pull-based** (`tools/deploy-staging.sh`) uruchamiany z crona DirectAdmin. Bez sekretów w GitHubie.
- **Źródło = gałąź `develop`.** `main` to lustro starej produkcji — NIE wdrażamy z niego (patrz `rebuild-roadmap.md` §1a).
- Prod (dla porównania): PM2 `bridge-backend` na `0.0.0.0:5000`, proxy w `public_html/panel/.htaccess`.

## Fakty hosta (zwiad 2026-08-21)
- Node **v20.20.2**, npm 10.8.2 → build na VPS OK. sqlite3 CLI **3.26** (stary → snapshot przez `.backup`, nie `VACUUM INTO`).
  Dotyczy to WYŁĄCZNIE CLI: `better-sqlite3` 11.7.0 niesie własne SQLite **3.47**, więc kod aplikacji
  (m.in. kopia bazy przed migracjami) `VACUUM INTO` używa bez przeszkód.
- `mod_proxy` działa w `.htaccess` (flaga `[P]`) → **nie trzeba „Custom HTTPD Configurations"**.
- User `admin`, **bez sudo** → wszystko na poziomie usera. Port **5001 wolny**.
- Docroot subdomeny: `/home/admin/domains/agritires.eu/public_html/test`.

## Kontrakt z aplikacją (spełniony — Iteracja 1a backend + 1b frontend)
`deploy-staging.sh` zakłada, że:
- **rebuild/backend**: `npm ci --include=dev` && `npm run build` → `dist/`, wejście `dist/server.js`; serwer nasłuchuje na
  `process.env.HOST:process.env.PORT`, baza z `process.env.DB_PATH`; `npm run migrate` stosuje schemat/migracje (idempotentnie);
  `node scripts/kopia-bazy.cjs` robi kopię bazy przed migracjami (tylko gdy są jakieś do zastosowania).
  Wymaga też **`JWT_SECRET`** — bez niego serwer celowo nie wstaje (brak zahardkodowanego fallbacku, patrz niżej).
  Spełnione od Iteracji 1a (`rebuild/backend/`, szczegóły: `rebuild/backend/README.md`).
  Od Iteracji 3a `npm run build` dokłada krok kopiujący portowane parsery importu (`.cjs` +
  słownik) do `dist/import/legacy/` — bez niego import nie miałby czym parsować plików
  dostawców, bo deploy kopiuje wyłącznie `dist/` (szczegóły: `rebuild/backend/README.md`).
- **rebuild/frontend**: `npm ci --include=dev` && `npm run build` → `dist/` (base `/`, API pod `/api`).
  Spełnione od Iteracji 1b (`rebuild/frontend/`, szczegóły: `rebuild/frontend/README.md`).

`deploy-staging.sh` odpala build tylko, gdy widzi **jednocześnie** `rebuild/backend/package.json`
i `rebuild/frontend/package.json`. **Oba pakiety już istnieją**, więc skrypt nie pomija builda —
pierwszy deploy po Iteracji 1b podmienia placeholder na realny panel.

> **`--include=dev` jest konieczne, nie kosmetyczne.** Skrypt eksportuje `NODE_ENV=production`
> (potrzebne dla runtime backendu), a przy tej zmiennej `npm ci` pomija devDependencies — na naszym
> lockfile frontendu **23 pakiety zamiast 383**, bez `vite` i bez `tsc` w `node_modules/.bin`.
> Przy `set -euo pipefail` build przerwałby się na `tsc: not found` i staging zostałby na placeholderze.
> `npm ci --omit=dev` w katalogu release'u backendu **zostaje bez zmian** — tam faktycznie chcemy
> wyłącznie zależności produkcyjne.

> **Frontend nie buduje sourcemap** (`sourcemap: false`). Skrypt rsynkuje całe `dist/` do publicznego
> docroota bez autoryzacji, więc mapy wystawiłyby źródła panelu w internet.

---

## Jednorazowa konfiguracja na VPS

```bash
# 1. Drzewo staging + klon repo (śledzi develop; użyj klucza SSH producenta — read wystarczy)
mkdir -p ~/private_apps/bridge-staging/{releases,data}
git clone git@github.com:pszuflad/bridge-agrowiec.git ~/private_apps/bridge-staging/repo
cd ~/private_apps/bridge-staging/repo && git checkout develop

# 2. Baza staging = snapshot produkcji (sqlite 3.26 -> .backup; NIE 'VACUUM INTO')
sqlite3 /home/admin/private_apps/bridge/data.db \
  ".backup '/home/admin/private_apps/bridge-staging/data/data-nowy.db'"

# 3. Proxy /api -> :5001 w docroocie subdomeny
cp ~/private_apps/bridge-staging/repo/deploy/staging/htaccess \
   /home/admin/domains/agritires.eu/public_html/test/.htaccess

# 4. Placeholder (dowód, że pipeline działa) — pierwszy deploy po Iteracji 1b nadpisuje go realnym panelem
cp ~/private_apps/bridge-staging/repo/deploy/staging/placeholder-index.html \
   /home/admin/domains/agritires.eu/public_html/test/index.html
cd ~/private_apps/bridge-staging/repo/deploy/staging
PORT=5001 HOST=127.0.0.1 pm2 start health.cjs --name bridge-backend-staging
pm2 save

# 4a. Sekrety środowiska — plik POZA repo, wczytywany przez deploy-staging.sh
#     (bez JWT_SECRET backend z Iteracji 1 nie wstanie; deploy przerwie się z jasnym komunikatem)
umask 077
printf 'JWT_SECRET=%s\n' "$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")" \
  > ~/private_apps/bridge-staging/.env
chmod 600 ~/private_apps/bridge-staging/.env
```

> **Selly.pl i eksport CSV (od Iteracji 8a; zabezpieczenia z ticketa 34):**
>
> **Staging nie wymaga tu ŻADNEJ ręcznej konfiguracji** — `tools/deploy-staging.sh` ustawia
> bezpieczne wartości sam, przy każdym deployu (linie zaraz po `export PORT=…`). Poniższe
> dotyczy sytuacji, w której ktoś chciałby to świadomie zmienić.
>
> - `SELLY_TRYB` — **twarda blokada, domyślnie `wylaczony`**: klient odmawia każdej operacji,
>   także z poprawnymi sekretami. `tylko-odczyt` przepuszcza odczyty i dry-run, blokując zapisy;
>   `pelny` to zachowanie 1:1 z produkcją. **Produkcja musi ustawić `pelny` jawnie.**
> - `SELLY_SHOP_URL`, `SELLY_CLIENT_ID`, `SELLY_CLIENT_SECRET`, `SELLY_SCOPE` (domyślnie
>   `READWRITE`) — bez nich sześć tras zewnętrznych oddaje 500 „Brak konfiguracji" (zachowanie
>   zamierzone, 1:1 z produkcją). Cztery trasy lokalne (`status`, `log`, `csv-status`,
>   `generate-csv`) działają bez nich normalnie.
> - ⚠ **`SELLY_CSV_DIR`, `SELLY_CSV_PLIK`, `SELLY_CSV_URL` mają domyślne wartości wskazujące
>   katalog PRODUKCYJNY** (`public_html/panel/ex-port-files`) — bo tam jest ich miejsce na
>   produkcji. Staging stoi na TYM SAMYM VPS, więc bez nadpisania przycisk „Wygeneruj CSV teraz"
>   podmieniłby produkcyjny plik treścią z bazy stagingowej, a Selly zaciągnąłby go o 6:00.
>   **Każde środowisko inne niż produkcja musi je nadpisać** — dla stagingu robi to skrypt
>   deployu. Znalezione i domknięte w tickecie `34-FEATURE-selly-blokada-srodowiska`.
>
> Wzór: `rebuild/backend/.env.example`.

```bash
# 5. Smoke test
curl -s https://test.agritires.eu/api/health      # -> {"ok":true,"stage":"staging-placeholder",...}
#   i otwórz https://test.agritires.eu — kafelek powinien pokazać "backend OK"
```

## Wyzwalacz CD — dwie opcje

### Opcja A (UŻYWANA): GitHub Actions po SSH — event-driven
Workflow `.github/workflows/deploy-staging.yml` uruchamia deploy **natychmiast po merge do develop**
(tylko przy zmianach `rebuild/**`, `deploy/staging/**`, `tools/deploy-staging.sh`) oraz ręcznie
(zakładka Actions → „Deploy staging" → Run workflow). Łączy się po SSH z VPS i odpala `deploy-staging.sh`.

**1. Wygeneruj dedykowany klucz SSH (na swojej maszynie):**
```bash
ssh-keygen -t ed25519 -C "gh-actions-staging-deploy" -f ~/gh_staging_deploy -N ""
```

**2. Dodaj klucz PUBLICZNY na VPS z wymuszoną komendą (klucz może TYLKO deployować):**
```bash
# na VPS, w ~/.ssh/authorized_keys — jedna linia:
mkdir -p ~/.ssh && chmod 700 ~/.ssh
printf 'command="bash /home/admin/private_apps/bridge-staging/repo/tools/deploy-staging.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty %s\n' \
  "$(cat ~/gh_staging_deploy.pub)" >> ~/.ssh/authorized_keys   # wklej treść .pub jeśli generujesz gdzie indziej
chmod 600 ~/.ssh/authorized_keys
```
> Wymuszona komenda (`command="…"`) sprawia, że nawet gdyby klucz wyciekł, da się nim uruchomić WYŁĄCZNIE deploy — nie zwykłą powłokę.

**3. Pobierz klucz serwera do weryfikacji (na dowolnej zaufanej maszynie):**
```bash
ssh-keyscan -p <PORT_SSH> vpshd1242.cyber-folks.pl 2>/dev/null
```

**4. Dodaj sekrety repo** (GitHub → Settings → Secrets and variables → Actions → New repository secret):
| Sekret | Wartość |
|---|---|
| `STAGING_SSH_HOST` | `vpshd1242.cyber-folks.pl` (lub IP) |
| `STAGING_SSH_PORT` | port SSH (np. `22`) |
| `STAGING_SSH_USER` | `admin` |
| `STAGING_SSH_KEY` | treść klucza PRYWATNEGO `~/gh_staging_deploy` (cała, z nagłówkami) |
| `STAGING_SSH_KNOWN_HOSTS` | wynik `ssh-keyscan` z kroku 3 |

**5. Test:** Actions → „Deploy staging" → **Run workflow** (albo zmerguj cokolwiek w `rebuild/`). Sprawdź log runu i `~/private_apps/bridge-staging/deploy.log`.

Uwagi: SSH VPS-a musi być osiągalne z internetu (runnery GitHuba mają publiczne IP) i nie może być zablokowane po IP. Branch protection już gwarantuje, że na `develop` trafia tylko kod z zielonym CI, więc deploy dostaje sprawdzony stan.

### Opcja B (UŻYWANA): cron-poll w DirectAdmin
Panel DirectAdmin → **Cron Jobs** (poll co 5 min; skrypt sam wykrywa brak zmian i kończy bez pracy):
```
*/5 * * * * /bin/bash /home/admin/private_apps/bridge-staging/repo/tools/deploy-staging.sh >> /home/admin/private_apps/bridge-staging/deploy.log 2>&1
```
**Nie używaj obu naraz na stałe.** Jeśli włączasz Opcję A, usuń tego crona (albo zostaw z rzadkim interwałem, np. co 30 min, jako awaryjny fallback — przy nakładce po prostu zrobi no-op).

## Rollback

### Kod (release)
```bash
ls -1dt ~/private_apps/bridge-staging/releases/*/     # lista release (najnowsze u góry)
ln -sfn ~/private_apps/bridge-staging/releases/<stary-sha> ~/private_apps/bridge-staging/current
pm2 reload bridge-backend-staging
```

### Baza (po migracji, która zrobiła coś nie tak)

Deploy robi kopię bazy **przed** zastosowaniem migracji — `tools/deploy-staging.sh` woła
`rebuild/backend/scripts/kopia-bazy.cjs`. Kopie leżą w
`~/private_apps/bridge-staging/data/backups/`, trzymane są **ostatnie 5**.

```bash
ls -1t ~/private_apps/bridge-staging/data/backups/    # najnowsza u góry
pm2 stop bridge-backend-staging                       # NAJPIERW zatrzymaj serwer
cd ~/private_apps/bridge-staging/data
cp backups/data-nowy.db.bak_pre-migracje_<znacznik>_<sha> data-nowy.db
rm -f data-nowy.db-wal data-nowy.db-shm               # resztki WAL po starej bazie
pm2 start bridge-backend-staging
```

⚠ **Kopia powstaje TYLKO wtedy, gdy deploy ma jakieś migracje do zastosowania.** Deploy chodzi
przy każdej zmianie w `rebuild/`, więc kopiowanie za każdym razem zasypałoby dysk — ten projekt
już raz się na to nadział na produkcji (292 pliki backup, ~6 GB; `mirror/backend/CHANGELOG.md`).
Jeśli w logu deployu widzisz „kopia niepotrzebna", to znaczy, że schemat się nie zmienił
i nie ma czego cofać.

⚠ **Kopia idzie przez `VACUUM INTO` z poziomu `node` + `better-sqlite3` (SQLite 3.47),
a NIE przez `sqlite3` CLI hosta** — ten ma 3.26 i `VACUUM INTO` (SQLite ≥ 3.27) w ogóle nie zna.
Zwykłe `cp` też odpada: baza chodzi w WAL, więc kopia samego pliku `.db` bywa niespójna.
Jeśli robisz kopię ręcznie CLI-em, użyj `.backup` — tak jak w sekcji odświeżania danych niżej.

## ⚠ Schemat bazy staging NIE pochodzi z naszego kanonu

Baza staging powstaje przez `.backup` z **produkcji**, a nie z `rebuild/schema/001_schema.sql`.
`001_schema.sql` jest idempotentny (`CREATE TABLE IF NOT EXISTS`), więc na przywróconej bazie
**nie tworzy niczego** — zostaje schemat produkcji. `npm run migrate` odnotowuje go jako
zastosowany i od tej pory obie strony wyglądają na zgodne, choć wcale być takie nie muszą.

**Skutek: kanon i staging mogą się po cichu różnić, a bramki tego nie pokażą.** Testy budują
własną bazę z kanonu, więc mierzą kanon — nie to, co realnie leży na staging.

Zdarzyło się to naprawdę: `products.szerokosc` był `TEXT` na produkcji i na staging (migracja
`szertxt` Ani z 2026-08-19), a `REAL` w naszym kanonie — przez wiele iteracji nikt tego nie
widział. Domknęła to migracja `003_szerokosc_text.sql` (I3/3d-1). Weryfikacja po wdrożeniu
pokazała, że na staging kolumna była TEXT-em JUŻ WCZEŚNIEJ, więc migracja była dla danych
praktycznie no-opem — i dlatego wartości z zerami końcowymi (`8.00`) przetrwały nietknięte.

**Praktyczny wniosek przy pisaniu każdej kolejnej migracji:**
- nie zakładaj, że tabela na staging ma dokładnie kształt z `001_schema.sql`;
- migracje przebudowujące tabelę (`INSERT INTO nowa SELECT * FROM stara`) są wrażliwe na
  liczbę i KOLEJNOŚĆ kolumn — przy rozjeździe albo padną, albo (gdy liczba się zgadza,
  a kolejność nie) po cichu przestawią dane;
- przed wdrożeniem migracji ruszającej strukturę warto porównać kształt:
  ```bash
  sqlite3 ~/private_apps/bridge-staging/data/data-nowy.db "PRAGMA table_info(products);"
  ```
  z tym, co daje świeża baza z kanonu (`npm run migrate` na pustym pliku).

## Odświeżenie danych staging ze snapshotu produkcji (na żądanie)
```bash
sqlite3 /home/admin/private_apps/bridge/data.db \
  ".backup '/home/admin/private_apps/bridge-staging/data/data-nowy.db'"
cd ~/private_apps/bridge-staging/repo/rebuild/backend \
  && DB_PATH=/home/admin/private_apps/bridge-staging/data/data-nowy.db npm run migrate
pm2 reload bridge-backend-staging
```

## CI (GitHub Actions)
`.github/workflows/ci.yml` — na PR/push do `develop`: install + lint + typecheck + **test (GATE fixtures/kontrakt)** + build.

### Branch protection na `develop` (krok po kroku)
Cel: żaden PR ticketa nie wejdzie do `develop` bez zielonego CI — a właściciel repo nadal może pushować docsy bezpośrednio.

1. GitHub → repo `pszuflad/bridge-agrowiec` → **Settings** (widoczne tylko dla właściciela).
2. Lewe menu: **Code and automation → Branches**.
3. **Add branch protection rule** (albo „Add rule").
4. **Branch name pattern:** `develop`.
5. Zaznacz **Require a pull request before merging** (Required approvals możesz zostawić **0** — praca solo).
6. Zaznacz **Require status checks to pass before merging**:
   - w polu wyszukiwania checków dodaj **`backend`** i **`frontend`** (pojawią się, bo CI już się uruchomiło),
   - zaznacz też **Require branches to be up to date before merging**.
7. **NIE** zaznaczaj **„Do not allow bypassing the above settings"** ani **„Include administrators"** — dzięki temu Ty (właściciel) możesz dalej pushować docsy prosto na `develop`, a reguła i tak wymusza GATE na normalnym flow ticketów. (Chcesz twardej ochrony także dla siebie? Zaznacz „Include administrators" — ale wtedy KAŻDA zmiana na `develop`, też docsy, musi iść przez PR.)
8. **Create** / **Save changes**.

**Weryfikacja:** przy następnym PR do `develop` przy checkach `backend`/`frontend` pojawi się „Required", a przycisk merge jest zablokowany aż zzielenieją.

> Jeśli checki `backend`/`frontend` nie są na liście — CI jeszcze się nie uruchomiło na tym repo. Zrób dowolny mały push/PR do `develop`, poczekaj aż workflow przejdzie (zakładka **Actions**), i wróć do ustawień.
>
> Alternatywa (nowszy mechanizm): **Settings → Rules → Rulesets → New branch ruleset**, target `develop`, reguły „Require a pull request" + „Require status checks" (backend, frontend). Efekt ten sam.

## Znane pułapki środowiska (VPS)
- **Nowe zależności parserów importu (Iteracja 3a) nie wymagają obejścia.** `csv-parse`,
  `iconv-lite`, `xlsx` są czysto JS-owe (bez kompilacji natywnej) — `npm ci --omit=dev` w
  release'ie instaluje je bez dodatkowych kroków, inaczej niż `better-sqlite3` niżej.
- **`archiver` (Iteracja 8a, ZIP eksportu Shopera) też nie wymaga obejścia** — czysto JS-owy,
  bez kompilacji natywnej, ten sam tryb instalacji co wyżej.
- **better-sqlite3 vs glibc 2.28.** VPS ma glibc 2.28; prebuilt better-sqlite3 (11.7+/11.10) wymaga
  `GLIBC_2.29` i nie ładuje się, a node-gyp 10 nie zbuduje ze źródła na dostępnym Pythonie 3.6.
  **Obejście (w `deploy-staging.sh`):** `npm ci --ignore-scripts` + podłożenie działającej binarki
  `better_sqlite3.node` **z produkcji** (`/home/admin/private_apps/bridge/node_modules/better-sqlite3/...`,
  wersja **11.7.0**, ABI node 20 = 115). Dlatego `rebuild/backend` jest **przypięty do better-sqlite3 11.7.0**
  (musi zgadzać się z wersją produkcji). Gdyby produkcja zmieniła/usunęła tę binarkę — deploy przerwie się
  z jasnym komunikatem; wtedy zaktualizuj pin i źródło binarki.
- **Pierwszy/ręczny deploy:** użyj `FORCE=1 bash tools/deploy-staging.sh` (skrypt normalnie wdraża tylko przy nowym commicie).

## Otwarte punkty (do rozwiązania przy I2)
- **Schemat snapshotu vs kanon:** snapshot produkcji niesie schemat prod (może różnić się od `rebuild/schema/001_schema.sql`,
  np. `szerokosc` — backlog #3). Przy pierwszym tickecie czytającym realne dane trzeba uzgodnić migrację snapshotu do kanonu.
- **Kolejność reguł w `deploy/staging/htaccess`:** wymuszenie HTTPS (reguła 3) stoi PO SPA fallbacku
  (reguła 2) kończącym się `[L]` — przekierowanie łapie dopiero drugi przebieg. Działa, ale jest kruche;
  HTTPS powinno iść zaraz za wyjątkiem na `.well-known`. Zmiana dotyka żywego stagingu — do zaplanowania.
- **Prod Node słucha na `0.0.0.0:5000`** (potencjalnie dostępny z sieci) — osobna, produkcyjna kwestia bezpieczeństwa; staging celowo słucha tylko na `127.0.0.1`.
