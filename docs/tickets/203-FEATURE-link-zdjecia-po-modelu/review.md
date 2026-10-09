# 203-FEATURE-link-zdjecia-po-modelu — Code review

> Reviewed: 2026-10-09
> Branch: feature/203-link-zdjecia-po-modelu
> Diff: 26 plików (+1511/-4), 5 commitów vs origin/develop

## BLOCKER

Brak.

(Sprawdzone i w porządku: kolejność wpięcia po `applyLinkMemory` — pamięć wygrywa, guard „nie nadpisuj istniejącego linku pustym" z legacy działa przed naszą funkcją, więc istniejący produkt z linkiem nie jest nadpisany; opt-in domyślnie wyłączony w `zatwierdzPozycjeStagingu`/`dodajProduktyBulk`, więc harness charakteryzacyjny nietknięty; `legacy/` i `schema.ts` bez zmian.)

## SHOULD-FIX

- [ ] `rebuild/backend/src/routes/maintenance.ts:217` — `dry_run` jest rozpoznawane tylko przy `=== true`; każda inna wartość (`"true"`, `1`, literówka) po cichu przechodzi do ZAPISU wszystkich propozycji i zakłada poprawki.
  - Reason: operacja zapisująca setki poprawek po złym typie flagi to zbyt łatwa pomyłka (np. klient CLI/curl). Wzorzec jest zgodny z `dziedzicz-wage`, ale tu zapis dodatkowo blokuje import dostawcy.
  - Suggestion: odrzucić 400, gdy `dry_run` jest podane i nie jest booleanem; dodać test.
- [ ] `rebuild/backend/src/import/akceptacja.ts:~214` (+ `dziedziczenieLinkow.ts:~129`) — przy akceptacji bez przekazanego indeksu `applyLinkDziedziczony` woła `zbudujIndeksLinkow(db)` = pełny skan `products` (~5,4 tys. wierszy + grupowanie w JS) dla KAŻDEJ zatwierdzanej pozycji z pustym linkiem i parą marka+model. Przy akceptacji masowej (tysiące pozycji, `allFiltered`) to O(N × katalog) w jednym żądaniu.
  - Suggestion: indeks lazy per-partia przekazywany z pętli akceptacji masowej (jak w `bulk.ts`), albo zapytanie SQL `WHERE UPPER(marka)=? AND UPPER(model)=?` dla pojedynczej pary.
- [ ] `rebuild/backend/src/import/bulk.ts:~132` — komentarz mówi „linki dodane w trakcie partii wejdą od następnej", a indeks jest budowany raz i NIE odświeża się. Zachowanie (stały indeks) jest sensowne, komentarz wprowadza w błąd; popraw komentarz. Dodatkowo `indeksLinkow` jest budowany w transakcji — OK, ale pozycja dodana w partii z linkiem nie zasila kolejnych pustych w tej samej partii (należy to świadomie przyjąć).
- [ ] `contract/openapi.yaml` (~l.19067) — opis „Od ticketu 203 dochodzi pole `linkZdjecia`…" został dopisany do `POST /api/ai-fallback/parse`, a dotyczy edycji pozycji stagingu (`PUT /api/staging/{id}`, `POLA_EDYTOWALNE` w `staging-mutacje.ts`). Realna zmiana kontraktu (nowe edytowalne pole + zapis poprawki) nie jest opisana przy właściwej ścieżce; opis przy ai-fallback jest błędny.
  - Reason: GATE kontraktu — zmiana przyjmowanych pól bez opisu przy właściwym endpoincie.
- [ ] `contract/openapi.yaml` schemat `GETStagingIdPropozycjaZdjeciaOdpowiedz200` + `contract/fixtures/GET_staging_id_propozycja-zdjecia.json` — kod zwraca `{ propozycja: null }` (brak linku/dopasowania), a schemat ma `propozycja` jako `type: object` bez `nullable`. Fixture pokazuje tylko wariant z wartością. Dopisz `nullable: true` (lub `oneOf` z null) i ewentualnie drugi fixture/test wariantu `null`.
- [ ] Interakcja z silnikiem importu (`src/import/silnik/overrides.ts`) — uzupełniony link staje się poprawką Marty, a `poprawkiMarty` podmienia wartość z pliku BEZWARUNKOWO i zgłasza konflikt (`_srcConflict`, `naruszono`) za każdym razem, gdy dostawca poda niepusty, inny link. Produkty, którym dziedziczymy link, mają zwykle pusty link u dostawcy, więc na dziś OK; ale gdy dostawca później zacznie podawać własny link, trafi on do stagingu jako „konflikt ze źródłem" i nigdy nie wejdzie do katalogu bez ręcznego usunięcia poprawki (decyzja 5 planu, świadoma). Brakuje: (a) testu integracyjnego, że po uzupełnieniu kolejny przebieg silnika (`poprawkiMarty`) zachowuje link i zgłasza/nie zgłasza konflikt zgodnie z oczekiwaniem, (b) jakiejkolwiek metryki/wskazania w UI, ile takich poprawek powstało (audyt trasy zapisuje tylko liczby, nie id/kody — `maintenance.ts:~236`). Rozważ wpisanie listy id/kodów do `szczegoly` audytu.
- [ ] Pokrycie testami — brak: testu `dry_run` z wartością nie-boolowską, testu akceptacji istniejącego produktu z pustym linkiem w snapshocie (guard legacy vs nasza funkcja), testu `dodajProduktyBulk` dla istniejącego produktu z linkiem, testu że ręczna edycja/wyczyszczenie `linkZdjecia` w stagingu (PUT, nowe pole) zakłada override i blokuje podpowiedź/uzupełnienie przy akceptacji (to krytyczna ścieżka planu, DoD pkt 2), testu `ids: []`. Ścieżka pustego `ids` zapisuje zero — OK, ale nietestowana.
- [ ] `rebuild/backend/src/import/akceptacja.ts:~296` / `bulk.ts:~202` — błąd `zapiszPoprawkeLinku` jest połykany `catch {}`: produkt dostaje uzupełniony link BEZ ochrony poprawką (kolejny import go nadpisze, wbrew decyzji 5), bez śladu w logu. Zalogować ostrzeżenie (jak w innych miejscach repo) lub chociaż policzyć.

## NICE-TO-HAVE

- [ ] `dziedziczenieLinkow.ts:74` — `znajdzPropozycje`: warunek remisu `najlepszy !== null` jest zbędny przy pierwszym elemencie (obsługuje go `liczba > ile`); działa poprawnie, ale upraszczalny.
- [ ] `dziedziczenieLinkow.ts` — klucz `marka|model` traktuje „UNKNOWN" (fallback marki w `akceptacja.ts`) jak realną markę: produkty z `UNKNOWN`+ten sam model dostaną wspólny link. Rozważ pominięcie `UNKNOWN`/`—` jako braku danych (parytet z `bulk.ts`, gdzie fallback to `—`).
- [ ] `routes/maintenance.ts` — `ids` bez limitu rozmiaru i bez deduplikacji; `Set` to rozwiązuje, limit zbędny przy `requireAuth`, ale warto odnotować.
- [ ] Audyt `encjaId: "wszystkie"` także przy zapisie wybranych `ids` — mylące; lepiej `"wybrane"` lub lista.
- [ ] Zakres autoryzacji: tylko `requireAuth` (zgodnie z `dziedzicz-wage`), bez sprawdzania roli, mimo że operacja modyfikuje setki produktów i zakłada poprawki. Spójne z precedensem — do decyzji, nie zmiana w tym tickecie.
- [ ] Brak pomiaru skali (ile pustych/dopasowalnych) — plan zakłada podgląd dry-run po stronie użytkowniczki; warto dopisać w PR instrukcję uruchomienia `npm run uzupelnij-zdjecia` w trybie podglądu na kopii.

## Plan compliance

### Done ✓
- Moduł `dziedziczenieLinkow.ts` (poza `legacy/`) z wszystkimi funkcjami z planu.
- Wpięcie w `akceptacja.ts` i `bulk.ts` po `applyLinkMemory`, opt-in, zapis poprawki PO zapisie produktu; klucz poprawki liczony PRZED `nadajKod`/`assignKodImportu` (dostawca + kod dostawcy — zgodny z kluczem `poprawkiMarty`, bo `products.kod` = `pozycja.kod`).
- Trasy: `POST /api/products/uzupelnij-zdjecia` (dry_run/ids, audyt), `GET /api/staging/:id/propozycja-zdjecia`; skrypt CLI + `package.json`.
- Walidacja `ids` (lista liczb całkowitych), transakcja zapisu, przeliczenie propozycji przy zapisie (nie ufa podglądowi).
- Podpowiedź w stagingu z możliwością edycji (`linkZdjecia` w `POLA_EDYTOWALNE` + override), podgląd/zapis w Katalogu, openapi + 2 fixtures, wpis `spec-backend/wpis-203.md`, testy BE i FE.

### Missing or deviating ✗
- `fabryka.ts` (auto-zatwierdzanie) — plan pkt 2 przewidywał wpięcie; raport uzasadnia pominięcie (łata tylko istniejące produkty, lukę domyka przycisk). Odchylenie jawne, akceptowalne.
- Podpowiedź tylko w szczegółach pozycji, nie w kolumnie tabeli — jawnie opisane w raporcie.
- Zmiana kontraktu `PUT /api/staging/{id}` (nowe pole edytowalne) opisana przy złym endpointcie (patrz SHOULD-FIX).
- Staging v2: `polityka/akceptacja.ts` włącza opt-in (OK), ale brak testu na tej ścieżce (`zatwierdzPozycjeZPolityka`) — testy wołają `zatwierdzPozycjeStagingu` bezpośrednio.

### Definition of done
- [x] Podgląd i zapis w katalogu działają, pomijają niepuste i chronione
- [x] Podpowiedź w stagingu z możliwością edycji; akceptacja wpisuje link (test przez bazową akceptację; brak testu przez politykę)
- [x] Uzupełnione linki chronione przez `manual_overrides`
- [ ] Openapi + fixtures + testy zielone — zielone wg raportu, ale kontrakt ma nieścisłości (nullable `propozycja`, opis przy złym endpointcie)
- [ ] Gałąź zsynchronizowana z `origin/develop`, bramki po synchronizacji, PR `MERGEABLE` — raport nie potwierdza synchronizacji ani PR (do zrobienia przez Mastera)

## Parallel-test concerns

None — testy używają bazy tymczasowej (`posprzataj`) i efemerycznych portów; nic nie współdzieli zasobów.

## Overall assessment

Czysta, dobrze udokumentowana implementacja zgodna z wzorcem dziedziczenia wagi; kolejność względem pamięci linków, opt-in i ochrona poprawką są poprawne, bez blockerów. Główne uwagi: miękka walidacja `dry_run` przy zapisie, koszt pełnego skanu katalogu na pozycję przy akceptacji masowej, nieścisłości kontraktu (nullable, opis przy złym endpointcie) oraz luki w testach ścieżki edycji w stagingu i konfliktów z silnikiem importu.
