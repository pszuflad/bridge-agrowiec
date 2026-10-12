# 236-FEATURE-partnerzy-numer-katalogowy-ean-dostawca — Code review

> Reviewed: 2026-10-12
> Branch: claude/peaceful-gates-a8yebr
> Diff: 10 plików, 1 commit (dc9f969)

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/backend/src/partnerzy/selekcja.ts:51-55` vs `walidacja-zamowienia.ts:~44` — asymetria normalizacji: `numerPartnera()` wycina WSZYSTKIE białe znaki z EAN i dostawcy (`"MO 4"` → `MO4`), a wyszukiwanie porównuje `products.ean` i `upper(products.dostawca)` z surowymi wartościami z bazy.
  - Reason: numer wysłany w pliku nie odnajdzie się w zamówieniu, gdy w bazie EAN/dostawca ma spację w środku (lub dostawca ma spacje na brzegach) — zamówienie dostaje `blad_importu` mimo poprawnego numeru.
  - Suggestion: albo nie wycinać spacji (tylko trim), albo w SQL porównywać `replace(ean,' ','')`/`replace(upper(dostawca),' ','')`; dodać test z dostawcą ze spacją. Zmierzyć na kopii bazy, czy takie wartości istnieją.
- [ ] `walidacja-zamowienia.ts:~44` — `sql\`upper(dostawca) = ...\`` + `eq(ean)` bez indeksu na `products.ean`/`dostawca` (pełny skan przy każdej pozycji zamówienia bez trafienia po `kod`). Przy ~5,4 tys. wierszy akceptowalne, ale zamówienia z EAN-dostawca pójdą tą ścieżką zawsze (po nieudanym `eq(kod)`); sprawdzić `EXPLAIN` lub odnotować w wpisie spec.
- [ ] `walidacja-zamowienia.ts` (całość `znajdzPozycjeKatalogu`) — pierwszeństwo `products.kod` przed EAN-dostawca: w katalogu są kody z `-` / spacjami; jeśli istnieje `products.kod` równe napisowi `<EAN>-<dostawca>` innej pozycji, wygra ta po `kod`. Mało prawdopodobne, ale brak testu ani pomiaru kolizji na kopii bazy — zmierzyć (`SELECT kod FROM products WHERE kod LIKE '%-%'`) i zapisać wynik w raporcie.
- [ ] `walidacja-zamowienia.ts` — przy wielu trafieniach (ten sam EAN+dostawca w kilku magazynach) wybór „największy stan" jest nieokreślony przy remisie stanów (brak drugiego klucza sortowania, np. `kod`/`id`) — wynik zależy od kolejności zwrotu SQLite. Dodać deterministyczny tie-break i test remisu. Dodatkowo: po zmapowaniu zamówienie trafia do zapisu pod innym `kod` niż w `CODE` — sprawdzić, że `partner_zamowienia_pozycje`/wysyłka do sklepu używają `PozycjaKatalogu.kod`, a nie surowego `CODE` (w diffie nie ma tego śladu).
- [ ] `generator.ts:167` — rzutowanie `(w as { bezNumeru?: number })` omija typy; `w` to unia CSV/XML. Lepiej dodać `bezNumeru` do wyniku XML (=0) albo zawęzić gałąź. Brak testu ostrzeżenia generatora („N pozycji pominięto — brak EAN lub dostawcy"); test dotyczy tylko `zbudujCsv`.
- [ ] `plik-csv.ts:104` — pozycja bez numeru wypada z CSV po cichu dla pliku; podgląd w panelu (`podglad`) i liczniki `pominiete` (selekcja/panel) nie zawierają `bezNumeru` — operator zobaczy mniej wierszy bez wyjaśnienia poza ostrzeżeniem w logu. Sprawdzić, czy podgląd/`wynik.pominiete` pokazują ten licznik (zgodnie z planem „ostrzeżenie w logu" — OK, ale rozważyć UI).
- [ ] Duplikaty numeru w pliku (znane ryzyko, `wpis-236.md`): ten sam EAN+dostawca w kilku magazynach daje wiele wierszy z tym samym `CatNumber`. Brak testu ani ostrzeżenia w generatorze (np. licznik zduplikowanych numerów) — partner może zdublować/nadpisać pozycje po swojej stronie. Co najmniej ostrzeżenie.
- [ ] Brak testu zgodności „round-trip": numer wygenerowany przez `numerPartnera()` odnajduje pozycję w `znajdzPozycjeKatalogu` (EAN z myślnikiem, EAN ze spacją, dostawca z małymi literami). Test walidacji używa tylko prostego `745384925`/`MO4`.

## NICE-TO-HAVE

- [ ] `walidacja-zamowienia.ts` — sortowanie `[...kandydaci].sort(...)` można zastąpić jednym przebiegiem/`ORDER BY` w SQL z `limit 1`; kopia tablicy zbędna.
- [ ] `walidacja-zamowienia.ts` — `upper()` w SQLite jest ASCII-only (zgodnie z CLAUDE.md); dla dostawców typu `MO4` OK, warto dopisać krótki komentarz.
- [ ] `frontend/src/pages/partnerzy/api.ts:89` — etykieta „numer katalogowy EAN-dostawca" tuż obok „kod (numer katalogowy)" może mylić; rozważyć „kod partnera (EAN-dostawca)".
- [ ] `plik-xml.ts:61` — dla XML `numerPartnera=null` daje pusty atrybut (pominięty, bo `wartosc !== ""`); zgodne z planem (poza zakresem), ale `id="..."` oferty nadal = `products.kod`. Zapisać w wpis-236, że XML nie używa nowego numeru jako `id` (partner XML dostaje inny identyfikator niż CSV, a zamówienia akceptują oba).

## Plan compliance

### Done ✓
- Pole `numerPartnera` + źródło kolumny CSV (`POLA_KATALOGU`), pominięcie pozycji bez numeru + ostrzeżenie w generatorze.
- `znajdzPozycjeKatalogu`: dokładny `kod` → EAN-dostawca (ostatni `-`, dostawca case-insensitive), aktywna z największym stanem; test.
- Panel: nowe źródło w wyborze kolumn (frontend `POLA_KATALOGU`).
- Brak migracji; wpis `docs/spec-backend/wpis-236.md` (osobny plik, zgodnie z regułą).
- XML poza zakresem — zgodnie z planem pusta wartość, wiersze nie są pomijane.

### Missing or deviating ✗
- Brak `raport.md` w katalogu ticketu (tylko `plan.md`) — brak wyników bramek do zweryfikowania (lint/typecheck/test nie były uruchamiane w tym przeglądzie).
- Kontrakt: `contract/openapi.yaml` nie zmieniony; jeśli enum źródeł kolumny katalogu jest tam opisany (`zrodlo`), dodać `numerPartnera` — do sprawdzenia (GATE kontraktu). Plan nie wspomina o zmianie kształtu API.
- Plan: „reguła nazwy/`nazwa_pamiec`" nie dotyczy (brak zmiany nazwy) — OK.

### Definition of done
- [x] Pole katalogu i kolumna CSV działają (test `zbudujCsv`).
- [x] Wyszukiwanie po EAN-dostawca z testem.
- [ ] Ostrzeżenie generatora — kod jest, testu brak.
- [ ] Raport z wynikami bramek — brak pliku `raport.md`.

## Parallel-test concerns

None — nowe testy używają `stworzSrodowiskoTestowe` (baza tymczasowa) i czystych funkcji; wszystkie parallelizable.

## Overall assessment

Zmiana jest mała, spójna z planem i zlokalizowana (jedno miejsce mapowania, brak migracji). Brak blokerów; główne ryzyka to niespójna normalizacja EAN/dostawcy między generowaniem a wyszukiwaniem (spacje), niedeterministyczny wybór przy remisie stanów oraz luki w testach (round-trip, ostrzeżenie generatora, duplikaty numeru). Warto też potwierdzić, że do dalszej obsługi zamówienia używany jest zmapowany `products.kod`, a nie surowy `CODE`.
