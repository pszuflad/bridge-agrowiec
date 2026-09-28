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

---

## Iteracja 2 — weryfikacja poprawek

> Reviewed: 2026-09-04
> Commit poprawek: `23157d9` („review fix - backlog #12, cache archiver, cap spoza oryginału")
> Bramki (uruchomione ponownie samodzielnie): `npm run lint`/`typecheck`/`build` czyste,
> `npm test` — **954/954 zielone, 61 plików**.

### 1. BLOCKER — backlog #12 — **naprawione**

`git diff origin/develop...HEAD -- docs/rebuild-backlog.md` pokazuje realną, nietrywialną
zmianę: rozstrzygnięcie właścicielstwa (I8, nie I7) i nowa sekcja „Konsekwencja dla Selly —
zmierzona w 8a" z opisem obu gałęzi mapowania.

Zweryfikowano zgodność z kodem, nie tylko z opisem:
- `src/selly/mapper.ts:100-105` — puste `zastosowanie` → `wartosci.length === 0` →
  `source: "fallback_kategoria"`, `category_id = mapujKategorieGlownaId(...)`,
  `extra_cat_ids: []` — dokładnie tak, jak opisuje backlog (brak podkategorii, brak `multi_cat`).
- `src/selly/mapper.ts:284-293` (`walidujPayload`) — `if (!payload.category_id) errors.push("Brak
  category_id (nieznana kategoria)")` — potwierdza ścieżkę „walidacja odrzuca payload", gdy
  `products.kategoria` nie ma odpowiednika w `selly_kategoria_norm_map`.
- `src/routes/selly.ts:270-278` (`sync-supplier`) — `walidacja.ok === false` → `skipped++` —
  potwierdza twierdzenie backlogu, że taki produkt liczy się jako `skipped` i „w ogóle nie
  dojdzie do sklepu" (bo `continue` pomija wywołanie klienta).
- Obie ścieżki faktycznie są zamrożone w `test/selly.mapper.test.ts` (branże `fallback_kategoria`
  / `fallback_empty`) i `test/selly.synchronizacja.test.ts` (`skipped` w podsumowaniu).

Treść jest uczciwa wobec stanu faktycznego, komentarz w `src/selly/mapper.ts:9-17` odsyła do
tej samej sekcji backlogu. `raport.md` już nie twierdzi nieprawdy — sekcja „Poprawki po review"
opisuje dokładnie to, co zaszło w diffie. **BLOCKER zamknięty.**

### 2. SHOULD-FIX — cache `archiver` — **naprawione**

`src/routes/export-shoper.ts:59-69` — `let ZipArchiveCache` w zmiennej modułu +
`konstruktorZip()`, wzorem `rV()`/`oh` z oryginału (`deminified/backend-index.cjs:48138-48149`,
zweryfikowano ponownie 1:1: `var oh = null; async function rV() { if (!oh) {...} }`). Jedyny
konsument ZIP-a (`GET /api/export-shoper` bez `?dostawca` albo `dostawca=wszyscy`) woła
`await konstruktorZip()` zamiast bezpośredniego `import()`. Wyścig przy równoległych żądaniach
nieszkodliwy — najgorszy przypadek to kilka równoległych `import("archiver")` zanim pierwszy się
rozstrzygnie, a Node i tak cache'uje moduł w swoim rejestrze; wynik zawsze ten sam konstruktor.
Test `test/eksport-shoper.format.test.ts` nadal zieleni się (zawartość ZIP-a per dostawca,
nagłówki) — mechanizm cache'owania nie jest wprost testowany, ale to OK, bo zachowanie
obserwowalne jest identyczne z i bez cache'a; nie ma potrzeby osobnego testu na samą optymalizację.

### 3. SHOULD-FIX — `Math.min(limit, 50)` w słownikach — **naprawione**

Cap usunięty z `listProducers`/`listCategories` (`src/selly/klient.ts:277-284`), z komentarzem
wyjaśniającym asymetrię wobec `listProducts`/`listOrders`. Zweryfikowano w oryginale
(`mirror/backend/selly/client.cjs:129,181-186,203`): `listProducts`/`listOrders` capują
(`Math.min(limit, 50)` w query), `listProducers`/`listCategories` przekazują `query` wprost bez
capowania — potwierdzone.

Test `test/selly.klient.test.ts:263-284` przepisany poprawnie i NIE jest tautologiczny: podaje
`limit: 500` (jawnie powyżej dawnego capa 50) i asercją `daneowe?.sciezka).toBe("/api/producers?
limit=500")` sprawdza, że wartość dochodzi do Selly nieścięta — gdyby ktoś przywrócił
`Math.min(limit, 50)`, test faktycznie by czerwienił (ścieżka byłaby `?limit=50`).

### 4. NICE-TO-HAVE — `?dostawca` jako tablica — **udokumentowane, bez zmiany zachowania**

`src/routes/selly.ts:334-341` — komentarz opisuje uczciwie różnicę wobec oryginału (better-sqlite3
rzuciłby 500 na tablicy, tu ciche `undefined`) i uzasadnienie (panel takich żądań nie generuje).
Zgodne z tym, co Master zadeklarował — wystarczające jako NICE-TO-HAVE, nic więcej nie wymagane.

### 5. NICE-TO-HAVE — filtr statusu w SQL — **naprawione**

`src/selly/generator-csv.ts:154-160` (`zbudujCsvSelly`) — filtr `eq(products.status, "aktywny")`
przeniesiony do `.where(...)` zapytania Drizzle, `orderBy(asc(products.id))` zachowane.
Zweryfikowano zgodność z oryginałem: `test/selly.generator-csv.test.ts:88` ma referencyjne
zapytanie `SELECT * FROM products WHERE status = 'aktywny' ORDER BY id` — identyczny warunek
i porządek jak w nowym kodzie. Test `it("bierze wyłącznie produkty ze statusem \`aktywny\`"` 
(`test/selly.generator-csv.test.ts:62-68`) nadal pokrywa tę ścieżkę i przechodzi.

### 6. NICE-TO-HAVE — DoD w `plan.md` — **naprawione, zgodnie z procedurą**

`docs/tickets/28-FEATURE-selly-eksport-backend/plan.md:252-260` — wszystkie pozycje odhaczone
poza ostatnią („Roadmapa: blok 8a zamknięty…"), która świadomie zostaje `[ ]` do Fazy 5
(doc-checkery). Zgodne z procedurą ticketa — nie zgłaszane ponownie jako brak.

### Nowe problemy wprowadzone poprawkami

Brak. Żadna z pięciu poprawek nie wprowadza nowej regresji ani nowego odstępstwa od oryginału —
każda została zweryfikowana zarówno przeciw kodowi źródłowemu oryginału
(`mirror/backend/selly/client.cjs`, `deminified/backend-index.cjs:48138-48149`,
`mirror/backend/generate_selly_export.cjs`), jak i przeciw testom, które faktycznie pilnują
zgłoszonego zachowania (nie tautologicznie).

### Status po iteracji 2

- **BLOCKER: 0** (był 1, naprawiony).
- **SHOULD-FIX otwarte: 1** — roadmapa (`docs/rebuild-roadmap.md` §5, blok „Iteracja 8"), świadomie
  odłożone do Fazy 5 zgodnie z procedurą ticketa; nie blokuje mergu tej iteracji.
- **NICE-TO-HAVE: 0 otwartych** (2 z 3 naprawione, 1 świadomie zostawione jako udokumentowana
  różnica — zaakceptowane).

Ticket gotowy do merge z perspektywy code review; jedyny pozostały punkt (roadmapa) jest
formalnie poza zakresem tej iteracji i ma właściciela (Faza 5).
