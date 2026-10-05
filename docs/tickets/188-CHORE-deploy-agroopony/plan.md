# 188-CHORE: deploy CD na nowy serwer (vpshd86, agroopony.eu)

Data: 2026-10-05. Zlecenie: Ania — „zrobić wszystko co potrzeba do integracji z GitHubem nowego serwera”.

## Kontekst

- 2026-10-05 17:11 produkcja Bridge przeniesiona z vpshd1242 (panel.agritires.eu) na vpshd86:
  **bridgeone.agroopony.eu**. Staging: **training.agroopony.eu**. Stary `bridge-backend-prod`
  zatrzymany (nic nie usunięto), stary panel → 301 na bridgeone.
- Na vpshd86 wolno pisać tylko w `public_html/bridgeone` i `public_html/training`, więc aplikacja
  leży POD docrootem w `_app/` (własny `.htaccess` „Require all denied” + reguła `[F]` w głównym).
- SSH na vpshd86 jest w jailu (jailsh): brak nvm, globalnego pm2, crontaba — crony przez DirectAdmin.

## Układ na serwerze (dla obu środowisk, `<docroot>` = public_html/bridgeone | public_html/training)

| Ścieżka | Co |
|---|---|
| `<docroot>/` | zbudowany frontend (rsync), `.htaccess` z repo, `ex-port-files/` (CSV, biała lista IP), `cgi-bin/` |
| `<docroot>/_app/repo` | klon repo (HTTPS, repo publiczne — bez klucza do GitHuba) |
| `<docroot>/_app/releases/<sha>`, `current` | release backendu |
| `<docroot>/_app/data/` | baza (`data-prod.db` / `data-test.db`), `import_archive/`, `backups/` |
| `<docroot>/_app/.env` | sekrety i konfiguracja (poza repo) |
| `<docroot>/_app/node/` | Node v20.20.2 |
| `<docroot>/_app/bin/pm2` | nakładka na wspólny demon PM2 (`bridgeone/_app/pm2.sh`, `PM2_HOME=bridgeone/_app/.pm2`) |
| `<docroot>/_app/lib/better_sqlite3.node` | stała kopia binarki 11.7.0 / ABI 115 (glibc 2.28, brak Pythona → bez node-gyp) |

Autostart: cron DirectAdmin `*/5` → `bridgeone/_app/autostart.sh` (resurrect z dump PM2).

## Zmiany w repo

- `tools/deploy-produkcja.sh`, `tools/deploy-staging.sh`: nowe ścieżki, `HOST=127.0.0.1` dla prod
  (Apache proxy lokalnie), PATH z `_app/node/bin` i `_app/bin`, binarka z `_app/lib`,
  **ochrona `_app/` i `cgi-bin/` przed `rsync --delete`** (inaczej deploy skasowałby bazę),
  nowy guard: brak blokady WWW `_app/.htaccess` → przerwij.
- `deploy/produkcja/htaccess`, `deploy/staging/htaccess`: wersje dla agroopony (bez przekierowania
  na panel.agritires.eu — dałoby pętlę), blokada `_app` i `.env`.
- Workflowy: komentarze i ścieżki (informacyjne — klucze mają wymuszone `command=` na serwerze).

## Poza repo (zrobione na serwerze / w GitHubie)

- `~/.ssh/authorized_keys` na vpshd86: te same klucze publiczne co na vpshd1242
  (`gh-actions-staging-deploy`, `deploy-produkcja-bridge`) z wymuszonymi poleceniami na nowe ścieżki.
- Sekrety repo `PROD_SSH_HOST/PORT/KNOWN_HOSTS` i `STAGING_SSH_HOST/PORT/KNOWN_HOSTS` → vpshd86.
  Klucze prywatne (`*_SSH_KEY`) i `*_SSH_USER=admin` bez zmian.
- Na vpshd1242 blokada wdrożeń (atrapa PM2 `bridge-backend`, guard 3) zostaje.
