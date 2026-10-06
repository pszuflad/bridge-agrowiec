# 193 — Host SSH wdrożeń: vpshd86.cyber-folks.pl zamiast agroopony.eu

## Problem (2026-10-06)
Domena `agroopony.eu` w publicznym DNS wskazuje już 212.91.26.121 (Selly), a nie VPS 185.201.115.38.
Sekrety `*_SSH_HOST=agroopony.eu` kierowały GitHub Actions na zły serwer — Deploy staging 13:26 UTC:
`ssh: connect to host … Connection timed out`. Dokumentacja nadal podawała vpshd1242 i port 22.

## Zmiana
- Sekrety `STAGING_SSH_HOST`, `PROD_SSH_HOST` → `vpshd86.cyber-folks.pl`; `*_SSH_KNOWN_HOSTS` → `ssh-keyscan -p 222 vpshd86.cyber-folks.pl`.
  Ponowiony run 37470749518 — sukces.
- Dokumentacja: `docs/deploy-setup.md`, `START.md`, `docs/wdrozenie-produkcji.md`, komentarze workflowów.

## Uwaga na przyszłość
URL-e cenników dostawców (`https://agroopony.eu/imports/...`) działają, bo serwer rozwiązuje `agroopony.eu`
lokalnie na siebie. Z zewnątrz ta domena to Selly — przy zmianie DNS na serwerze importy przestaną działać.
