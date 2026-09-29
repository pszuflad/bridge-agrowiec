# 166-FEATURE-nawigacja-do-brakow-wagi — Code review

> Reviewed: 2026-09-29
> Branch: feature/166-nawigacja-do-brakow-wagi
> Diff: 7 plików (4 kod, 3 testy), 1 commit (`cb90fb6`)

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/konfiguracja/Katalog.tsx:63-68` — gdy `dziedziczWage()` rzuci
  wyjątek PO wcześniej udanym wywołaniu, `wynikDziedziczenia` z poprzedniej (udanej) próby zostaje
  wyświetlony razem z toastem błędu — mylący komunikat sugerujący nieaktualny wynik.
  - Reason: drobny UX, ale dwa sprzeczne komunikaty naraz (błąd w toaście + stary „sukces” pod
    przyciskiem) mogą zmylić Anię co do rzeczywistego stanu ostatniej operacji.
  - Suggestion: `ustawWynikDziedziczenia(null)` w bloku `catch`.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/Katalog.tsx:138-143` — lazy initializer czyta `useSearch()`
  tylko raz przy montowaniu (świadomie, opisane w komentarzu); warto rozważyć w przyszłości,
  czy nawigacja `/katalog?status=X` → `/katalog?status=Y` bez odmontowania (np. z linku na tej
  samej stronie w przyszłym widoku) nie powinna też reagować — dziś nie ma takiego przypadku
  użycia, więc nie blokuje.
- [ ] `rebuild/frontend/src/pages/konfiguracja/Katalog.tsx:249-262` — tekst „Pozostało N bez wagi
  (…) — zobacz je w katalogu” liczy różnicę (`wszystkichKandydatow - zaktualizowano`) osobno od
  filtra `brak_waga`; oba źródła danych są spójne dziś, ale to dwa niezależne obliczenia tej samej
  liczby (jedno na serwerze przy dociąganiu, jedno w `filtrujStatus` na kliencie) — czysto
  informacyjne, nie wymaga zmian.

## Plan compliance

### Done ✓
- Nowa opcja filtra `brak_waga` w `filtrowanie.ts`, próg pustości identyczny bajt-w-bajt z
  backendowym `jestPustaWaga()` (`null`/`undefined`/`""`/`NaN`/`0`) — zweryfikowane porównaniem
  kodu obu funkcji.
- Dropdown w `Katalog.tsx` + inicjalizacja stanu `status` z `?status=` przez `useSearch()`,
  z walidacją przeciw nieznanym/złośliwym wartościom (fallback do `"all"` przez `OPCJE_STATUSU.some`).
- Trwały komunikat + link w `konfiguracja/Katalog.tsx`, widoczny tylko gdy
  `zaktualizowano < wszystkichKandydatow` — poprawnie chowa się też przy `wszystkichKandydatow === 0`
  (przypadek `0 < 0` = `false`, sprawdzone).
- Testy pokrywają: próg pustości (5 wariantów), deep link ustawiający filtr, link znika przy
  100% pokryciu, link pojawia się i wskazuje poprawny `href` przy częściowym pokryciu.
- Komentarze jasno oznaczają NOWĄ logikę vs port (ticket 166 vs 155/156 vs oryginał `:23306`).

### Missing or deviating ✗
Brak — zakres z raportu pokrywa się z diffem.

### Definicja ukończenia
- [x] Filtr `brak_waga` z progiem spójnym z backendem
- [x] Deep link `?status=brak_waga` działający i zwalidowany
- [x] Trwały link z wyniku „Dociągnij wagę”, poprawny warunek widoczności (w tym edge case 0/0)
- [x] Testy nowej logiki (filtrowanie, deep link, link znika/pojawia się)
- [x] `npm run lint && npm run typecheck && npm run build && npm test` zielone (zweryfikowane
  ponownie w review: lint czysty, typecheck czysty, 80/80 testów w trzech zmienionych plikach)

## Parallel-test concerns

None — wszystkie nowe testy używają lokalnego renderu/MSW per-test, bez współdzielonych zasobów
(portów, plików, stałej bazy).

## Overall assessment

Czysta, dobrze skoncentrowana zmiana czysto frontendowa. Próg pustości wagi jest dosłownie
przepisany z backendu (nie tylko „podobny”), walidacja parametru URL jest solidna wobec
nieznanych wartości, a warunek widoczności linku poprawnie obsługuje edge case pustego katalogu
kandydatów. Jedyna uwaga (SHOULD-FIX) to kosmetyczny stan wyścigu komunikatów przy błędzie po
wcześniejszym sukcesie — nie blokuje merge'a.
