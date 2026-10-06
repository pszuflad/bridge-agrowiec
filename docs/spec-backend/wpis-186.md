# Wpis do spec-backend od ticketu 186 · 2026-10-05

**Sekcja:** Selly REST (harmonogram) i widok Historia.

**Potwierdzone w 186** (`186-FEATURE-selly-usuwanie-sierot`, 2026-10-05): produkcja nie ma ścieżki usuwania z Selly (backlog #100). **Nowa funkcja
(decyzja użytkownika):** Tor 3 (`selly/rest/sync-usuwanie.ts`) po każdym Torze 1 usuwa sieroty — wiersze `selly_products`, dla których nie ma
produktu w Bridge (po `(dostawca, kod_importu)`, po kodzie Bridge ani po EAN-ie z `historia_cen`), po sprawdzeniu tożsamości w Selly (produkt, wariant,
magazyn = dostawca, EAN). Wariant usuwany, gdy produkt ma inne warianty/mapowania; inaczej cały produkt; 404 = już usunięty. Limit 20 na przebieg,
wstrzymanie przy pustym katalogu lub >30% sierot, `SELLY_USUWANIE=false` wyłącza. Historia: `audit_log` akcja `selly_usuniecie` (widok „Historia”,
typ `edycja`) i `selly_sync_log` operacja `sync_delete`. Szczegóły: `docs/tickets/186-FEATURE-selly-usuwanie-sierot/`.
