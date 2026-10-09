# 206 — kroki wdrożenia także na środowisku testowym

Powód: reset hasła Arkadiusza (krok `2026-10-09-reset-hasla-arkadiusz`, ticket 205) wykonał się tylko na
produkcji; skrypt wdrożenia środowiska testowego (`tools/deploy-staging.sh`) nie uruchamiał kroków.

Zmiany:
- `deploy-staging.sh` uruchamia `npm run kroki-wdrozenia` po migracjach, z `KROKI_SRODOWISKO=testowe`.
- `Krok.tylkoProdukcja` — runner pomija taki krok (bez zapisu) na środowisku testowym. Oznaczone:
  `2026-10-07-zrodla-cennikow-foldery`, `2026-10-08-selly-tor2-tor3-wlaczone` (środowisko testowe nie może
  dostać zapisu do sklepu Selly).
- Na środowisku testowym wykonają się więc: konta Erwina i Anny oraz reset hasła Arkadiusza — pod warunkiem,
  że `HASLO_TYMCZASOWE` jest wpisane (raz) w `$STAGING_ROOT/.env` na serwerze testowym; bez niego kroki są pomijane.

Uwaga: skrypt wdrożenia aktualizuje się w trakcie działania, więc zmiana `deploy-staging.sh` zadziała
od DRUGIEGO wdrożenia środowiska testowego po merge'u.
