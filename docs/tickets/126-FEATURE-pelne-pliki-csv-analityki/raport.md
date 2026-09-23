# 126-FEATURE-pelne-pliki-csv-analityki — raport z wdrożenia

## Podsumowanie

Plik CSV z Analityki dostaje teraz WSZYSTKIE wiersze po filtrach — sufit `LIMIT` tras dashboardu
zdjęty wyłącznie dla eksportu, opcjonalnym parametrem `?limit=0`. Tabela nadal rysuje 300 wierszy,
kafel „Pozycje unikalne" nadal liczy 1000, a trasa bez parametru odpowiada dokładnie tak jak przed
ticketem. Zakres objął **osiem** widoków z sufitem, nie trzy z promptu: pomiar pokazał, że ucina
dziś sześć, a dwa kolejne mają sufit i zapas.

## Zmiany

**Backend**
- `rebuild/backend/src/repos/analityka.ts` — nowa `czyBezLimitu()` (tylko `"0"` zdejmuje limit,
  mapowane na BRAK klauzuli `LIMIT`, nigdy na SQL-owe `LIMIT 0`); osiem funkcji repo dostało ostatni
  parametr `bezLimitu = false` z idiomem `${bezLimitu ? sql`` : sql`LIMIT ${STAŁA}`}` (wzorzec
  `listaWartosci`). Stałe `LIMIT_*` zostały na miejscu i są nadal domyślne.
- `rebuild/backend/src/routes/analytics.ts` — osiem tras czyta `czyBezLimitu(req.query.limit)`;
  sześć handlerów zmieniło `_req` → `req`; zaktualizowany komentarz nagłówkowy o tym, które trasy
  czytają `req.query`.
- `contract/openapi.yaml` — osiem ścieżek deklaruje opcjonalny `limit` (`enum: [0]`) z opisem
  semantyki. Schematy odpowiedzi bez zmian.

**Frontend**
- `rebuild/frontend/src/pages/analityka/api.ts` — **nowe** `zAdresemBezLimitu()` i
  `pobierzPelneWiersze()`: leniwe `queryClient.fetchQuery` z `?limit=0`, dziedziczy domyślny
  `queryFn` (nagłówki, `credentials`, `on401: "returnNull"`) i wspólny cache. `null` = błąd.
- `rebuild/frontend/src/pages/analityka/eksport.tsx` — `PrzyciskCsv` dostał opcjonalny
  `pobierzPelne`; ścieżka asynchroniczna ze spinnerem (`LoaderCircle`), `disabled` na czas
  pobierania, `toast` przy błędzie i **brak pliku**. Bez propu przycisk działa synchronicznie
  jak przed ticketem.
- Siedem sekcji podpiętych (osiem przycisków): `SekcjaEan.tsx` (`unique`, `ean-comparison`),
  `SekcjaDostepnosciProduktow.tsx`, `SekcjaTempaSchodzenia.tsx`, `SekcjaCyklZyciaDostawcow.tsx`,
  `SekcjaCeny.tsx`, `SekcjaMarze.tsx`, `SekcjaRotacji.tsx` (jedyna z dwoma parametrami:
  `?days` + `?limit=0`).

**Testy**
- **Nowy** `rebuild/backend/test/analityka.limity.test.ts` — 36 przypadków.
- **Nowy** `rebuild/frontend/test/analityka.eksport-pelne.test.tsx` — 7 przypadków.

## Pomiar — liczba wierszy w pliku przed i po

Zmierzone na kopii `db/snapshot.db`, przez skompilowane repo (`dist/repos/analityka.js`):

| Widok | Sufit | Plik PRZED | Plik PO | Zysk | Czas zapytania bez limitu | JSON |
|---|---:|---:|---:|---:|---:|---:|
| `unique` — 2.5 Pozycje unikalne | 1000 | 1000 | **5109** | +4109 | 31 ms | 597 KB |
| `availability-products` — 4.1 Historia dostępności | 500 | 500 | **5184** | +4684 | 47 ms | 825 KB |
| `sell-through` — 4.2 Tempo schodzenia | 500 | 500 | **5184** | +4684 | 77 ms | 513 KB |
| `suppliers-lifecycle` — 1.2 Nowości i wycofania | 500 | 500 | **1716** | +1216 | 5 ms | 307 KB |
| `prices-last` — 3.1 Zmiany cen | 500 | 500 | **1644** | +1144 | 8 ms | 292 KB |
| `rotation-inactive` — Rotacja (`days=60`) | 1000 | 1000 | **1100** | +100 | 7 ms | 225 KB |
| `ean-comparison` — 2.1-2.4 EAN wspólne | 1000 | 769 | 769 | — | 16 ms | 139 KB |
| `margins` — Marża (grupy) | 1000 | 335 | 335 | — | 12 ms | 37 KB |

**Czas NIE jest odczuwalny.** Najcięższe zapytanie bez limitu to 77 ms, największa odpowiedź
825 KB. Do tego pobranie jest leniwe (dopiero po kliknięciu CSV) i trafia do wspólnego cache
(`staleTime: Infinity`), więc drugie kliknięcie tego samego widoku jest natychmiastowe.

⚠ **Podstawa pomiaru.** Prompt mówił o „bazie stagingu, kopii produkcji z 23.09". W repo jest
wyłącznie `db/snapshot.db` z **2026-08-13** i na niej liczone są wszystkie liczby wyżej. Na
świeższej kopii liczby będą inne (najpewniej wyższe); mechanizm i wnioski bez zmian.

## Odstępstwa od planu

**Jedno, rozszerzające zakres w ramach decyzji D1.** Plan wymieniał osiem widoków z sufitem na
podstawie `docs/instrukcja-testow-I10-v2.md`. Po pomiarze okazało się, że lista jest trafna, ale
backlog #96 i karta P10.5 liczą tylko cztery z nich. Zakres = osiem, zgodnie z D1.

Poza tym 1:1 z planem. Dwa doprecyzowania w trakcie:
- `czyBezLimitu(0)` (liczba, nie napis) też zdejmuje limit — `String(0) === "0"`. Z HTTP przyjdzie
  napis, więc to nie zmienia zachowania trasy; udokumentowane testem.
- `products.data_aktualizacji` jest `NOT NULL` w schemacie odbudowy, więc testy rotacji robią
  „bez ruchu" datą sprzed lat, nie `NULL`-em.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt):** ✓ zgodne. Osiem ścieżek z sekcji „Kontrakt i fixtures"
  (`/api/analytics/{ean/unique, ean/comparison, availability/products, availability/sell-through,
  suppliers/lifecycle, prices/last-import, rotation/inactive, margins}`) — GATE (`analityka.gate`,
  `analityka.ean.gate`, `analityka.ceny.gate`, `analityka.dostawcy.gate`, `analityka.dostepnosc.gate`,
  `analityka.eksport.gate`) woła je BEZ parametru i przechodzi na **nietkniętych** plikach
  `contract/fixtures/GET_analytics_*.json`. Żaden fixture nie był zmieniany. `openapi.yaml` parsuje
  się poprawnie (sprawdzone `js-yaml`), zmiana dotyczy wyłącznie `parameters`.
- **Backend:** ✓ 1668 passed, 3 skipped (101 plików). Nowy `analityka.limity.test.ts` — 36/36.
- **Frontend:** ✓ 945 passed (55 plików). Nowy `analityka.eksport-pelne.test.tsx` — 7/7.
- **Bramki:** `lint` ✓, `typecheck` ✓, `build` ✓ w obu pakietach (Node 20.20.2).

Co dowodzą nowe testy:
- **backend** — dla każdej z ośmiu tras, na zbiorze PONAD sufitem: bez parametru dokładnie `LIMIT`
  wierszy, z `?limit=0` wszystkie, i `0` nie znaczy `LIMIT 0`. Plus: `margins` nie rusza `low`/`high`
  (200), `rotation/inactive` łączy `?days` z `?limit=0`, obie gałęzie `availability/products`;
- **frontend** — handlery MSW **rozróżniają** `?limit=0` (istniejący test tego nie łapał, bo MSW
  dopasowuje po ścieżce i ignoruje query string): plik 1200 wierszy przy tabeli 300 i kaflu 400,
  filtr zawęża PEŁNY zbiór (600, nie 200), pobranie dopiero po kliknięciu, Rotacja z dwoma
  parametrami, 500 i 401 → komunikat i **zero plików**, karta bez sufitu bez drugiego zapytania.

## Zmiany łamiące zgodność

Brak. Nowy parametr jest opt-in; bez niego wszystkie osiem tras odpowiada identycznie jak przed
ticketem, co pilnują nowe testy i niezmienione fixtures.

## Follow-up

- **Kontrakt nie opisuje istniejących parametrów analityki.** `contract/openapi.yaml` nie deklaruje
  `parameters:` dla `?days`, `?ean`, `?kod`, `?group`, `?minDiffPct` — luka sprzed tego ticketu.
  Dołożyliśmy tylko `limit`; reszta zostaje do osobnej decyzji (zapisane w „Do koordynatora").
- **`lifecycle/models` ucina 1691 → 1000**, ale ta karta NIE MA przycisku CSV (nie ma jej
  w `WidokEksportu`), więc sufit nie wchodzi do żadnego pliku. Poza zakresem #96.
- **Serwerowy `GET /api/analytics/export/{view}`** nadal nie ma konsumenta we froncie
  (`repos/analityka-eksport.ts`, `LIMIT_EKSPORTU = 5000` na 6/10 widoków). Świadomie nietknięty.
