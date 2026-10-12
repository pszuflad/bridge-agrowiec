# 236 — raport
Dowiezione wg planu. Z review (`review.md`, 0 BLOCKER) poprawione: spójna normalizacja spacji w wyszukiwaniu, tie-break po kodzie, test round-trip, notatka o XML i ASCII `upper()`.
Świadomie bez zmian: brak indeksu na `ean` (≈5,4 tys. wierszy, skan akceptowalny); duplikaty numeru przy kilku magazynach tego samego dostawcy (opisane w wpis-236); licznik `bezNumeru` tylko w logu generatora. `contract/openapi.yaml` nie opisuje tras partnerów.
Bramki: backend lint/tsc/build/test, frontend lint/typecheck/testy — zielone (CI w PR).
