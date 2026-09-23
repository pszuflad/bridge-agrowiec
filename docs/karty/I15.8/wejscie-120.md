# Wejście dla I15.8 od ticketu 120 (karta I15.2, resync parserów) · 2026-09-23

Rozbierałem `git diff origin/develop 88fa31c -- mirror/backend/extensions.cjs` (5 hunków, +34/−1),
żeby przypisać zmiany do kart. **Jeden hunk jest Twój.**

## Hunk 3 — rejestracja Selly REST (linie 479–494 na `88fa31c`)

```js
// === DODANE 2026-09-07: Selly REST API sync (Tor 1 delta + Tor 2 full) ===
try {
  const { registerSyncRoutes } = require('./selly/routes_sync.cjs');
  registerSyncRoutes(app, { db: _bridgeDb, requireAuth: we });
  const { installScheduler } = require('./selly/scheduler_selly.cjs');
  installScheduler(_bridgeDb);
  console.log('[bridge_v6] Selly sync: endpointy /sync-* + scheduler zaladowane');
} catch (e) {
  console.error('[bridge_v6] BLAD ladowania selly/sync:', e.message);
}
```

Dwie rzeczy warte uwagi:

1. **Rejestracja tras i scheduler idą PARĄ, w jednym `try`** — a `catch` tylko loguje. Jeśli
   `routes_sync.cjs` rzuci przy ładowaniu, scheduler też się nie zainstaluje, a backend wstanie
   normalnie i wypisze błąd na konsolę. Cicha awaria: trasy `/api/selly/sync-*` po prostu nie istnieją,
   zamiast zwracać błąd.
2. Zmiana pochodzi z **2026-09-07**, więc jest starsza niż `88fa31c` — sprawdź, czy I15.6/I15.7 już jej
   nie skonsumowały, zanim zaczniesz ją portować. Karta I15.2 jej NIE ruszała (Selly jest poza jej
   wyłączną własnością).

## Czego NIE ma w tym hunku

`mirror/backend/selly/*` (`routes_sync.cjs`, `scheduler_selly.cjs`, `sync_delta.cjs`, `sync_full.cjs`,
`discovery.cjs`, `mapper_v2.cjs`, `rate_limiter.cjs`) **nie zostały** zsynchronizowane do `mirror/`
przez ticket 120 — decyzja D-2 użytkownika ograniczyła sync do warstwy parserów, żeby nie wchodzić
w cudze pliki. Na `develop` są więc nadal w starszej wersji niż `88fa31c`; różnicę zobaczysz przez
`git diff origin/develop 88fa31c -- mirror/backend/selly/`.

## Drobiazg o duplikacie w backlogu

Numer **#103** jest w `docs/rebuild-backlog.md` użyty DWA razy dla niepowiązanych spraw: raz dla
„`routes_sync.cjs` woła nieistniejące `runFullTodays` → 500 na `/sync-full-*`" (Twoje), raz dla
„Braki w cenniku / `feed_safety`" (karta I15.2). Zgłoszone koordynatorowi w `karta.md` I15.2 —
przy czytaniu backlogu upewnij się, który wpis masz na myśli.
