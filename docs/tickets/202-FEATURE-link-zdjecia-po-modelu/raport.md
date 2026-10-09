# 202-FEATURE-link-zdjecia-po-modelu — Implementation report

## Summary
Puste pole „Link do zdjęcia" uzupełnia się najczęstszym linkiem produktów o tej samej marce i modelu.
Działa w stagingu (podpowiedź w szczegółach pozycji z edycją linku + uzupełnienie przy akceptacji) i w
katalogu (przycisk z podglądem i zapisem wybranych). Uzupełnione linki są chronione poprawką Marty.

## Changes
- **New:** `rebuild/backend/src/import/dziedziczenieLinkow.ts` — indeks marka|model → linki, wybór najczęstszego, `applyLinkDziedziczony`, `proponujLinkiKatalogu` (podgląd), `uzupelnijLinkiWstecznie` (zapis w transakcji), `propozycjaLinkuDlaPozycji`.
- `src/import/akceptacja.ts`, `src/import/bulk.ts`, `src/import/polityka/akceptacja.ts`, `src/routes/products.ts` — wpięcie po `applyLinkMemory` (opt-in jak EAN), zapis poprawki po zapisie produktu.
- `src/routes/maintenance.ts` — `POST /api/products/uzupelnij-zdjecia`; `src/routes/staging.ts` — `GET /api/staging/:id/propozycja-zdjecia`; `src/routes/staging-mutacje.ts` — `linkZdjecia` w polach edytowalnych stagingu.
- **New:** `scripts/uzupelnij-zdjecia.ts` + wpis w `package.json`.
- Frontend: `pages/konfiguracja/UzupelnianieZdjec.tsx` (nowy), `katalog.ts`, `Katalog.tsx`; `pages/staging/SzczegolyPozycji.tsx`, `dane.ts`.
- Kontrakt: `contract/openapi.yaml` (2 ścieżki, schematy wygenerowane `tools/generate-openapi-schemas.cjs`), 2 nowe fixtures.
- Testy: `test/dziedziczenie-linkow.test.ts` (12), `test/uzupelnij-zdjecia.routes.test.ts` (6), FE: `staging.test.tsx` (+2), `konfiguracja.admin.test.tsx` (+2), handler MSW w `test/msw/staging.ts`.
- Docs: `docs/spec-backend/wpis-202.md`.

## Deviations from plan
- Podpowiedź w stagingu pokazana tylko w szczegółach pozycji (nie w kolumnie tabeli) — jeden dodatkowy request na otwarcie okna zamiast N dla listy.
- Auto-zatwierdzanie (`fabryka.ts`) nie wołają nowej logiki: łata istniejące produkty z diffem, a luki w katalogu domyka przycisk. Do rozważenia, jeśli ma być automatycznie.
- Wpis w pkt 9 planu (rememberLink przy ręcznej edycji) — poza zakresem, bez zmian.

## Test results
- **Gate kontraktu:** ✓ — nowe ścieżki sprawdzone `sprawdzZgodnoscZKontraktem` + `sprawdzZgodnoscZFixture`; istniejące fixtures (`GET_products*`, `GET_staging*`, `PUT/PATCH_products_id`) bez zmian i zielone w pełnym biegu. Selly (CSV/REST) — kształt bez zmian, zmieniają się tylko wartości kolumny `Link-do-zdjecia`; nie dotykano generatora.
- Backend: lint ✓, typecheck ✓, build ✓, `npm test` ✓ (po regeneracji schematów openapi z fixtures — pierwszy bieg wykrył nieaktualne schematy i został poprawiony `node tools/generate-openapi-schemas.cjs`).
- Frontend: lint ✓, typecheck ✓, `npm test` ✓ (1076).
- Skali (ile pustych / dopasowalnych) nie zmierzono — brak kopii bazy produkcyjnej; podgląd w UI/CLI pokaże ją przed zapisem.

## Breaking changes
None. (Domyślnie wyłączone w ścieżkach używanych przez harness charakteryzacyjny.)

## Follow-up
- Ręcznie wpisany link w katalogu nie trafia do pamięci linków do czasu akceptacji stagingu (luka z badania).
- Poprawka linku może wywołać „konflikt ze źródłem" przy imporcie, gdy dostawca poda inny link — zachowanie istniejącego mechanizmu.
- Brak testów na `link_pamiec_mr` i wyjątek MO9 (stan sprzed ticketu).
