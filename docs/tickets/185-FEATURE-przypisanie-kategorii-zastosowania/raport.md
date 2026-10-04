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
- Przeliczenie pliku CSV: 8487 wierszy; 19 niejednoznacznych nazw rozstrzyga reguła Ciągnik/Uniwersalne, **52 nazwy (różne kategorie) są pomijane** — lista w `nazwy-niejednoznaczne-do-decyzji.csv`; po zmianach wszystkie pary są dozwolone przez triggery.
- Migracja 022 sprawdzona na bazie z 8487 produktami (czas ~160 ms).
- Test mutacyjny: wyłączenie ochrony/dziedziczenia → 2 testy czerwone.

## Breaking changes
Zapis „Rolnicze / Wózek widłowy” (import, edycja, API) trigger zamienia teraz na „Rolnicze / Uniwersalne/pozostałe”.

## Follow-up
- Uruchomić skrypt na kopii produkcji (dry-run + `--raport`), obejrzeć raport, dopiero potem `--apply`.
- Sprawdzić mapy Selly (`selly_kategoria_norm_map`, `selly_zastosowanie_category_map`) pod nowe kombinacje kategoria/zastosowanie (przeniesienia zmieniają kategorię produktów → eksport do Selly).
- Lista zastosowań Leśnych na froncie nie ma „Forwarder/Harwester” (jest „Harwester”, „Forwarder”), a baza go dopuszcza — niezwiązane z tym ticketem.
- Dziedziczenie w `bulk` działa tylko przy braku kategorii w pozycji; ręczne dodanie z UI z kategorią podaną wprost jej nie zmienia.

## Review fixes applied
Review: 0 BLOCKER, 8 SHOULD-FIX, 5 NICE-TO-HAVE (`review.md`). Naprawione:
- **Poprawka Marty dodana po imporcie** (`PUT /api/staging/{id}`): snapshot jej nie niesie, więc `zachowajKategorieZastosowanie` i dziedziczenie nakładają teraz WARTOŚĆ poprawki na rekord (wcześniej tylko nie ruszały pola → domyślne „Rolnicze”). Testy: poprawka na kategorii, tylko na zastosowaniu, dla nowego produktu.
- **Skrypt:** dry-run nie wykonuje już migracji (nie zmienia bazy); przy `--apply` najpierw kopia, potem migracje i zapis (sprawdzone ręcznie: `_migracje` bez zmian po dry-runie).
- **Raport CSV** zawiera nazwy z pliku bez produktu w bazie (`brak_produktu_w_bazie`); dopasowanie po nazwie opisane w nagłówku modułu (dokładne, po `trim`, wielkość liter ma znaczenie; ta sama nazwa u kilku dostawców → ta sama para).
- **Testy:** gałęzie null-safe dziedziczenia (profil/średnica/konstrukcja), odpowiednik bez zastosowania.
Nie zmieniane (świadomie): indeks `products(marka, model)` — pełny skan ~8 tys. wierszy na nowy produkt jest pomijalny kosztem; dziedziczenie nie uwzględnia bieżnika (klucz zatwierdzony: marka + model + rozmiar); test CLI (CLI to cienka nakładka, logika pokryta testami modułu).

## Przypisanie przy wdrożeniu (bez SSH)
Na prośbę użytkownika przypisanie wykonuje się automatycznie: **migracja `022_przypisanie_kategorii_zastosowania_csv.sql`**
(generowana z `scripts/data/katalog-kategoria-zastosowanie-2026-09-30.csv` przez `npm run generuj-migracje-przypisania`).
Deploy robi kopię bazy → `npm run migrate` (021, 022) → raz na bazę dzięki `_migracje`; najpierw staging (merge do `develop`), potem
produkcja (merge do `main`). Migracja nadpisuje także produkty z dotychczasową poprawką Marty i **usuwa wszystkie poprawki** `kategoria`/`zastosowanie` z `manual_overrides` (decyzja użytkownika; poprawki na innych polach zostają); zapisuje `history` (kto = „migracja 022”). Poprawki dodane później działają normalnie (wartość poprawki jest nakładana przy akceptacji). Skrypt CLI zostaje
do dry-runu i raportu (`--raport`).
