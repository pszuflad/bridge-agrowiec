# 230-FEATURE-partnerzy-panel-zamowien — Code review

> Reviewed: 2026-10-10
> Branch: claude/peaceful-gates-a8yebr
> Diff: 14 plików, 1 commit (f465904)

## BLOCKER

Brak.

Sprawdzone pod kątem blockerów:
- Izolacja partnerów: `szczegolyZamowieniaDlaPartnera` porównuje `z.partnerId !== partnerId` i zwraca `null`, więc trasa daje 404. Zamówienie innego partnera nie wycieka, a test to pokrywa. Odpowiedź 404 jest taka sama dla "cudzego" i "nieistniejącego", więc nie da się sprawdzić, czy id istnieje.
- Autoryzacja: obie trasy mają `requireAuth` i test 401.
- Walidacja id: `idZParametru` sprawdza liczbę całkowitą >= 1 i istnienie partnera. `zamowienieId` jest sprawdzane przez `Number.isInteger` i `> 0`. Zapytania są parametryzowane przez Drizzle. SQL w podzapytaniu jest stały, bez interpolacji danych użytkownika.
- Podzapytanie `liczbaPozycji`: `partner_zamowienia_pozycje p WHERE p.zamowienie_id = partner_zamowienia.id` ma jawne nazwy tabel. Tabela zewnętrzna występuje w zapytaniu pod własną nazwą (bez aliasu), więc odwołanie jest poprawne. Test oczekuje 2, a nie 1. Indeks `idx_partner_zamowienia_pozycje_zam` pokrywa korelację, więc to jedno zapytanie bez N+1.
- Brak zmiany istniejących kształtów API i `openapi.yaml`. Plan jawnie deklaruje trasy poza kontraktem, jak reszta `/api/partnerzy*`.

## SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/partnerzy/ZamowieniaPartnera.tsx:15-16` / `api.ts` (`LIMIT_ZAMOWIEN = 50`) — lista pobiera tylko 50 najnowszych zamówień i nie ma paginacji ani informacji, że są starsze.
  - Reason: operator nie dojdzie do zamówienia nr 51 i dalszych, a UI nie mówi, że lista jest obcięta. Plan zostawia filtry i wyszukiwanie poza zakresem, ale sam brak sygnału "pokazano 50 z N" jest luką.
  - Suggestion: dodać przycisk "Pokaż starsze" (offset) albo przynajmniej komunikat, gdy `zamowienia.length === LIMIT_ZAMOWIEN`. Zapisać to w follow-upie, jeśli ma zostać na później.
- [ ] `rebuild/backend/src/routes/partnerzy.ts:69-72` (`stronicowanie`, używane przez nową trasę, linia 92-96) — `?limit=1.5` albo `?offset=2.7` przechodzi przez `Math.min/max` jako liczba niecałkowita i trafia do `LIMIT`/`OFFSET` w SQLite. Wynik to prawdopodobnie `datatype mismatch` i 500 zamiast 400 lub zaokrąglenia.
  - Reason: błąd istniejącego helpera, odziedziczony po trasach `logi` i `error-log`. Nowa trasa go powiela, a plan wymienia walidację `limit`/`offset` jako zakres.
  - Suggestion: `Math.trunc` albo `Number.isInteger` w `stronicowanie` (jedna poprawka dla wszystkich trzech tras). Dopisać test `limit=abc` i `limit=1.5`. Obecny test sprawdza tylko `limit=1&offset=1`.
- [ ] `rebuild/backend/test/partnerzy.zamowienia-trasy.test.ts:46` — asercja `expect(Object.keys(lista[0]!)).not.toEqual(expect.arrayContaining(["surowyXml"]))` jest słaba i nieczytelna. Nie pilnuje też, że lista nie ma `dostawa`, `faktura`, `skrotXml` ani `dostawaJson`. Wyciek danych osobowych sprawdza dopiero następna linia, i to tylko po napisie "Jan Kowalski".
  - Reason: założenie planu "dane osobowe tylko w szczegółach" jest kluczowe, a `listaZamowien` używa jawnej projekcji, więc test powinien ją pilnować wprost.
  - Suggestion: pętla `for (const k of ["surowyXml","skrotXml","fakturaJson","dostawaJson","dostawa","faktura"]) expect(lista[0]).not.toHaveProperty(k)`, jak w teście szczegółów.
- [ ] `rebuild/backend/test/partnerzy.zamowienia-trasy.test.ts:9-73` — brak testu, że lista partnera A nie zawiera zamówień partnera B. Jest tylko test szczegółów (404). Filtr `eq(partnerId)` w `listaZamowien` nie jest pilnowany od strony trasy (dwóch partnerów założono w `beforeEach`, `b` jest użyty tylko raz).
  - Suggestion: zapisać zamówienie dla `b` i sprawdzić, że `GET /api/partnerzy/${a}/zamowienia` go nie zwraca.
- [ ] `rebuild/frontend/src/pages/partnerzy/ZamowieniaPartnera.tsx:48-70` — dane dostawy (`dostawa`) to dane osobowe klienta końcowego (imię, adres, telefon, e-mail), wyświetlane po rozwinięciu każdemu zalogowanemu użytkownikowi, z kluczami XML (`CUSTOMERNAME`, `PHONE`) pokazanymi jako etykiety. Faktura (`faktura`) jest zwracana przez API, ale panel jej nie pokazuje.
  - Reason: plan zakłada pokazanie "faktury" w szczegółach, a zakres frontu mówi tylko o adresie dostawy, więc to świadome. Warto jednak potwierdzić z użytkownikiem, że NIP/dane faktury zostają niewidoczne, i że dostęp do danych osobowych nie wymaga roli (jest tylko `requireAuth`, jak reszta panelu). Klucze po angielsku z XML to wada UX (nie tłumaczone na polskie etykiety).
  - Suggestion: mapa etykiet PL dla znanych kluczy (kraj, miasto, ulica, telefon) z fallbackiem na klucz. Wpisać decyzję o danych osobowych do `wpis-230.md`.
- [ ] `rebuild/frontend/src/pages/partnerzy/ZamowieniaPartnera.tsx:15` — "Odśwież" odświeża tylko listę (`lista.refetch()`). Otwarte szczegóły (`kluczZamowienia`) zostają w cache i przy ponownym rozwinięciu nie pobierają się od nowa (brak `refetchOnMount`, w odróżnieniu od listy). Stan `otwarte` zostaje po odświeżeniu, nawet gdy zamówienie zniknęło z listy (wtedy po prostu nic nie jest rozwinięte, bez błędu — to akurat OK).
  - Reason: zamówienie jest nadpisywane tylko przy zmianie XML, a statusy dojdą w 7.4/7.5, więc dziś ryzyko jest małe. Przy dodaniu statusów szczegóły będą nieaktualne.
  - Suggestion: `refetchOnMount: "always"` także w `SzczegolyZamowieniaWidok`, albo unieważnić klucz `[KLUCZ_PARTNERZY, id, "zamowienia"]` przy "Odśwież". Do rozważenia przed 7.4.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/partnerzy/ZamowieniaPartnera.tsx:24-27` — tekst pomocniczy "Zamówienia odebrane kanałem e-mail" stoi na sztywno, a odbiór e-mail jest nieprzetestowany na prawdziwym IMAP i domyślnie wyłączony. Dobrze byłoby pokazać (np. gdy lista pusta), czy `partner.kanalEmail` jest włączony, żeby "Brak zamówień" nie wprowadzało w błąd.
- [ ] `rebuild/frontend/src/pages/partnerzy/ZamowieniaPartnera.tsx:44-46` — `z.status` pokazywany surowo (`nowe`). Przy dodaniu statusów w 7.4 zamienić na etykiety PL. Brak pokazania `numerWlasny` (jest w typie i API, ale nie w UI) — świadome, bo zawsze `null` do czasu 7.5.
- [ ] `rebuild/frontend/src/pages/partnerzy/ZamowieniaPartnera.tsx:76-86` — tabela pozycji ma szerokie kolumny na wąskim ekranie (mobile); rozważyć `overflow-x-auto` wokół `<table>`. Przycisk rozwijania ma `aria-expanded`, ale brak `aria-controls` na panel szczegółów.
- [ ] `rebuild/backend/src/repos/partnerzy-zamowienia.ts:93-97` — `szczegolyZamowieniaDlaPartnera` pobiera cały wiersz razem z `surowy_xml` tylko po to, żeby go odrzucić (destrukturyzacja). Dla pojedynczego zamówienia to akceptowalne, ale prostsza byłaby jawna projekcja w osobnej funkcji. Parametry z podkreśleniem (`_xml`, `_skrot`) mogą wymagać `argsIgnorePattern` w lincie — bramka lint zweryfikuje.
- [ ] `rebuild/backend/src/repos/partnerzy-zamowienia.ts:87-89` — `JSON.parse` w `szczegolyZamowienia` bez obsługi błędu przy uszkodzonym `faktura_json`/`dostawa_json` skutkowałby 500 całej trasy. Dane powstają wyłącznie z naszego parsera, więc ryzyko jest niskie.
- [ ] `rebuild/frontend/test/partnerzy.zamowienia.test.tsx` — brak testu na `kosztDostawy`/`—` dla pustych pól oraz na przełączanie dwóch wierszy (otwarcie B zwija A, bo `otwarte` to pojedyncze id). Zachowanie jest poprawne w kodzie, ale niepokryte.

## Plan compliance

### Done ✓
- Backend: `GET /api/partnerzy/:id/zamowienia` (`limit`/`offset`, najnowsze pobrane pierwsze) i `GET .../:zamowienieId` (404 dla innego partnera), za `requireAuth`, bez `surowy_xml` i skrótu.
- Frontend: sekcja "Zamówienia" na `/partnerzy/:id` z numerem partnera, datą odbioru, krajem, statusem, liczbą pozycji i rozwijanymi szczegółami (pozycje, dostawa).
- Liczba pozycji w SQL, bez pobierania pozycji; dane `dostawa` tylko w szczegółach, nie na liście.
- Tylko odczyt, brak akcji; trasy poza `openapi.yaml`, jak w planie (ticket 209).
- Handlery MSW dopisane w trzech istniejących testach stron partnera (`kolumny`, `konfiguracja`, `logi`) — zgodnie z regułą CLAUDE.md o nowym zapytaniu w widoku z testami.
- Nazewnictwo po polsku (`listaZamowien`, `szczegolyZamowieniaDlaPartnera`, `ZamowieniaPartnera`), dokumentacja: `wpis-230.md` w osobnym pliku (zgodnie z regułą "plik per ticket"), wpis w `karta.md`.

### Missing or deviating ✗
- Plan wymienia w szczegółach "dostawę i fakturę"; API zwraca obie, panel pokazuje tylko dostawę (zgodne z sekcją "Zakres → Frontend", rozbieżne ze zdaniem o backendzie — drobne, patrz SHOULD-FIX o danych osobowych).
- Plan zapowiada testy "limit"; jest tylko przypadek poprawny, brak przypadków brzegowych (nieprawidłowy `limit`/`offset`).
- Raport nie podaje wyników testów ("zob. PR") — pełne bramki biegną osobno; nie sprawdzano ich w tym review.

### Definition of done
- [ ] Bramki backendu i frontendu zielone, PR `MERGEABLE`, gałąź zsynchronizowana z `develop` — do potwierdzenia po zakończeniu pełnych testów i otwarciu PR (poza zakresem tego review). Raport nie zawiera jeszcze wyników.

## Parallel-test concerns

None — testy backendu używają `stworzSrodowiskoTestowe()` (baza w katalogu tymczasowym, `supertest` bez stałego portu), a testy frontendu MSW w pamięci i `queryClient.clear()` w `beforeEach`. Wszystkie parallelizowalne.

## Overall assessment

Zmiana jest niewielka, spójna z konwencjami projektu i bezpieczna: izolacja partnerów działa (404 dla cudzego zamówienia), autoryzacja jest na obu trasach, ciężkie i surowe pola nie wychodzą w odpowiedzi, a podzapytanie liczące pozycje ma jawne nazwy tabel i jest pokryte testem. Główne uwagi dotyczą braku sygnału o obciętej liście (limit 50 bez paginacji), nieobsłużonych niecałkowitych `limit`/`offset` (dziedziczone z istniejącego helpera), słabszych asercji w teście wycieku oraz odświeżania szczegółów. Żadna nie blokuje merge'a.
