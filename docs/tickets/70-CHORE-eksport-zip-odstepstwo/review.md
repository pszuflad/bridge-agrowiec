# 70-CHORE-eksport-zip-odstepstwo — Code review

> Reviewed: 2026-09-21
> Branch: chore/70-eksport-zip-odstepstwo
> Diff: 7 plików (+606/-33), 5 commitów

## BLOCKER

- [ ] `docs/rebuild-roadmap.md:2628-2641` (blok 14j) i `docs/rebuild-backlog.md:3892` (wpis #93) —
      Definition of done p. 6 z `plan.md` nie jest spełniony.
  - Reason: Diff w ogóle nie rusza `docs/rebuild-roadmap.md` ani `docs/rebuild-backlog.md`
    (`git diff origin/develop...HEAD --stat -- docs/rebuild-roadmap.md docs/rebuild-backlog.md`
    jest pusty). Roadmapa nadal mówi „Wymaga osobnej karty i decyzji użytkownika" (14j), backlog
    #93 nadal ma `Status: decyzja podjęta, karta niezałożona`, a podbloku „P5.2" w §5 roadmapy
    nadal nie ma — dokładnie te trzy stany, które `plan.md` (Kontekst pkt 5, DoD pkt 6)
    zdiagnozował jako nieaktualne PRZED implementacją i kazał poprawić. CLAUDE.md („Roadmapa
    jest wejściem dla następnej sesji") traktuje to jako obowiązek stały, nie opcjonalny —
    następna sesja czytająca roadmapę trafi na ten sam nieaktualny stan, mimo że karta jest
    `raport.md`-em ogłoszona jako Shipped.
  - Suggestion: Dopisać podblok P5.2 do §5 roadmapy (stan: zrobione, ticket 70, data, PR), zdjąć
    zdanie „Wymaga osobnej karty i decyzji" z opisu bloku 14j, zaktualizować `Status` wpisu #93
    w backlogu na zamknięty z odsyłaczem do tej karty.

## SHOULD-FIX

- [ ] `rebuild/backend/test/eksport-shoper.format.test.ts:228` — test mutuje współdzielony stan
      bazy w trakcie działania (nie w `beforeAll`), tworząc niejawną zależność kolejności testów.
  - Reason: `zasiejDostawcow(srodowisko.db, [{ ...DOSTAWCA_BEZ_PRODUKTOW }])` wykonuje się w
    środku testu na linii 228 (nie w `beforeAll` na linii 190-199), dokładając dostawcę `MO7` do
    bazy współdzielonej przez WSZYSTKIE testy w tym `describe`. Dziś działa, bo testy po nim
    (linie 249, 260) nie odpytują `listaDostawcow`, ale to przypadek, nie gwarancja — reorder,
    `.only()` na późniejszym teście albo dodanie kolejnego testu odpytującego listę dostawców
    cicho się wywróci albo (gorzej) zafałszuje wynik bez wyjaśnienia skąd wziął się `MO7`.
  - Suggestion: Przenieść seed `MO7` do `beforeAll` tego `describe` albo do osobnego,
    dedykowanego `describe`/`beforeEach`, żeby stan bazy między testami nie zależał od kolejności
    wykonania.

## NICE-TO-HAVE

- [ ] `docs/tickets/70-CHORE-eksport-zip-odstepstwo/plan.md:99-106` — Definition of done ma
      wszystkie pozycje jako `- [ ]` mimo że `Status:` nagłówka mówi „Shipped" i `raport.md`
      opisuje pracę jako skończoną; warto odhaczyć spełnione punkty (1-5), żeby dokument
      odzwierciedlał stan.
- [ ] `rebuild/backend/src/routes/export-shoper.ts:100-119` — gałąź „błąd po wysłaniu nagłówków"
      w `przerwij()` jest w automatycznym teście pokryta tylko pośrednio (przez wyścig
      `zapiszAudyt` vs. flush archivera, zmierzony empirycznie jako częściej trafiający w tę
      gałąź — patrz `raport.md` „Zadanie 4"). Druga ścieżka („error" z samego archivera po
      pierwszych bajtach) była sprawdzona jednorazowym, nieautomatyzowanym skryptem. Rozumiem
      uzasadnienie (współdzielony `przerwij()`), ale warto rozważyć osobny test z wstrzykniętym
      archiwum (parametr tylko-testowy wspomniany w raporcie), żeby regresja w tej gałęzi nie
      czekała na kolejny ręczny skrypt.
- [ ] `rebuild/backend/test/eksport-shoper.gate.test.ts:274-283` — test ścieżki błędu akceptuje
      `500` LUB `ECONNRESET`/`ECONNABORTED`, co jest słuszne dla wyścigu, ale w praktyce (patrz
      manualne uruchomienie w tym review) trafia deterministycznie w gałąź „po nagłówkach" na tej
      maszynie — czyli asercja `wynik.status === undefined` z listą kodów jest jedyną realnie
      wykonywaną gałęzią w CI. Nie blokujące, tylko do świadomości: gdyby kiedyś środowisko CI
      zaczęło trafiać w drugą gałąź, komunikat błędu i tak jest czytelny.

## Plan compliance

### Done ✓
- Krok 1 — `test/gate/czytnik-zip.ts`: czytnik ZIP od katalogu centralnego, z walidacją EOCD,
  sygnatur, metody, rozmiaru i CRC-32; `doBufora` jako parser supertest. Zweryfikowane ręcznie:
  poprawność offsetów nagłówka lokalnego/centralnego/EOCD zgodna z APPNOTE, potwierdzona testami
  na urwanym i przekłamanym archiwum (`test/zaleznosci.archiver.test.ts:79-86`).
- Krok 2 — `test/eksport-shoper.gate.test.ts`: jawne komentarze odstępstwa przy obu przypadkach
  ZIP, sprostowanie błędnego cytatu `:48786-48800`, `sprawdzArchiwum` sprawdza nazwy wpisów
  1:1 z `listaDostawcow`, BOM i 7-kolumnowy nagłówek.
- Krok 3 — `test/eksport-shoper.format.test.ts`: każdy wpis ZIP-a porównany bajt w bajt z
  odpowiedzią `?dostawca={kod}`, wariant dostawcy bez produktów (`MO7`) pokryty.
- Krok 4 — `test/zaleznosci.archiver.test.ts`: strażnik `ZipArchive`, komunikat z wersją i
  eksportami pakietu, kontrola samego czytnika na zepsutym archiwum.
- Krok 5 — `src/routes/export-shoper.ts`: wspólny `przerwij()` dla `on("error")` i `.catch`;
  `headersSent` → `res.destroy()` + `archiwum.abort()`, inaczej `unpipe` + `abort` + 500 jak w
  oryginale. Test napisany najpierw i sprawdzony, że pada na starym kodzie — potwierdzone
  niezależnie w tym review (revert routingu → test faktycznie czerwony na limicie 5 s, z powrotem
  zielony po przywróceniu poprawki).
- Krok 6 — bramki `lint`/`typecheck`/`build`/`test` uruchomione niezależnie w tym review: wszystkie
  zielone, 86 plików / 1320 testów zgadza się z liczbą z `raport.md`.

### Missing or deviating ✗
- Krok „Roadmapa: podblok P5.2 ✅; 14j bez „wymaga decyzji"; backlog #93 Status zaktualizowany"
  (DoD p. 6) — nie zrobiony, patrz BLOCKER wyżej.

### Definition of done
- [x] Bramka ZIP ma jawny komentarz odstępstwa (oba przypadki) i sprawdza zawartość archiwum.
- [x] Każdy wpis ZIP-a == pojedynczy eksport tego dostawcy (bajty).
- [x] Strażnik `archiver` pada na wersji bez `ZipArchive`.
- [x] Błąd w trakcie strumienia nie wiesza klienta; test pada na starym kodzie.
- [x] `lint`/`typecheck`/`build`/`test` zielone; `package.json`/lock bez zmian.
- [ ] Roadmapa: podblok P5.2 ✅; 14j bez „wymaga decyzji"; backlog #93 Status zaktualizowany —
      NIE zrobione (patrz BLOCKER).

## Parallel-test concerns

Brak — nowy test błędu strumienia (`DROP TABLE audit_log`) działa na własnym, izolowanym
`stworzSrodowiskoTestowe()` (tymczasowa baza, bez `listen()`, bez portu), tak samo jak reszta
plików w `test/`. Wszystkie testy równoległe do uruchamiania przez wielu agentów jednocześnie.

## Overall assessment

Implementacja jest solidna technicznie: czytnik ZIP ma poprawne offsety formatu (zweryfikowane
ręcznie względem APPNOTE i empirycznie na uszkodzonych archiwach), poprawka `przerwij()` w trasie
została niezależnie odtworzona i potwierdzona — na starym kodzie test faktycznie wisi/pada na
limicie, na nowym przechodzi bez ostrzeżeń (`double callback`, unhandled `error` na `res` itd.).
Wszystkie cztery bramki (`lint`, `typecheck`, `build`, `test`) są zielone, liczby testów zgadzają
się z raportem. Jedyny poważny brak to niedokończona część „papierowa" karty: DoD wprost wymagał
aktualizacji roadmapy i backlogu (dokładnie tych trzech miejsc, które `plan.md` sam zdiagnozował
jako nieaktualne), a diff ich nie dotyka — to samodzielny warunek odblokowania per checklist
review (naruszenie DoD z planu), niezależny od jakości kodu.
