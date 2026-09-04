# 28-FEATURE-selly-eksport-backend — Code review

> Reviewed: 2026-09-04
> Branch: feature/28-selly-eksport-backend
> Diff: 25 plików, 2 commity (vs `origin/develop`)

## BLOCKER

- [ ] `docs/rebuild-backlog.md` — wpis #12 NIE został zaktualizowany, mimo że `raport.md`
  (sekcja „Follow-up", punkt 1) twierdzi wprost: „Wpis w backlogu zaktualizowany."
  - Reason: `git diff origin/develop...HEAD --stat -- docs/rebuild-backlog.md` nie pokazuje
    żadnej zmiany w tym pliku — wpis #12 w repo jest identyczny jak przed sesją 8a, nie
    zawiera konsekwencji dla mapowania kategorii Selly (`fallback_kategoria` przy pustym
    `zastosowanie`), którą opisuje sam `raport.md`. To rozjeżdża się z Definition of Done
    z `plan.md` („Backlog #12 zaktualizowany o konsekwencję dla mapowania kategorii Selly
    (D3)") i z zasadą nadrzędną projektu (CLAUDE.md, obowiązek 1: „roadmapa/backlog opisuje
    STAN, nie zamiar"). Raport z fałszywym twierdzeniem o wykonanej pracy jest gorszy niż
    brak wzmianki — następna sesja przyjmie na wiarę, że #12 jest już opisane.
  - Suggestion: albo dopisać do `docs/rebuild-backlog.md` #12 akapit o konsekwencji dla Selly
    (treść jest już gotowa w `raport.md` i w komentarzu `src/selly/mapper.ts:10-17`), albo
    poprawić `raport.md`, żeby nie twierdził, że to zrobione.

## SHOULD-FIX

- [ ] `docs/rebuild-roadmap.md` §5, blok „Iteracja 8" — nie zawiera sprostowań z sesji 8a
  (5 GET + 5 POST zamiast 7+3, panel Selly już za auth w oryginale), mimo że `plan.md`
  DoD tego wymaga i `raport.md` ma gotową sekcję „Sprostowania faktów (do naniesienia
  w roadmapie)". W tym wypadku `raport.md` uczciwie mówi „do naniesienia" (nie twierdzi, że
  zrobione), więc to nie jest fałszywe twierdzenie jak przy #12 — ale DoD i tak jest
  niespełnione i zostanie z tym sesja 8b, która czyta blok 8 i dostanie stare, błędne
  założenia (7 GET + 3 POST), dokładnie ten typ pomyłki, przed którym ostrzega CLAUDE.md.
- [ ] `src/routes/export-shoper.ts:77` — `const { ZipArchive } = await import("archiver")`
  wykonuje się przy KAŻDYM żądaniu ZIP-a, podczas gdy oryginał (`deminified/backend-index.cjs
  :48139-42`) cache'uje `import()` w zmiennej modułu (`oh`) i importuje raz. Node cache'uje
  moduły ESM wewnętrznie, więc narzut jest znikomy (dodatkowa mikrotaska na request), ale to
  odstępstwo od wzorca oryginału nie jest opisane w kodzie ani w `plan.md`.
- [ ] `src/selly/klient.ts:271-285` (`listProducers`/`listCategories`) — dodaje `Math.min(limit,
  50)`, którego nie ma w oryginalnym `client.cjs:181` (`listProducers`/`listCategories` tam
  NIE capują — cap ma tylko nieużywany `listProducts`). Zachowanie obserwowalne jest identyczne,
  bo jedyne wywołanie (`slowniki.ts:70,76`) zawsze podaje `limit: 50`, ale to jest dodana logika
  spoza oryginału, niewspomniana w komentarzach jako świadome odstępstwo.

## NICE-TO-HAVE

- [ ] `src/routes/selly.ts:339` (`GET /api/selly/status`) — `req.query.dostawca` gdy przyjdzie
  jako tablica (`?dostawca=a&dostawca=b`) trasa cicho ignoruje filtr (`typeof dostawca ===
  "string" ? ... : undefined`), podczas gdy oryginał przekazałby tablicę wprost do
  `db.prepare(...).get(dostawca)`, co w better-sqlite3 rzuciłoby. Brzegowy przypadek bez
  praktycznego znaczenia (panel nie generuje takich zapytań), ale to realna, niewielka różnica
  zachowania.
- [ ] `src/selly/generator-csv.ts:155` (`zbudujCsvSelly`) — filtruje `status='aktywny'` w JS po
  załadowaniu WSZYSTKICH wierszy `products` (`db.select().from(products)...all()`), podczas gdy
  oryginał filtruje w SQL (`WHERE status = 'aktywny'`). Przy ~7-8 tys. produktów różnica jest
  pomijalna, a trasa i tak stoi za `requireAuth` jako przycisk awaryjny — czysta obserwacja,
  nie do poprawy teraz.
- [ ] `docs/tickets/28-FEATURE-selly-eksport-backend/plan.md` — wszystkie pozycje Definition of
  Done mają nieodhaczone `[ ]`, mimo że większość jest faktycznie spełniona (testy, GATE,
  bramki). Warto odhaczyć przed zamknięciem ticketu, żeby dokument odzwierciedlał stan.

## Plan compliance

### Done ✓
- Krok 1–9 z planu (env, klient, mapper, słowniki, repo, generator CSV, 10 tras Selly, eksport
  Shoper ×2, rejestracja w `app.ts`) — wszystko obecne w diffie i zweryfikowane linia po linii
  przeciw `mirror/backend/selly/{routes,client,mapper}.cjs`, `generate_selly_export.cjs`
  i `deminified/backend-index.cjs:48770-48863`.
- D1–D8 zaimplementowane zgodnie z opisem: `requireAuth` na eksporcie Shopera (D1), klient za
  interfejsem z atrapą (D2), backlog #12 świadomie nieportowany w kodzie (D3, ale patrz BLOCKER
  wyżej — dokumentacja tego nie odzwierciedla), `SELLY_CSV_*` z domyślnymi produkcyjnymi (D4),
  generator in-process (D5), 500 przy braku sekretów (D6), `archiver` + ZIP (D7), cache tokenu
  w instancji (D8).
- Krok 10 (testy) — 76 przypadków w 6(+1 pomocniczy) plikach, GATE dla 5 fixtures + 12 ścieżek
  kontraktu, testy formatu bajtowego obu CSV, testy klienta na realnym HTTP (port efemeryczny),
  testy synchronizacji na atrapie.

### Missing or deviating ✗
- Krok 11 z planu („dokumentacja backlogu #12 — bez kodu") NIE jest wykonany, mimo że
  `raport.md` twierdzi inaczej — patrz BLOCKER.
- Roadmapa (poza zakresem „Kroku 11", ale w DoD) nie zawiera sprostowań z sesji — patrz
  SHOULD-FIX.

### Definition of done
- [x] 10 tras Selly + 2 trasy eksportu odpowiadają, wszystkie za `requireAuth`
- [x] 5 fixtures Selly zgodne 1:1 (kształt) i żadna odpowiedź nie niesie `_przyciete`
- [x] Wszystkie 12 ścieżek waliduje się względem `contract/openapi.yaml`
- [x] Format obu CSV eksportu odtworzony wiernie (BOM, `;`, `\r\n`, kolumny, escaping); ZIP działa
- [x] Generator 59-kolumnowy zgodny z `generate_selly_export.cjs`
- [x] 401 bez tokenu na wszystkich 12 trasach; eksport działa na samo cookie
- [x] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` czyste (potwierdzone
  lokalnie: 954/954 testów, 61 plików)
- [ ] Backlog #12 zaktualizowany o konsekwencję dla mapowania kategorii Selly (D3) — NIE
  zrobione, mimo przeciwnego twierdzenia w `raport.md`
- [ ] Roadmapa: blok 8a zamknięty, sprostowane POST-y i auth panelu, notatki dla 8b w bloku 8b —
  NIE zrobione (uczciwie odnotowane w `raport.md` jako „do naniesienia")

## Parallel-test concerns

None — wszystkie testy przechodzą przez `stworzSrodowiskoTestowe` (baza SQLite w katalogu
tymczasowym, port efemeryczny). `test/selly.klient.test.ts` stawia własny serwer HTTP przez
`server.listen(0, "127.0.0.1")` — port systemowy, zero kolizji między równoległymi agentami.
Atrapa klienta Selly (`test/gate/selly-atrapa.ts`) całkowicie eliminuje ruch do prawdziwego
sklepu; nawet testy bez wstrzykniętej atrapy (60 istniejących plików) tworzą realnego klienta
z pustym `SELLY_SHOP_URL`, ale nigdy go nie wywołują (żadna z istniejących tras nie dotyka
`/api/selly/*`), więc zero ryzyka realnego żądania sieciowego.

## Overall assessment

Bardzo solidny port — logika biznesowa (klient OAuth2, mapper kategorii, generator CSV,
dwa formaty eksportu Shopera, wszystkie 10 tras Selly) jest zweryfikowana linia po linii
przeciw oryginałowi i zgadza się 1:1, łącznie z nieoczywistymi szczegółami (verbatim komunikaty
błędów, `Math.floor` zamiast `toFixed` w cenie CSV Selly, brak escapingu w CSV Shopera kontra
escaping cudzysłowem w generatorze Selly, różne parametry filtrujące `?dostawca` vs `?supplier`).
Testy są rzeczowe — sprawdzają zachowanie, nie tylko status 200, w tym rzeczy niewidoczne
w samej odpowiedzi (liczba wywołań atrapy, zawartość ZIP-a, autoryzacja przez samo cookie).
Jedyny realny problem to rozjazd między tym, co `raport.md` deklaruje jako zrobione
(aktualizacja backlogu #12), a tym, co faktycznie trafiło do diffu — to trzeba naprawić przed
merge, żeby dokumentacja projektu nie zaczęła kłamać sama do siebie.
