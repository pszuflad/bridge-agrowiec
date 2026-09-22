# 97-FEATURE-kafle-kpi-analityki — kafle KPI w Analityce jak na produkcji (PR.2)

> Status: Draft
> Branch: `feature/97-kafle-kpi-analityki`
> Worktree: `.worktrees/97-FEATURE-kafle-kpi-analityki`

## Opis ticketa
Karta PR.2 (`docs/karty/PR.2/`): nagłówek `/analityka` ma pokazywać cztery kafle jak na produkcji —
Dostawcy / EAN wspólne / Pozycje unikalne / Snapshoty — zamiast dzisiejszych z `GET /api/analytics/kpi`
(„Produkty / Dostawcy / Śr. marża / Staging oczekujące"). Odwrócenie odstępstwa O-10a-1.
Wariant (a) pytania 12.3 potwierdzony przez użytkownika 2026-09-22 (odpowiedź Ani nie jest zapisana
w `docs/pytania-do-ani-2026-09-18.md:361`).

## Kontekst
- Oryginał: `zM()` w `deminified/frontend-index.js:27980-28030`; żywy bundel
  `origin/main:mirror/frontend/assets/index-PRICEFMT1783512500.js` jest w tym fragmencie identyczny
  (sprawdził researcher). Wartości kafli dosłownie:
  - „Dostawcy": `f.dostawcy ? f.dostawcy.length : "—"`, gdzie `data: f = {}` z `/api/analytics/filters`,
  - „EAN wspólne": `v.rows ? v.rows.length : "—"`, gdzie `data: v = { rows: [] }` z `ean/comparison`,
  - „Pozycje unikalne": `b.rows ? b.rows.length : "—"`, gdzie `data: b = { rows: [] }` z `ean/unique`,
  - „Snapshoty": `p.snapshots || 0`, gdzie `data: p = {}` z `/api/analytics/status`.
  Klasy: siatka `grid grid-cols-2 md:grid-cols-4 gap-3 text-sm`, karta `border rounded p-3`,
  etykieta `text-muted-foreground text-xs`, wartość `text-xl font-mono font-semibold` — dzisiejszy
  `Kafel` ma już te same klasy. Liczby renderowane surowo (bez separatora tysięcy).
- Wszystkie cztery trasy oryginał woła bez parametrów, więc filtrów nie ma. W rebuild hooki `useFiltry`,
  `useStatusHistorii`, `usePorownanieEan`, `useUnikalneEan` (`pages/analityka/api.ts`) mają
  `queryKey` = sam URL i `Analityka.tsx` już je woła, więc nagłówek dostaje dane przez props,
  bez nowego zapytania.
- `ean/comparison` i `ean/unique` mają w backendzie `LIMIT 1000` (`rebuild/backend/src/repos/analityka.ts`),
  tak jak oryginał, więc kafel może pokazać najwyżej 1000. Tak samo jest na produkcji.

## Kontrakt i fixtures (zakres)
Backendu nie zmieniamy. Frontend zaczyna czytać kafle z tras, które i tak już pobiera:
`GET /api/analytics/filters`, `/status`, `/ean/comparison`, `/ean/unique`
(`contract/fixtures/GET_analytics_{filters,status,ean_comparison,ean_unique}.json`). Testy FE
jadą na tych fixtures (`test/msw/kontrakt.ts`). `GET /api/analytics/kpi` zostaje w backendzie
i kontrakcie, ale traci konsumenta w UI (jak #28). Gate backendowy: N/D (brak zmian w backendzie).

## Decyzje
- D1 — wariant (a) 12.3, potwierdzony przez użytkownika. Nie jest to nowe odstępstwo: zamyka O-10a-1.
- D2 — kafle liczą całość i nie reagują na pasek filtrów (O-10a-2), bo oryginał filtrów nie ma,
  a hooki nie przyjmują parametrów.
- D3 — semantyka pustych stanów 1:1 z oryginałem (patrz wyżej): w trakcie ładowania i przy błędzie
  „Dostawcy" = „—", „EAN wspólne"/„Pozycje unikalne" = „0" (domyślne `{rows: []}`), a „Snapshoty" = „0".
  „—" przy EAN tylko wtedy, gdy odpowiedź nie ma `rows`.
- D4 — `null` (wygasła sesja, `on401: returnNull`): w oryginale `null.rows` rzuca wyjątkiem. U nas
  `null` traktujemy jak „odpowiedź bez pola", czyli „—" / „—" / „—" / „0". To ochrona przed wysypaniem,
  a nie zmiana tego, co widać przy działającej sesji.
- D5 — liczby surowe (`String(n)`), bez `toLocaleString`, jak w oryginale.
- `useKpi()` usunięty z `api.ts` i `Analityka.tsx`. Typ `Kpi` zostaje (używa go `test/msw/kontrakt.ts`).

## Plan implementacji
1. `NaglowekKpi.tsx`: props `filtry`, `status`, `porownanieEan`, `unikalneEan` oraz czysta funkcja
   `wartosciKafli()` (eksport, do testów jednostkowych), cztery kafle z testId `kpi-dostawcy`,
   `kpi-ean-wspolne`, `kpi-unikalne`, `kpi-snapshoty`. Komentarz nagłówkowy przepisany: O-10a-1
   zamknięte (ticket 97), pułapka `LIMIT 1000`.
2. `Analityka.tsx`: podpięcie nagłówka (`porownanieEan.data`, `unikalneEan.data`, `filtry`, `status`),
   usunięcie `useKpi`, aktualizacja komentarza modułu (lista odstępstw, akapit 10c).
3. `api.ts`: usunięcie `useKpi` i poprawka komentarza przy `Kpi`.
4. `pages/analityka/README.md`: wiersz O-10a-1 oznaczony jako zamknięty.
5. Testy: `test/analityka.test.tsx` §2 (handler `/kpi` zdjęty z `zamockujApi`, handlery
   ean/comparison i ean/unique są już w pliku), asercje na treść czterech kafli z fixtures, brak
   wywołań `/kpi`, po jednym wywołaniu każdej z czterech tras (liczone w handlerze MSW), wariant pusty
   (`rows: []` → „0", `dostawcy` brak → „—", `snapshots: 0` → „0"). Test jednostkowy
   `wartosciKafli()` dla `undefined`/`null`.

## Strategia testów
Vitest + MSW na fixtures produkcji. Bramki: lint, typecheck, build, test w `rebuild/frontend/`.
`git diff origin/develop --stat -- rebuild/backend contract` ma być pusty.

## Poza zakresem
- Handlery `/api/analytics/kpi` w innych plikach testów (`analityka.{ceny,dostawcy,ean,dostepnosc,eksport}.test.tsx`)
  zostają. Nieużyty handler niczego nie psuje, a `eksport.test` jest w obszarze P10.3. Do follow-up.
- Komentarz `pages/pulpit/KafelKpi.tsx:8` wspomina O-10a-1, ale Pulpit należy do P10.2. Trafia do „Do koordynatora".
- `docs/instrukcja-testow-I10.md:171,472` opisuje stare kafle, więc idzie wejście dla P10.4.

## Definition of done
- [ ] Cztery kafle z etykietami i kolejnością oryginału, liczby z fixtures.
- [ ] Puste stany wg D3/D4.
- [ ] `/api/analytics/kpi` nie jest wołane z `/analityka`, każda z czterech tras dokładnie raz.
- [ ] Bramki FE zielone, backend i contract bez zmian.
- [ ] `karta.md` PR.2 z opisem stanu, wejścia dla PR.6 i P10.4, PR do `develop`.
