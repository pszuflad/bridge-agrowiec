## 188-CHORE: CD na nowy serwer vpshd86 (bridgeone / training.agroopony.eu)

Produkcja i staging zostały przeniesione z vpshd1242 (agritires.eu) na vpshd86 (agroopony.eu). Ten PR przestawia skrypty wdrożeń i pliki `.htaccess` na nowy układ. Szczegóły: `docs/tickets/188-CHORE-deploy-agroopony/plan.md`.

- `tools/deploy-produkcja.sh`, `tools/deploy-staging.sh`:
  - nowe ścieżki (`public_html/<subdomena>/_app`);
  - Node i PM2 lokalne;
  - binarka better-sqlite3 z `_app/lib`;
  - **ochrona `_app/` (baza!) i `cgi-bin/` przed `rsync --delete`**;
  - guard blokady WWW na `_app/`.
- `deploy/*/htaccess`: wersje dla agroopony.eu (proxy lokalnie, blokada `_app` i `.env`, bez przekierowania na agritires).
- Workflowy: komentarze i ścieżki.

Po stronie serwera i GitHuba (poza diffem):
- `authorized_keys` na vpshd86 z tymi samymi kluczami deployu;
- sekrety `*_SSH_HOST`, `*_SSH_PORT` i `*_SSH_KNOWN_HOSTS` → vpshd86.
