# I15.7 — Selly REST 2: nocna pełna synchronizacja (`sync_full`, `mapper_v2`, #81)

> **Stan:** ⬜ po I15.6 (fala 2)
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #60, #81 · **Zależy od:** I15.6
> **Ticket:** —

Założona przez koordynatora ticketem `104-DOCS-plan-i15`, 2026-09-22. Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”.

## Zakres
Dawne 13d-2. Port TS z `origin/main`: `mirror/backend/selly/sync_full.cjs` (336 l.) i `mapper_v2.cjs` (235 l.):
ścieżka A (`GET /api/products/{pid}` → payload z `includeFeatures:true` → `PUT` z cechami i `category_id`),
auto-create, **#81**: `metadataScore()`/`isMetadataOwner()` (jeden kanoniczny rekord pisze cechy i kategorię
wspólnego produktu; grupa o różnych kategoriach pomijana), usunięta martwa `fetchVariantFeatures()`,
`buildFeaturesMirror()` nie dziedziczy starej wartości cechy zarządzanej przez Bridge, gdy bieżąca jest pusta.
⚠ Ustalenie z 08.09 „PUT nie przyjmuje features” jest **OBALONE** (test produkcyjny 17.09, `5dedefb`) — patrz blok 13d.
⚠ Bezpieczeństwo jak w I15.6.

## Pliki (wyłączna własność)
`rebuild/backend/src/selly/rest/sync-full*`, `mapper*` (+ testy). NIE: pliki I15.6 poza importem ich API.

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
