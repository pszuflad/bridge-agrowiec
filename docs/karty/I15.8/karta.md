# I15.8 — Selly REST 3: harmonogram (Tor 2 o 4:30) i trasy `sync-*`

> **Stan:** ⬜ po I15.7 (fala 3)
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #60 · **Zależy od:** I15.7
> **Ticket:** —

Założona przez koordynatora ticketem `104-DOCS-plan-i15`, 2026-09-22. Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”.

## Zakres
Dawne 13d-3. Port TS z `origin/main`: `mirror/backend/selly/scheduler_selly.cjs` (Tor 2 codziennie **04:30**, po
auto-pull dostawców o 04:00; pętla sprawdzająca) i `routes_sync.cjs` — sześć tras: `GET /api/selly/sync-status`,
`POST /api/selly/sync-delta-supplier`, `sync-delta-all`, `sync-full-supplier`, `sync-full-today`, `sync-full-force`
→ `contract/openapi.yaml` + nagrania z oryginału (z atrapą Selly).
- Harmonogram za flagą środowiskową, **domyślnie wyłączony** (wzorzec `IMPORT_SCHEDULER`), produkcja włącza jawnie —
  wejście dla koordynatora (cutover: kto od dnia przełączenia robi nocną synchronizację).
- **Przycisków synchronizacji w panelu NIE ma na produkcji** (koordynator 2026-09-22: żaden z 8 żywych skryptów frontu
  nie woła `sync-*`). Dawny plan 13d-3 zakładał przyciski — to było założenie. Odtwarzamy 1:1 (bez UI); jeśli Ania ich
  chce, to osobna decyzja.
⚠ Bezpieczeństwo jak w I15.6 — trasy `sync-*` realnie zapisują do sklepu; w testach tylko atrapa.

## Pliki (wyłączna własność)
`rebuild/backend/src/selly/rest/scheduler*`, trasy `sync-*`, rejestracja w `app.ts`, `config/env.ts` (flaga), `contract/openapi.yaml`, testy.

## Decyzje
**Decyzje użytkownika 2026-09-22 (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na
istniejące obiekty · D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2
przenosimy · D4 błędny EAN = błąd blokujący akceptację (wersja Ani zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
**Produkcja zamrożona od 2026-09-22** — źródło prawdy to `origin/main` na commicie `7d6cfc9`; nowy kod na `main` = zgłoś.

—

## Dowiezione
—

## Do koordynatora
—
