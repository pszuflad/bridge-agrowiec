# Wdrożenie produkcji — dwa środowiska obok siebie

**Model (decyzja użytkownika 2026-09-24/25):** środowisko testowe **zostaje nietknięte**.
Obok niego stawiamy **drugą, niezależną instancję produkcyjną**, budowaną z gałęzi `main`
i wdrażaną automatycznie po każdym merge'u do `main`.

| | Test | Produkcja |
|---|---|---|
| gałąź | `develop` | **`main`** |
| domena | `test.agritires.eu` | **`panel.agritires.eu`** |
| katalog frontendu | `public_html/test` | `public_html/panel` |
| port backendu | 5001 (`127.0.0.1`) | 5000 (`0.0.0.0`) |
| proces PM2 | `bridge-backend-staging` | `bridge-backend-prod` |
| drzewo backendu | `~/private_apps/bridge-staging/` | `~/private_apps/bridge-prod/` |
| baza | `data-test.db` | `data-prod.db` |
| Selly | twardo wyłączone w skrypcie | z `.env` (ma pisać do sklepu) |
| skrypt deployu | `tools/deploy-staging.sh` | `tools/deploy-produkcja.sh` |
| workflow | `.github/workflows/deploy-staging.yml` | `.github/workflows/deploy-produkcja.yml` |

Poza konfiguracją z tej tabeli oba skrypty są **identyczne**. Zmieniasz jeden — sprawdź drugi.

---

## Praca dzieli się na trzy grupy

| Grupa | Co | Kto / czym |
|---|---|---|
| **A. Repo** | skrypt deployu produkcji, workflow, `.htaccess` produkcji, zmiana nazwy bazy testu | ten ticket (PR do `develop`) |
| **B. Serwer** | kopie, drzewo produkcji, klon `main`, bazy, `.env`, klucz SSH | `tools/przygotuj-produkcje.sh` |
| **C. GitHub i DirectAdmin** | sekrety, `authorized_keys`, subdomena, ochrona `main` | ręcznie — rozdział „Grupa C" |

---

## Grupa A — co wchodzi tym ticketem

- **`tools/deploy-produkcja.sh`** — odbicie skryptu testowego. Trzy bramki, których staging
  nie ma, bo na produkcji ich brak kosztuje realne pieniądze:
  1. **baza musi już istnieć** — staging może sobie wytworzyć pustą i zmigrować; na produkcji
     pusty plik oznacza katalog bez produktów, a generator oddałby Selly pusty plik i sklep
     wyzerowałby stany;
  2. **docroot musi istnieć** — inaczej `publikuj-frontend.sh` utworzyłby go pustym i panel
     zniknąłby razem z katalogiem `ex-port-files`;
  3. **proces PM2 `bridge-backend` (stary stos) nie może istnieć** — dwa backendy na jednej
     bazie to dwa schedulery importu i dwie synchronizacje Selly (decyzja D9).
- **`.github/workflows/deploy-produkcja.yml`** — wyzwalacz na `push` do `main`.
- **`deploy/produkcja/htaccess`** — proxy na 5000, przekierowanie 301 z `agritires.eu/panel/`
  na subdomenę i **wyjątek na `ex-port-files/`** (patrz niżej).
- **`tools/deploy-staging.sh`** — `DATA_DB` zmienione na `data-test.db`.

### ⚠ Dlaczego `ex-port-files/` ma własną regułę w `.htaccess`

Katalog `public_html/panel` jest widoczny pod **dwoma** adresami: jako korzeń
`panel.agritires.eu` (tam mieszka panel) i jako podkatalog `agritires.eu/panel/`. Nowy frontend
ma absolutne ścieżki do assetów (`vite base: "/"`), więc pod drugim adresem by się nie
załadował — dlatego przekierowujemy go 301 na subdomenę.

**Ale Selly pobiera plik spod `https://agritires.eu/panel/ex-port-files/sellycsv-….csv`** i ten
adres ma zostać nietknięty. Przekierowanie zerwałoby pobranie. Stąd reguła 1 w
`deploy/produkcja/htaccess`: `RewriteRule ^ex-port-files/ - [L]` — serwuj wprost, przed
jakimkolwiek przekierowaniem. Katalog zachowuje własny `.htaccess` z białą listą IP.

---

## Grupa B — serwer, jednym skryptem

```bash
cd ~/private_apps/bridge-staging/repo && git pull
bash tools/przygotuj-produkcje.sh --sucho     # najpierw zobacz, co zrobi
bash tools/przygotuj-produkcje.sh             # potem wykonaj
```

Skrypt jest **idempotentny i niczego nie kasuje**. Robi: kopie bezpieczeństwa (katalog panelu
+ produkcyjna baza), drzewo `bridge-prod/`, klon repo na `main`, `data-prod.db` jako spójną
migawkę (`.backup`, nie `cp` — baza chodzi w WAL), `data-test.db` dla testu, szkielet `.env`
z sekretami przepisanymi ze starego stosu i parę kluczy SSH dla deployu produkcji.

**Czego świadomie nie robi** — bo to decyzje, nie czynności: nie zatrzymuje starego stosu, nie
publikuje frontendu, nie podmienia `.htaccess` w katalogu panelu, nie uruchamia migracji
(robi je `deploy-produkcja.sh`, po kopii bazy), nie zakłada subdomeny.

⚠ **`data-prod.db` to MIGAWKA.** Jeśli stary stos jeszcze pracuje, kopia starzeje się od chwili
wykonania. Uruchom skrypt **ponownie tuż przed przełączeniem** — powie, jak odświeżyć bazę.

⚠ **Zmiana nazwy bazy testu jest dwuetapowa.** Skrypt tworzy `data-test.db` jako **kopię**;
`data-nowy.db` zostaje jako siatka bezpieczeństwa. Nazwa w `tools/deploy-staging.sh` zmienia się
tym PR-em. Kolejność: **najpierw uruchom skrypt (plik powstaje), potem zmerguj PR** — odwrotnie
pierwszy deploy testu utworzyłby pustą `data-test.db` i zmigrował ją, a Ania zobaczyłaby pusty
katalog. Starą `data-nowy.db` skasujesz ręcznie, gdy test chwilę popracuje na nowej.

---

## Grupa C — GitHub i DirectAdmin, ręcznie

### C1. Klucz SSH produkcji → `authorized_keys`

⚠ **Osobny klucz jest konieczny, nie kosmetyczny.** Klucz stagingu ma w `~/.ssh/authorized_keys`
wymuszone `command="…deploy-staging.sh"`, a **wymuszone polecenie ignoruje to, o co prosi
klient** — tym samym kluczem nie da się uruchomić skryptu produkcji.

```bash
printf 'command="bash /home/admin/private_apps/bridge-prod/repo/tools/deploy-produkcja.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty %s\n' \
  "$(cat ~/.ssh/deploy_prod_ed25519.pub)" >> ~/.ssh/authorized_keys
```

### C2. Sekrety repo — Settings → Secrets and variables → Actions

| Sekret | Wartość |
|---|---|
| `PROD_SSH_KEY` | zawartość `~/.ssh/deploy_prod_ed25519` (klucz **prywatny**) |
| `PROD_SSH_KNOWN_HOSTS` | wynik `ssh-keyscan -p <port> <host>` |
| `PROD_SSH_HOST`, `PROD_SSH_PORT`, `PROD_SSH_USER` | te same wartości co przy stagingu |

### C3. Environment „produkcja" — Settings → Environments

Załóż środowisko o nazwie **`produkcja`** (workflow już się do niego odwołuje). Warto włączyć
**Required reviewers** — wtedy merge do `main` nie wdroży się sam, tylko poczeka na kliknięcie.
Bez tego każdy merge do `main` idzie od razu na żywy panel.

### C4. Ochrona gałęzi `main`

`main` przestaje być lustrem starej produkcji, a staje się **gałęzią wdrożeniową**. Ustaw ruleset
jak na `develop`: bez pushu bezpośredniego, zmiany wyłącznie przez PR, wymagane zielone CI.

### C5. Subdomena w DirectAdmin

`panel.agritires.eu` → DocumentRoot `/home/admin/domains/agritires.eu/public_html/panel`,
plus certyfikat Let's Encrypt.

---

## Kolejność całości

1. **Grupa A** — PR do `develop`, zmerguj. *(Test dalej chodzi; zmiana nazwy bazy czeka na krok 2.)*
2. **Grupa B** — `tools/przygotuj-produkcje.sh` na VPS.
3. **Grupa C** — klucz, sekrety, environment, ruleset, subdomena.
4. **`develop` → `main`** pierwszym PR-em. To jest moment, w którym `main` przestaje być lustrem
   starej produkcji.
5. **Stary stos w dół:** `pm2 delete bridge-backend && pm2 save`. Stary cron CSV o 6:00 wyłączyć.
6. **Odśwież `data-prod.db`** (skrypt powie jak) — żeby produkcja startowała ze stanu z tej chwili,
   nie sprzed kilku dni.
7. **Pierwszy deploy:** `FORCE=1 bash ~/private_apps/bridge-prod/repo/tools/deploy-produkcja.sh`.
8. **Smoke-testy** — `docs/cutover.md` §6, na `panel.agritires.eu`.
9. **Faza 2 Selly:** w `.env` produkcji `SELLY_TRYB=pelny`, `SELLY_SCHEDULER=true`, ponowny deploy.
   Uzasadnienie dwufazowości: `docs/cutover-runbook.md` krok 11.
10. **Cron CSV 6:00** na nowy stos:
    ```
    0 6 * * * cd /home/admin/private_apps/bridge-prod/current && \
      DB_PATH=/home/admin/private_apps/bridge-prod/data/data-prod.db \
      /home/admin/.nvm/versions/node/v20.20.2/bin/npm run selly:csv \
      >> /home/admin/private_apps/bridge-prod/selly-csv.log 2>&1
    ```

---

## Co się zmienia w codziennej pracy

`develop` → auto-deploy na test → Ania klika na `test.agritires.eu` → **PR `develop` → `main`**
→ (opcjonalne zatwierdzenie w Environments) → auto-deploy na `panel.agritires.eu`.

Merge do `main` staje się **momentem wdrożenia na produkcję**. Zapis w
`docs/rebuild-roadmap.md` §1a („PRODUKCJA (nowa) = `main` po cutoverze", lustro produkcji)
trzeba będzie po przełączeniu odświeżyć — to zadanie koordynatora, nie tego ticketu.

## Czego ten dokument nie rozstrzyga

- **Czy zostaje cron-poll co 5 minut** dla testu (`docs/deploy-setup.md`, opcja B), czy wystarczy
  workflow. Dla produkcji cron-polla **nie zakładamy** — wdrożenie ma być świadomą decyzją.
- **Czy `agritires.eu/panel/` ma przekierowywać 301** — reguła jest w `deploy/produkcja/htaccess`
  i można ją usunąć jednym skreśleniem, jeśli wolisz tam zostawić stronę informacyjną.
