# 202-FEATURE-link-zdjecia-po-modelu — automatyczne uzupełnianie linków do zdjęć po marce i modelu

> Status: Draft
> Branch: `feature/202-link-zdjecia-po-modelu`
> Worktree: `.worktrees/202-FEATURE-link-zdjecia-po-modelu`

## Ticket description
„Czy da się zrobić automatyczne uzupełnianie linków do zdjęć w pustych polach produktów, dopasowując po modelu?"

## Context
- Pole: `products.link_zdjecia` (`schema.ts:98`), edytowalne ręcznie (`POLA_EDYTOWALNE_PRODUKTU`, `repos/products.ts`), w CSV Selly jako `Link-do-zdjecia`.
- Dziś pusty link uzupełnia tylko pamięć linków (`applyLinkMemory`, `legacy/bridge_ext.cjs` — kopia 1:1 pilnowana sha256, NIE ruszać) po kodzie albo marce+modelu+rozmiarze, wyłącznie przy akceptacji stagingu / auto-zatwierdzaniu. Brak dopasowania po marce+modelu bez rozmiaru i brak przebiegu po katalogu.
- Najbliższy wzorzec: dziedziczenie wagi (tickety 155/156) — `src/import/dziedziczenieWagi.ts` (`applyWagaDziedziczona` w `akceptacja.ts`/`bulk.ts`, `dziedziczWageWstecznie`, trasa `POST /api/products/dziedzicz-wage`, przycisk w `frontend/src/pages/konfiguracja/Katalog.tsx`).
- Brak `db/snapshot.db` w środowisku — skali (ile pustych / dopasowalnych) nie zmierzono; pomiar na kopii produkcji do zrobienia przez użytkowniczkę albo w kroku wdrożenia (dry-run).

## Kontrakt i fixtures (zakres)
- Nowe ścieżki w `contract/openapi.yaml`: podgląd + zapis uzupełnienia dla katalogu (analogicznie do `POST /api/products/dziedzicz-wage`) oraz podpowiedź linku dla pozycji stagingu. Dla nowych tras: nowe fixtures (ręczne, jak `dziedzicz-wage`).
- Istniejące kształty (`GET /api/products`, `/api/staging`, `PUT/PATCH /api/products/{id}`) NIE zmieniają się — `schema.ts` nie jest ruszany (brak nowej kolumny).
- Kontrakty zewnętrzne: CSV Selly — zmieniają się tylko wartości kolumny `Link-do-zdjecia` (puste → uzupełnione); kształt pliku bez zmian. Sprawdzić na istniejącym teście generatora.

## Decisions
1. **Dopasowanie: marka + model (bez rozmiaru)** — zatwierdzone. Klucz znormalizowany (upper, zwinięte spacje, jak `mrKey`). Zwiększa trafienia kosztem ryzyka złego zdjęcia przy modelach z wariantami → stąd podgląd przed zapisem.
2. **Źródło: tylko linki z katalogu** (`products.link_zdjecia` innych produktów), bez tabel `link_pamiec_*` — zatwierdzone.
3. **Wiele różnych linków dla tej samej pary marka+model: bierzemy najczęstszy** (remis → najmniejszy link alfabetycznie, deterministycznie) — zatwierdzone (2.A). Pokazujemy to jako propozycję.
4. **Gdzie:** (B) staging **i** katalog — zatwierdzone (1.B).
   - Staging: w szczegółach pozycji (oraz w kolumnie „Link-do-zdjecia") pusta wartość dostaje oznaczoną podpowiedź, którą można edytować/usunąć przed akceptacją; przy akceptacji pozycji z pustym linkiem i bez edycji — link zostaje wpisany z propozycji.
   - Katalog: przycisk „Uzupełnij puste zdjęcia" w Konfiguracja → Katalog: najpierw podgląd (liczba i lista propozycji, możliwość odznaczenia), zapis po potwierdzeniu.
5. **Ochrona przed importem — zatwierdzone (3.A):** po akceptacji/zapisie uzupełniony link dostaje wpis w `manual_overrides` (`fieldName = 'linkZdjecia'`), więc import go nie nadpisze. Konsekwencja: dostawca nie zmieni linku, dopóki ktoś nie usunie poprawki.
6. **Czego nie nadpisujemy:** niepustych linków i produktów, których link już ma `manual_overrides` (pusty + override = celowe czyszczenie → pomijamy).
7. **Bez nowej kolumny** (np. „link_auto") — brak ruszania `schema.ts`; ślad w audycie (`zapiszAudyt`, jak waga). Do decyzji, jeśli ma być wyróżnik w UI katalogu.
8. Ta zmiana nie dotyka nazw ani `nazwa_pamiec` — reguła „zmiana nazwy" nie dotyczy.
9. Dodatkowo (zaproponowane, do potwierdzenia „go"): ręcznie wpisany link w katalogu wpada też do pamięci linków (`rememberLink`) — luka znaleziona w badaniu. **Poza zakresem tego ticketu, chyba że użytkowniczka powie inaczej.**

## Implementation plan
1. `src/import/dziedziczenieLinkow.ts` (nowy, poza `legacy/`): `kluczMarkaModel`, `znajdzLinkDoDziedziczenia(db, klucz)` (najczęstszy), `applyLinkDziedziczony(db, rekord)`, `proponujLinkiKatalogu(db)` (dry-run), `uzupelnijLinkiWstecznie(db, sqlite, wybraneId?)` (transakcja, pomija override, zapisuje `manual_overrides`).
2. Wpięcie w `akceptacja.ts` i `bulk.ts` TUŻ PO `applyLinkMemory` (pamięć wygrywa; nasza funkcja działa tylko gdy link nadal pusty) i `fabryka.ts` (auto-zatwierdzanie) — z zapisem override.
3. Trasy w `routes/maintenance.ts` (wzór `dziedzicz-wage`): `POST /api/products/uzupelnij-zdjecia` z `dry_run`/`ids`, audyt; podpowiedź dla stagingu (`GET`/`POST /api/staging/propozycje-zdjec`).
4. Skrypt CLI `scripts/uzupelnij-zdjecia.ts` + `package.json` (jak `dziedzicz-wage`) — ta sama funkcja co trasa.
5. FE: przycisk + okno podglądu w `Katalog.tsx`/`katalog.ts`; podpowiedź w `SzczegolyPozycji.tsx` i `staging/dane.ts`.
6. `contract/openapi.yaml` + fixtures dla nowych tras; wpis `docs/spec-backend/wpis-202.md`.

## Testing strategy
- Testy jednostkowe `dziedziczenieLinkow` na prawdziwej bazie tymczasowej: najczęstszy link, remis, brak marki/modelu, nie nadpisuje niepustego, pomija override, idempotencja, normalizacja wielkości liter/spacji.
- Integracyjnie: akceptacja stagingu z pustym linkiem (pamięć wygrywa nad dziedziczeniem), trasa dry-run vs zapis, zapis `manual_overrides`, kolejny import nie nadpisuje.
- Gate kontraktu: fixtures `GET_products*.json`, `GET_staging.json`, `PUT/PATCH_products_id.json` bez zmian; nowe fixtures dla nowych tras; test CSV Selly.
- FE: testy komponentów (MSW — dopisać handlery dla nowych tras, pułapka „onUnhandledRequest").
- Bramki: `npm run lint && typecheck && build && test` w `rebuild/backend`, odpowiedniki FE; po `tools/sync-z-develop.sh` od nowa.

## Out of scope
Nowa kolumna/wyróżnik „link auto", tabele `link_pamiec_*` jako źródło, dopasowanie po samym modelu, pobieranie zdjęć z internetu, `rememberLink` przy ręcznej edycji (pkt 9), zmiana `legacy/bridge_ext.cjs`.

## Definition of done
- [ ] Podgląd i zapis w katalogu działają, pomijają niepuste i chronione
- [ ] Podpowiedź w stagingu z możliwością edycji; akceptacja wpisuje link
- [ ] Uzupełnione linki chronione przez `manual_overrides`
- [ ] Openapi + fixtures + testy zielone
- [ ] Gałąź zsynchronizowana z `origin/develop`, bramki zielone PO synchronizacji, PR `MERGEABLE`
