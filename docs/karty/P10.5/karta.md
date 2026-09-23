# P10.5 — pełne pliki CSV z Analityki (bez sufitu tras dashboardu)

> **Stan:** ⬜ gotowe (niezależna od I15)
> **Iteracja:** 10 — Analityka i Pulpit (karta dołożona po zamknięciu iteracji) · **Wpisy backlogu:** #96 · **Zależy od:** P10.3 (✅ 2026-09-22)
> **Ticket:** —

Założona przez koordynatora ticketem `124-DOCS-decyzje-ani-96-97-108`, 2026-09-23, po odpowiedzi Ani.

## Zakres
Po karcie P10.3 plik CSV powstaje w przeglądarce z wierszy tabeli — a te przychodzą z tras dashboardu, które mają
limity SQL z oryginału. Zmierzone na `db/snapshot.db`: „Pozycje unikalne” 5109 → plik 1000; karty „Dostępności”
(4.1 i 4.2) ~5184 → plik 500; „EAN wspólne” 769 (poniżej sufitu, bez straty).

**Decyzja Ani 2026-09-23: „chcę pełne pliki”.** Zakres:
- **sufit zdejmujemy TYLKO dla pliku** — przy eksporcie osobne zapytanie bez limitu (albo inny mechanizm,
  uzasadniony w planie);
- **tabela na ekranie zostaje przy 300 wierszach** (`TabelaAnalityki.tsx`, limit rysowania z oryginału);
- **kafel „Pozycje unikalne” nadal liczy 1000** (port 1:1 oryginału, PR.2) — nie ruszamy;
- pomiar do raportu: liczba wierszy w pliku przed i po zmianie dla każdego z trzech dotkniętych widoków.

⚠ Świadome odstępstwo od produkcji (tam eksport serwerowy miał własne limity: `unique` bez limitu,
`availability-*` 5000). Opisz je w karcie i zapisz wejście dla P10.4/I15.9 — Ania ma wiedzieć, że pliki są pełne.

## Pliki (wyłączna własność)
`rebuild/frontend/src/pages/analityka/**` (ścieżka eksportu) oraz, jeśli potrzebne, trasy/repozytoria analityki
w `rebuild/backend/src` dla zapytania bez limitu. NIE: Pulpit, kafle KPI, staging, Selly.

## Decyzje
Ania 2026-09-23 (#96): pełne pliki. Kafel i tabela bez zmian.

## Dowiezione
—

## Do koordynatora
—
