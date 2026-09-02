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

1. ~~`docs/spec-backend.md` mówi o „podwójnej rejestracji" — rejestracji są TRZY.~~
   **ZROBIONE w Fazie 5 tego ticketa** (nie przeniesione dalej). Rdzeń (`:48335`, `:48352`, bez
   `we`), `pagination_module.cjs:136,168` (z `we`) i ten sam moduł ładowany drugi raz przez
   `extensions.cjs:449-451`. Wniosek się nie zmienił (wygrywa rdzeń, trasy są publiczne),
   poprawiona tylko liczba rejestracji.
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

## Docs updates

Trzy doc-checkery równolegle, każdy nanosił zmiany sam.

### `docs/rebuild-roadmap.md`

- **§4 Tablica postępu** — wiersz „5 | Historia": `⬜` → `✅ | PR #24 · 2026-09-02`.
- **§5 Iteracja 5** — blok przepisany ze stanu planowanego na dowieziony: status zamknięty
  (data + ID ticketa + PR); sprostowany fakt `Wa` = tabela `history` (nie `historia_cen`),
  z rozbiciem, co czyta która trasa; filtr pięciu akcji zapisany jako fakt rozstrzygnięty (D2)
  z listą przechodzących i odpadających; ostrzeżenie o `synchronizacja_reczna` przeformułowane
  na „wypada na filtrze, do widoku nie dociera" i przeniesione tam, gdzie realnie uderza.
  Dopisane fakty na przyszłość: brak pisarza tabeli `history`, potrójna rejestracja tras,
  różnica clampu paginacji wobec `/api/staging/paged`, limit 5000 wierszy audytu przed
  filtrowaniem. DoD odhaczone.
- **§5 Iteracja 10** — nowa nota „WEJŚCIE Z ITERACJI 5" (decyzja D3): `historia_cen` ma pisarza
  z 3d-1, czytelnika dowozi I10 (`GET /api/analytics/prices/product-history`); `GET /api/history`
  jest gotowe i czeka jako źródło dla Pulpitu, na stagingu zwraca dziś `[]`.
- **§5 Iteracja 12** — nowa nota: ostrzeżenie o `synchronizacja_reczna` (NULL `szczegoly_json`,
  `encja_id` niezłączalny) przeniesione tu z I5, bo `/api/audit-log` czyta surowy log bez filtra
  typu i musi to jawnie znieść; wskazany gotowy parser z I5 do reużycia.
- **§5 blok 3e** — sprostowana błędna wzmianka „widać je dopiero w `historia_cen` (Iteracja 5)".

### `docs/rebuild-backlog.md`

- **Nowy wpis #21 (⬜ DO DECYZJI)** — „widok `/historia` nie pokazuje importów z URL ani ręcznych
  synchronizacji". Opisuje, co robi produkcja, dlaczego odtworzyliśmy to 1:1 (D2) i dlaczego mimo
  to warto, żeby Ania zdecydowała: od 3f-3 automatyczny import z URL jest głównym kanałem
  zasilania danych, a historia go nie pokazuje. **Nie oznaczone jako ✅** — to nie nasza decyzja.
- Zweryfikowano grepem, że żaden istniejący wpis nie dotyczy historii / `audit_log` / `Wa`.
- Świadomie NIE dopisano limitu 5000 wierszy audytu: backlog rejestruje decyzje Ani, a to jest
  odziedziczone ograniczenie techniczne bez alternatywy do rozstrzygnięcia (zostaje jako
  komentarz w `repos/audit.ts` i fakt w roadmapie).

### `docs/spec-backend.md`

- §2 — „podwójna rejestracja" `/api/history/meta` i `/paged` sprostowana na **trzy** rejestracje;
  wniosek (trasy faktycznie publiczne) bez zmian. **To domyka follow-up #1 tego raportu** —
  nie przechodzi dalej do I12.
- §2 — nowy blok „Potwierdzone w I5": trzy trasy za `requireAuth` (D1) oraz sprostowanie, że
  `/api/history` czyta `history` (goła tablica, 10 pól), a `/meta`/`/paged` czytają `audit_log`
  i zwracają `{dostawcy}` / `{items,total,pages,page,limit}` z 11-polowymi wpisami.
- §5 — przy mapowaniu `Wa` dopisane, że to tabela SQL `history`, odrębna od `historia_cen`
  (pisana od 3d-1, czytana dopiero od I10).

### `docs/spec-frontend.md`

- §4 — doprecyzowane, których endpointów widok Historii faktycznie używa (`/paged` + `/meta`,
  nigdy gołego `GET /api/history`).
- §5 (Blueprint odbudowy) — nowy blok „Odbudowa (I5)": zdjęty placeholder `/historia`
  (12 tras routera, 7 placeholderów zostaje), widok to log zdarzeń a nie lista zmian cen
  (bez „przed → po"), wołane endpointy, odstępstwo D5.

### Problemy zastane

Żaden z trzech agentów nie znalazł nieaktualności poza tymi, które ten ticket sam zgłosił
i naprawił. Sekcje niezwiązane z historią (design tokens, blueprint auth, rozjazd
`/api/attributes`) zostawione bez zmian.

## Instrukcja testów dla Ani

`docs/instrukcja-testow-I5.md` (nowy, wzorowany na `instrukcja-testow-I3.md`).

Dokument jest zbudowany wokół jednego problemu: **nazwa ekranu obiecuje coś innego, niż ekran
robi.** „Historia" brzmi jak lista zmian cen, a jest logiem zdarzeń. Gdyby Ania weszła na ten
ekran bez ostrzeżenia, jej pierwszym zgłoszeniem byłoby „nie widzę zmian cen" — a to jest
zachowanie zgodne z produkcją i przez nas zamierzone. Dlatego rozdział 3 („Czego ten ekran NIE
pokazuje") stoi przed jakąkolwiek instrukcją klikania.

Druga rzecz wyłożona wprost: **jedyne kliknięcie, które doda wiersz do Historii, to wgranie
cennika przez przeglądarkę.** Zweryfikowane grafem wywołań — `synchronizuj.ts` i `scheduler.ts`
nie zapisują audytu w ogóle, a `synchronizacja_reczna` z `routes/suppliers.ts:348` nie przechodzi
przez filtr pięciu akcji. Bez tego zdania Ania kliknęłaby „Synchronizuj teraz", zobaczyła brak
zmiany i zgłosiła nieistniejącą usterkę.

Instrukcja **zadaje jej dwa pytania** zamiast zakładać odpowiedzi: czy log bez importów z URL
jej wystarcza (backlog #21) i czy brak zmian cen per opona na tym ekranie jest do przyjęcia.
Oba są oznaczone jako „nie ma złej odpowiedzi" — to decyzje jej, nie nasze.

Przy okazji sprostowany nieaktualny wiersz w `docs/instrukcja-testow-I3.md` §13, który
obiecywał „Widok Historia (zmiany cen z importów) — Iteracja 5". Zmiany cen to Iteracja 10;
dopisane sprostowanie z odesłaniem do nowej instrukcji.
