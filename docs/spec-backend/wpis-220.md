# Wpis 220 — harmonogram generowania cenników partnerów

Ticket `220-FEATURE-partnerzy-harmonogram` (PRT-4.1). `src/partnerzy/scheduler.ts`: serwis z tickiem co minutę (aktywni partnerzy z `harmonogram_minuty`, interwał liczony od ostatniej próby z `partner_logi`),
zamkiem per partner i ręcznym `generujTeraz`. Trasa `POST /api/partnerzy/:id/generuj` (poza openapi; 409 gdy trwa, 503 bez serwisu). Env: `PARTNERZY_SCHEDULER` (domyślnie wyłączony), `PARTNERZY_KATALOG`.
Wynik zawsze trafia do logów (PRT-4.2).
