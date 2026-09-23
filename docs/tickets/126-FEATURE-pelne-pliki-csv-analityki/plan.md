# 126-FEATURE-pelne-pliki-csv-analityki — pełne pliki CSV z Analityki (zdjęcie sufitu tylko dla eksportu)

> Status: Draft
> Branch: `feature/126-pelne-pliki-csv-analityki`
> Worktree: `.worktrees/126-FEATURE-pelne-pliki-csv-analityki`
> Karta: `docs/karty/P10.5/` · Backlog: `#96` (✅ TAK, decyzja Ani 2026-09-23)

## Opis ticketa

P10.5 — pełne pliki CSV z Analityki: zdjęcie sufitu tras dashboardu tylko dla eksportu (#96).

Decyzja Ani 2026-09-23: „chcę pełne pliki". Świadome odstępstwo — w produkcji eksport serwerowy miał
własne limity (`unique` bez limitu, `availability-*` 5000), a nasze pliki powstają z danych dashboardu
(P10.3, #91).

1. Plik CSV dostaje WSZYSTKIE wiersze po filtrach.
2. Tabela na ekranie BEZ ZMIAN — nadal 300 wierszy (`TabelaAnalityki.tsx`).
3. Kafel „Pozycje unikalne" BEZ ZMIAN — nadal 1000 (port 1:1 oryginału, karta PR.2).
4. Domyślne zachowanie tras (bez parametru) MUSI zostać 1:1.

## Kontekst

Od karty P10.3 (ticket 98, backlog #91) plik CSV powstaje **w przeglądarce** z tej samej tablicy wierszy,
którą karta podaje `TabelaAnalityki` — po filtrach globalnych i lokalnych, bez limitu 300. Plan P10.3
zakładał, że karty mają pełne listy. Nieprawda: trasy dashboardu niosą `LIMIT` z oryginału, więc sufit
SQL wchodzi do pliku niezauważony.

### Pomiar — sześć widoków ucina dziś, nie trzy

Zmierzone na `db/snapshot.db` (liczba wierszy PRZED `LIMIT`, `node` + `better-sqlite3`):

| Widok CSV | Trasa | Stała | Pre-limit | Strata |
|---|---|---|---|---|
| `unique` (2.5) | `ean/unique` | `LIMIT_UNIKALNYCH_EAN=1000` | 5109 | −4109 |
| `availability-products` (4.1) | `availability/products` | `LIMIT_DOSTEPNOSCI=500` | 5184 | −4684 |
| `sell-through` (4.2) | `availability/sell-through` | `LIMIT_TEMPA_SCHODZENIA=500` | 5184 | −4684 |
| `suppliers-lifecycle` (1.2) | `suppliers/lifecycle` | `LIMIT_CYKLU_ZYCIA=500` | 1716 | **−1216** |
| `prices-last` (3.1) | `prices/last-import` | `LIMIT_OSTATNIEGO_IMPORTU=500` | 1644 | **−1144** |
| `rotation-inactive` | `rotation/inactive` | `LIMIT_ROTACJI=1000` | 1100 (`days=60`) | **−100** |
| `ean-comparison` (2.1-2.4) | `ean/comparison` | `LIMIT_PORWNANIA_EAN=1000` | 769 | — (zapas 23%) |
| `margins` | `margins` | `LIMIT_GRUP_MARZY=1000` | 335 | — |
| `suppliers-stability`, `suppliers-stock` | — | brak `LIMIT` | ~9 | — (grupowane po dostawcy) |

**Trzy widoki pogrubione nie były wymienione ani w promptzie, ani w karcie P10.5, ani w backlogu #96** —
ale są w tej samej sytuacji, a `prices-last` traci 70% wierszy. Lista ośmiu kart z sufitem jest już
w `docs/instrukcja-testow-I10-v2.md:174-179` i to o nie wszystkie pytało Pytanie A do Ani; backlog #96
policzył tylko cztery z nich. Rozjazd zapisany w „Do koordynatora" karty.

⚠ **Podstawa pomiaru.** Prompt mówi o „bazie stagingu, kopii produkcji z 23.09". W repo jest wyłącznie
`db/snapshot.db` z **2026-08-13** i na niej liczone są wszystkie liczby wyżej. Liczby na świeższej kopii
będą inne (najpewniej wyższe); mechanizm i wnioski się nie zmieniają.

### Stan kodu

- `eksport.tsx` — `PrzyciskCsv<T>({widok, wiersze, kolumny, wczytywanie})`, `onClick` SYNCHRONICZNY:
  `pobierzPlik(nazwa, zbudujCsvTabeli(wiersze, kolumny))`. `wiersze` = ta sama tablica co tabeli.
- `api.ts` — 27 hooków `useQuery`, konwencja `queryKey.join("/") === URL` (`lib/queryClient.ts`),
  `staleTime: Infinity`, `on401: returnNull` (dane mogą być `null`).
- `repos/analityka.ts` — każdy limit to nazwana stała tuż nad funkcją; `listaWartosci` (`:63-72`) ma
  już idiom „limit opcjonalny": `${limit === null ? sql`` : sql`LIMIT ${limit}`}`.
- `routes/analytics.ts` — zero zod; parametry parsowane nazwanymi funkcjami (`zacisnijDniRotacji`,
  `zacisnijGrupeRynku`), testowalnymi bez serwera.
- **Żaden test nie broni dziś liczbowych wartości `LIMIT_*`.** Frontendowy test „350 wierszy → tabela
  300, plik 350" jedzie na mockach MSW, więc o realnym suficie SQL nie mówi nic.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Ścieżki `contract/openapi.yaml`** (8, wszystkie `GET`): `/api/analytics/ean/unique`,
`/api/analytics/ean/comparison`, `/api/analytics/availability/products`,
`/api/analytics/availability/sell-through`, `/api/analytics/suppliers/lifecycle`,
`/api/analytics/prices/last-import`, `/api/analytics/rotation/inactive`, `/api/analytics/margins`.

**Fixtures:** odpowiadające `contract/fixtures/GET_analytics_*.json` — nagrane BEZ query params.

**Jak to spełniamy:** żądanie **bez** `?limit` musi dać odpowiedź bajt w bajt taką jak dziś — kształt
i liczbę wierszy. Nowy parametr jest czysto opt-in, więc fixtures i GATE (`analityka.*.gate.test.ts`,
`sprawdzZgodnoscZKontraktem` / `sprawdzZgodnoscZFixture`) zostają bez zmian i muszą przejść.
`openapi.yaml` dostaje **wyłącznie** deklarację nowego, opcjonalnego parametru `limit` na tych ośmiu
ścieżkach — żadnych zmian w schematach odpowiedzi.

**Znany rozjazd (pre-existing, poza zakresem):** kontrakt nie deklaruje `parameters:` dla ŻADNEJ trasy
`/api/analytics/*`, w tym istniejących `?days`, `?ean`, `?kod`, `?group`, `?minDiffPct`. Dokładamy tylko
`limit`; reszta luki idzie do „Do koordynatora", nie naprawiamy jej przy okazji.

**Świadome odstępstwo od oryginału (zatwierdzone):** produkcja dla tych widoków nie ma pełnych plików
z filtrami — miała serwerowy `export/:view` z własnymi limitami (`unique` bez limitu, `availability-*`
5000) i bez znajomości filtrów. To odstępstwo jest decyzją Ani (#96 ✅) i domyka lukę z #91.

## Decyzje

Wszystkie cztery z Q&A 2026-09-23, zgodnie z rekomendacją:

- **D1 — zakres: wszystkie 8 widoków z sufitem**, nie 3 z promptu i nie 6 dziś ucinanych. Jednolita
  reguła „widok z `LIMIT` → eksport pobiera bez limitu" jest odporna na wzrost danych; `ean-comparison`
  (769/1000) i `margins` (335/1000) mieszczą się dziś w suficie, ale urosną. *Za:* jeden mechanizm,
  zero kolejnych ticketów, zgodne z Pytaniem A, które wymieniało wszystkie karty z sufitem.
  *Przeciw:* większy PR niż wariant minimalny.
- **D2 — parametr `?limit=0`** (rekomendacja koordynatora). `0` znaczy „bez klauzuli `LIMIT`",
  **nie** SQL-owe `LIMIT 0` (zero wierszy) — mapowanie siedzi w jednej funkcji parsującej.
  Wartości inne niż `0` (brak, `5`, `abc`) → trasa używa swojego oryginalnego limitu. *Za:* najmniejsza
  możliwa powierzchnia, domyślne zachowanie trywialnie 1:1, droga do przyszłego `limit=N` otwarta.
  *Przeciw:* `limit=250` jest cicho ignorowane — dlatego opisujemy to wprost w `openapi.yaml`.
- **D3 — pobranie LENIWE, dopiero po kliknięciu CSV.** Wejście na zakładkę nie ciągnie pełnych
  zbiorów (~825 KB na karcie 4.1) dla każdego, kto CSV nigdy nie kliknie. Filtry klienckie stosowane
  ponownie na pełnym zbiorze, więc plik nadal = „to, co widzę". *Koszt:* przycisk staje się
  asynchroniczny.
- **D4 — `disabled` + spinner na czas pobierania.** Serwer odpowiada <100 ms, ale transfer i parsowanie
  ~825 KB na wolnym łączu bywa odczuwalne; bez sygnału user kliknie drugi raz.
- **D5 (moja, w ramach D3/D4) — błąd pobrania NIE daje pliku.** Zamiast po cichu zapisać uciętą
  tablicę z pamięci (czyli odtworzyć #96 niewidocznie) pokazujemy `toast` z błędem i nie pobieramy nic.
  `on401: returnNull` znaczy, że wygasła sesja daje `null` — traktujemy to jak błąd, nie jak pusty plik.

## Plan implementacji

### Krok 1 — backend: parsowanie parametru (`repos/analityka.ts`)

Nowa funkcja obok `zacisnijDniRotacji`, w tym samym stylu (nazwana, testowalna bez serwera):

```ts
export function czyBezLimitu(surowe: unknown): boolean
```

Zwraca `true` **wyłącznie** dla `"0"`. Komentarz tłumaczy, dlaczego `0` nie idzie do SQL-a.

### Krok 2 — backend: opcjonalne zdjęcie limitu w ośmiu funkcjach repo

Każda dostaje dodatkowy, **ostatni** parametr `bezLimitu = false` i używa idiomu z `listaWartosci`:
`${bezLimitu ? sql`` : sql`LIMIT ${STAŁA}`}`. Stała zostaje na miejscu i jest nadal domyślna —
dzięki temu „bez parametru = 1:1" jest własnością sygnatury, nie dyscypliny wywołującego.

| Funkcja | Linia | Stała |
|---|---|---|
| `unikalneEan` | `:877` | `LIMIT_UNIKALNYCH_EAN` |
| `porownanieEan` | `:752` | `LIMIT_PORWNANIA_EAN` |
| `cyklZyciaDostawcow` | `:1150` | `LIMIT_CYKLU_ZYCIA` |
| `zmianyCenOstatniegoImportu` | `:488` | `LIMIT_OSTATNIEGO_IMPORTU` |
| `dostepnoscProduktow` | `:1382` | `LIMIT_DOSTEPNOSCI` |
| `tempoSchodzenia` | `:1452` | `LIMIT_TEMPA_SCHODZENIA` |
| `rotacjaNieaktywnych` | `:1645` | `LIMIT_ROTACJI` |
| `marze` | `:232` | `LIMIT_GRUP_MARZY` **tylko dla `rows`** |

⚠ `marze` zwraca `rows` + `low` + `high`. CSV bierze wyłącznie `rows` (grupy — decyzja P10.3), więc
`LIMIT_LISTY_MARZY=200` dla `low`/`high` **zostaje nietknięty**.

⚠ `porownanieEan` i `rotacjaNieaktywnych` mają już parametr — nowy idzie po nim, nie zamiast.

### Krok 3 — backend: trasy (`routes/analytics.ts`)

Osiem tras przekazuje `czyBezLimitu(req.query.limit)` jako ostatni argument. `rotation/inactive`
zachowuje `zacisnijDniRotacji(req.query.days)` — obsługuje oba parametry naraz.

### Krok 4 — kontrakt (`contract/openapi.yaml`)

Do ośmiu ścieżek dochodzi identyczny blok, z opisem semantyki `0`:

```yaml
      parameters:
        - { name: limit, in: query, required: false, schema: { type: integer, enum: [0] },
            description: "0 = bez limitu (eksport CSV, karta P10.5). Brak parametru lub inna wartość = limit trasy (1:1 z oryginałem)." }
```

### Krok 5 — frontend: pobranie bez limitu (`api.ts`)

Jedna generyczna funkcja obok hooków, oparta o `queryClient.fetchQuery` (leniwa, korzysta z domyślnego
`queryFn`, więc dziedziczy `on401: returnNull` i cache — drugie kliknięcie jest natychmiastowe):

```ts
export async function pobierzBezLimitu<T>(adres: string): Promise<T | null>
```

Skleja `?limit=0` albo `&limit=0`, zależnie od tego, czy adres ma już query string (potrzebne dla
`rotation/inactive?days=…`). Klucz zapytania = cały adres w jednym segmencie — konwencja
`useRotacjeNieaktywnych`.

### Krok 6 — frontend: asynchroniczny przycisk (`eksport.tsx`)

`PrzyciskCsv` dostaje opcjonalny prop:

```ts
pobierzPelne?: () => Promise<readonly T[] | null>;
```

- **brak propu** → dzisiejsza ścieżka synchroniczna (`suppliers-stability`, `suppliers-stock` — trasy
  bez `LIMIT`, nie ma czego zdejmować);
- **prop jest** → `onClick` ustawia `pobieranie`, `await`, buduje CSV z tego, co wróciło;
  `null`/wyjątek → `toast` z błędem i **żadnego pliku**;
- przycisk `disabled` gdy `wczytywanie || pobieranie`, w trakcie pobierania spinner
  (`Loader2` + `animate-spin`, wzorzec z reszty panelu).

Sekcja zwraca wiersze **już przefiltrowane** — filtrowanie zostaje w sekcji, `eksport.tsx` pozostaje
generyczny.

### Krok 7 — frontend: osiem sekcji

W każdej powstaje lokalny helper stosujący filtry, używany **i** dla tabeli, **i** dla eksportu —
żeby nie rozjechały się dwie kopie reguły:

```ts
const przygotuj = (surowe: X[] | undefined) => zastosujFiltry(surowe ?? [], filtry);
const wiersze = przygotuj(dane?.rows);
// …
pobierzPelne={async () => przygotuj((await pobierzBezLimitu<{rows: X[]}>(ADRES))?.rows)}
```

Pliki: `SekcjaEan.tsx` (2 przyciski: `unique`, `ean-comparison`), `SekcjaDostepnosciProduktow.tsx`,
`SekcjaTempaSchodzenia.tsx`, `SekcjaCyklZyciaDostawcow.tsx`, `SekcjaCeny.tsx`, `SekcjaRotacji.tsx`
(dokłada aktualne `dni` do adresu), `SekcjaMarze.tsx`.

## Strategia testów

**Backend — `rebuild/backend/test/`:**
- jednostkowo `czyBezLimitu`: `"0"` → `true`; `undefined`, `""`, `"1"`, `"500"`, `"abc"`, `"00"` → `false`.
- integracyjnie, na bazie tymczasowej zasilonej **ponad sufit** (np. 1200 wierszy tam, gdzie limit to
  1000, i 700 tam, gdzie 500) — dla każdej z ośmiu tras: **bez parametru = dokładnie `LIMIT` wierszy**,
  **z `?limit=0` = wszystkie**. To jest test, którego dziś nie ma (researcher: żaden test nie broni
  liczbowych `LIMIT_*`) — broni jednocześnie nowej funkcji i wierności 1:1 domyślnej trasy.
- `rotation/inactive`: `?days=X&limit=0` — oba parametry naraz.
- `margins`: `?limit=0` zdejmuje sufit `rows`, a `low`/`high` nadal mają najwyżej 200.
- **GATE** bez zmian: `analityka.*.gate.test.ts` wołają trasy bez parametrów i muszą przejść
  na niezmienionych fixtures.

**Frontend — `rebuild/frontend/test/`:**
- `analityka.eksport.test.tsx` rozszerzony: MSW oddaje 1000 wierszy bez parametru i 5109 dla `limit=0`;
  klik CSV → plik ma 5109 wierszy danych, a **tabela nadal rysuje 300**.
- filtr globalny + `limit=0` → plik ma pełny zbiór PO filtrze (nie pełny zbiór bez filtra).
- `rotation-inactive`: zmiana „Bez ruchu dni" → adres eksportu niesie oba parametry.
- błąd trasy / `null` → brak pliku, `toast` (asercja: `pobierzPlik` nie wołane).
- dwa widoki bez sufitu nadal nie robią drugiego zapytania.
- kafel „Pozycje unikalne" nadal 1000 — istniejące testy PR.2 bez zmian.

**Bramki:** `lint`, `typecheck`, `build`, `test` w `rebuild/backend/` i `rebuild/frontend/` (Node ≥ 20).

## Poza zakresem

- Serwerowy `GET /api/analytics/export/{view}` i `repos/analityka-eksport.ts` — **nie ruszamy**
  (przywrócenie go odebrałoby plikowi filtry, czyli cofnęło sens #91).
- Limit 300 rysowania tabeli (`TabelaAnalityki.tsx`) i kafel KPI „Pozycje unikalne" (1000).
- `LIMIT_LISTY_MARZY` (200) dla `low`/`high`, `LIMIT_CYKLU_ZYCIA_MODELI`, `LIMIT_OSI_IMPORTOW`,
  `LIMIT_TOP_ZMIAN`, `LIMIT_INFLACJI`, `LIMIT_GRUP_RYNKU`, `LIMIT_PORWNANIA_EAN_LEGACY` — widoki bez
  przycisku CSV albo bloki poza zakresem karty.
- Paginacja (`limit=N`) — nie jest potrzebna, `enum: [0]` zostawia na nią miejsce.
- Uzupełnienie kontraktu o istniejące, nieudokumentowane `?days`/`?ean`/`?kod`/`?group`/`?minDiffPct`.
- Pulpit, kafle KPI, staging, Selly, parsery.
- `docs/rebuild-roadmap.md` — karta w roadmapie nie pisze nic (CLAUDE.md, reguła 0).

## Definition of done

- [ ] Plik CSV z każdego z ośmiu widoków z sufitem ma wszystkie wiersze po filtrach.
- [ ] Trasa bez `?limit` oddaje dokładnie to samo co przed ticketem (test na zbiorze ponad sufitem).
- [ ] Tabela nadal rysuje najwyżej 300 wierszy.
- [ ] Kafel „Pozycje unikalne" nadal liczy 1000.
- [ ] `?limit=0` nie oznacza SQL-owego `LIMIT 0` (zero wierszy) w żadnej z ośmiu tras.
- [ ] `rotation/inactive` obsługuje `?days` i `?limit=0` jednocześnie.
- [ ] Błąd pobrania → brak pliku + `toast`, nigdy cicho ucięty plik.
- [ ] Osiem ścieżek `openapi.yaml` deklaruje opcjonalny `limit`; schematy odpowiedzi bez zmian.
- [ ] GATE fixtures/kontrakt przechodzi bez zmian w plikach `contract/fixtures/`.
- [ ] Bramki lint/typecheck/build/test zielone w obu pakietach.
- [ ] Pomiar „przed → po" dla każdego dotkniętego widoku w `raport.md`.
- [ ] `docs/karty/P10.5/karta.md` — Stan ✅, Dowiezione, „Do koordynatora" (6 widoków zamiast 3).
- [ ] `docs/karty/I15.9/wejscie-126.md` — Ania ma wiedzieć, że pliki są pełne.
- [ ] Backlog #96 → Status ✅.
