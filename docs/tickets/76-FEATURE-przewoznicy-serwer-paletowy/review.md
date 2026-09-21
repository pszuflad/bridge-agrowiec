# 76-FEATURE-przewoznicy-serwer-paletowy — Code review

> Reviewed: 2026-09-21
> Branch: feature/76-przewoznicy-serwer-paletowy
> Diff: 17 plików, 3 commity (`6af44a0`, `15a7c31`, `d445935`)

## BLOCKER

- [ ] `rebuild/frontend/src/pages/waga-gabarytowa/TabelaPrzewoznikow.tsx:241-265` — pola `Input`
  edycji nazwy i dzielnika nie są zablokowane w trakcie zapisu (`disabled={zapisuje}` jest tylko na
  przyciskach usuń/dodaj/reset, linie 217, 279, 312 — pola tekstowe go nie mają).
  - Reason: `zatwierdzPole` (onBlur, linia 77) buduje nową listę przez `przewoznicy.map(...)`, gdzie
    `przewoznicy` to prop z poprzedniego renderu. `zapiszListe` woła `mutateAsync` bez oczekiwania
    (`void zapiszListe(...)`), a optymistyczny `setQueryData` w `onMutate` (`WagaGabarytowa.tsx:72-75`)
    ląduje w cache dopiero po `await klient.cancelQueries(...)` — czyli nie w tym samym takcie.
    Jeśli użytkownik zdąży opuścić DRUGIE pole (inny wiersz albo inna kolumna) zanim pierwszy zapis
    zdąży się odzwierciedlić w propsie `przewoznicy`, drugi `PUT` wyśle listę zbudowaną na starych
    danych i po zapisaniu **po cichu cofnie pierwszą zmianę** na serwerze (ostatni zapis wygrywa —
    zgodnie z założeniem D, ale tu przegrywa zapis, który użytkownik faktycznie zrobił jako pierwszy,
    nie „czyjś inny", tylko WŁASNA wcześniejsza edycja w tym samym oknie). To dokładnie scenariusz z
    dopisku pliku: „Ania dodaje tu własnych przewoźników i poprawia dzielniki" — czyli edycja kilku
    wierszy z rzędu jest głównym, oczekiwanym użyciem tego ekranu, nie przypadkiem brzegowym.
  - Suggestion: zablokować pola tekstowe tak jak przyciski (`disabled={zapisuje}` na `Input` przy
    nazwie i dzielniku), albo budować kolejną listę z `klient.getQueryData(KLUCZ_PRZEWOZNIKOW)` w
    momencie zapisu zamiast z propsa, albo serializować zapisy (kolejka/await poprzedniego zanim
    przyjmie się kolejny blur). Ten sam wzorzec dotyczy `usun` (linia 128) i `dodaj` (linia 135) —
    wszystkie budują listę z tego samego potencjalnie nieaktualnego propsa.

## SHOULD-FIX

- [ ] `rebuild/backend/src/waga-gabarytowa/przewoznicy.ts:56-66` — walidacja nie sprawdza, czy więcej
  niż jeden element ma `domyslny: true`.
  - Reason: nieszkodliwe dla obliczeń (front nie steruje wyborem po `domyslny`), ale niespójny stan
    w bazie (dwóch „domyślnych") nigdy nie jest sygnalizowany.
  - Suggestion: opcjonalnie — nie jest to część DoD, niski priorytet.

- [ ] `contract/README.md` — konwencja `x-odbudowa-nowa-trasa` nie jest tam opisana (jest tylko
  `x-odbudowa-auth`, linia 139).
  - Reason: sam raport.md (sekcja Follow-up) to przyznaje i odkłada na potem — zgadzam się z
    odłożeniem, ale odnotowuję, żeby nie zgubić się przy kolejnej trasie spoza produkcji.
  - Suggestion: dopisać przy najbliższej okazji, jak zapowiedziano w raporcie.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/waga-gabarytowa/TabelaPrzewoznikow.tsx:226` — kontener tabeli ma
  `overflow-hidden`, nie `overflow-x-auto` (jak `TabelaHistorii.tsx`, `TabelaNarzutow.tsx` i inne
  tabele w projekcie). Kolumna „Akcje" w trybie edycji zwiększa szerokość wiersza — na wąskim
  ekranie może się przycinać zamiast przewijać. Linia nietknięta w tym diffie (przedticketowa), więc
  nie blokuję, ale warto rozważyć przy kolejnej wizycie w tym pliku.
- [ ] `rebuild/backend/src/waga-gabarytowa/przewoznicy.ts:41` — brak górnego limitu długości listy
  (`cialo.length`); przy koncie z `requireAuth` ryzyko minimalne, ale warto rozważyć sensowny limit
  (np. 50) jako higieniczne zabezpieczenie.

## Plan compliance

### Done ✓
- Migracja `007` — tabela + seed sześciu przewoźników, GEIS domyślny, `INSERT OR IGNORE`
  (`rebuild/schema/007_waga_gab_przewoznicy.sql`), zgodna z listą Ani; test `db.migracje.test.ts`
  liczy 27 tabel.
- Model Drizzle `wagaGabPrzewoznicy` (`domyslny` w trybie boolean) — `src/db/schema.ts`.
- `repos/przewoznicy.ts` — odczyt z jawną projekcją i `ORDER BY kolejnosc`, zapis w transakcji
  (DELETE + INSERT z `kolejnosc = indeks`), zgodnie z planem.
- `waga-gabarytowa/przewoznicy.ts` (backend) — czysta funkcja walidująca, komunikaty z numerem
  pozycji, dokładnie reguły z założenia E (pusta lista, brak tablicy, `id` niepusty bez duplikatów,
  `nazwa` niepusta po trim, `dzielnik` liczbą dodatnią, `domyslny` opcjonalny boolean, obce pola
  odcięte).
- `routes/waga-gabarytowa.ts` — `GET`/`PUT` za `requireAuth`, walidacja → odczyt „przed" → zapis →
  audyt w try/catch (wzorzec `atrybuty.ts`) → `200` z listą po zapisie. `/oblicz` bez zmian.
- `contract/openapi.yaml` — nowa ścieżka z `x-odbudowa-nowa-trasa`, kody 200/400/401, `security:
  bearerAuth`+`cookieAuth`; `/oblicz` bez zmian; `contract/fixtures/` nieruszane (potwierdzone
  `git status`).
- Frontend: `useQuery` listy, `useMutation` PUT z optymistycznym `setQueryData` i rollbackiem przez
  `invalidateQueries` przy błędzie; efekt D3 wyrównujący `wybrany` po `wczytano` (bez przedwczesnego
  resetu przed hydratacją IndexedDB — sprawdzone czytaniem kodu, brak pętli).
  `TabelaPrzewoznikow.tsx` — zapis na blur (D2), dwa `DialogPotwierdzenia` (usunięcie, reset),
  blokada przycisków w trakcie zapisu (częściowa — patrz BLOCKER).
  `KalkulatorPaletowy.tsx` — nowy, bez pamięci (D4), pełny wynik pięciu pól.
- Stary klucz IndexedDB `waga-gabarytowa-przewoznicy` (C) — potwierdzone: nie jest ani czytany, ani
  pisany (test FE `waga-gabarytowa.test.tsx:160-179` dowodzi wprost).
- `lib/magazynKV.ts`, `obliczenia.ts`, `formula.ts`, `historia/mapowanie.ts`, Spedycja,
  `contract/fixtures/` — potwierdzone nietknięte (`git diff --stat` puste dla tych ścieżek).
- Testy backendu (23 przypadki w `waga-gabarytowa.przewoznicy.test.ts`) i frontendu (MSW,
  scenariusze z karty) — uruchomione lokalnie, zielone (`vitest run`), nie tautologiczne: sprawdzają
  konkretne komunikaty, kolejność, `audit_log`, treść żądań `PUT`/`POST`.
- `npm run typecheck` (backend i frontend) — zielony lokalnie.

### Missing or deviating ✗
- Brak — zakres z `Implementation plan` pokryty w całości; jedyne odstępstwo (kształt odpowiedzi
  200/400 w tekście markera zamiast inline w linii statusu) jest opisane i uzasadnione w
  raport.md „Deviations from plan" i widoczne w `contract/openapi.yaml`.

### Definition of done
- [x] Migracja 007 tworzy tabelę i sześciu przewoźników w kolejności, GEIS `domyslny`.
- [x] `GET/PUT /api/waga-gabarytowa/przewoznicy` działają za `requireAuth`, walidują i audytują.
- [x] Kontrakt opisuje nowe trasy, `/oblicz` bez zmian, fixtures bez zmian.
- [x] Widok czyta listę z API, nie z IndexedDB; edycje zapisują się na serwer — **z zastrzeżeniem**:
      działa poprawnie dla pojedynczej edycji na raz; przy szybkiej edycji kilku pól z rzędu możliwa
      cicha utrata wcześniejszej zmiany (patrz BLOCKER).
- [x] Usunięcie i „Przywróć domyślne" pytają o potwierdzenie, anulowanie nic nie zmienia
      (potwierdzone testami FE).
- [x] Ostatniego przewoźnika nie da się usunąć; usunięcie wybranego przenosi wybór.
- [x] Wybór usunięty przez kogoś innego → pierwszy z listy.
- [x] Kalkulator paletowy woła `/oblicz` i pokazuje pełny wynik.
- [x] `waga-gabarytowa.obliczenia.test.ts` przechodzi bez zmian; bramki BE i FE zielone (lint,
      typecheck, build wg raport.md; typecheck i testy zweryfikowane lokalnie w tym review).

## Parallel-test concerns

None — backend testy używają `stworzSrodowiskoTestowe()` (baza tymczasowa, port efemeryczny, jak
reszta kanonu), frontend testy są RTL + MSW bez zasobów współdzielonych. Wszystkie równoległe.

## Overall assessment

Implementacja jest solidna i dobrze udokumentowana — trzy odstępstwa są jawnie oznaczone, kontrakt i
migracja mają wyczerpujące komentarze „dlaczego", a testy (backend i frontend) są konkretne, nie
tautologiczne, i faktycznie sprawdzają zachowanie z karty (potwierdzenia, blur-save, D3, walidację
400 pozycja po pozycji, audyt). Jedyny poważny problem to realna, niepokryta testem luka
współbieżności po stronie klienta: pola tekstowe edytora nie są blokowane w trakcie zapisu, więc
szybka edycja kilku wierszy z rzędu (opisana w komentarzu pliku jako główny scenariusz użycia) może
po cichu cofnąć wcześniejszą zmianę. To do naprawy przed merge — reszta to kosmetyka i notatki na
przyszłość.
