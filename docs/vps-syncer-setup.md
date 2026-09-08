# Konfiguracja producenta sync na VPS — krok po kroku

Cel: serwer produkcyjny sam snapshotuje swój stan do gita i wypycha na GitHub.
Laptopy tylko `git pull`. Uwierzytelnienie do GitHuba: **deploy key (SSH), nie token.**

**Środowisko VPS (zweryfikowane):** git 2.43, node v20.20.2, crontab — wszystko jest.

Legenda: 🧑 terminal na VPS (po `ssh -p 222 admin@vpshd1242.cyber-folks.pl`) ·
🌐 przeglądarka (GitHub).

> ⚠ Warunek wstępny: `tools/vps-sync.sh` i `tools/deminify.sh` muszą być już
> w repo na GitHubie (commit + push z laptopa). Bez tego krok 3 (clone) nie
> przyniesie skryptów.

---

## Krok 1 — 🧑 Deploy key na serwerze

Generujemy parę kluczy **dedykowaną temu repo**, bez hasła (cron musi działać
bezobsługowo):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/bridge_deploy -N "" -C "bridge-vps-syncer"
cat ~/.ssh/bridge_deploy.pub          # skopiuj CAŁĄ tę linię
```

## Krok 2 — 🌐 Dodaj klucz publiczny do repo na GitHubie

1. `github.com/pszuflad/bridge-agrowiec` → **Settings** → **Deploy keys** →
   **Add deploy key**.
2. Title: `vps-syncer`.
3. Key: wklej zawartość `~/.ssh/bridge_deploy.pub` z kroku 1.
4. ☑ **Allow write access** — kluczowe, bez tego push nie przejdzie.
5. **Add key**.

Deploy key działa tylko dla tego jednego repo — bezpieczniejszy niż token konta.

## Krok 3 — 🧑 Powiedz gitowi, żeby dla GitHuba używał tego klucza

```bash
cat >> ~/.ssh/config <<'EOF'

Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/bridge_deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

# test — powinno wypisać "Hi pszuflad/bridge-agrowiec! You've successfully authenticated"
ssh -T git@github.com
```

(„You've successfully authenticated, but GitHub does not provide shell access" =
sukces.)

## Krok 4 — 🧑 Sklonuj repo na VPS (do osobnego katalogu, NIE do katalogu aplikacji)

```bash
cd ~
git clone git@github.com:pszuflad/bridge-agrowiec.git bridge-sync
cd bridge-sync
```

Klon ląduje w `~/bridge-sync` — świadomie **poza** `/home/admin/private_apps/bridge`
(żeby nie mieszać z żywą aplikacją).

## Krok 5 — 🧑 Tożsamość gita dla commitów serwera

```bash
git config user.name  "Bridge VPS syncer"
git config user.email "syncer@agritires.eu"
```

## Krok 6 — 🧑 Zainstaluj js-beautify w klonie (dla deminify)

```bash
cd ~/bridge-sync
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
npm install --prefix tools --no-audit --no-fund
```

Wersja jest zapinowana w `tools/package.json` (js-beautify 1.14.11) — dzięki temu
upiększanie na serwerze daje **identyczny** wynik co na laptopie, więc diffy są czyste.

## Krok 7 — 🧑 Pierwsze uruchomienie ręczne (test)

```bash
cd ~/bridge-sync
bash tools/vps-sync.sh
```

Oczekiwane: skopiuje produkcję do `mirror/`, wygeneruje `deminified/`, i jeśli
cokolwiek różni się od baseline z laptopa — zrobi commit i push. Sprawdź na
GitHubie, czy pojawił się commit `sync(vps): ...`.

Jeśli push zawiedzie na „permission denied" — wróć do kroku 2 (czy zaznaczone
„Allow write access") i kroku 3 (czy `ssh -T git@github.com` się uwierzytelnia).

## Krok 8 — 🧑 Cron: co godzinę

```bash
crontab -e
```
Dopisz (login shell `-l`, żeby cron miał PATH do node/git/sqlite3/rsync):

```
0 * * * * /bin/bash -lc '$HOME/bridge-sync/tools/vps-sync.sh >> $HOME/bridge-sync/tools/vps-sync.log 2>&1'
```

Co godzinę serwer snapshotuje swój stan. Podgląd działania:

```bash
tail -20 ~/bridge-sync/tools/vps-sync.log
```

### 🧑 Sprawdź, czy cron nadal ISTNIEJE (panel DirectAdmin)

> **Dlaczego to trzeba sprawdzać.** Producent potrafi „zniknąć" na dwa sposoby: (a) sam
> **skrypt** się wywala (tak było 25.08–08.09: `grep '\.bak_pre_'` przestał trafiać i pod
> `set -euo pipefail` skrypt ubijał się przed `git push` — naprawione), albo (b) **cron
> zostaje usunięty/wyłączony** w panelu (przy zmianie planu, migracji konta itp.). Ten krok
> sprawdza (b). Na tym VPS `crontab -e/-l` z CLI bywa **zablokowany** — wpisy crona żyją w
> panelu DirectAdmin, więc sprawdzasz je TAM, nie przez `crontab -l`.

1. Zaloguj się do **DirectAdmin** → **Advanced Features** → **Cron Jobs**
   (pol. „Zadania Cron" / „Harmonogram zadań").
2. Poszukaj na liście wpisu, którego **polecenie zawiera `vps-sync.sh`** (albo `bridge-sync`).
   - **Jest** → sprawdź, że: harmonogram to `0 * * * *` (min=0, godzina=`*`, dzień/mies./dzień
     tyg.=`*`), polecenie to dokładnie linia z bloku wyżej, i że wpis **nie jest wyłączony**
     (DirectAdmin nie ma przełącznika „disabled" — wyłączony cron to zwykle zakomentowany
     `#` na początku polecenia albo po prostu brak wpisu).
   - **Brak / zakomentowany** → to jest przyczyna ciszy. Dodaj go: **Cron Jobs** → wypełnij
     pola Minute=`0`, Hour=`*`, pozostałe `*`, a w polu polecenia wklej:
     ```
     /bin/bash -lc '$HOME/bridge-sync/tools/vps-sync.sh >> $HOME/bridge-sync/tools/vps-sync.log 2>&1'
     ```
     → **Add**.
3. **Potwierdź, że pierwszy przebieg po naprawie przechodzi** (nie czekaj godziny — odpal ręcznie):
   ```bash
   /bin/bash -lc '$HOME/bridge-sync/tools/vps-sync.sh'
   tail -20 ~/bridge-sync/tools/vps-sync.log
   ```
   Oczekiwane: w logu linia `… brak zmian` **albo** `… wypchnięto zmiany …`, i przychodzi mail.
   **Brak nowego commita to też OK** — jeśli wszystkie zaległości są już w repo (`6872aea`),
   producent nie ma czego pchać; ważne, że skrypt **kończy się bez błędu** (poprzednio wywalał
   się w połowie). Jeśli w logu widać `UWAGA: mail nie wyszedł` — patrz sekcja o `sendmail`.

---

## Jak to wygląda w codziennej pracy

- **Serwer** (co godzinę, sam): pobiera własny stan → commit `sync(vps)` → push.
- **Ty na dowolnym laptopie:** `git pull --rebase` przed pracą — masz najświeższy
  stan produkcji. Swoje zmiany (`docs/`, `rebuild/`) commitujesz i pushujesz;
  producent je zaciągnie (`git pull --rebase` w skrypcie) i nie pobije.
- **Konflikty:** praktycznie niemożliwe — serwer pisze tylko do `mirror/`,
  `deminified/`, `db/schema.sql`; Ty piszesz do `docs/`, `rebuild/`. Różne ścieżki.

## Uwagi

- `knowledge/` (eksport z Perplexity) wgrywasz z laptopa — serwer go nie dotyka.
- `snapshot.db` (pełna baza) NIE trafia do gita. Gdy potrzebujesz binarnej bazy
  lokalnie do analizy, użyj `tools/acquire.sh` z laptopa (pobierze ją przez SSH).
- `mirror/backend/import_archive/` jest wykluczony z rsync (`tools/vps-sync.sh`) i z gita
  (`.gitignore`) — zrzuty importu dostawców puchły w repo (bloat, usunięte commitem
  `72957d7`). W drzewie roboczym tych plików już nie ma; próbki do gate'u charakteryzacji
  parserów (I3) wyciąga się z historii gita (`git show '72957d7^:mirror/backend/import_archive/...'`).
- Częstotliwość: „co godzinę" to punkt startowy. Zmiany Ani i tak są zachowane
  na serwerze (kopie `.bak` + `CHANGELOG.md`), więc rzadszy sync = tylko grubsza
  historia, nie utrata danych. Możesz dać `0 */2 * * *` (co 2 h) albo gęściej.
