# 234-FEATURE-partnerzy-zamowienia-bestellung — Code review

> Reviewed: 2026-10-12
> Branch: claude/peaceful-gates-a8yebr
> Diff: 12 plików (+300/−5), 1 commit ticketu (5eae575); merge `origin/main` pominięty w ocenie

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/backend/src/partnerzy/zamowienie-xml.ts:199` — komentarz twierdzi, że `artnr` = „nasz numer katalogowy, 9 cyfr", a fixture (`test/partnerzy.zamowienie-bestellung-przyklad.ts:25`) cytuje komentarz TopM: „5-Stellige Artikel ID, auch Alphanummerisch". Mapowanie artnr → `kod` produktu to założenie (potwierdzają je tylko 2 z 4 kodów w przykładach, reszta wygasła), nie ustalony fakt.
  - Reason: sprzeczne twierdzenia w jednym tickecie; walidacja 232 opiera się na tym założeniu (kod = `products.kod`).
  - Suggestion: zmienić na „zakładamy, że artnr = kod w naszym katalogu (do potwierdzenia, `decyzje-do-konsultacji-marty.md`)" i dodać to jako pytanie w dokumencie decyzji.
- [ ] `docs/karty/PARTNERZY/decyzje-do-konsultacji-marty.md` (nowa sekcja, akapit „Zamówienie TyreWorld na `013100077`…") — porównanie 650,08 (zamówienie) z 576,75 (cennik DE) wnioskuje „reguła ceny ma realne znaczenie", choć w tym samym akapicie i w pytaniu 4 netto/brutto oraz waluta są nieustalone, a daty różne. Przesada wobec stanu wiedzy.
  - Suggestion: dopisać „różnica może wynikać z netto/brutto lub daty — nie wnioskujemy".
- [ ] `docs/karty/PARTNERZY/karta.md:3` — „na `main`: … tickety 208–234", a 234 nie jest jeszcze na `main` (to PR do `develop`). Stan zapisany jako dowieziony przed merge'em.
  - Suggestion: sformułować po merge'u albo „(234 w PR)".
- [ ] `docs/tickets/234-FEATURE-partnerzy-zamowienia-bestellung/raport.md` (Test results) — „zob. PR" bez konkretnych wyników; DoD w `plan.md:30` nieodhaczone.
  - Reason: wg checklisty brak wyników testów w raporcie to luka. Uzupełnić po zakończeniu bramek w tle (lint/typecheck/build/test backend + frontend, PR `MERGEABLE`).
- [ ] `rebuild/backend/test/partnerzy.zamowienie-bestellung.test.ts` — brak testów brzegowych, o które Master pytał: pusty element `<preis></preis>` (dziś → `null`, test sprawdza tylko brak elementu), pusty `<lkz></lkz>` (→ `krajDostawy` null), `lieferadresse` obecny bez `lkz`, rozróżnianie wielkości liter (`<Bestellung>` → „Nieznany format"), `menge` z tekstem/przecinkiem. Zachowanie jest poprawne (sprawdziłem czytając kod), ale nieprzypięte testem.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/partnerzy/zamowienie-xml.ts:1-3` — nagłówek pliku nadal opisuje tylko `DOCUMENTORDER` i „brak `NUMBER`, pusty `CODE`"; zaktualizować o `bestellung`.
- [ ] `zamowienie-xml.ts:195-243` — `parsujBestellung` powiela ~70% logiki pozycji z `parsujDocumentOrder` (ilość, cena, limit pozycji). Warto wyciągnąć wspólną funkcję z nazwami pól jako parametrami, gdy pojawi się trzeci format; teraz akceptowalne (DOCUMENTORDER celowo nietknięty).
- [ ] `zamowienie-xml.ts:228-233` — klucz `bemerkung`/`neutralversand` z korzenia zapisywany do tej samej mapy co dzieci `lieferadresse`; przy hipotetycznym polu o tej samej nazwie w adresie nastąpi nadpisanie. Praktycznie nieistotne.
- [ ] Rozpoznawanie formatu jest case-sensitive (`bestellung`, nie `Bestellung`); zgodne ze specyfikacją TopM widoczną w przykładzie, ale nie udokumentowane jako świadoma decyzja.
- [ ] `docs/spec-backend/wpis-234.md` — „Inny element = błąd pliku": dodać, że komunikat zmienił treść z „Oczekiwano elementu DOCUMENTORDER" na „Nieznany format…" (żaden test/FE tego tekstu nie zależy — grep czysty).
- [ ] Fixture: bestellnummer, adres, e-mail (`example.test`), telefon i nazwisko są zmyślone (OK). Kody artykułów, ilości i ceny (779,06 / 650,08 oraz 2 szt.) odpowiadają realnemu zamówieniu opisanemu w docs — to dane handlowe, nie osobowe, ale kombinację można zmienić (np. inne ceny), żeby fixture nie dało się powiązać z prawdziwym zamówieniem.

## Plan compliance

### Done ✓
- Dyspozytor po elemencie głównym + `parsujBestellung`; DOCUMENTORDER wydzielony do `parsujDocumentOrder` bez zmian logiki (diff: zmieniony tylko nagłówek funkcji i usunięty warunek korzenia; komunikat błędu dla obcego korzenia zmieniony).
- Mapowanie wg planu: bestellnummer, bestelldatum, lkz → kraj, artnr (tekst), menge, preis (opcjonalny), bezeichnung; adres + neutralversand/bemerkung/bemerkungintern w `dostawa`; waluta i koszt `null`; pusta uwaga nie tworzy wpisu.
- Puste elementy (`<lkz></lkz>`, `<preis></preis>`, CDATA puste) → `tekstDziecka` zwraca null; `mapa()` bierze dzieci liście lieferadresse (CDATA zdekodowany jako tekst, puste → `""`, np. `land`). Poprawne.
- Błędy strukturalne zbierane naraz; limit pozycji; DOCTYPE odrzucany (wspólny czytnik).
- Testy: parser (7), odbiór e-mail, panel. Uruchomiłem `partnerzy.zamowienie-bestellung.test.ts` + `partnerzy.zamowienie-xml.test.ts`: 18/18 zielone.
- Panel: etykiety polskie (`ETYKIETY_DOSTAWY`), sensowne („Kraj (kod)" vs „Kraj" rozróżnia `lkz` i `land`).
- Prywatność: w zmienionych plikach nie znalazłem prawdziwych danych osobowych, adresów, telefonów ani numerów zamówień (grep po `@`, ciągach cyfr, URL-ach; fixture zmyślony, e-mail na `example.test`).

### Missing or deviating ✗
- Brak wyników bramek w raporcie (patrz SHOULD-FIX).
- Docs: twierdzenia o `artnr` = nasz numer katalogowy oraz wniosek z porównania cen wykraczają poza to, co ustalone. Pozostałe niewiadome (kanał zamówień TyreWorld, netto/brutto, waluta) są poprawnie opisane jako pytania/„do potwierdzenia" i zgodne z kodem (`waluta: null`).

### Definition of done
- [ ] Bramki backendu i frontendu zielone, PR `MERGEABLE`, gałąź zsynchronizowana z `develop` — nie zweryfikowane w tym review (bramki w tle); raport bez wyników.

## Parallel-test concerns

None — all tests parallelizable (parser czysty, odbiór e-mail na bazie w katalogu tymczasowym z `stworzSrodowiskoTestowe`, atrapa skrzynki).

## Overall assessment

Zmiana jest mała, czysta i bezpieczna: refaktor DOCUMENTORDER nie zmienia zachowania (poza treścią komunikatu o obcym korzeniu), parsowanie `bestellung` poprawnie obsługuje puste/brakujące pola i CDATA, a model, walidacja i panel działają bez zmian. Główne uwagi dotyczą dokumentacji: nieudowodnione założenie „artnr = nasz kod" (sprzeczne z komentarzem w fixture), wniosek o cenach przy nieustalonym netto/brutto, stan „na main" przed merge'em oraz brak wyników bramek w raporcie. Prywatność w porządku.
