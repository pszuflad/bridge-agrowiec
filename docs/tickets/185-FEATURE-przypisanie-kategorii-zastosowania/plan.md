# 185-FEATURE-przypisanie-kategorii-zastosowania — przypisanie kategorii i zastosowania z CSV + ochrona + dziedziczenie

> Status: Implemented
> Branch: `claude/clever-turing-w6da6a` (sesja chmurowa — gałąź narzucona, bez osobnego worktree)

## Ticket description
Przypisać produktom w Bridge kategorię i zastosowanie z pliku
`katalog_wszyscy_KATEGORIA_ZASTOSOWANIE_FINAL_2026-09-30.csv`, zmienić reguły zastosowań, zabezpieczyć
przypisanie przed importem i dać nowym produktom parę po odpowiednikach z katalogu.

## Context
- Triggery `products_zastosowanie_*` (migr. 011, kopia produkcji) zamieniają parę spoza listy dozwolonych
  na „Uniwersalne/pozostałe” (Rolnicze/Ładowarka → „Ciągnik”). Dla pliku CSV dotyczyłoby to 207 wierszy.
- Zwykły import nie ruszał kategorii/zastosowania (patch: ceny, stan, magazyn, DOT, EAN, status), ale
  akceptacja stagingu istniejącego produktu zapisuje cały rekord z domyślnym „Rolnicze” i pustym zastosowaniem.
- `legacy/application_rules.cjs` jest bajt-w-bajt kopią `mirror/backend` (test integralności) i nie jest ładowany
  w czasie działania — zostaje bez zmian.
- Brak bazy produkcyjnej w sesji (`db/snapshot.db` w `.gitignore`) — testy na bazie tymczasowej.

## Kontrakt i fixtures (zakres)
Brak (nie dotyka kontraktu API): zmiana triggerów w bazie, ścieżki zapisu importu i skrypt CLI. Odpowiedzi
`GET /api/products` nie zmieniają kształtu. Gate fixtures nie obowiązuje; pełne testy backendu zielone.

## Decisions (użytkownik, 2026-10-04)
1. CSV final = wersja docelowa; `wersja_1.xlsx` tylko podgląd. Zmiany w bazie Bridge, nie w pliku. Klucz: `products.nazwa`.
2. Reguły: żadnych nowych par; jedyna zmiana — „Wózek widłowy” wypada z Rolniczych (**odstępstwo od produkcji**).
3. Pary spoza listy przenoszone wg zasady „zastosowanie decyduje o kategorii” (tabela `PRZENIESIENIA`, 16 wpisów).
4. Nazwy z dwoma zastosowaniami w tej samej kategorii (Rolnicze: Ciągnik vs Uniwersalne/pozostałe) → Rolnicze / Ciągnik. **Korekta:** użytkownik zdecydował „wszystkie 71 → Rolnicze/Ciągnik” na podstawie mojego błędnego opisu (że wszystkie mają tę samą kategorię). W rzeczywistości tylko 19 z 71 to ten przypadek; **52 mają RÓŻNE kategorie** (m.in. ciężarowe) — użytkownik: „przypisz do której uważasz”; Claude wybrał parę wg rodzaju opony (tabela `ROZSTRZYGNIECIA_NIEJEDNOZNACZNYCH`, lista z wyborem i alternatywami: `nazwy-niejednoznaczne-rozstrzygniete.csv`).
5. Akceptacja stagingu istniejącego produktu nie nadpisuje kategorii/zastosowania; poprawka Marty wygrywa. **Decyzja 2026-10-04:** dotychczasowe poprawki Marty na `kategoria`/`zastosowanie` są nieaktualne — migracja 022 nadpisuje także te produkty i **usuwa** te poprawki z `manual_overrides` (potwierdzone przez użytkownika: „usuwaj”); poprawki dodane później działają normalnie.
6. Nowe produkty dziedziczą parę po odpowiedniku (marka + model + rozmiar), tylko gdy jednoznaczna.
   Nie podjęte decyzji o `bulk` — przyjęto: dziedziczenie tylko, gdy kategoria nie została podana wprost.

## Implementation plan
1. `rebuild/schema/021_zastosowania_wozek_tylko_przemyslowe.sql` — odtworzenie dwóch triggerów zastosowań (kopia 011 bez dwóch `WHEN … 'Wózek widłowy'` w gałęzi Rolnicze).
2. `frontend/src/pages/katalog/poleEdycji.ts` — lista Rolniczych bez „Wózek widłowy”.
3. `src/import/migracje/przypisz-kategorie-zastosowanie.ts` + `scripts/przypisz-kategorie-zastosowanie.ts` — plan/zapis/raport (backup, `history`, pomija poprawki Marty i niejednoznaczne).
4. `src/import/dziedziczenieKategorii.ts` + wpięcie w `akceptacja.ts` i `bulk.ts`.
5. Testy: migracja 021, moduł przypisania, akceptacja/dziedziczenie/bulk, lista na froncie; aktualizacja testów migracji 011/łańcucha.

## Testing strategy
Prawdziwy SQLite, bez mocków. Macierz kategoria×zastosowanie przez triggery przed/po 021 (różni się dokładnie jedna para).
Test mutacyjny: wyłączenie `zachowajKategorieZastosowanie`/dziedziczenia czerwieni testy akceptacji.

## Out of scope
Uruchomienie `--apply` na bazie produkcyjnej; zmiany w `legacy/` i `mirror/`; mapy Selly (`selly_kategoria_norm_map`, `selly_zastosowanie_category_map`).

## Definition of done
- [x] Migracja 021 + test macierzy
- [x] Skrypt przypisania z tabelą przeniesień i raportem
- [x] Ochrona w akceptacji + dziedziczenie (akceptacja, bulk)
- [x] Bramki backendu i testy frontendu zielone po synchronizacji z `develop`
- [ ] `--apply` na produkcji (decyzja i wykonanie: użytkownik)
