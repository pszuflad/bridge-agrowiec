## Co i dlaczego
Po przeprowadzce produkcji na vpshd86 (ticket 188) stare skrypty i dokumentacja nadal wskazywały serwer vpshd1242.
Zgodnie z `docs/po-cutoverze-proces.md` §1.3 **nie przenosimy** crona `vps-sync` na nowy serwer: skopiowałby kod
odbudowy do `mirror/`, skasował oryginał i wypchnął to na `main` (co uruchamia wdrożenie).

## Zmiany
- `vps-sync.sh`, `acquire.sh`, `przygotuj-produkcje.sh`: blokada `exit 1` (wycofane, treść jako historia).
- `record-fixtures.sh`: domyślna domena bridgeone + ostrzeżenie o baseline.
- `deploy-produkcja.sh`: tylko teksty komunikatów błędów.
- `env.ts`, `.env.example`: domyślne `SELLY_CSV_DIR`/`SELLY_CSV_URL` → bridgeone (prod/staging nadpisują z `.env`).
- Banery „wycofane"/„stan po przeprowadzce" w 5 dokumentach.

## Poza zakresem
Stary cron `selly:csv` na vpshd1242 (decyzja Ani), `/triaz-zmian` i reszta karty PO.0.

## Test plan
- [ ] `bash -n` na zmienionych skryptach, `bash tools/vps-sync.sh` → kod 1
- [ ] bramki backendu zielone
