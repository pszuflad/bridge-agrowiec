# 164b-BUG-napraw-nazwy-katalog — raport implementacji

## Summary

Uzupełnienie ticketu 164-BUG-poprawione-nazwy-sklejonych-opon. Po wdrożeniu PR #190 i
uruchomieniu skryptu na produkcji okazało się (potwierdzone zrzutem ekranu z panelu), że
zapisanie 174 poprawek do `manual_overrides` **nie zmieniło** widocznych nazw w katalogu —
`GET /api/products` nie czyta tej tabeli przy odczycie, override "wygrywa" dopiero przy
kolejnym imporcie/akceptacji stagingu. Dodatkowo znaleziono realną lukę w `akceptacja.ts:204`
(`applyNazwaPamiec()` wołane bezwarunkowo PO ustawieniu nazwy ze stagingu, bez ponownego
nałożenia override'u) — dla kolizji `kod_importu` ta luka mogłaby cofnąć poprawną nazwę z
powrotem na sklejoną przy najbliższej akceptacji.

Rozwiązanie: `napraw-nazwy-sklejone.ts` teraz oprócz zapisu do `manual_overrides` (co już
zrobił pierwszy przebieg na produkcji) **dodatkowo nadpisuje `products.nazwa` bezpośrednio**
— identyczny efekt jak ręczna edycja pola w panelu (`PUT /api/products/:id`), natychmiastowy,
bez czekania na import/akceptację i bez ryzyka związanego z luką w `akceptacja.ts`.

## Changes

- `rebuild/backend/src/import/naprawaNazwSklejonych.ts` — nowa funkcja
  `zastosujNazwyWKatalogu(db, wiersze)`: dla każdego wiersza znajduje produkt po `kod` i
  nadpisuje `nazwa`, licząc `zaktualizowano` / `bezZmian` / `nieZnaleziono`.
- `rebuild/backend/scripts/napraw-nazwy-sklejone.ts` — wywołuje teraz obie funkcje po sobie:
  `naprawNazwySklejone()` (jak dotąd) + `zastosujNazwyWKatalogu()` (nowe), z dodatkowym logiem.
- `rebuild/backend/test/naprawa-nazw-sklejonych.test.ts` — 4 nowe testy dla
  `zastosujNazwyWKatalogu` (nadpisanie, brak zmiany gdy nazwa już poprawna, produkt nieistniejący,
  rozróżnienie dwóch kolidujących produktów w katalogu).

## Deviations from plan

Nie dotyczy planu 164 — to uzupełnienie odkryte PO wdrożeniu, na podstawie realnej obserwacji
w panelu produkcyjnym (zrzut ekranu użytkownika) i weryfikacji w kodzie (`akceptacja.ts`,
`fabryka.ts`, `routes/products.ts`). Świadome doprecyzowanie: skrypt teraz robi to, co
pierwotnie zakładano, że robi (zmienia widoczne nazwy), a nie tylko przygotowuje grunt pod
przyszły import.

## Test results

- Gate odbudowy: N/D — nie dotyka API/kontraktu; `zastosujNazwyWKatalogu` używa tego samego
  zapisu do `products`, co istniejący `PUT /api/products/:id` (bez zmiany zachowania endpointu).
- Unit: 11/11 zielone w `naprawa-nazw-sklejonych.test.ts` (7 istniejących + 4 nowe).
- Pełny `npm test`: 1914 passed, 12 skipped (118 plików + rozszerzony).
- `npm run lint` / `npm run typecheck` / `npm run build`: zielone.
- Weryfikacja manualna end-to-end na tymczasowej bazie: zasiano dwa produkty z identyczną
  (sklejoną) nazwą "VF710/70R42 CEAT TORQUEMAX 185D SB/TL" pod `MO1_15126981`/`MO1_15126983`
  (dokładnie scenariusz ze zrzutu ekranu), uruchomiono `napraw-nazwy-sklejone` — log:
  „katalog — zaktualizowano 2, bez zmian 0, nie znaleziono produktu 172" (pozostałe 172 z pliku
  nie istniały w tej minimalnej testowej bazie, co jest oczekiwane). Odczyt bazy potwierdził
  dwie różne, poprawne nazwy w `products.nazwa`.

## Breaking changes

None. `zastosujNazwyWKatalogu` nie zmienia zachowania żadnego endpointu — działa tylko wewnątrz
skryptu CLI.

## Follow-up

- **Luka w `akceptacja.ts:204`** (bezwarunkowe `applyNazwaPamiec()` bez ponownego nałożenia
  `manual_overrides` przy akceptacji stagingu) pozostaje NIENAPRAWIONA — to wierne odtworzenie
  zachowania oryginału (port `U.acceptStaging`), więc naprawa wymaga świadomej decyzji
  użytkownika o odstępstwie od 1:1 (dotyczyłoby WSZYSTKICH przyszłych kolizji `kod_importu`,
  nie tylko tych 174). Zgłoszone użytkownikowi, czeka na decyzję — nie wchodzi w zakres tego
  ticketu.
- Zaktualizowane `manual_overrides` (z pierwszego przebiegu na produkcji) nadal chronią te 174
  nazw przed nadpisaniem przez przyszły import pliku dostawcy — z zastrzeżeniem powyższej luki.
