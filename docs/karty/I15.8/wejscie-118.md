# Wejście dla I15.8 od ticketu 118 (koordynator) · 2026-09-23 — decyzja Ani: usuwamy stary przycisk „Sync dostawcy"

**Odpowiedź Ani (23.09):** „Możemy usunąć ten przycisk z panelu, bo my i tak nie będziemy go używali”.

Dotyczy **sekcji „Sync dostawcy" w panelu Selly** (`rebuild/frontend/src/pages/selly/SekcjaSync.tsx`,
wywołanie `synchronizujDostawce` → `POST /api/selly/sync-supplier`). Po przebudowie tabeli `selly_products`
(migracja `013`, karta I15.6) ta ścieżka i tak jest zepsuta — identycznie jak na produkcji (backlog #67) —
a zastąpiły ją tory API.

**Do wykonania w tej karcie (świadome odstępstwo, decyzja Ani 2026-09-23):**
- usuń sekcję „Sync dostawcy" z widoku `/selly` (komponent + jego wywołania i testy);
- **trasa `POST /api/selly/sync-supplier` ZOSTAJE** bez zmian (kontrakt, nagrania, backlog #67 opisuje ją jako
  defekt odtworzony 1:1) — usuwamy tylko przycisk, nie API;
- odnotuj w karcie jako odstępstwo od produkcji (produkcja przycisk ma, choć nie działa) i zapisz wejście
  dla I15.9 — Ania ma wiedzieć, że sekcja zniknęła z panelu.
