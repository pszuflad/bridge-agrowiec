# 185-FEATURE-przypisanie-kategorii-zastosowania — raport

## Summary
Dodano migrację 021 (Wózek widłowy tylko w Przemysłowych), skrypt przypisania kategorii/zastosowania z CSV (tabela
przeniesień, raport, backup, `history`), ochronę kategorii/zastosowania przy akceptacji istniejącego produktu oraz
dziedziczenie pary dla nowych produktów (marka + model + rozmiar).

## Changes
- **New:** `rebuild/schema/021_zastosowania_wozek_tylko_przemyslowe.sql`
- **New:** `rebuild/backend/src/import/migracje/przypisz-kategorie-zastosowanie.ts`, `rebuild/backend/src/import/dziedziczenieKategorii.ts`
- `rebuild/backend/scripts/przypisz-kategorie-zastosowanie.ts` — przepisany na moduł; `package.json` — skrypt npm
- `rebuild/backend/src/import/akceptacja.ts`, `bulk.ts` — wpięcie (po `applyWagaDziedziczona`/EAN, przed zapisem)
- `rebuild/frontend/src/pages/katalog/poleEdycji.ts` — lista Rolniczych bez „Wózek widłowy”
- Testy: `db.migracja-021`, `przypisz-kategorie-zastosowanie`, `dziedziczenie-kategorii`, `katalog.poleEdycji`; poprawione `db.migracja-011`, `db.migracje`, `db.migracje-produkcja` (nowa migracja 021 podmienia dwa triggery)

## Deviations from plan
None. Odstępstwa od produkcji (świadome, zatwierdzone): lista Rolniczych bez „Wózek widłowy”; kategoria/zastosowanie przeżywają akceptację stagingu; dziedziczenie pary dla nowych produktów.

## Test results
- **Gate odbudowy (fixtures/kontrakt):** N/D — nie dotyka API.
- Backend: lint ✓, typecheck ✓, build ✓, `npm test` ✓ (135 plików, 2136 testów) — po synchronizacji z `origin/develop`.
- Frontend: tsc ✓, testy katalogu ✓ (171).
- Przeliczenie pliku CSV (poza repo): 8487 wierszy → 314 zmienionych; po zmianach wszystkie pary są dozwolone przez triggery.
- Test mutacyjny: wyłączenie ochrony/dziedziczenia → 2 testy czerwone.

## Breaking changes
Zapis „Rolnicze / Wózek widłowy” (import, edycja, API) trigger zamienia teraz na „Rolnicze / Uniwersalne/pozostałe”.

## Follow-up
- Uruchomić skrypt na kopii produkcji (dry-run + `--raport`), obejrzeć raport, dopiero potem `--apply`.
- Sprawdzić mapy Selly (`selly_kategoria_norm_map`, `selly_zastosowanie_category_map`) pod nowe kombinacje kategoria/zastosowanie (przeniesienia zmieniają kategorię produktów → eksport do Selly).
- Lista zastosowań Leśnych na froncie nie ma „Forwarder/Harwester” (jest „Harwester”, „Forwarder”), a baza go dopuszcza — niezwiązane z tym ticketem.
- Dziedziczenie w `bulk` działa tylko przy braku kategorii w pozycji; ręczne dodanie z UI z kategorią podaną wprost jej nie zmienia.
