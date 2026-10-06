## 190-FEATURE: przełącznik `SELLY_TOR2` — sam Tor 1 w harmonogramie Selly

Ania (2026-10-05) chce wysyłać do Selly wyłącznie ceny i stany (Tor 1), bez Toru 2 (pełny mirror + auto-create o 04:30) i bez Toru 3 (usuwanie). Toru 3 dało się nie włączać już wcześniej (`SELLY_USUWANIE=false`), dla Toru 2 nie było przełącznika.

- `config/env.ts`: nowa flaga `SELLY_TOR2`, domyślnie włączona, więc zachowanie bez zmian.
- `selly/rest/scheduler.ts`: opcja `tor2`; przy `false` o 04:30 tylko log „Tor2 pominięty”.
- `server.ts`: przekazanie flagi do harmonogramu.
- Test `selly.harmonogram.test.ts`: przy `tor2=false` Tor 2 nie rusza mimo rotacji.
- `.env.example`: dokumentacja flagi.

Produkcja (vpshd86) po wdrożeniu: `SELLY_TRYB=pelny`, `SELLY_SCHEDULER=true`, `SELLY_TOR2=false`, `SELLY_USUWANIE=false`.
