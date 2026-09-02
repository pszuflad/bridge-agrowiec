# 15-FEATURE-historia-zmian — Raport z implementacji

## Podsumowanie

Iteracja 5 dowieziona end-to-end: trzy trasy historii (`GET /api/history`, `/api/history/meta`,
`/api/history/paged`) za `requireAuth` plus widok `/historia` z tabelą, trzema filtrami
i paginacją. Zachowanie odtworzone 1:1 z oryginału, łącznie z odsiewem akcji audytu i clampem
paginacji, który różni się od tego w `/api/staging/paged`. Przy okazji sprostowany fakt, na
którym opierał się opis ticketa i roadmapa: `Wa` to tabela `history`, nie `historia_cen`,
a `/meta` i `/paged` czytają `audit_log`.

## Zmiany

**Backend — nowe:**
- `rebuild/backend/src/repos/dziennik-zmian.ts` — odczyt tabeli `history` (port `listHistory()`,
  `:44962`). Nagłówek rozróżnia trzy mylnie podobne tabele: `history` / `historia_cen` / `audit_log`.
- `rebuild/backend/src/historia/mapowanie.ts` — czysty port mapowania `audit_log → widok`
  (`:48335-48391`): słownik pięciu akcji, odporny parser `szczegoly_json`, kolejność fallbacków
  `liczbaPozycji`, clamp `page`/`limit`, filtry i wycinanie strony.
- `rebuild/backend/src/routes/history.ts` — trzy trasy z `requireAuth` (odstępstwo D1).

**Backend — zmienione:**
- `rebuild/backend/src/repos/audit.ts` — dopisane `listaAudytu(db, limit)` (port `listAudit()`,
  `:45068`) i typ `WierszAudytu`; ostrzeżenie o trzech podobnych tabelach.
- `rebuild/backend/src/repos/historia.ts` — sprostowany docstring: czytelnika `historia_cen`
  dowozi I10, nie I5.
- `rebuild/backend/src/app.ts` — wpięcie `trasyHistorii`.

**Frontend — nowe:**
- `rebuild/frontend/src/pages/Historia.tsx` — port `GT()` (`fe.js:25374-25635`).
- `rebuild/frontend/src/pages/historia/TabelaHistorii.tsx` — sześć kolumn + `OdznakaTypu`
  (port `QT()`), kolumna „Szczegóły" z trzema wariantami.
- `rebuild/frontend/src/pages/historia/dane.ts` — typy, opcje filtrów, `adresStrony`,
  `sformatujDate`. Nagłówek mówi wprost, czego ten widok NIE pokazuje.

**Frontend — zmienione:**
- `rebuild/frontend/src/App.tsx` — trasa `/historia`.
- `rebuild/frontend/src/pages/placeholdery.ts` — zdjęty placeholder `/historia`.
- `rebuild/frontend/src/pages/Staging.tsx` — tylko komentarz: nota „widać je dopiero w historii
  cen (Iteracja 5)" była nieprawdziwa, `historia_cen` czyta I10.

**Testy — nowe:**
- `rebuild/backend/test/historia.gate.test.ts` — GATE (9 testów).
- `rebuild/backend/test/historia.mapowanie.test.ts` — jednostkowe (57 testów).
- `rebuild/backend/test/historia.odczyt.test.ts` — integracyjne na realnej bazie (14 testów).
- `rebuild/frontend/test/historia.test.tsx` — widok z MSW (16 testów).
- `rebuild/backend/test/gate/dane.ts` — `zasiejDziennikZmianZFixtures` + `zasiejAudytHistorii`.
- `rebuild/frontend/test/msw/kontrakt.ts` — `stronaHistoriiZFixtura` + `metaHistoriiZFixtura`.

## Odstępstwa od planu

Dwie korekty, obie drobne i wykryte przez testy:

1. **Wpis `/paged` ma 11 pól, nie 12** — plan podawał 12, bo policzyłem pola z listy o jeden
   za dużo. Fixture i implementacja mają 11 (`id, typ, kiedy, dostawca, uzytkownik,
   liczbaPozycji, nazwaPliku, format, kodProduktu, zmienionePola, uwagi`). Test GATE
   sprawdzający komplet kluczy złapał to od razu.
2. **Seed GATE ma dwa wiersze z zepsutym JSON-em, nie jeden** — plan przewidywał jeden, przy
   akcji nierozpoznanej. Taki wiersz wypada na odsiewie i nie dowodzi, że parser broni CAŁEJ
   drogi, więc dołożyłem drugi przy `upload_pliku` (akcja rozpoznawana), który przechodzi przez
   pełne mapowanie i musi wyjść z pustymi szczegółami.

Poza tym plan zrealizowany 1:1, łącznie z kolejnością commitów.

## Zawężenie typu wobec oryginału (udokumentowane w kodzie)

`mapowanie.ts` bierze wartości ze `szczegoly_json` tylko wtedy, gdy mają właściwy typ; oryginał
przepuszcza dowolny (`m.dostawca ?? null`). Dla wszystkich pisarzy `audit_log` w rebuildzie
zachowanie jest identyczne — różnica ujawniłaby się przy ręcznie zepsutym wierszu, gdzie
oryginał złamałby kształt odpowiedzi wobec kontraktu, a my nie. Opisane w komentarzu przy
`tekstAlboNull` / `liczbaAlboNull`.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.** Sprawdzone trzy ścieżki i trzy pliki:
  - `GET /api/history` ↔ `contract/fixtures/GET_history.json` — kształt 1:1 + komplet 10 kluczy
    na wierszu;
  - `GET /api/history/meta` ↔ `GET_history_meta.json` — kształt 1:1;
  - `GET /api/history/paged` ↔ `GET_history_paged.json` — kształt 1:1 + komplet 11 kluczy na
    wpisie + porównanie WARTOŚCI pięciu nagranych wpisów (`typ`, `kiedy`, `kodProduktu`,
    `zmienionePola`, `uzytkownik`, `liczbaPozycji` oraz nulle w `nazwaPliku`/`format`/`uwagi`/
    `dostawca`).
  - Każda ścieżka dodatkowo: 401 bez tokenu, mimo `security: []` w kontrakcie (utrwalenie D1).
  - Zero zadeklarowanych wyjątków `WyjatekGate` — nic nie trzeba było obchodzić.
- **Unit:** ✓ 57 (`historia.mapowanie.test.ts`).
- **Integracyjne:** ✓ 14 backend (`historia.odczyt.test.ts`, realny SQLite w katalogu
  tymczasowym, zero mocków) + ✓ 16 frontend (`historia.test.tsx`, MSW na fixtures).
- **Regresja:** backend 529/529, frontend 199/199 — nic nie zepsute.
- **Bramki:** `lint`, `typecheck`, `test`, `build` czyste po obu stronach.
- **E2E:** pominięte świadomie — widok jest tylko do odczytu, a drogę „import → wpis w historii"
  pokrywają testy backendu.

## Breaking changes

Brak. Trzy nowe trasy tylko do odczytu, jedna nowa trasa w routerze FE. Żaden istniejący
endpoint ani komponent nie zmienił zachowania — zmiany w `repos/historia.ts` i `Staging.tsx`
dotyczą wyłącznie komentarzy.

## Follow-up

Rzeczy zauważone po drodze, świadomie NIE zrobione w tym ticketcie:

1. **`docs/spec-backend.md:51-54` mówi o „podwójnej rejestracji" `/api/history/meta` i `/paged`
   — rejestracji są TRZY.** Rdzeń (`:48335`, `:48352`, bez `we`), `pagination_module.cjs:136,168`
   (z `we`) i ten sam moduł ładowany drugi raz przez `extensions.cjs:449-451`. Wynik ten sam
   (wygrywa rdzeń, trasy są publiczne), więc na implementację to nie wpływa — ale opis w spec
   jest niedokładny. Do poprawy przy okazji I12 (hardening bezpieczeństwa).
2. **Widok `/historia` nie pokaże importów z URL ani ręcznych synchronizacji.** `import_z_url`,
   `import_pliku` i `synchronizacja_reczna` nie są w słowniku pięciu rozpoznawanych akcji, więc
   wypadają — tak samo jak w produkcji (D2). Jeśli Ania uzna to za lukę, jest to zmiana do
   `docs/rebuild-backlog.md`, nie do naprawy „po cichu".
3. **Tabela `history` nie ma w rebuildzie pisarza**, więc `GET /api/history` zwraca na stagingu
   `[]`. Pisarzem jest ręczna edycja produktu w katalogu (`PUT`/`PATCH /api/products/:id`,
   `:48435`/`:48475`) — mutacja katalogu, poza zakresem I5.
4. **`/api/history/paged` czyta tylko 5 000 najświeższych wierszy audytu PRZED filtrowaniem**
   (`listAudit(5e3)`). Przy większym `audit_log` starsze wpisy stają się niedostępne niezależnie
   od numeru strony, a `total` przestaje być liczbą wszystkich wpisów. To zastane zachowanie
   produkcji, odtworzone celowo i opisane w `repos/audit.ts`.

## Review fixes applied

Runda 1 review (`review.md`): 1 BLOCKER, 1 SHOULD-FIX, 2 NICE-TO-HAVE.

- **BLOCKER — roadmapa nie zamknięta.** Zasadny: blok I5 dalej miał status `⬜`, błędny fakt
  „`Wa` = `historia_cen`" i brak noty w bloku I10 (decyzja D3). Realizowane w Fazie 5 (Krok 13-14),
  bo aktualizacja `docs/` to osobny etap ticketa — nie było to pominięcie, tylko kolejność.
- **SHOULD-FIX — mylący komentarz** przy `stronaHistoriiZFixtura`
  (`rebuild/frontend/test/msw/kontrakt.ts`): mówił „50 nagranymi wpisami", a `items` ma pięć
  (50 to `_przyciete.items`, czyli stan sprzed sanityzacji). Poprawione, z wyjaśnieniem, dlaczego
  `total`/`pages` celowo nie zgadzają się z długością `items`.
- **NICE-TO-HAVE — niezatwierdzone odstępstwo w `sformatujDate`.** Strażnik `Number.isNaN`
  usunięty: oryginał go nie ma, a w praktyce był to martwy kod (`repos/audit.ts` zapisuje
  wyłącznie `new Date().toISOString()`). Zamiast dopisywać decyzję D7 dla czegoś, co nigdy się
  nie uruchamia, wolałem wrócić do 1:1. Powód zostawiony w docstringu.
- **NICE-TO-HAVE — kruche literały w testach.** `total === 12` / `pages === 3` w
  `historia.odczyt.test.ts` zastąpione wartościami liczonymi z seeda: nowe
  `liczbaRozpoznanychWpisowHistorii()` w `test/gate/dane.ts` przepuszcza wiersze seeda przez ten
  sam zbiór pięciu rozpoznawanych akcji, a test wyprowadza z niej `total`, `pages` i długość
  ostatniej strony. Zmiana seeda (np. przy `/api/audit-log` w I12) zmieni teraz oczekiwania
  razem z danymi.

Po poprawkach: backend 529/529, frontend 199/199, `lint`/`typecheck`/`build` czyste po obu stronach.
