# 91-FEATURE-archiwum-importow — Code review

> Reviewed: 2026-09-22
> Branch: feature/91-archiwum-importow
> Diff: 26 plików, 8 commitów (vs `origin/develop`)

## BLOCKER

- [ ] `docs/karty/PR.1/karta.md` — karta NIE opisuje stanu po zakończeniu ticketu 91.
  - Reason: Nadal `> **Stan:** ⬜ gotowe` (wg konwencji `docs/karty/README.md:115` to znaczy „gotowe
    do startu”, nie „zrobione” — dla zrobionej karty ma być `✅ <data> · <ticket>`), `**Ticket:** —`,
    sekcje „Dowiezione” i „Do koordynatora” puste (`—`). `raport.md:79-84` opisuje follow-up
    cutover („`IMPORT_ARCHIVE_DIR` na produkcji musi wskazywać…”) i jawnie twierdzi „zapisane w
    `docs/karty/PR.1/karta.md`” — ale w pliku tej notatki NIE MA. To dokładnie naruszenie zasady
    CLAUDE.md „Po każdej zamkniętej karcie jej `karta.md` opisuje STAN, nie zamiar” (reguła
    wprowadzona po 7 konfliktach 2026-09-18…21) i punkt 5 Definition of done w `plan.md:126`
    (`karta.md PR.1 = stan, PR.6/wejscie-91.md, ustalenie cutover w „Do koordynatora"` — wszystkie
    trzy elementy tego punktu są niespełnione).
  - Suggestion: Zaktualizować `> **Stan:**` na `✅ 2026-09-22 · 91-FEATURE-archiwum-importow`,
    wypełnić „Dowiezione” faktycznym zakresem (3 trasy + widok, zgodnie z raportem) i przenieść
    notatkę o cutoverze (`IMPORT_ARCHIVE_DIR`, rozjazd z `docs/cutover.md:207`) do sekcji
    „Do koordynatora” tego pliku.
- [ ] `docs/karty/PR.6/` — brak pliku `wejscie-91.md`.
  - Reason: `plan.md:126` (Definition of done) i `docs/karty/PR.6/karta.md:9-10` („Wejścia od
    innych kart: pliki `wejscie-*.md` w tym katalogu”) wprost wymagają wejścia od karty 91 dla
    przyszłej aktualizacji `docs/przeglad-12-widokow.md`. Katalog ma tylko `wejscie-77.md` — sesja
    PR.6 nie dowie się, że PR.1 (archiwum) jest zrobione, dopóki ktoś nie doda tego pliku ręcznie.
  - Suggestion: Dopisać `docs/karty/PR.6/wejscie-91.md` z krótkim podsumowaniem zakresu widoku
    `/archiwum` (dla aktualizacji `docs/przeglad-12-widokow.md`, odpowiedź 12.1).

## SHOULD-FIX

*(brak — zmiany w kodzie BE/FE nie budzą zastrzeżeń wykraczających poza powyższe braki
dokumentacyjne).*

## NICE-TO-HAVE

- [ ] `contract/openapi.yaml` — generator schematów nazwał współdzielony schemat `{error}`
  `GETImportArchiveOdpowiedz401` (bierze nazwę z pierwszego alfabetycznie nagrania) i podpiął go
  też pod niepowiązane odpowiedzi, np. `POST /api/products/clear` 400 (`:19833`) i
  `PATCH /api/products/{id}` 404 (`:19994`). Nazwa myli przy czytaniu kontraktu ([odnotowane
  świadomie w `raport.md:42-45`], kształt `{error}` jest poprawny — to kosmetyka nazwy, nie błąd
  funkcjonalny).

## Plan compliance

### Done ✓
- Nagrania z oryginału (`tools/record-write-fixtures.cjs`, `odegrajArchiwum()`) zapełniające
  archiwum piaskownicy KODEM oryginału (`parse-file`), 9 fixtures w `contract/fixtures/`.
- 3 ścieżki w `contract/openapi.yaml` (`GET /api/import-archive`, `/stats`, `/file/{month}/{name}`)
  ze schematami z generatora.
- 3 trasy odczytu w BE (`archiwum.ts`: `listaArchiwum`, `statystykiArchiwum`,
  `szukajPlikuArchiwum`; `routes/import-archive.ts`), rejestracja w `app.ts`.
- GATE (`archiwum-importow.gate.test.ts`, 22 testy) — kształt i wartości 1:1 z nagraniami (poza
  zegarem), path traversal (`..`, `%2F`, `%2E%2E`, backslash, zły miesiąc, `a..csv`) faktycznie
  wysyłany surowym HTTP bez normalizacji klienta — dowodzi 400, nie tylko zakłada.
  Zweryfikowano uruchomieniem: 22/22 zielone.
- Widok `/archiwum` z filtrami (dostawca/miesiąc/status), paskiem zajętości, tabelą 8 kolumn,
  pobieraniem blobu pod ORYGINALNĄ nazwą (`a.download`), toastem błędu, pozycją w menu zaraz za
  „Historią” — zweryfikowane w kodzie i 13 testach FE.
- Bramki: BE lint/typecheck/build/test (1491/1491, w tym nowy GATE) i FE lint/typecheck/build/test
  (904/904, w tym 13 nowych) — uruchomione ponownie w tym review, wszystkie zielone.

### Missing or deviating ✗
- Punkt 5 Definition of done (`karta.md` PR.1 = stan, `PR.6/wejscie-91.md`, cutover w „Do
  koordynatora”) — niespełniony, patrz BLOCKER wyżej. Reszta planu zrealizowana zgodnie z opisem.
- Deviations opisane w `raport.md` (D6 zachowanie wybranej wartości na liście selecta, brak
  „przyklejania się” błędu dzięki React Query, nazwa schematu `GETImportArchiveOdpowiedz401`) są
  świadome, uzasadnione i nieszkodliwe funkcjonalnie — zgodne z tym, co pozwala plan.md (D5, D8).

### Definition of done
- [x] 9 nagrań w `contract/fixtures/`, 3 ścieżki w `openapi.yaml`
- [x] 3 trasy w BE, GATE zielony
- [x] Widok `/archiwum` z menu, filtrami, paskiem zajętości, pobieraniem pod oryginalną nazwą
- [x] Bramki BE i FE zielone (Node 20)
- [ ] `karta.md` PR.1 = stan, `PR.6/wejscie-91.md`, ustalenie cutover w „Do koordynatora” —
      żaden z trzech elementów nie został wykonany (patrz BLOCKER)

## Parallel-test concerns

None — wszystkie nowe testy (BE GATE, FE) używają katalogu tymczasowego per test
(`srodowisko.katalogArchiwum` = `dirname(baza.sciezka)/import_archive`) i portu efemerycznego
(`app.listen(0, "127.0.0.1", …)` w teście „surowego” żądania HTTP w GATE). Brak
zahardkodowanych portów, ścieżek czy współdzielonego stanu między testami.

## Overall assessment

Implementacja backendu i frontendu jest bardzo solidna i wierna oryginałowi: filtry, wartości
zastępcze bez `.meta.json`, kody/ciała błędów, `Content-Disposition`, ochrona przed path
traversal (w tym testy surowych żądań HTTP bez normalizacji klienta) i zachowanie FE (opcje
selectów z przefiltrowanej listy, pobieranie pod oryginalną nazwą) są odtworzone 1:1 i
udowodnione nagraniami z żywego oryginału, nie ręcznie pisanymi fixture'ami. Wszystkie bramki
(BE i FE: lint/typecheck/build/test) przechodzą zielono po ponownym uruchomieniu. Jedyny realny
problem to zaniedbanie procesu kart: `raport.md` twierdzi, że notatka o cutoverze trafiła do
`docs/karty/PR.1/karta.md`, a w rzeczywistości karta nie została w ogóle zaktualizowana i brakuje
`docs/karty/PR.6/wejscie-91.md` — bez tego następna sesja (koordynator / karta PR.6) nie dowie
się, że PR.1 jest zrobione ani jaka decyzja czeka na cutover.
