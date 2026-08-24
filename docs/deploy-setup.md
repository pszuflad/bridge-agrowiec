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
- `mod_proxy` działa w `.htaccess` (flaga `[P]`) → **nie trzeba „Custom HTTPD Configurations"**.
- User `admin`, **bez sudo** → wszystko na poziomie usera. Port **5001 wolny**.
- Docroot subdomeny: `/home/admin/domains/agritires.eu/public_html/test`.

## Kontrakt z aplikacją (musi spełnić Iteracja 1)
`deploy-staging.sh` zakłada, że:
- **rebuild/backend**: `npm ci` && `npm run build` → `dist/`, wejście `dist/server.js`; serwer nasłuchuje na
  `process.env.HOST:process.env.PORT`, baza z `process.env.DB_PATH`; `npm run migrate` stosuje schemat/migracje (idempotentnie).
  Wymaga też **`JWT_SECRET`** — bez niego serwer celowo nie wstaje (brak zahardkodowanego fallbacku, patrz niżej).
- **rebuild/frontend**: `npm ci` && `npm run build` → `dist/` (base `/`, API pod `/api`).

Dopóki tego nie ma, `deploy-staging.sh` pomija build (placeholder działa dalej).

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

# 4. Placeholder (dowód, że pipeline działa) — do czasu Iteracji 1
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

# 5. Smoke test
curl -s https://test.agritires.eu/api/health      # -> {"ok":true,"stage":"staging-placeholder",...}
#   i otwórz https://test.agritires.eu — kafelek powinien pokazać "backend OK"
```

## Cron w DirectAdmin (wyzwalacz CD)
Panel DirectAdmin → **Cron Jobs** → dodaj (poll co 5 min):
```
*/5 * * * * /bin/bash /home/admin/private_apps/bridge-staging/repo/tools/deploy-staging.sh >> /home/admin/private_apps/bridge-staging/deploy.log 2>&1
```
Skrypt sam wykrywa brak zmian (`git rev-parse`) i kończy bez pracy — bezpiecznie odpalać często.

## Rollback
```bash
ls -1dt ~/private_apps/bridge-staging/releases/*/     # lista release (najnowsze u góry)
ln -sfn ~/private_apps/bridge-staging/releases/<stary-sha> ~/private_apps/bridge-staging/current
pm2 reload bridge-backend-staging
```

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

## Otwarte punkty (do rozwiązania przy I2)
- **Schemat snapshotu vs kanon:** snapshot produkcji niesie schemat prod (może różnić się od `rebuild/schema/001_schema.sql`,
  np. `szerokosc` — backlog #3). Przy pierwszym tickecie czytającym realne dane trzeba uzgodnić migrację snapshotu do kanonu.
- **Prod Node słucha na `0.0.0.0:5000`** (potencjalnie dostępny z sieci) — osobna, produkcyjna kwestia bezpieczeństwa; staging celowo słucha tylko na `127.0.0.1`.
