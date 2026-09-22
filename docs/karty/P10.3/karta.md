# P10.3 — eksport CSV respektuje filtry

> **Stan:** ⬜ gotowe (po P10.1) — zakres rozstrzygnięty 2026-09-21, patrz `wejscie-87.md`
> **Iteracja:** 10 — Analityka i Pulpit · **Wpisy backlogu:** #91 · **Zależy od:** P10.1 (✅ 2026-09-22)
> **Ticket:** —

Przeniesione z roadmapy (blok „Poprawki po testach Ani”, plan P) ticketem `86-DOCS-migracja-kart-etap2`, 2026-09-21.

## Zakres
Eksport CSV respektuje to, co widać w tabeli — „zapisz to, co widzę” (#91). Zakres rozstrzygnięty
2026-09-21 (`wejscie-87.md`, backlog #91 boks „⭐ ZAKRES”): plik CSV powstaje w PRZEGLĄDARCE z wierszy
tabeli po filtrach, Marża w przekroju tabeli, wszystkie wiersze (bez limitu 300).

## Pliki (wyłączna własność)
Frontend analityki — **podział z PR.2 (fala B, obie równolegle)**:
- `rebuild/frontend/src/pages/analityka/eksport.tsx`, NOWY generator CSV (np. `csv.ts`),
  sekcje z przyciskiem CSV (`Sekcja*.tsx`), `TabelaAnalityki.tsx` (tylko jeśli potrzebny dostęp do kolumn),
  testy eksportu/sekcji.
- **NIE rusza:** `NaglowekKpi.tsx`, `Analityka.tsx`, `api.ts` (własność PR.2), backendu i `contract/`
  (trasa `export/:view` zostaje, jak zostawiła ją P10.1).

## Decyzje
✅ 2026-09-21, użytkownik, zgodnie z rekomendacją — trzy decyzje w `wejscie-87.md` i backlogu #91.

## Dowiezione
—

## Do koordynatora
—
