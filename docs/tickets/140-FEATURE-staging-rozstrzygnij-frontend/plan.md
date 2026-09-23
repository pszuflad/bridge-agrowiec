# 140-FEATURE-staging-rozstrzygnij-frontend — Staging v2: przycisk i okno „Rozstrzygnij" oraz okno blokady akceptacji (FE)

> Status: Draft
> Branch: `feature/140-staging-rozstrzygnij-frontend`
> Worktree: `.worktrees/140-FEATURE-staging-rozstrzygnij-frontend`
> Karta: `docs/karty/I15.5/` (I15.5, iteracja 15, backlog #99)

## Opis ticketa

Port `mirror/frontend/assets/staging-policy-injection.js` (z `origin/main` na `88fa31c`,
wersja ładowana przez `index.html` jako `?v=20260923dotchoice`) do widoku `/staging` w React:

- **przycisk „Rozstrzygnij"** przy zgłoszeniach z niejednoznacznym dopasowaniem oraz
  **„Sprawdź kartę"** tam, gdzie jest stara wstrzymana karta;
- **okno**: osobno stara karta i możliwy odpowiednik, wskazanie zgodności lub różnicy EAN i DOT,
  stan obu kart; akcje: wybór jednej karty i zapis wyboru. Teksty **dosłownie** z oryginału;
- **okno „Nie zapisano zmian"** z treścią błędu przy blokadzie akceptacji (409);
- zachowanie układu ekranu z I14 (karty 14a/14b/14c) — skrypt wstrzykiwany go nie znał.

Poza zakresem: panel „Braki w cenniku" i backend (patrz „Out of scope").

## Kontekst

### Co robi oryginał (155 linii, przeczytane w całości)

Skrypt jest **wstrzykiwaną nakładką na gotowy DOM** — nie zna Reacta ani układu I14. Działa tak:

1. `MutationObserver` na `document.body` → `scan()` (debounce przez `requestAnimationFrame`).
2. `scan()` iteruje `tr[data-testid^="row-staging-"]`, pomija wiersze, które już mają przycisk,
   i dokleja przycisk do `row.lastElementChild` (u nas: kolumna „Akcje").
3. Warunek: `row.textContent` pasuje do
   `/Sprawdź dopasowanie|Wybierz właściwą oponę|Wymaga sprawdzenia pliku|Sprawdź starą kartę/`.
   Etykieta: „Sprawdź kartę" gdy pasuje `Sprawdź starą kartę`, inaczej „Rozstrzygnij".
4. Kliknięcie → `GET /api/staging/:id/review` → okno `<dialog>` z **trzema rozłącznymi gałęziami**.
5. Osobno: nakładka na `window.fetch` pokazująca okno „Nie zapisano zmian" dla każdej nieudanej
   odpowiedzi z `/api/staging/accept`.

Wszystkie cztery frazy z regexa pochodzą z pola **`powod`** pozycji stagingu — zweryfikowane
w `rebuild/backend/src/import/polityka/fabryka.ts` (`:412`, `:436`, `:437`, `:447`, `:457`, `:528`,
`:879`, `:917`) i w oryginale `staging_policy.cjs` (`:384`, `:394`, `:400`, `:407`, `:433`, `:577`,
`:592`). `powod` jest w odpowiedzi `/api/staging/paged`, więc lista ma wszystko, czego trzeba.

### Trzy gałęzie okna (jedno okno, jeden przycisk)

| Gałąź | Warunek z `review` | Tytuł okna | Akcja |
|---|---|---|---|
| **stara karta** | `absenceReview === true` | „Porównaj starą kartę z obecną ofertą" | `POST …/choose-absence-card` |
| **dopasowanie** | `matchIssue && !duplicateSource` | „Sprawdź dopasowanie opony" | `POST …/resolve` |
| **sprzeczne wiersze** | `duplicateSource === true` | „Sprawdź dopasowanie opony" | brak — sam podgląd |

⚠ **Gałęzie „stara karta" i „dopasowanie" są ROZŁĄCZNE** — sprawdzone w importerze po code
review (ticket 140): `_absenceReview` ustawiają tylko `fabryka.ts:855` i `:902`, a obie te
gałęzie budują snapshot z produktu katalogowego, który `_matchIssue` nie ma. Oryginał ma dla
nich dwa osobne elementy błędu, co sugeruje współwystępowanie — w danych jest ono nieosiągalne.
Port ma więc jeden stan błędu.

Gałąź „sprzeczne wiersze" jest w zakresie, mimo że nagłówek karty jej nie wymienia: otwiera ją
ten sam przycisk (fraza „Wymaga sprawdzenia pliku" jest w regexie), więc bez niej „Rozstrzygnij"
otwierałby puste okno. Gałąź „stara karta" też jest w zakresie — prompt karty opisuje ją wprost
(„osobno stara karta i możliwy odpowiednik, wskazanie zgodności lub różnicy EAN i DOT, stan obu
kart"), a fizycznie siedzi w TYM pliku, nie w żywym bundlu.

### Stan odbudowy, na którym budujemy

- `src/pages/Staging.tsx` (380 l.) — nagłówek, pasek, paginacja, `DialogPotwierdzenia` ×2,
  mutacja `akcja` z `onError → ustawKomunikat`.
- `src/pages/staging/TabelaStagingu.tsx:125` — wiersze mają JUŻ `data-testid="row-staging-${id}"`,
  a kolumna „Akcje" ma przycisk „Szczegóły”. Dokładnie to miejsce, w które celował skrypt.
- `src/pages/staging/dane.ts` — typy i mutacje (`zatwierdzPozycje`, `zatwierdzWszystkie`, …).
- `src/components/DialogPotwierdzenia.tsx` — precedens „natywny `confirm()` → React `<Dialog>`,
  teksty dosłownie" (D2 z 7b, D5 z 12e).
- `src/lib/api.ts` — `zadanie()` rzuca `Error("409: <surowy tekst ciała>")`; **nie** oddaje
  sparsowanego `message`. To jest do obejścia (patrz Decisions D4).
- `test/staging.test.tsx` (613 l.) — wzorzec testu widoku; `zamockujApi()` jest dziś **lokalny**.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Ticket jest **frontendowy** i nie zmienia backendu ani kontraktu. Konsumuje cztery trasy
opisane w `contract/openapi.yaml`:

| Trasa | Użycie w tym tickecie |
|---|---|
| `GET /api/staging/{id}/review` | materiał do okna (wszystkie trzy gałęzie) |
| `POST /api/staging/{id}/resolve` | gałąź „dopasowanie": `{action:"link"\|"new", targetCode?}` |
| `POST /api/staging/{id}/choose-absence-card` | gałąź „stara karta": `{selectedCode, candidateVersion}` |
| `POST /api/staging/{id}/close-absence-review` | **NIE UŻYWANA** — decyzja D1 |
| `POST /api/staging/accept` | bez zmian w ciele; zmienia się tylko prezentacja błędu 409 |

**Fixtures: dla tych tras nie ma i nie było czego nagrać** — `contract/fixtures/` zawiera wyłącznie
`GET_staging.json` i `GET_staging_paged.json` (odczyt listy), co karta I15.4c ustaliła jako D129.5.
GATE na fixtures **nie obowiązuje**; dowodem wierności są mocki MSW zbudowane z kształtów
`openapi.yaml` + asercje na DOSŁOWNĄ treść okna, porównaną znak w znak z oryginałem.

**Rozjazd rozstrzygnięty:** `openapi.yaml` i backend mają `close-absence-review`, a żywy frontend
na `88fa31c` go nie woła. Wzorcem jest frontend (odtwarzamy frontend) — trasa zostaje po stronie
backendu nieużywana. Szczegóły w D1.

## Decisions

Odpowiedzi użytkownika z 2026-09-23 (Krok 3):

**D1 — „Pozostaw starą wstrzymaną i zamknij sprawę" NIE wchodzi.** Zamrożona produkcja `88fa31c`
nie ma tego przycisku: łatka `20260923_dotchoice` (23.09 12:31, `CHANGELOG.md`) zastąpiła go
przyciskiem „Zapisz wybór w katalogu" wołającym `choose-absence-card`. Zweryfikowane diffem
`git diff 58d9d1d 88fa31c -- mirror/frontend/assets/staging-policy-injection.js`: linie z
`'Pozostaw starą wstrzymaną i zamknij sprawę'` i `close-absence-review` zostały USUNIĘTE.
Prompt karty opisywał wersję sprzed 12:31.
*Za:* reguła 1:1 i hierarchia źródeł (oryginał > prompt > roadmapa).
*Przeciw (świadomie przyjęte):* przy różnym DOT użytkownik nie ma akcji zamykającej sprawę —
produkcja liczy na to, że następny import usunie zgłoszenie, i mówi to wprost w tekście okna.

**D2 — warunek pokazania przycisku czytamy z DANYCH, nie z DOM-u.** Ten sam regex, ale stosowany
do `pozycja.powod` + `pozycja.ostrzezenie`, niezależnie od widoczności kolumny „Powód".
*Powód:* oryginał testuje `row.textContent`, więc schowanie kolumny „Powód" w konfiguratorze
(`kolumny.ts:57`, klucz `powod`, domyślnie widoczna) CHOWA przycisk. To niezamierzony efekt
uboczny wstrzykiwanej nakładki, nie funkcja. **Odstępstwo w mechanice, zgodność w skutku** przy
domyślnym zestawie kolumn.

**D3 — po sukcesie unieważniamy zapytania, nie przeładowujemy strony.** Oryginał robi
`location.reload()`. U nas: zamknięcie okna + istniejąca `odswiez()` ze `Staging.tsx`
(`/api/staging`, bieżąca strona, `/api/products`, wyczyszczenie zaznaczenia).
*Powód:* ten sam typ adaptacji nośnika co D2 z 7b; `reload()` gubi filtr, stronę i szukajkę,
a w RTL nie da się go zweryfikować. Skutek dla użytkownika identyczny — świeża lista z nowym
`id` zgłoszenia (`resolve` kasuje stare zgłoszenie i zakłada nowe).

**D4 — okno „Nie zapisano zmian" podpinamy w `onError` mutacji akcji.** Oryginał nakłada nakładkę
na globalny `window.fetch` i filtruje po URL-u `/api/staging/accept`. U nas wszystkie trzy przyciski
akceptacji („wszystkie", „zaznaczone", „widoczne") idą przez `zatwierdzPozycje`/`zatwierdzWszystkie`,
więc `onError` łapie dokładnie ten sam zbiór zdarzeń. Odrzucanie zostaje przy dotychczasowym
komunikacie w pasku — tak jak w produkcji, gdzie nakładka filtruje wyłącznie `accept`.
*Powód odrzucenia wariantu wiernego:* globalna mutacja `window.fetch` w aplikacji React kolidowałaby
z nakładką z `test/setup.ts` i nie ma w tym kodzie precedensu.

**D5 — `window.confirm()` przed zapisem wyboru karty → `DialogPotwierdzenia`.** Treść pytania
dosłownie, nośnik jak w całej odbudowie (precedens D2 z 7b, D5 z 12e). Nie jest to nowa decyzja,
tylko zastosowanie ustalonego wzorca.

**D6 — współdzielone mocki stagingu wydzielamy do `test/msw/staging.ts`.** Dziś `zamockujApi()`
siedzi lokalnie w `staging.test.tsx`. Wydzielenie jest warunkiem sensownego wykonania ostrzeżenia
z CLAUDE.md („dopisz handlery czterech tras do WSPÓŁDZIELONYCH mocków stagingu") i daje I15.11
gotowy punkt startu. Decyzja wykonawcza Mastera, nie odstępstwo od oryginału.

### Odstępstwa od oryginału — zestawienie

| # | Co | Dlaczego |
|---|---|---|
| D2 | warunek z pola `powod`, nie z `textContent` wiersza | odtwarzanie defektu nakładki byłoby szkodliwe i nietestowalne |
| D3 | `invalidateQueries` zamiast `location.reload()` | SPA; ten sam skutek dla użytkownika |
| D4 | `onError` mutacji zamiast nakładki na `window.fetch` | ten sam zbiór zdarzeń, bez globalnej mutacji `fetch` |
| D5 | `DialogPotwierdzenia` zamiast `window.confirm()` | ustalony wzorzec odbudowy, teksty dosłowne |
| — | `<Dialog>` Radix zamiast `<dialog>`+`showModal()` | wzorzec projektu (`SzczegolyPozycji`, `DialogPotwierdzenia`) |

**Wszystkie teksty widoczne dla użytkownika przenosimy DOSŁOWNIE**, razem z interpunkcją,
polskimi cudzysłowami („…"), wielokropkiem `…` i wersalikami („RÓŻNY — nie łączyć", „NIE zatwierdza").

## Implementation plan

### Krok 1 — warstwa danych (`src/pages/staging/polityka.ts`, nowy)

Osobny plik obok `dane.ts`, żeby I15.11 miała czysty punkt wejścia i żeby nie puchło `dane.ts`.

- Typy z `contract/openapi.yaml`: `PrzegladZgloszenia` (`id`, `kod`, `nazwa`, `powod`, `matchIssue`,
  `absenceReview`, `absenceEvidence`, `duplicateSource`, `sourceConflict`, `eanIssue`, `incoming`,
  `candidates`) i `KandydatPrzegladu` (`...snapshot`, `catalogStan`, `status`, `catalogDot`,
  `catalogVersion`, `selectable`, `sameEan`, `sameDot`, plus `sourceKey`/`stan`/`cenaZakupu`/`dot`/
  `ean`/`rozmiar`/`nazwa` ze snapshotu).
- `WZORZEC_ROZSTRZYGNIECIA` — regex z oryginału; `wymagaRozstrzygniecia(pozycja)` i
  `etykietaPrzycisku(pozycja)` („Sprawdź kartę" / „Rozstrzygnij").
- `rozstrzygnij(id, action, targetCode)` i `wybierzKarte(id, selectedCode, candidateVersion)`
  na bazie `zadanie()`.
- `komunikatBledu(e)` — wyciąga `message` → `error` → zapasowy tekst z `Error` rzuconego przez
  `zadanie()` (format `"<status>: <ciało>"`). Potrzebne w trzech miejscach (okno akceptacji,
  błąd w oknie, błąd wczytania) — DRY.

### Krok 2 — okno (`src/pages/staging/OknoRozstrzygniecia.tsx`, nowy)

`useQuery` po `["/api/staging", String(id), "review"]`, `enabled: id != null` — wzorzec
`SzczegolyPozycji.tsx`. Render trzech gałęzi w kolejności z oryginału (A.5):

1. tytuł (dynamiczny),
2. gałąź `absenceReview`: akapit wyjaśniający → karta „Stara karta w katalogu" z radio
   „Zostaw tę kartę" → karty „Pozycja w obecnej ofercie" z radio → notatka (jedna z trzech,
   zależnie od `valid = candidates.filter(selectable)`),
   gałąź inna: `nazwa` → „Pozycja z oferty: …" → `matchIssue || powod`,
3. gałąź `matchIssue && !duplicateSource`: akapit instrukcji → radio per kandydat + „To osobna
   opona. Przygotuj ją jako nowy produkt." → opcjonalny `eanIssue` → miejsce na błąd (`role="alert"`),
4. gałąź `duplicateSource`: akapit → różnice + „Pierwszy wiersz"/„Drugi wiersz" LUB akapit
   zastępczy → akapit zamykający,
5. stopka: „Zamknij" + („Zapisz wybór w katalogu" | „Zapisz wybór").

Warunki włączenia przycisków radio i zapisu — **skopiowane z oryginału co do znaku**, łącznie
z `Number.isFinite(Number(c.stan))`. Blokada obu przycisków na czas żądania, odblokowanie przy błędzie.

### Krok 3 — okno „Nie zapisano zmian" (`src/pages/staging/OknoBlokady.tsx`, nowy)

Tytuł „Nie zapisano zmian", treść = komunikat z serwera, jeden przycisk „Zamknij".
Prosty komponent — świadomie osobny od `DialogPotwierdzenia` (tam są dwa przyciski i pytanie).

### Krok 4 — wpięcie w tabelę (`TabelaStagingu.tsx`)

W kolumnie „Akcje", **po** przycisku „Szczegóły" (oryginał dokleja na koniec komórki):
przycisk `data-testid={\`button-rozstrzygnij-${id}\`}` renderowany tylko gdy
`wymagaRozstrzygniecia(pozycja)`. Nowy prop `otworzRozstrzygniecie`.

### Krok 5 — wpięcie w widok (`Staging.tsx`)

- stan `rozstrzyganeId`;
- `<OknoRozstrzygniecia … onZapisano={odswiez} />`;
- `akcja.onError`: rozdzielenie — błąd z akceptacji → `OknoBlokady`, inne → dotychczasowy pasek.
  Rozróżnienie po tym, którą operację wywołano (flaga przy `mutate`), nie po treści błędu.

### Krok 6 — mocki i testy

- `test/msw/staging.ts` (nowy): `handleryStagingu()` z dotychczasowymi trasami **oraz** `review`,
  `resolve`, `choose-absence-card`; fabryki `przegladMatchIssue()`, `przegladAbsence()`,
  `przegladDuplicate()`. ⚠ Kolejność handlerów: `*/api/staging/paged` PRZED `*/api/staging/:id`
  (komentarz z `staging.test.tsx:41` zostaje).
- `staging.test.tsx` przechodzi na `handleryStagingu()` — bez zmiany istniejących asercji.
- `test/staging.rozstrzygnij.test.tsx` (nowy): patrz „Testing strategy".

### Krok 7 — punkt wejścia dla I15.11

W `OknoRozstrzygniecia.tsx` komentarz `⭐ PUNKT WPIĘCIA I15.11` przy gałęzi `absenceReview`
(tam ma dojść podgląd starej karty z żywego bundla) i w `Staging.tsx` przy pasku narzędzi
(tam ma dojść panel „Braki w cenniku"). Opis w „Do koordynatora" karty.

## Testing strategy

Gate odbudowy na fixtures **nie obowiązuje** (uzasadnienie w „Kontrakt i fixtures"). Zamiast niego:

1. **Asercje na DOSŁOWNĄ treść okna** — każda z trzech gałęzi ma test sprawdzający komplet
   tekstów znak w znak z oryginałem (nagłówki kart, linie EAN/DOT, wszystkie trzy warianty
   notatki, akapit „Zapisz wybór” NIE zatwierdza…”). To jest w tym tickecie odpowiednik GATE'u.
2. **Warunek przycisku** — `powod` z każdą z czterech fraz daje przycisk, z właściwą etykietą;
   `powod` bez frazy nie daje przycisku; **ukrycie kolumny „Powód" NIE chowa przycisku** (D2).
3. **Ciała żądań** — `resolve` dostaje `{action:"link", targetCode}` i `{action:"new"}` bez
   `targetCode`; `choose-absence-card` dostaje `{selectedCode, candidateVersion}` z
   `catalogVersion` właściwego kandydata.
4. **Włączanie przycisków** — „Zapisz wybór" startuje wyłączony; radio niedostępne dla kandydata
   z `selectable:false`; przy `valid.length === 0` żadnego wyboru nie da się dokonać.
5. **Okno „Nie zapisano zmian"** — `POST /api/staging/accept` → 409 z `{message}` pokazuje okno
   z DOSŁOWNYM komunikatem z serwera (test z realnym komunikatem z `blokady.ts`), a nie
   z tekstem przepisanym w UI; 409 bez `message` daje „Odśwież staging i spróbuj ponownie.".
6. **Błąd w oknie** — 409 z `choose-absence-card` pokazuje komunikat W OKNIE i odblokowuje przyciski.
7. **Odświeżenie po sukcesie (D3)** — po zapisie leci ponowne `GET /api/staging/paged`.
8. **Regresja układu I14** — istniejące testy `staging.test.tsx` przechodzą bez zmian asercji.

Czego NIE testujemy: `close-absence-review` (nieużywana, D1), `MutationObserver`/`scan()`
(nie istnieje w porcie), stylowanie.

## Out of scope

- **Backend** — I15.4a/4b/4c zamknięte; `src/import/polityka/**`, `src/routes/staging-polityka.ts`,
  `contract/openapi.yaml` nietknięte.
- **Panel „Braki w cenniku"** i podgląd starej karty z żywego bundla `index-PRICEFMT1783512500.js`
  — karta **I15.11**, idzie po tym tickecie na tym samym widoku. Zostawiamy punkt wejścia (Krok 7).
- **`POST /api/staging/{id}/close-absence-review`** — D1.
- **Globalny error middleware backendu** — nota z I15.4c „Do koordynatora" p. 6, osobny ticket.
- **Zmiany w `docs/rebuild-roadmap.md`** — CLAUDE.md reguła 0, roadmapę rusza koordynator.

## Definition of done

- [ ] Przycisk „Rozstrzygnij"/„Sprawdź kartę" pojawia się dokładnie przy czterech frazach `powod`,
      z właściwą etykietą, i nie znika po ukryciu kolumny „Powód"
- [ ] Okno renderuje wszystkie trzy gałęzie z tekstami DOSŁOWNIE z `88fa31c`
- [ ] `resolve` i `choose-absence-card` wysyłają ciała zgodne z `contract/openapi.yaml`
- [ ] Okno „Nie zapisano zmian" pokazuje komunikat 409 z serwera bez przepisywania go w UI
- [ ] Układ ekranu z I14 nietknięty — `staging.test.tsx` zielony bez zmian asercji
- [ ] Handlery czterech tras w `test/msw/staging.ts`; żaden test nie chodzi po nieobsłużonym URL-u
- [ ] `npm run lint && npm run typecheck && npm run build && npm test` w `rebuild/frontend/` zielone
- [ ] `docs/karty/I15.5/karta.md` opisuje STAN (zakres dowieziony, D1–D6), wejście dla I15.11 założone
- [ ] Gałąź zsynchronizowana z `origin/develop`, bramki zielone PO synchronizacji, PR `MERGEABLE`
