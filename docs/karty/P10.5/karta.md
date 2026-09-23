# P10.5 — pełne pliki CSV z Analityki (bez sufitu tras dashboardu)

> **Stan:** ✅ 2026-09-23 · 126-FEATURE-pelne-pliki-csv-analityki
> **Iteracja:** 10 — Analityka i Pulpit (karta dołożona po zamknięciu iteracji) · **Wpisy backlogu:** #96 · **Zależy od:** P10.3 (✅ 2026-09-22)
> **Ticket:** `126-FEATURE-pelne-pliki-csv-analityki`

Założona przez koordynatora ticketem `124-DOCS-decyzje-ani-96-97-108`, 2026-09-23, po odpowiedzi Ani.

## Zakres
Po karcie P10.3 plik CSV powstaje w przeglądarce z wierszy tabeli — a te przychodzą z tras dashboardu, które mają
limity SQL z oryginału. Zmierzone na `db/snapshot.db` (2026-08-13): **osiem** widoków mają sufit, nie trzy —
lista była już w `docs/instrukcja-testow-I10-v2.md:174-179`. Sześć realnie ucina dziś: „Pozycje unikalne” 5109 →
1000, „Dostępności” 4.1/4.2 5184 → 500, „Nowości i wycofania” 1.2 1716 → 500, „Zmiany cen” 3.1 1644 → 500,
Rotacja 1100 → 1000; dwa mieszczą się w suficie z zapasem („EAN wspólne” 769/1000, Marża 335/1000).

**Decyzja Ani 2026-09-23: „chcę pełne pliki”.** Zakres:
- **sufit zdejmujemy TYLKO dla pliku** — przy eksporcie osobne zapytanie bez limitu (albo inny mechanizm,
  uzasadniony w planie);
- **tabela na ekranie zostaje przy 300 wierszach** (`TabelaAnalityki.tsx`, limit rysowania z oryginału);
- **kafel „Pozycje unikalne” nadal liczy 1000** (port 1:1 oryginału, PR.2) — nie ruszamy;
- pomiar do raportu: liczba wierszy w pliku przed i po zmianie dla każdego z ośmiu widoków z sufitem (nie trzech).

⚠ Świadome odstępstwo od produkcji (tam eksport serwerowy miał własne limity: `unique` bez limitu,
`availability-*` 5000). Opisz je w karcie i zapisz wejście dla P10.4/I15.9 — Ania ma wiedzieć, że pliki są pełne.

## Pliki (wyłączna własność)
`rebuild/frontend/src/pages/analityka/**` (ścieżka eksportu) oraz, jeśli potrzebne, trasy/repozytoria analityki
w `rebuild/backend/src` dla zapytania bez limitu. NIE: Pulpit, kafle KPI, staging, Selly.

## Decyzje
Ania 2026-09-23 (#96): pełne pliki. Kafel i tabela bez zmian.

## Dowiezione
- Mechanizm: opcjonalny parametr `?limit=0` na ośmiu trasach dashboardu analityki — tylko dosłowne `"0"` zdejmuje
  klauzulę `LIMIT` (mapowane na **brak klauzuli**, nigdy na SQL-owe `LIMIT 0`). Osiem funkcji repo
  (`rebuild/backend/src/repos/analityka.ts`) dostało ostatni parametr `bezLimitu = false`; stałe `LIMIT_*` zostają
  na miejscu i są nadal domyślne — „bez parametru = 1:1” jest własnością sygnatury.
- Osiem ścieżek `contract/openapi.yaml` deklaruje `limit` z `enum: [0]`; schematy odpowiedzi bez zmian; fixtures
  nietknięte, GATE zielony.
- Front dociąga pełny zbiór **leniwie** (dopiero po kliknięciu CSV, `pobierzPelneWiersze` w `api.ts`) i stosuje na
  nim **te same filtry**, które buduje tabelę — jeden helper na sekcję, bez rozjazdu reguł.

⚠ **Zakres wyszedł na OSIEM widoków z sufitem, nie trzy z pierwotnego opisu karty.** Pomiar na `db/snapshot.db`
(2026-08-13, `raport.md` sekcja „Pomiar”):

| Widok | Sufit | Plik PRZED | Plik PO |
|---|---:|---:|---:|
| `unique` — 2.5 Pozycje unikalne | 1000 | 1000 | **5109** |
| `availability-products` — 4.1 Dostępność | 500 | 500 | **5184** |
| `sell-through` — 4.2 Tempo schodzenia | 500 | 500 | **5184** |
| `suppliers-lifecycle` — 1.2 Nowości i wycofania | 500 | 500 | **1716** |
| `prices-last` — 3.1 Zmiany cen | 500 | 500 | **1644** |
| `rotation-inactive` — Rotacja (`days=60`) | 1000 | 1000 | **1100** |
| `ean-comparison` — 2.1-2.4 EAN wspólne | 1000 | 769 | 769 (zapas) |
| `margins` — Marża (grupy) | 1000 | 335 | 335 (zapas) |

`suppliers-lifecycle` i `prices-last` nie były wymienione ani w tej karcie, ani w backlogu #96 — `prices-last`
tracił 70% wierszy.

- Świadome odstępstwo (zatwierdzone, Ania #96): błąd pobrania pełnego pliku **nie daje pliku** — `toast` zamiast
  cichego zapisu uciętej tablicy z pamięci (cichy ucięty plik byłby tą samą usterką co #96).
- Nietknięte: tabela na ekranie nadal 300 wierszy, kafel „Pozycje unikalne” nadal 1000, serwerowy
  `GET /api/analytics/export/{view}`, `LIMIT_LISTY_MARZY` (200, `low`/`high` w `margins`).
- Testy: backend `analityka.limity.test.ts` 36/36 (nowy — zasila bazę PONAD sufit, czego GATE nigdy nie robił),
  frontend `analityka.eksport-pelne.test.tsx` 8/8 (nowy — handlery MSW rozróżniają `?limit=0`, czego
  istniejący test eksportu nie robił); bramki zielone (backend 1668 passed, frontend 946 passed); GATE
  na niezmienionych fixtures. Szczegóły: `docs/tickets/126-FEATURE-pelne-pliki-csv-analityki/`.

## Do koordynatora
1. **Rozjazd zakresu (fakt, zmierzony).** Ta karta i backlog #96 mówiły o „trzech dotkniętych widokach” — realnie
   sufit ucina **sześć** z ośmiu widoków z limitem. Pełna lista z liczbami: `raport.md` tego ticketu, sekcja
   „Pomiar”. Lista wszystkich ośmiu kart z sufitem była już poprawnie zapisana w
   `docs/instrukcja-testow-I10-v2.md:174-179` — backlog #96 policzył tylko cztery z nich. Decyzja Ani 2026-09-23:
   objąć wszystkie osiem, jednym mechanizmem (`?limit=0`).
2. **Luka w kontrakcie (poza zakresem tego ticketu).** `contract/openapi.yaml` nie deklaruje `parameters:` dla
   ŻADNEGO z istniejących parametrów analityki (`?days`, `?ean`, `?kod`, `?group`, `?minDiffPct`) — ten ticket
   dołożył wyłącznie `limit`. Do osobnej decyzji.
3. **`lifecycle/models` ucina 1691 → 1000**, ale ta karta NIE MA przycisku CSV (nie ma jej w `WidokEksportu`), więc
   sufit nie wchodzi do żadnego pliku. Poza zakresem #96 — do ewentualnego wpisu w backlogu.
