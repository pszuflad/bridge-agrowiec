# 18-FEATURE-waga-gabarytowa — raport z implementacji

## Podsumowanie

Iteracja 9 dowieziona w całości: backend dostał `POST /api/waga-gabarytowa/oblicz` z formułą
paletową odtworzoną 1:1 z `deminified/backend-index.cjs:48749-48769`, a frontend widok
`/waga-gabarytowa` z kalkulatorem wolumetrycznym i pełnym edytorem przewoźników, portowany
1:1 z `deminified/frontend-index.js:26514-26953`.

**Główne ustalenie ticketa: backend i frontend to DWA RÓŻNE kalkulatory**, nie ten sam wzór
w dwóch miejscach. Rekomendacja roadmapy („liczyć przez API — jedno źródło logiki") opierała
się na fałszywej przesłance i została świadomie odrzucona (D1). Widok liczy lokalnie i nie
woła endpointu — tak jak produkcja.

## Zmiany

### Backend (`rebuild/backend/`)
- **Nowy:** `src/waga-gabarytowa/formula.ts` — czysta funkcja `obliczWageGabarytowa` z progami
  półpalety/palety, doliczoną wysokością palety i zaokrągleniem do trzech miejsc.
  Odtwarza też semantykę `parseFloat(x || "0")` z całym jej dziwactwem (NaN przechodzi przez
  formułę i serializuje się do `null` — tak robi produkcja).
- `src/repos/config.ts` — dopisane `DOMYSLNE_WAGA_GAB` (cztery wartości z `:45633-45637`)
  i `odczytajUstawieniaWagiGabarytowej` z fallbackiem przez `||`, nie `??`.
- **Nowy:** `src/routes/waga-gabarytowa.ts` — jedna trasa za `requireAuth`, bez walidacji,
  bez audytu (oryginał nie audytuje tej trasy).
- `src/app.ts` — rejestracja `trasyWagiGabarytowej`.
- **Nowy:** `test/waga-gabarytowa.formula.test.ts` — 13 testów formuły.
- **Nowy:** `test/waga-gabarytowa.gate.test.ts` — 6 testów gate'u.

### Frontend (`rebuild/frontend/`)
- **Nowy:** `src/pages/waga-gabarytowa/przewoznicy.ts` — sześciu przewoźników i cztery klucze
  IndexedDB, nazwy 1:1 z `:9165-9192`.
- **Nowy:** `src/pages/waga-gabarytowa/obliczenia.ts` — `policzWage`, `wymiaryPoprawne`,
  `naLiczbe` (przecinek dziesiętny). Wydzielone, żeby dały się testować bez renderu.
- **Nowy:** `src/pages/waga-gabarytowa/TabelaPrzewoznikow.tsx` — edytor listy (D3).
- **Nowy:** `src/pages/WagaGabarytowa.tsx` — widok: formularz, wynik, tabela; hydratacja
  i autozapis w IndexedDB przez istniejący `lib/magazynKV.ts`.
- `src/App.tsx` — trasa `/waga-gabarytowa` wpięta w router.
- `src/pages/placeholdery.ts` — wpis `/waga-gabarytowa` usunięty; liczba tras routera bez zmian (12).
- **Nowy:** `test/waga-gabarytowa.obliczenia.test.ts` — 15 testów jednostkowych.
- **Nowy:** `test/waga-gabarytowa.test.tsx` — 14 testów renderowych.

## Odstępstwa od planu

Jedno, drobne i porządkowe: plan zapowiadał formułę backendu w `src/domain/waga-gabarytowa.ts`,
ale w `rebuild/backend/src/` **nie ma katalogu `domain/`** — konwencją repo są katalogi cech
(`src/import/`, `src/historia/`, `src/auth/`). Formuła trafiła więc do
`src/waga-gabarytowa/formula.ts`. Zero wpływu na zachowanie.

Poza tym implementacja jest 1:1 z planem. Decyzje D1–D4 zrealizowane bez zmian.

## Świadome odstępstwa od oryginału

- **D2 — `requireAuth` na trasie, którą produkcja i kontrakt mają jako publiczną.**
  `contract/openapi.yaml:1157` zamraża `security: []` z komentarzem „stan faktyczny", a oryginał
  rejestruje trasę bez middleware auth. Kontynuujemy D1 z I1 (wszystkie trasy danych pod auth).
  Kontraktu **nie ruszaliśmy**. Konsekwencja: kontrakt nie deklaruje dla tej ścieżki kodu 401,
  więc gate asertuje go wprost, poza `sprawdzZgodnoscZKontraktem` — ten sam zabieg co
  `test/narzuty.gate.test.ts:149` dla `GET /api/markups`.

Poza tym jednym punktem — zero odstępstw. W szczególności **nie** dorobiliśmy walidacji ani
kodu 400, choć kontrakt 400 deklaruje: oryginał tej gałęzi nie ma i każde wejście, łącznie
z pustym ciałem, kończy się kodem 200.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt):** ✓ zgodne, **ale siatka jest tu słabsza niż zwykle**.
  - Ścieżka w zakresie: `POST /api/waga-gabarytowa/oblicz` — jedyna, jakiej ticket dotyka.
  - **Fixtures: BRAK.** `contract/fixtures/` nie ma ani jednego pliku dla tej ścieżki
    (potwierdzone; roadmapa §5 I9 to zakładała). Nie mamy nagrania produkcji do porównania.
  - Co gate faktycznie dowodzi: operacja istnieje w kontrakcie; odpowiedź 200 waliduje się
    względem niego (ścieżka, metoda, kod, content-type — `openapi.yaml` nie opisuje ciał
    schematami); odpowiedź ma dokładnie pięć pól handlera oryginału; trasa jest pod auth.
  - **Ciężar dowodu zgodności LICZB leży w teście jednostkowym formuły**, na przykładach
    wyliczonych ręcznie z kodu oryginału — po jednym co najmniej na każdą gałąź decyzyjną.
    Ograniczenie jest nazwane wprost w nagłówkach obu plików testowych.
- **Unit backend:** ✓ 19 nowych testów (13 formuła + 6 gate). Cały pakiet: 622 testy w 38 plikach.
- **Unit + render frontend:** ✓ 29 nowych testów (15 jednostkowych + 14 renderowych).
  Cały pakiet: 307 testów w 20 plikach.
- **Bramki:** `lint`, `typecheck`, `build`, `test` — czyste w `rebuild/backend/` i `rebuild/frontend/`.

Test renderowy widoku **celowo nie używa MSW** — setup ma `onUnhandledRequest: "error"`, więc
gdyby ktoś kiedyś podpiął widok pod `fetch`, testy padną na nieobsłużonym żądaniu. To asercja
decyzji D1, nie tylko wygoda.

## Breaking changes

Brak. Ticket dokłada jedną trasę i jeden widok; nie zmienia żadnego istniejącego zachowania.
Trasa `/waga-gabarytowa` przestaje pokazywać placeholder — to cel iteracji.

## Follow-up

1. **`POST /api/waga-gabarytowa/oblicz` nie ma konsumenta.** Endpoint jest dowieziony
   i przetestowany, ale nikt go nie woła — tak samo jak w produkcji. Gdyby kiedyś okazało się,
   że formuła paletowa jest komuś potrzebna w UI, to osobna decyzja produktowa (nowy widok albo
   zakładka), nie podmiana istniejącego kalkulatora.
2. **Brak fixtura dla tej ścieżki.** Gdyby przy kolejnym nagrywaniu kontraktu udało się
   zarejestrować odpowiedź produkcji, `test/waga-gabarytowa.gate.test.ts` należy przepisać
   na porównanie fixture-diff — nagłówek pliku o tym mówi.
3. **Klucze `waga_gab.*` nie są zasiewane w bazie.** Formuła działa na fallbacku z kodu.
   Oryginał sieje je do tabeli `config` przy starcie (`allConfig()`); w odbudowie zasiew
   configu należy do **Iteracji 11** (`GET/PUT /api/config`) i tam trzeba go dołożyć,
   inaczej Ania nie zobaczy tych czterech pól w widoku konfiguracji.
4. **Lista przewoźników żyje tylko w przeglądarce.** IndexedDB per urządzenie — zmiany Ani
   nie przeniosą się na inny komputer i giną przy czyszczeniu danych witryny. Tak działa
   produkcja; przeniesienie listy na backend byłoby nową funkcją, nie odbudową.

## Review fixes applied

Reviewer zgłosił 1 BLOCKER, 1 SHOULD-FIX, 1 NICE-TO-HAVE. Formułę backendu i widok frontendu
porównał z oryginałem linia po linii, przeliczył samodzielnie wszystkie oczekiwane liczby
w teście formuły (36.072, 33.4, 240.48, 3.707, 54) i odpalił komplet bramek — bez zastrzeżeń.

- **BLOCKER — `docs/rebuild-roadmap.md` i `docs/rebuild-backlog.md` nieaktualne.** Zasadny:
  roadmapa nadal pokazywała blok I9 jako otwarty, z nierozstrzygniętą decyzją „lokalnie vs API".
  Domknięte w Fazie 5 ticketa (aktualizacja dokumentacji) — patrz sekcja „Docs updates".
- **SHOULD-FIX — niedokumentowany `req.body ?? {}`** (`src/routes/waga-gabarytowa.ts`).
  Dopisany komentarz: oryginał sięga po `c.body` wprost, strażnik chroni przed 500 przy żądaniu
  bez ciała i nie zmienia zachowania (puste ciało liczy się jako same zera).
- **NICE-TO-HAVE — `aria-label` na przycisku usuwania**, którego oryginał nie ma. Usunięty:
  w tym projekcie 1:1 wygrywa, a każde odstępstwo ma być decyzją użytkownika, nie inicjatywą
  implementacji. Trafia do follow-up jako temat ogólnorepozytoryjny, nie lokalny (punkt 5).

Po poprawkach: `lint`, `typecheck`, `test` czyste po obu stronach (FE 307/307, BE gate 6/6).

## Follow-up (uzupełnienie)

5. **Dostępność ikonowych przycisków — temat ogólnorepozytoryjny, nie tylko tego widoku.**
   Oryginał nie daje etykiet tekstowych przyciskom z samą ikoną (tu: usuwanie przewoźnika),
   więc czytnik ekranu nie ma czego przeczytać. Odtwarzamy to wiernie, bo poprawka jest
   odstępstwem od 1:1. Jeśli Ania zechce dostępność, to osobna decyzja obejmująca WSZYSTKIE
   takie przyciski w odbudowie, a nie łatka w jednym widoku.

## Docs updates

### `docs/rebuild-roadmap.md`
- §4 tablica postępu — wiersz „9 | Waga gabarytowa": `⬜` → `✅`, `ticket 18-FEATURE-waga-gabarytowa · 2026-09-03`.
- §5 blok „Iteracja 9" oznaczony jako zrobiony. **Usunięta obalona rekomendacja** „liczyć przez API
  — jedno źródło logiki"; zastąpiona ustalonym faktem (dwa różne kalkulatory biznesowe) i decyzją D1
  z uzasadnieniem. Dopisane odstępstwo D2 z precedensem `GET /api/markups`.
- **Ustalenie dla PRZYSZŁEGO bloku wpisane do tego bloku, nie do I9** (CLAUDE.md, obowiązek 2):
  blok Iteracji 11 dostał notę „⚠ WEJŚCIE Z ITERACJI 9" — cztery klucze `waga_gab.*` (plus opisowy
  piąty `waga_gab.opis_wspolczynnik`) nie są zasiewane w bazie odbudowy; I9 dowiozła sam odczyt
  z fallbackiem, zasiew configu należy do I11.
- §3 „Zasady przekrojowe", wiersz „Lokalne vs API" — status rozdzielony per iteracja:
  `⬜ per iteracja` → `🔨 częściowo (I9 ✅, I6 ⬜)`.
- Bloki 3d-2 i I12 sprawdzone: `applyWagaPamiec`/`waga_pamiec` już poprawnie opisane jako
  import-side, bez związku z `/waga-gabarytowa`. Bez zmian, bez duplikowania.

### `docs/rebuild-backlog.md`
- **Nowy wpis #26** — lista przewoźników i dzielników żyje wyłącznie w IndexedDB przeglądarki
  (`✅ port 1:1` na stan obecny, `⬜ do decyzji` na ewentualne przeniesienie na backend).
- **Nowy wpis #27** — `POST /api/waga-gabarytowa/oblicz` bez konsumenta (`⬜ do decyzji`),
  z odsyłaczem do #26.
- Żaden istniejący wpis nie dotyczył tego ticketa — przeszukane pod kątem wagi gabarytowej,
  `waga_gab`, `waga_pamiec`, przewoźników, dzielników i `bridge_ext`. Backlog nigdzie nie mieszał
  `waga_pamiec` z kalkulatorem, więc nie było czego prostować.
- Kandydat odrzucony: wpis o dostępności przycisków ikonowych — backlog nie prowadzi żadnego
  wątku przekrojowego a11y, a temat nie jest „zmianą produkcji do naniesienia", tylko standardem
  implementacyjnym. Zostaje w follow-up raportu (punkt 5).

### `docs/spec-frontend.md`
- §3 — licznik odbudowanych widoków: 6 → **7** (`/waga-gabarytowa`), placeholderów 6 → 5.
- §4 „Zachowania lokalne vs API" — wpis o wadze gabarytowej uzupełniony o **powód**: BE liczy inny
  wzór (paletowy), FE wolumetryczny z wyborem przewoźnika, więc to nie jest duplikat do usunięcia.
  Odnotowane, że I9 zachowała ten stan świadomie (D1).
- §5 „Blueprint odbudowy" — nowy blok dla I9 w stylu wpisów I5 i 4b.

### `docs/spec-backend.md`
- §2 — nowy blok „Potwierdzone w I9" (jak wpisy I2/3b/4a/I5): `requireAuth` (D2), formuła paletowa
  z progami i configiem `waga_gab.*`, pięć pól odpowiedzi, brak walidacji (zawsze 200).
- Lista publicznych endpointów produkcji — bez zmian, opisuje stan oryginału i nadal jest prawdziwa.

### `CLAUDE.md`
Bez zmian. Doc-checker zweryfikował w kodzie ostrzeżenie o duplikatach definicji w zdeminifikowanym
oryginale: `grep -c "waga-gabarytowa" mirror/backend/index.cjs` → 1 wystąpienie, żaden `patch_*.cjs`
tej trasy nie dotyka. Nic w pliku nie stało się nieprawdą.

### Pre-existing issues
Żaden z trzech doc-checkerów nie znalazł zastanych nieścisłości niezwiązanych z tym ticketem.
