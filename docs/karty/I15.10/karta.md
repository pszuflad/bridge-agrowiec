# I15.10 — dostępność w Selly: `availability_sync` + zmiany w delcie (Tor 1)

> **Stan:** ⬜ po I15.4 i I15.3 (faza 4)
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #104 · **Zależy od:** I15.4 (auto-wstrzymania, punkt wpięcia), I15.3 (generator CSV), I15.6 (✅ delta), I15.7 (✅ Tor 2)
> **Ticket:** —

Przepisana z karty-rezerwy przez koordynatora (ticket 110, triaż 22.09 wieczór). Źródło prawdy: `origin/main` na `abe5f14`.

## Zakres
- **`availability_sync.cjs` (nowy moduł):** `request(db, dostawca)` kolejkuje odświeżenie — uruchamia generator CSV
  w osobnym procesie, a po nim `syncDelta` dla dotkniętych dostawców; okresowa synchronizacja zostaje mechanizmem
  ponawiania; błąd tylko loguje.
- **`selly/sync_delta.cjs` (zmiany z #104):** warunek `WHERE` obejmuje wstrzymane z wariantem, ale **wyklucza** te,
  które mają inną aktywną ofertę w tej samej grupie `kod_importu`; **mapowany wariant bez EAN też się zeruje**;
  tuż przed wysyłką czytany jest ŻYWY `status`/`stan`/`cena_sprzedazy` produktu (import mógł wstrzymać pozycję
  w trakcie biegu) — przy `wstrzymany` wysyłany jest stan 0.
- **`selly/sync_full.cjs` (Tor 2, #104):** tuż przed wysyłką czytany jest żywy `status`/`stan`; produkt wstrzymany
  po rozpoczęciu cyklu jest pomijany. I15.7 zamknęła się na stanie `7d6cfc9`, więc ta poprawka należy do tej karty —
  szczegóły i dokładny fragment: `wejscie-111.md`.

## Pliki (wyłączna własność)
`rebuild/backend/src/selly/rest/sync-delta.ts` i `sync-full.ts` (tylko zmiany z #104), nowy moduł dostępności,
montaż uzgodniony z I15.8; testy.
NIE: generator CSV (I15.3), staging i auto-wstrzymania (I15.4).

## Decyzje
Decyzje D1–D9 z bloku I15 obowiązują. Port 1:1 z `abe5f14`.

## Dowiezione
—

## Do koordynatora
—
