# 249 — raport

Zrobione wg planu. Testy: backend `partnerzy.podglad-selly` (9: podgląd, blokady, flaga wyłączona, jednokrotne wysłanie + 409 przy drugim kliknięciu, odmowa Selly → powrót do `przyjete`, 401), walidacja ID Selly, `selly.tryb` (kompletność: `createOrder` = zapis), migracje; frontend (ustawienia, podgląd, dwuklik z potwierdzeniem, flaga, odmowa). Lint/typecheck czyste.
Włączenie na produkcji: wpisać `PARTNERZY_SELLY_ZAMOWIENIA=true` do `.env` (flaga, nie sekret) — OSOBNA decyzja użytkowniczki po obejrzeniu podglądu ciała. Do czasu wpisu migracja i panel działają, a tworzenie jest zablokowane.
