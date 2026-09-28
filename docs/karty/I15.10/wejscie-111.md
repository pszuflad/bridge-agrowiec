# Wejście dla I15.10 od ticketu 111 (koordynator) · 2026-09-22 — przejmujesz też zmianę w Torze 2

**Fakt:** karta I15.7 (ticket `109-FEATURE-selly-rest-sync-full`, ✅ zmergowana 2026-09-22 17:15) portowała
`sync_full` ze stanu **`7d6cfc9`** — czyli SPRZED zmiany „dostępność” z `abe5f14` (18:09). Trzyliniowej poprawki
Toru 2 w niej nie ma. Zgodnie z `wejscie-110.md` przejmuje ją ta karta.

**Do doniesienia w `src/selly/rest/sync-full.ts`** (dokładny diff: `git diff 7d6cfc9 abe5f14 -- mirror/backend/selly/sync_full.cjs`):

```js
const live = db.prepare('SELECT status,stan FROM products WHERE id=?').get(row.bridge_product_id);
if (!live || live.status !== 'aktywny') { stats.skip++; continue; }
row.stan = live.stan;
```

Czyli: tuż przed wysyłką Tor 2 czyta **żywy** status i stan produktu; pozycja wstrzymana po rozpoczęciu cyklu
jest pomijana (`skip`), a stan bierze się z bazy, nie z migawki sprzed biegu. To ten sam wzorzec co w delcie
(Tor 1), tylko prostszy — delta dodatkowo sprawdza inną aktywną ofertę w grupie `kod_importu`.

**Skutek dla zakresu karty:** trzy elementy zamiast dwóch — `availability_sync`, zmiany w delcie (Tor 1)
i ta poprawka Toru 2. Testy Toru 2 z I15.7 muszą zostać zielone; dopisz przypadek „produkt wstrzymany
w trakcie biegu → pominięty, nie wysłany ze starym stanem”.
