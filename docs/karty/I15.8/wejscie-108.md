# Wejście dla I15.8 od ticketu 108 (I15.6) · 2026-09-22

Karta I15.6 przeportowała `src/selly/rest/{limiter,discovery,sync-delta}.ts`. Dla harmonogramu i tras
(własność I15.8) istotne jest:

- **Eksport Toru 1 to `syncDelta(db, discovery, dostawca, opts)`** z `src/selly/rest/sync-delta.ts` —
  nazwa zgodna z oryginałem, NIE `syncDeltaForDostawca`.
- **Graf wywołań (produkcja):** produkcyjny `routes_sync.cjs` importuje nieistniejące
  `syncDeltaForDostawca` → trasa `sync-delta-supplier` rzuca `TypeError` w produkcji. Decyzja do podjęcia
  w I15.8: odtworzyć awarię 1:1 (nazwa importu zgodna z produkcją, trasa wybucha) czy naprawić import na
  `syncDelta` — to jest decyzja użytkownika, nie fakt do zgadnięcia.
- **`discovery` wymaga JEDNEJ instancji montowanej wspólnie** dla Toru 1 i Toru 2 (I15.7) — stan
  (nauczone `feature_id`, cache kodów produktów) żyje w domknięciu `stworzDiscovery()`. Montaż w
  `server.ts`/`app.ts` powinien stworzyć ją raz i wstrzyknąć do obu torów oraz do harmonogramu.
- **Przed uruchomieniem biegu sprawdzić `SELLY_TRYB`.** Przy `wylaczony` discovery połyka blokadę odczytu
  (rzuca wyjątek klienta) i **myli to z „produkt nie istnieje”** — bez sprawdzenia trybu przed startem
  Tor 1 zacznie zakładać duplikaty zamiast czekać.
- **`dryRun` Toru 1 NIE chroni przed `createVariant`** w discovery (może utworzyć wariant nawet przy
  `dry_run=true`) — zastane 1:1 z oryginałem; jedyną twardą blokadą jest `SELLY_TRYB`.
- **`getStats()` limitera** (`globalnyLimiter` z `src/selly/rest/limiter.ts`) jest gotowe do wypięcia pod
  `GET /api/selly/sync-status`, jeśli ta trasa ma pokazywać stan throttle'a.
