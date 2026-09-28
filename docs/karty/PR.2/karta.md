# PR.2 — kafle KPI analityki jak na produkcji

> **Stan:** ✅ 2026-09-22 · 97-FEATURE-kafle-kpi-analityki
> **Iteracja:** przegląd 12 widoków · **Wpisy backlogu:** — · **Zależy od:** P10.1 (✅ 2026-09-22)
> **Ticket:** 97-FEATURE-kafle-kpi-analityki

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
- **Snapshoty** = `status.snapshots || 0` (`GET /api/analytics/status`).
Puste stany nie są jednolite: „Dostawcy” bez danych → „—”, „EAN wspólne”/„Pozycje unikalne” bez
`rows` → „0”, „Snapshoty” zawsze „0" gdy brak pola — 1:1 z oryginałem. Blok 10a wziął `/kpi`, bo
w chwili budowy brakowało tras EAN; dziś są (10c).

**Rozstrzygnięcie 12.3:** wariant (a) „jak na produkcji” potwierdzony przez użytkownika 2026-09-22 —
odpowiedź Ani w `docs/pytania-do-ani-2026-09-18.md:361` nadal jest pusta i nie znalazła się nigdzie
indziej w repo.

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
Nagłówek `/analityka` (`NaglowekKpi.tsx`) pokazuje cztery kafle z produkcji — Dostawcy / EAN
wspólne / Pozycje unikalne / Snapshoty — liczone klientem z `filters`, `ean/comparison`,
`ean/unique` i `status`, czyli z tras, które widok i tak pobiera (współdzielony `queryKey`,
zero nowych zapytań). Semantyka pustych stanów 1:1 z oryginałem: „—” tylko dla „Dostawcy” bez
danych, „0” dla EAN-owych bez `rows` i dla „Snapshoty” zawsze (D3), `null` (wygasła sesja)
traktowany jak brak pola (D4). Liczby renderowane surowo, bez `toLocaleString` (D5). Kafle
liczą CAŁOŚĆ i nie reagują na pasek filtrów — to zgodne z oryginałem i zostaje jako odstępstwo
O-10a-2 (nieruszane tym ticketem). `GET /api/analytics/kpi` zostaje bez zmian w backendzie i
kontrakcie, ale traci konsumenta w UI (analogia #28 backlogu). Odstępstwo **O-10a-1 zamknięte**.
Wejście `wejscie-90.md` (P10.1) rozliczone: potwierdzało tylko spełnienie zależności PR.2 → P10.1
(dane pod kartami 4.1/4.2 ożywione); kafli KPI samych w sobie nie dotyczyło. Szczegóły:
`docs/tickets/97-FEATURE-kafle-kpi-analityki/`.

## Do koordynatora
- `docs/rebuild-roadmap.md:1424` i `:1632` (blok I10) nadal opisują O-10a-1 jako żywe odstępstwo —
  ticket 97 je zamknął. Poprawka wymaga edycji roadmapy, więc zostawiam koordynatorowi.
- `rebuild/frontend/src/pages/pulpit/KafelKpi.tsx:8` — komentarz mówi „Nagłówek analityki jest
  zresztą sam w sobie odstępstwem (O-10a-1)”, co jest już nieaktualne. Plik należy do karty P10.2
  (Pulpit), więc nie poprawiałem go w tym tickecie.
- `docs/pytania-do-ani-2026-09-18.md:361` — pole „ODPOWIEDŹ” dla pytania 12.3 nadal puste; wariant
  (a) przyjęty na podstawie decyzji użytkownika 2026-09-22, nie odpowiedzi Ani.
- Handlery MSW `/api/analytics/kpi` zostały nieużywane w
  `analityka.{ceny,dostawcy,ean,dostepnosc,eksport}.test.tsx` (nieszkodliwe, do sprzątnięcia;
  `eksport.test` leży w obszarze P10.3).
