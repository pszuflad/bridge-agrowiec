# P10.2 — kafel „Ostatni eksport CSV” pokazuje datę

> **Stan:** ⬜ gotowe (po P10.1)
> **Iteracja:** 10 — Analityka i Pulpit · **Wpisy backlogu:** #34 · **Zależy od:** P10.1, P6.2 (✅)
> **Ticket:** —

Przeniesione z roadmapy (blok „Poprawki po testach Ani”, plan P) ticketem `86-DOCS-migracja-kart-etap2`, 2026-09-21.

## Zakres
Kafel „Ostatni eksport CSV” na Pulpicie pokazuje datę — pełna treść: `docs/rebuild-backlog.md` #34
(naprawa zatwierdzona przez Anię, wdrożenie w tej karcie).

## Pliki (wyłączna własność)
`rebuild/frontend/src/pages/pulpit/kpi.ts` (`ostatniEksport`) + testy zamrażające
`test/pulpit.kpi.test.ts`, `test/pulpit.test.tsx` (wg backlogu #34). Rusza Pulpit tak jak P6.2 — dlatego po P6.2 (✅ 2026-09-21, ticket 77).

## Decyzje
Idzie **po P10.1**, bo P10.1 ożywia dane analityki, które kafel może pokazywać.

## Dowiezione
—

## Do koordynatora
—
