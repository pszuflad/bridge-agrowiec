# 109-FEATURE-selly-rest-sync-full — Code review

> Reviewed: 2026-09-22
> Branch: feature/109-selly-rest-sync-full
> Diff: 11 plików, 3 commity

## BLOCKER

- [ ] `docs/karty/I15.7/karta.md` — karta nie została zaktualizowana: „Stan” dalej `⬜ po I15.6`,
      sekcje „Dowiezione” i „Do koordynatora” dalej puste (`—`), mimo że `git diff origin/develop...HEAD`
      nie zawiera ŻADNEJ zmiany w `docs/karty/`.
  - Reason: to jawny punkt Definition of done w `plan.md:86-92` („Karta I15.7: stan, Dowiezione,
    Do koordynatora (#101, sygnatura, rotacja/`buildCache`, `SELLY_TRYB`); wejście dla I15.8”) —
    niespełniony w całości. To też złamanie reguły projektu (CLAUDE.md, „Roadmapa jest wejściem…”,
    pkt 1–2): karta zamknięta ma opisywać STAN, a ustalenia dla przyszłej karty (I15.8) mają trafić
    do `docs/karty/I15.8/wejscie-109.md` — tego pliku nie ma (`docs/karty/I15.8/` ma tylko
    `wejscie-104.md` i `wejscie-108.md`). Treść, która powinna tam trafić, dziś jest schowana
    wyłącznie w sekcji „Follow-up” `raport.md` — kolejna sesja (koordynator I15.8) czyta katalog
    `docs/karty/I15.8/`, nie `docs/tickets/109-.../raport.md`, więc realnie tego nie zobaczy
    (dokładnie przypadek opisany w CLAUDE.md jako powtarzający się błąd 3b→3c/3d/3e).
  - Suggestion: uzupełnić `docs/karty/I15.7/karta.md` (Stan: zrobione, data, ticket 109; Dowiezione:
    lista z `raport.md`; Do koordynatora: #101, sygnatura `syncFullForDostawca(db, discovery, dostawca, opts)`,
    rotacja/`buildCache` tylko dla pierwszego dostawcy partii, `SELLY_TRYB`) i dopisać
    `docs/karty/I15.8/wejscie-109.md` z notatką o buggu `runFullTodays`/`routes_sync.cjs:14` i o #101 —
    to jest dokładnie treść już napisana w `raport.md`, tylko w złym miejscu.

## SHOULD-FIX

- [ ] `docs/tickets/109-FEATURE-selly-rest-sync-full/plan.md:86-92` — checkboxy Definition of done
      zostały puste (`[ ]`) mimo że treść jest w praktyce spełniona (poza kartą wyżej).
  - Reason: kosmetyczne, ale utrudnia szybką weryfikację „co jest zrobione” bez czytania całego
    `raport.md`; przy okazji poprawki karty warto odhaczyć.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/selly/rest/sync-full.ts:288-289` — komentarz „w oryginale bez sprawdzenia”
      przy `row.selly_product_id as number` jest trafny i dobrze udokumentowany; warto tylko
      upewnić się, że ten sam komentarz nie zdubluje się przy przyszłych portach (czysto informacyjne,
      bez akcji).

## Plan compliance

### Done ✓
- `mapper-v2.ts`: port 1:1 `yn`/`txt`/`num`/`zastosowaniePierwsze`, `FEATURE_MAP` (21 cech, bez „Lód”
  i „Magazyny”), `buildFeatures`, `buildFeaturesMirror` (#81 — brak dziedziczenia pustej cechy
  zarządzanej, zweryfikowane linia po linii z `mapper_v2.cjs:94-115`), `toSellyPayloadV2`,
  `buildProductPayload` — zgodne z oryginałem, w tym komunikaty błędów `_error` znak w znak.
- D1 wykonane: `toDeltaPayload`, `DOSTAWCA_TO_MAGAZYN_FEATURE_ID`, `getMagazynFeatureIdForDostawca`
  pominięte, udokumentowane w nagłówku pliku.
- `sync-full.ts`: `collectFullSyncItems` (SQL verbatim), `loadDictMaps`, `logSyncStart/End`,
  `markProductSynced`, `markError` (klasyfikacja `missing_dict`/`error` identyczna z `sync_full.cjs:127-135`),
  `metadataScore`/`isMetadataOwner` (#81, remis po `id`, grupa różnych kategorii pomijana) — zgodne
  z `sync_full.cjs:137-172`.
- Ścieżka A (`updateExistingVariant`): GET tylko dla właściciela metadanych, kolejność
  `productPayload` bez cech → (jeśli owner) GET → payload z lustrem + `category_id` — zgodne z
  `sync_full.cjs:174-216`, w tym podwójne rozpakowanie `current.data?.data || current.data || {}`.
- Ścieżki B/C (`ensureAndUpdate`) przez `discovery.ensureMapping(db, row, dictMaps)`, PUT bez cech —
  zgodne z `sync_full.cjs:222-253`.
- `syncFullForDostawca`: sygnatura D2 (`db, discovery, dostawca, opts`), `buildCache && autoCreate`
  z połkniętym błędem, status logu `blad` tylko gdy `err>0 && totalOk===0`, `dryRun` nie robi GET/PUT —
  zgodne z `sync_full.cjs:261-333`.
- D3: `getProduct` w kliencie (`GET /api/products/{pid}`), sklasyfikowany w `METODY_ODCZYTU`, atrapa
  i test kompletności (`selly.tryb.test.ts`) — zielone.
- Zmiana w `discovery.ts` (typ `provider_code?: string | null`) minimalna, bez zmiany zachowania.
- Zastane defekty odtworzone 1:1 i zweryfikowane w kodzie/testach: martwe gałęzie non-2xx po PUT,
  `createVariant` zawsze dostaje `vat: 23` (kolumna `vat` zamiast `vat_rate` — potwierdzone też
  w oryginalnym `discovery.cjs:181`, nie tylko w porcie), `metadataScore` liczy `0` jako wypełnione,
  sam `UPDATE` bez `INSERT` w `markError`/`markProductSynced`.
- Testy: `selly.mapper-v2.test.ts` (13) i `selly.sync-full.test.ts` (13) sprawdzają zachowanie
  (payloady PUT/POST, stan atrapy `sklep`, wiersze `selly_products`/`selly_sync_log`), nie tylko
  wywołania — w tym test na #81 wprost cytujący backlog.
- Żaden test nie woła sieci — klient za interfejsem, atrapa `test/gate/selly-atrapa.ts`.
- `npm run lint` / `typecheck` / `build` / `test` — zielone (98 plików, 1587 testów, 2 pominięte,
  zweryfikowane niezależnie).
- `contract/openapi.yaml` i `contract/fixtures/` — brak zmian (zweryfikowane `git diff`);
  `selly.gate.test.ts` bez zmian, w zestawie zielonym.

### Missing or deviating ✗
- `docs/karty/I15.7/karta.md` nieaktualizowana (BLOCKER wyżej).
- `docs/karty/I15.8/wejscie-109.md` nie powstał — ustalenia dla I15.8 (#101, bug `runFullTodays`)
  są tylko w `raport.md` (BLOCKER wyżej).

### Definition of done
- [x] `mapper-v2.ts` i `sync-full.ts` portują oryginał 1:1 (poza D1), #81 w całości.
- [x] `getProduct` w kliencie, atrapie i `METODY_ODCZYTU`; test kompletności zielony.
- [x] Testy mappera i Toru 2 na atrapie; żaden test nie woła sieci.
- [x] lint, typecheck, build, test zielone; `selly.gate.test.ts` bez zmian w fixtures.
- [ ] Karta I15.7: stan, Dowiezione, Do koordynatora (#101, sygnatura, rotacja/`buildCache`,
      `SELLY_TRYB`); wejście dla I15.8. — niespełnione, patrz BLOCKER.

## Parallel-test concerns

None — wszystkie nowe testy działają na `stworzTestowaBaze()` (SQLite w katalogu tymczasowym) i
atrapie Selly (zero sieci, brak portów/plików o stałej ścieżce).

## Overall assessment

Port kodu jest bardzo wierny — sprawdzone linia po linii `mapper_v2.cjs`/`sync_full.cjs` vs
`mapper-v2.ts`/`sync-full.ts`: kolejność kroków, warunki brzegowe, treści komunikatów błędów
(kontrakt `markError`), kształt payloadów i zastane defekty (#81, `vat` zamiast `vat_rate`,
`metadataScore` z `0` jako wypełnione) są odtworzone 1:1, z dobrym pokryciem testami, które
faktycznie sprawdzają skutek (stan atrapy, wiersze w bazie), nie tylko wywołania. Jedyny realny
problem to brak aktualizacji `docs/karty/I15.7/karta.md` i brak `docs/karty/I15.8/wejscie-109.md` —
to jawny punkt Definition of done i zarazem dokładnie ten błąd procesowy, przed którym ostrzega
CLAUDE.md (notatki dla przyszłej karty giną w raporcie zamiast trafić do katalogu odbiorcy). Do
połączenia z `develop` wystarczy dopisać te dwa pliki treścią, która już istnieje w `raport.md`.
