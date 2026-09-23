# 130-FEATURE-importer-staging-bezpieczenstwo — Code review

> Reviewed: 2026-09-23
> Branch: feature/130-importer-staging-bezpieczenstwo
> Diff: 54 pliki zmienione, 9 commitów (vs `git merge-base origin/develop HEAD` = `730c32f`)

## BLOCKER

Brak. Port `importer()` (`src/import/polityka/fabryka.ts`) porównany linia po linii z
`staging_policy.cjs:332-616` (oraz `:108-162` dla wspólnych helperów) — kolejność gałęzi
dopasowania (manualChoice → remembered → dokładny kod z ochroną DOT → byCodeNorm →
bySupplierCode → EAN tylko przy jednym kandydacie → fallback po cechach), progi bezpieczeństwa
źródła, reguła „pewny powrót", zapis `historia_cen`, ścieżka dowodowa nieobecności i pętla po
`produkty` nieobecnych w cenniku zgadzają się z oryginałem co do warunków, kolejności efektów
ubocznych i literałów komunikatów. `podstawy.ts`, `bledy.ts`, `kod-importu.ts`,
`edycja-stagingu.ts` sprawdzone analogicznie — zgodne. Gate `test/silnik.polityka-zrodla.test.ts`
(port kontra ŻYWY `staging_policy.install()` na prawdziwym SQLite) i charakteryzacja MO1–MO10
uruchomione lokalnie — 54 + 188 testów zielone; `npm run typecheck` i `eslint` na zmienionych
plikach czyste.

## SHOULD-FIX

- [ ] `rebuild/backend/test/silnik.gate.test.ts:286-309` — podpunkt planu (Krok 12: „przypadek
  «EAN w notacji naukowej» przepisać z okna przejściowego na oczekiwaną blokadę akceptacji (D4)")
  nie został zrealizowany. Test wciąż nosi docstring „STAN PRZEJŚCIOWY D4 (…) przy porcie
  silnika w I15.4 trzeba go przepisać na oczekiwaną blokadę" — a właśnie ten port silnika
  odbył się w TYM tickecie, bez aktualizacji testu. Asercje nadal sprawdzają tylko
  `snapshotJson.ean === null` i `kodDostawcy`, nie `eanRaw`, `_eanIssue` ani `typZmiany`
  (powinien być `'blad'`, skoro `ev.error` ustawia `bledy.push(...)` w `fabryka.ts:500-502`).
  - Reason: `raport.md` („Odstępstwa od planu: Brak odstępstw od zatwierdzonego planu") nie
    wspomina o pominięciu tego podpunktu — czytelnik raportu nie dowie się, że ta gałąź D4
    (błędny EAN w postaci naukowej) nie ma zaktualizowanego dowodu testowego, mimo że plan
    explicite to zamawiał.
  - Suggestion: albo dopisać asercje na `typZmiany==='blad'`, `eanRaw`, `_eanIssue` (to, co da
    się sprawdzić w zakresie I15.4b — bez `checkAcceptance()`, który jest I15.4c), albo
    jawnie odnotować w `raport.md`, że ten podpunkt Kroku 12 przesunięto do I15.4c wraz z
    uzasadnieniem (test rzeczywistej „blokady akceptacji" wymaga `checkAcceptance()`, którego
    tu świadomie nie portujemy).

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/import/polityka/fabryka.ts:1014-1026` — `dostepnoscZmieniona()` i
  `oznaczZmianeDostepnosci()` są dziś martwe z perspektywy wołających (żaden plik w tym
  tickecie ich nie używa) — to jawnie zamierzone API międzykartowe dla I15.4c (D-130.2), ale
  warto dopisać w `karta.md` I15.4c przypomnienie, żeby nikt nie skasował „nieużywanego" kodu
  przy porządkowaniu.
- [ ] `rebuild/backend/src/import/polityka/kod-importu.ts:63` — `db.select().from(products).all()`
  czyta CAŁĄ tabelę `products` przy każdym wywołaniu `assignKodImportu` (także wewnątrz pętli
  bulk/akceptacji). To wierne odtworzenie kosztu oryginału (`U.listProducts()`), nie regresja
  tego ticketu — ale skoro `raport.md` już zgłasza podobny koszt wydajności w `#107`, warto
  dopisać tam też tę ścieżkę, żeby nie trzeba było jej odkrywać osobno.

## Plan compliance

### Done ✓
- Krok 1 — `_bridgeFeedMeta` przez `MetaCennika`/`WynikParsowania.meta`, `parsuj.ts` zdejmuje
  właściwość `enumerable:false` wprost (`zdejmijMeta()`).
- Krok 2 — `stworzPolitykeStagingu()` odtwarza domknięcie `install()`, prymitywy w
  `podstawy.ts` (siedem przemostowanych + siedem odtworzonych, jak w planie).
- Krok 3 — łańcuch dopasowania w dokładnie tej kolejności co oryginał, z ochroną DOT/DEMO
  i wykrywaniem `_sourceConflict`.
- Krok 4 — cztery blokady źródła (`BladOdczytuCennikaBlad`, `PustyImportBlad`,
  `CennikPodejrzanieMalyBlad`, `CennikMasowoNierozpoznanyBlad`), wszystkie 400 (D-130.4).
- Krok 5 — `fingerprint`/`complete`/`elapsed`/`distinctCompleteFeed` zgodne z `:462-466`,
  `zapiszWersjeOferty` wołane wyłącznie pod `nowaKompletnaOferta`.
- Krok 6 — transakcja: sprzątanie `oldQueue`, patch, pewny powrót, `historia_cen` bajt w bajt.
- Krok 7 — auto-wstrzymania (`suspend`/`wstrzymaj`), natychmiastowe wstrzymanie braku, dowody
  nieobecności `slice(-3)`, stare karty bez prefiksu/kodu dostawcy.
- Krok 8 — `assignKodImportu`, gałąź 1 dosłowna (zachowanie istniejącego kodu), zweryfikowana
  testem `akceptacja.odstepstwa.test.ts` „grupowanie po EAN-ie musi zostać NIETKNIĘTE".
- Krok 9 — `updateStaging`: model → bieżnik (`edycja-stagingu.ts`), warunek potrójny zgodny.
- Krok 10 — `U.updateProduct` (D-130.3) naniesione w `routes/products.ts` PATCH, kasuje
  `product_auto_suspensions` przy jawnej zmianie `status`.
- Krok 11 — `tk.ts` sprowadzone do cienkiej warstwy zgodności nad fabryką.
- Krok 12 — charakteryzacja przenagrana z `install()` @ `88fa31c` przez nowy harness
  `polityka.mjs`; MO1–MO10 + scenariusze zielone. **Wyjątek: patrz SHOULD-FIX** (przypadek EAN
  naukowy w `silnik.gate.test.ts` nie został przepisany, mimo że Krok 12 to zamawiał).

### Missing or deviating ✗
- Krok 12, podpunkt „`test/silnik.gate.test.ts`: przypadek EAN naukowy przepisać na oczekiwaną
  blokadę akceptacji" — niezrealizowany, niezgłoszony w `raport.md` (patrz SHOULD-FIX).
  Nie blokuje merge'a: rzeczywista blokada akceptacji wymaga `checkAcceptance()` z I15.4c,
  której ten ticket świadomie nie porcjonuje — ale dokumentacja powinna to powiedzieć wprost
  zamiast zostawiać stary docstring.

### Definition of done
- [x] `_bridgeFeedMeta` dochodzi z parserów do silnika
- [x] Cztery blokady źródła działają i dają 400 z własnymi klasami błędów
- [x] Reguła wycofań: 3 różne kompletne oferty + 24 h, dowody w trzech tabelach
- [x] Auto-wstrzymania działają; ręczne wstrzymania przeżywają import i pewny powrót
- [x] `updateProduct` kasuje znacznik automatu przy jawnej zmianie `status`
- [x] Dopasowanie po EAN tylko do jednej zgodnej opony; DOT, DEMO i warianty chronione
- [x] `assignKodImportu` zachowuje istniejący sześciocyfrowy `kod_importu` (dosłownie)
- [x] Edycja modelu w stagingu aktualizuje bieżnik, gdy był jego automatyczną kopią
- [x] Szew dostępności wystawiony, domyślnie no-op, opisany w „Do koordynatora"
- [x] Wzorce charakteryzacji przenagrane z `install()` @ `88fa31c`, rozjazdy opisane
- [x] Gate odbudowy: fixtures z tabeli zgodne co do kształtu i wartości deterministycznych
- [x] `lint`, `typecheck`, `build`, `test` zielone (zweryfikowane lokalnie: typecheck + eslint
      na zmienionych plikach czyste; kluczowe pliki testowe — silnik.polityka-zrodla, gate,
      decyzje, rownosc, charakteryzacja, akceptacja, bulk, analityka, import, upload —
      242 testy przechodzą)
- [ ] `docs/karty/I15.4b/karta.md` opisuje STAN; backlog #104 podniesiony na ✅ — **nie
      weryfikowałem** (poza zakresem code review kodu; do sprawdzenia przez koordynatora/Mastera
      jako osobny krok dokumentacyjny)

## Parallel-test concerns

None — wszystkie nowe/zmienione testy budują bazę SQLite w katalogu tymczasowym
(`stworzTestowaBaze()` z `test/gate/baza.ts`, `mkdtempSync`) albo bazę `:memory:`
(`stworzPolitykeOryginalu()`), bez współdzielonych portów ani stałych ścieżek plikowych.

## Overall assessment

Bardzo solidny port. Rdzeń `importer()` sprawdzony linia po linii przeciw
`staging_policy.cjs:332-616` — kolejność gałęzi dopasowania, progi bezpieczeństwa źródła,
reguła pewnego powrotu, zapis `historia_cen` i pętla nieobecności zgadzają się z oryginałem co
do warunku, kolejności efektów ubocznych i treści komunikatów. Testy nie zostały osłabione —
przeciwnie, `silnik.polityka-zrodla.test.ts` porównuje port z żywym oryginałem na tej samej
bazie SQLite, co jest mocniejszym dowodem niż nagrany fixture. Jedyna rzecz do poprawki to
jeden niedokończony podpunkt Kroku 12 (test EAN w notacji naukowej) i brakująca wzmianka o nim
w `raport.md` — nie wpływa na poprawność silnika, tylko na kompletność dowodu dla tej jednej
gałęzi D4.
