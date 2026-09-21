# P10.1 — klaster backendu analityki: ożywienie kart „Dostępności” + trzy poprawki towarzyszące

> **Stan:** ⬜ gotowe — decyzje 2026-09-21
> **Iteracja:** 10 — Analityka i Pulpit · **Wpisy backlogu:** #31, #32, #33, #35 · **Zależy od:** —
> **Ticket:** —

Przeniesione z roadmapy (blok „Poprawki po testach Ani”, plan P) ticketem `86-DOCS-migracja-kart-etap2`, 2026-09-21.

## Zakres
Klaster backendu analityki (`repos/analityka-*.ts`, trasy analityki). Pełna treść każdego wpisu
w `docs/rebuild-backlog.md` (#31, #32, #33, #35).

## Pliki (wyłączna własność)
Backend analityki: `rebuild/backend/src/repos/analityka.ts`, `repos/analityka-eksport.ts`,
`routes/analytics.ts` + testy analityki BE; `contract/openapi.yaml` (404 dla `export/:view`).
Frontend tylko w obrębie zakładki „Dostępność”, jeśli wymusi to pusta nazwa (#32).
P10.3 po decyzji z 2026-09-21 (eksport z przeglądarki, `docs/karty/P10.3/wejscie-87.md`) NIE rusza
plików backendu — idzie po P10.1 z powodu danych, nie kolizji plików.

## Decyzje
**PODJĘTE 2026-09-21 przez użytkownika, wszystkie zgodnie z rekomendacją** (pełna treść w backlogu).
Do 21.09 karta stała na „gotowe”, choć #31, #33 i #35 miały w backlogu „do decyzji” — rozjazd
zamknięty. Przy #32 Ania zatwierdziła NAPRAWĘ, a wybór WARIANTU był decyzją techniczną użytkownika.

| Wpis | Decyzja |
|---|---|
| **#32** | wariant (a): nazwa z katalogu, `LEFT JOIN products` po **`dostawca` + `kod`**; usunięty produkt → kreska |
| **#33** | naprawić razem z #32; z duplikatów klucza brać **ostatni wpisany** (`MAX(id)`) — karta najpierw MIERZY, co import zostawia w katalogu |
| **#31** | naprawić: nie dokładać migawki, jeśli produkt ma już dzisiejszą; **bez** indeksu unikalnego |
| **#35** | lista znanych widoków eksportu, reszta **404** (zamiast `200` z samym BOM) → zmiana kontraktu |

⚠ **Skutek dla PR.2** (kafle KPI analityki) i **P10.2** (kafel na Pulpicie): P10.1 ożywia dane, które
te karty mogą pokazywać — obie idą po P10.1.

## Dowiezione
—

## Do koordynatora
—
