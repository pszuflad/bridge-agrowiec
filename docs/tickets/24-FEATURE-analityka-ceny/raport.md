# 24-FEATURE-analityka-ceny — raport z wdrożenia

## Podsumowanie

Blok 10b Iteracji 10 dowieziony: pięć tras `/api/analytics/*` za `requireAuth` z agregatami
przepisanymi dosłownie z `mirror/backend/analytics_module.cjs`, oraz wypełniona zakładka
`ceny` („Ceny w czasie") z trzema kartami oryginału. Dwie trasy — `top-zmiany`
i `market/group-prices` — dostały backend **bez UI**, bo oryginał ich nie renderuje
(decyzje D1/D2). GATE zielony za pierwszym uruchomieniem; agregaty sprawdzone dodatkowo
na snapshocie produkcji i **odtwarzają wartości z nagrań**, nie tylko ich kształt.

## Zmiany

**Backend**

- `rebuild/backend/src/repos/analityka.ts` — sekcja „BLOK 10b · CENY": `czyJestHistoria`
  (port `hasHistory`, `:58`), `cenyGrupRynku`, `zmianyCenOstatniegoImportu`, `topZmiany`,
  `historiaCenProduktu`, `statystykiCen` (port `stats` z `:259-260`), `inflacjaCennika`;
  whitelista `GRUPY_RYNKU`/`KOLUMNY_GRUP_RYNKU` + `zacisnijGrupeRynku`; cztery nazwane
  limity (500/500/500/100).
- `rebuild/backend/src/routes/analytics.ts` — pięć `router.get(…, requireAuth, …)`
  w kolejności rejestracji z oryginału.

**Frontend**

- **Nowy:** `rebuild/frontend/src/pages/analityka/SekcjaCeny.tsx` — trzy karty
  (`3.1`, `3.2 / 3.3`, `3.6`) z kolumnami 1:1, wykres liniowy nad tabelą inflacji.
- **Nowy:** `rebuild/frontend/src/pages/analityka/useOpoznionaWartosc.ts` — debounce 300 ms.
- `rebuild/frontend/src/pages/analityka/api.ts` — pięć typów z fixtures + trzy hooki,
  w tym `useHistoriaCenyProduktu` z własnym `queryFn`.
- `rebuild/frontend/src/pages/analityka/filtrowanie.ts` — `WYMIARY_CEN`,
  `zastosujFiltrDostawcow` (generyczny).
- `rebuild/frontend/src/pages/Analityka.tsx` — `ZakladkaWPrzygotowaniu blok="10b"` → `SekcjaCeny`.
- `rebuild/frontend/src/pages/analityka/README.md` — sprostowany §2.2, nowy §2.2a
  (debounce), rozszerzone reguły wykresu, nowy §5 z dorobkiem 10b.

**Testy**

- **Nowy:** `rebuild/backend/test/analityka.ceny.gate.test.ts` — 12 przypadków.
- **Nowy:** `rebuild/backend/test/analityka.ceny.agregaty.test.ts` — 23 przypadki.
- **Nowy:** `rebuild/frontend/test/analityka.ceny.test.tsx` — 19 przypadków.
- `rebuild/backend/test/gate/dane.ts` — `zasiejHistorieCenDlaCen` (nowy zasiew, istniejący
  `zasiejHistorieCen` nietknięty).
- `rebuild/frontend/test/msw/kontrakt.ts` — trzy loadery zdejmujące klucze na `_`.

## Odstępstwa od planu

Dwa doprecyzowania względem planu, oba wynikły z kodu i żadne nie zmienia zakresu:

1. **Hook debounce nazywa się `useOpoznionaWartosc`, nie `uzyjOpoznionejWartosci`.**
   Reguła `react-hooks/rules-of-hooks` wymaga prefiksu `use`; reszta projektu ma tę samą
   konwencję (`useFiltry`, `useMarze`).
2. **Wykres inflacji ma próg `MIN_MIESIECY_NA_WYKRESIE = 2`.** Plan nie przewidywał, że
   szereg może mieć jeden punkt w czasie — a nagranie właśnie tak wygląda (pięciu dostawców,
   wszyscy w `2026-08`). Linia przez jeden punkt to anty-wzorzec, więc karta pokazuje wtedy
   samą tabelę. Gałąź wykresu testujemy na danych z drugim miesiącem dobudowanym z kształtu
   nagrania — ograniczenie opisane w komentarzu testu.

## Wyniki testów

**Gate odbudowy (fixtures/kontrakt): ✓ zgodne.** Pięć ścieżek, każda × (kontrakt + fixture)
+ 401 bez tokenu; zielony za pierwszym uruchomieniem, zero `WyjatekGate`.

| Ścieżka | Fixture | Wynik |
|---|---|---|
| `GET /api/analytics/market/group-prices` | `GET_analytics_market_group-prices.json` | ✓ |
| `GET /api/analytics/prices/last-import` | `GET_analytics_prices_last-import.json` | ✓ |
| `GET /api/analytics/prices/product-history` | `GET_analytics_prices_product-history.json` | ✓ |
| `GET /api/analytics/prices/inflation` | `GET_analytics_prices_inflation.json` | ✓ |
| `GET /api/analytics/top-zmiany` | `GET_analytics_top-zmiany.json` | ✓ |

Do gate'a dołożone dwie asercje, których harness sam nie robi: **odpowiedź musi być
niepusta** (`gate/ksztalt.ts` nie zagląda do elementów pustej tablicy po ŻADNEJ ze stron,
więc pusta odpowiedź przeszłaby bez dowodu) oraz **brak kluczy na `_`** w odpowiedzi.

**Weryfikacja na snapshocie produkcji** (`db/snapshot.db`, 7405 produktów, 3362 pozycje
stagingu, 14 513 wpisów historii) — nie tylko kształt, ale i wartości:

| Trasa | Wiersze | `_przyciete` w fixture | Zgodność wartości |
|---|---|---|---|
| `market/group-prices` | 92 | 92 | pierwszy wiersz `BKT / 945 ofert` — jak w nagraniu |
| `prices/inflation` | 17 | 17 | pierwszy wiersz `MO1 / 2026-08 / 3138.08 / 44.06` — **identyczny** |
| `prices/last-import` | 500 (limit) | 500 | kształt i porządek zgodne |
| `prices/product-history` | 14 513 | 15 597 | `min 24.26`, `max 27230` — **identyczne**; `avg` różni się (snapshot jest starszy o ~1000 wpisów) |
| `top-zmiany` | 100 (limit) | 100 | pierwszy wiersz `MO9_48466 / 529.4642857142857` — **identyczny** |

- **Unit (backend):** ✓ 23 nowe przypadki (`analityka.ceny.agregaty.test.ts`) —
  whitelista `?group` (w tym tablica z `?group=a&group=b`), gałęzie `?ean`/`?kod`/oba/żaden,
  `stats` (zaokrąglenie, pominięcie `null`-i, przepuszczenie zera, puste zbiory), brak
  historii bez zapytania, różnica `WHERE` między `last-import` a `top-zmiany`, sortowanie
  po `ABS(zmiana_pct)`, `LAG` i próg `cena_zakupu > 0`.
- **Widok (frontend, MSW):** ✓ 19 przypadków — trzy karty i ich kolejność, kolumny 1:1,
  brak zapytania przed wpisaniem czegokolwiek, query string, debounce (13 znaków → 1 zapytanie),
  nierenderowanie `stats`, filtry i notka o wymiarach pominiętych, wykres wraz z tabelą.
- **Pełne pakiety:** backend 45 plików / **719 testów** ✓; frontend 27 plików /
  **410 testów** ✓.
- **Bramki:** `lint` ✓, `typecheck` ✓, `build` ✓ w obu projektach. Chunk `Analityka`
  urósł z 385 kB do 423 kB (Recharts `LineChart` + `Legend`) — bez zmian w bundlu wspólnym.
- **E2E:** pominięte świadomie — jedyny przepływ użytkownika to wpisanie tekstu w dwa pola,
  pokryte testem widoku z MSW (tak samo rozstrzygnęło 10a).

## Zmiany łamiące zgodność

Brak. Blok wyłącznie dokłada trasy i wypełnia pustą zakładkę; nie ruszono żadnej istniejącej
trasy, komponentu ani tokenu. `test/tokeny.test.ts` przechodzi — paleta `--chart-1..5`
nietknięta.

## Follow-up

Rzeczy zauważone i świadomie odłożone — **żadna nie jest w zakresie tego bloku**:

1. **Przycisk „CSV" przy karcie „3.1"** (`onClick: () => M("prices-last")`, `:28310`) —
   należy do bloku **10f** razem z `GET /api/analytics/export/{view}`. Lista wszystkich
   widoków eksportu jest w `docs/analityka-bloki-10b-10f.md` §8.1.
2. **Wykres w karcie „3.2 / 3.3 Historia ceny"** — oryginał obiecuje go własnym tekstem
   („Wykres/tabela zapełnią się po zebraniu historii cen."), a i tak nie rysuje. Szereg
   cenowy jednego produktu to naturalny kandydat na linię jednoserialną. Nie dokładam
   bez decyzji użytkownika: byłoby to trzecie odstępstwo w jednym bloku.
3. **Środowisko: `rebuild/frontend/node_modules` w GŁÓWNYM repo jest nieaktualne** —
   brakuje w nim `recharts` i `@radix-ui/react-popover`, które doszły w bloku 10a
   (`typecheck` frontendu tam nie przejdzie). Ten worktree ma własne, świeże `node_modules`
   z `npm ci`. W głównym repo wystarczy `npm ci` w `rebuild/frontend/`.
4. **`market/group-prices` grupuje po `model` bez `LIMIT`-u sensownego dla UI** — 500 grup
   przy 92 markach. Nieistotne, dopóki trasa nie ma konsumenta; gdyby kiedyś dostała UI
   (nowa decyzja użytkownika), selektor grupy trzeba połączyć z paginacją albo wyszukiwarką.
