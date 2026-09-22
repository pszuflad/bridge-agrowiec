# PR.2 — kafle KPI analityki jak na produkcji

> **Stan:** ⬜ gotowe (po P10.1)
> **Iteracja:** przegląd 12 widoków · **Wpisy backlogu:** — · **Zależy od:** P10.1 (✅ 2026-09-22)
> **Ticket:** —

Przeniesione z roadmapy (blok „Poprawki po testach Ani”, plan P) ticketem `86-DOCS-migracja-kart-etap2`, 2026-09-21.

## Zakres
Kafle KPI na widoku analityki (`/analityka`) mają wyglądać jak na produkcji — uwaga Ani z przeglądu
12 widoków (`docs/przeglad-12-widokow.md` §8), pytanie 12.3 w `docs/pytania-do-ani-2026-09-18.md`.

**Co to znaczy konkretnie (ustalone 2026-09-22 przez koordynatora, z kodu):** odwrócenie odstępstwa
**O-10a-1** z bloku 10a (roadmapa, blok I10). Dziś nagłówek pokazuje cztery kafle z `GET /api/analytics/kpi`
— „Produkty / Dostawcy / Śr. marża / Staging oczekujące”. Oryginał (`deminified/frontend-index.js:27990-28030`)
pokazuje cztery INNE kafle, liczone klientem z tras, które widok i tak pobiera:
- **Dostawcy** = `filters.dostawcy.length` (`GET /api/analytics/filters`),
- **EAN wspólne** = `ean/comparison.rows.length`,
- **Pozycje unikalne** = `ean/unique.rows.length`,
- **Snapshoty** = źródło do ustalenia w kodzie oryginału (tuż za `:28020`).
Brak danych → „—” (jak w oryginale). Blok 10a wziął `/kpi`, bo w chwili budowy brakowało tras EAN;
dziś są (10c).

⚠ **Założenie do potwierdzenia:** tytuł karty („jak na produkcji”) nadano przy planowaniu po rundzie 2
odpowiedzi Ani, ale jej odpowiedź na 12.3 nie jest zapisana w repo. Karta ma ją odszukać (backlog,
`docs/tickets/66-*`, `71-*`); jeśli nie znajdzie — zapytać użytkownika przed kodem, czy wariant (a)
„jak na produkcji” jest potwierdzony.

## Pliki (wyłączna własność)
Frontend analityki — **podział z P10.3 (fala B, obie równolegle)**:
- `rebuild/frontend/src/pages/analityka/NaglowekKpi.tsx`, `Analityka.tsx` (tylko podpięcie nagłówka),
  `api.ts` (ewentualne nowe hooki), testy nagłówka KPI.
- **NIE rusza:** `eksport.tsx`, `Sekcja*.tsx`, `TabelaAnalityki.tsx` (własność P10.3).
- Backend: trasa `GET /api/analytics/kpi` zostaje (kontrakt) — przestaje być wołana przez nagłówek
  (trasa bez konsumenta w UI, jak #28). Backendu nie zmieniać.

## Decyzje
Idzie **po P10.1** (✅ 2026-09-22) — równolegle z P10.2 i P10.3 (fala B), z podziałem plików jak wyżej.

## Dowiezione
—

## Do koordynatora
—
