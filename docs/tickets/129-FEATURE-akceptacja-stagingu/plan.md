# 129-FEATURE-akceptacja-stagingu — akceptacja stagingu: blokady, trasy review/resolve/absence, decyzje o nieobecnych kartach

> Status: Draft → Approved → Implemented → Shipped
> Branch: `feature/129-akceptacja-stagingu`
> Worktree: `.worktrees/129-FEATURE-akceptacja-stagingu`
> Karta: `docs/karty/I15.4c/` · Iteracja 15 · Wpisy backlogu: #99, #103, #104, #105, #106, #107

## Opis ticketa

Karta **I15.4c** — druga połowa `staging_policy.cjs`, ścieżka ODCZYTU I DECYZJI UŻYTKOWNIKA:
blokady akceptacji (`checkAcceptance`), dodawanie i edycja zgłoszenia, trasy przeglądu
i rozstrzygania, decyzje o nieobecnych kartach (#106) oraz pomiar wydajności zatwierdzania
zbiorczego (#107). Równolegle pracuje **I15.4b** (`130-FEATURE-importer-staging-bezpieczenstwo`) —
ścieżka zapisu/importu. Fundament (migracja 012, model, `repos/staging-polityka.ts`) dowiozła
**I15.4a** (ticket 124) i wołamy go BEZ zmian w jej plikach.

## Kontekst

⭐ **Źródło prawdy: `88fa31c`** (produkcja zamrożona 23.09). Zweryfikowane na starcie ticketa:
`origin/main` stoi dziś na `5bd4a7b`, czyli **5 commitów dalej**, ale wszystkie to godzinowe
`sync(vps): zmiana [FRONTEND]` dotykające WYŁĄCZNIE wygenerowanego pliku
`sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv` (57 wstawek / 52 usunięcia, jeden plik). **Zero kodu** —
zamrożenie obowiązuje, `88fa31c` zostaje źródłem prawdy.

Moduł oryginału leży w repo bajt w bajt jako `rebuild/backend/src/import/legacy/staging_policy.cjs`
(skopiowany przez ticket 120, `diff` wobec `88fa31c:mirror/backend/staging_policy.cjs` pusty), więc
numery linii cytowane niżej są stabilne i wskazują ten plik.

Wpięcie w produkcji (zweryfikowane w bundlu `mirror/backend/index.cjs` @ `88fa31c`) to dwa wywołania:
`install({U,db,normalize,classify,badName,ext})` — monkey-patch na obiekcie `U`, podmieniający
`addStaging`, `updateStaging`, `acceptStaging`, `updateProduct` i `ext.assignKodImportu` — oraz
`registerRoutes(app,{U,we,be})` rejestrujące cztery trasy.

### Granica wobec I15.4b (ustalona z grafu wywołań, nie z nazw)

| Linie `staging_policy.cjs` | Co to | Czyje |
|---|---|---|
| 1–81 | helpery (`validateEan`, `norm`, `hash`, `identity`, `variant`, `syntheticCode`, `compatibility`, `separateDotBatch`, `version`, `sourceKey`, `codeKey`, `fail`) | wspólne — część już w `rebuild/` (I15.2), resztę dokładam |
| 82–107 | DDL tabel | **nikt** — zrobiła migracja 012 (I15.4a) |
| 108–140 | `original`/`originalUpdate`, `U.updateProduct` override, `suspend()`, `refreshAvailability()`, `clear`, `aliases`, `find` | wspólne — portuję, bo `suspend()` wołają `chooseAbsenceCard` (moje) i `importer()` (I15.4b) |
| **141–157** | **`ext.assignKodImportu` override** | **moje** (wołają je `akceptacja.ts:174` i `bulk.ts:116`) |
| 158–162 | `protect()` | wspólne — portuję |
| **163–187** | **`U.addStaging` / `U.updateStaging` override** | **moje** |
| **188–331** | **`checkAcceptance`, `acceptStaging`, `resolveStaging`, `closeAbsenceReview`, `chooseAbsenceCard`, `refreshAbsenceAvailability`** | **moje** |
| 332–618 | `function importer(...)` | **I15.4b — NIE RUSZAM** |
| **620–664** | **`registerRoutes` — cztery trasy** | **moje** |

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Stan zastany: dla tras w moim zakresie NIE MA ani wpisów w `contract/openapi.yaml`, ani nagrań
w `contract/fixtures/`.** To nie przeoczenie — karta wprost zleca ich dopisanie. Konsekwencja:
klasyczny GATE „porównaj z fixture" dla tych czterech tras **nie istnieje i trzeba go zbudować**.

**Dokładam do `contract/openapi.yaml` (wyłączna własność w tym ticketcie, I15.4b go nie rusza):**

| Metoda + ścieżka | Ciało żądania | Odpowiedź 200 |
|---|---|---|
| `GET /api/staging/{id}/review` | — | `{id,kod,nazwa,powod,matchIssue,absenceReview,absenceEvidence,duplicateSource,sourceConflict,eanIssue,incoming{...},candidates[...]}` |
| `POST /api/staging/{id}/resolve` | `{action,targetCode}` | `{ok,id,kod}` |
| `POST /api/staging/{id}/choose-absence-card` | `{selectedCode,candidateVersion}` | `{ok,kod}` |
| `POST /api/staging/{id}/close-absence-review` | — | `{ok,kod}` |

Kody błędów: **409** `{message}` (wszystkie blokady `fail()` — `staging_policy.cjs:81`), **404**
`{message}` tylko dla `GET /review` przy braku wiersza (`:623`), 401 wg wzorca sąsiednich tras.

⚠ **Rozjazd świadomie ZACHOWANY:** istniejące trasy stagingu w `rebuild/` zwracają błąd jako
`{error}`, a `registerRoutes` oryginału zwraca `{message}`. To DWA różne moduły produkcji i taka
właśnie niespójność jest w oryginale — **nie ujednolicam**, odtwarzam wiernie.

Fixtures istniejące, których NIE WOLNO zepsuć: `contract/fixtures/GET_staging.json`,
`GET_staging_paged.json` (odczyt listy stagingu — dotyka ich mój `addStaging`/`updateStaging`).

## Decyzje

Wszystkie z rundy Q&A z użytkownikiem (2026-09-23). Decyzje całej I15 (D1–D5) obowiązują z karty.

- **D129.1 — cztery trasy, nie dwie.** Karta i prompt wymieniają `review` + `resolve`, ale
  `registerRoutes` (`:620-664`) ma CZTERY: dochodzą `POST /choose-absence-card` (`:640`) i
  `POST /close-absence-review` (`:649`). To dokładnie te, które wystawiają #106 („wybór jednej
  karty", „sprawa nie wraca"). *Za:* odtworzenie 1:1, I15.11 ma co wołać, #106 nie zostaje
  w połowie. *Przeciw:* karta rośnie o dwie trasy. **Wybrano: wszystkie cztery.**
- **D129.2 — sześć blokad `checkAcceptance`, nie cztery.** Oryginał (`:188-200`) ma sześć
  wywołań `fail()`. Karta opisuje cztery, pomijając `_absenceReview` (`:192`) i `_catalogVersion`
  (`:198`). *Za pełną szóstką:* `_absenceReview` kieruje sprawę na ścieżkę choose/close zamiast
  zwykłej akceptacji, `_catalogVersion` chroni przed nadpisaniem produktu zmienionego po
  utworzeniu zgłoszenia; pominięcie = ciche odstępstwo. **Wybrano: wszystkie sześć, komunikaty
  znak w znak.**
- **D129.3 — `88fa31c` traktujemy jako decyzję już podjętą.** W backlogu tylko #99 ma `✅ TAK`;
  #103/#104/#105/#106/#107 mają `⬜ do decyzji`. Decyzja D3 („Staging v2 przenosimy") obejmuje
  całość zamrożonej produkcji, a `staging_policy.cjs` @ `88fa31c` już te warstwy zawiera.
  **Implementuję logikę #103/#104/#106 w swoim zakresie, a statusy wpisów podnoszę na ✅
  z datą i numerem ticketa 129.**
- **D129.4 — `assignKodImportu`: nowa wersja wstrzykiwana w moich plikach.** Oryginał podmienia
  `ext.assignKodImportu` globalnie (`:141-157`): grupowanie `kod_importu` przechodzi z „EAN/nazwa"
  na `compatibility()` (marka+model+rozmiar+opcjonalne), a dopiero potem EAN. W `rebuild/`
  funkcja jest re-eksportem starej wersji z `legacy/bridge_ext.cjs` i wołają ją `akceptacja.ts:174`
  oraz `bulk.ts:116` — **obie ścieżki akceptacji, czyli moje pliki**. *Za wstrzyknięciem:* zero
  ryzyka konfliktu z I15.4b, `bridge-ext.ts` nietknięty. *Przeciw podmianie globalnej:* rusza plik
  dzielony z importem, przy równoległej karcie to konflikt przy merge'u. **Wybrano: nowa funkcja
  w module akceptacji, wołana z `akceptacja.ts` i `bulk.ts`.**
- **D129.5 — dowód wierności: charakteryzacja na żywym module.** `staging_policy.cjs` NIE jest
  zminifikowany i nie ma efektów ubocznych przy `require()` (`install()` dostaje `db` argumentem),
  więc da się go załadować wprost, podać atrapę `U` i realną bazę SQLite, i porównać zachowanie
  nowego kodu z oryginałem. *Za:* sprawdza sześć komunikatów znak w znak i kształty czterech tras
  na ZMIERZONYM zachowaniu, nie na moim odczycie kodu. *Przeciw:* trzeba zbudować obiekt `U`
  (~10 metod). **Wybrano charakteryzację**; nagrywanie fixtures odpada, bo trasy wymagają złożonego
  stanu (`_policyVersion`, `_matchIssue`, `_absenceReview`), który trzeba by najpierw wytworzyć importem.
- **D129.6 — pomiar #107 na kopii `db/snapshot.db` (2026-08-13).** Karta zakłada „bazę stagingu
  (kopia produkcji z 23.09)", ale staging to serwer zdalny — lokalnie jest tylko `snapshot.db`
  z 13.08 (ta sama, na której mierzyła I15.4a). Pytanie #107 brzmi „czy mamy blokadę 5 s na
  pozycję", więc rząd wielkości wystarczy. **Datę bazy zapisuję w karcie jako zastrzeżenie.**
- **D129.7 — odstępstwo 14i usuwane, nie zostawiane jako martwy kod.** D4 („błędny EAN =
  błąd blokujący akceptację") uchyla 14i (ciche `ean=null` dla notacji naukowej). Fragment 14i
  w `akceptacja.ts` po wpięciu blokady staje się nieosiągalny. **Kasuję go, w backlogu oznaczam
  14i jako uchylone przez D4 z numerem ticketa**, a test `silnik.gate.test.ts` opisujący okno
  przejściowe przepisuję na oczekiwaną blokadę.

### Świadome odstępstwa od zachowania oryginału

**Brak nowych odstępstw.** Ten ticket ZDEJMUJE jedno istniejące (14i, decyzją D4 — patrz D129.7)
i wiernie odtwarza resztę, łącznie z niespójnością `{error}` vs `{message}` między modułami
oraz z zachowaniem zatwierdzania zbiorczego opisanym niżej.

### ⚠ Zachowanie zatwierdzania zbiorczego — wierne, choć zaskakujące

`POST /api/staging/accept` w oryginale (`deminified/backend-index.cjs:48544`) robi
`for (let p of l) U.acceptStaging(p, c.user.id);` — **bez `try`/`catch`**. Skutek: pierwsza pozycja
zablokowana którąkolwiek z sześciu blokad **przerywa całe żądanie** (409, Express łapie
synchroniczny throw), audyt się NIE zapisuje, a pozycje zatwierdzone wcześniej **zostają
zatwierdzone** — bo `acceptStaging` to `db.transaction(...)()` per pozycja, nie per żądanie.
„Akceptacja atomowa" z karty znaczy właśnie: atomowa **per pozycja**. Odtwarzam to 1:1.

## Plan implementacji

Kolejność = kolejność commitów.

**1. Helpery polityki (`src/import/polityka-stagingu/helpery.ts`, nowy)**
Port `staging_policy.cjs:1-81` w części jeszcze nieobecnej w `rebuild/`: `version()` (hash
z `[id,...KEYS,ean,cenaZakupu,cenaSprzedazy,stan,status,dataAktualizacji]` — używany przez
`checkAcceptance`, `chooseAbsenceCard`, `closeAbsenceReview` i `GET /review`), `compatibility()`,
`separateDotBatch()`, `codeKey()`, `sourceKey()`, `BladPolityki` (odpowiednik `fail()` — błąd
ze `status=409`). `validateEan`, `rawEan`, `syntheticCode`, `norm`, `hash`, `identity`, `variant`
są już w `rebuild/` (I15.2) — **reużywam, nie duplikuję**.

**2. Nadpisanie grupowania `kod_importu` (D129.4)**
Port `:141-157` jako funkcja w module akceptacji; podmiana wywołań w `akceptacja.ts:174`
i `bulk.ts:116`. `bridge-ext.ts` i `legacy/bridge_ext.cjs` **nietknięte**.

**3. `checkAcceptance` — sześć blokad (`src/import/polityka-stagingu/akceptacja-polityka.ts`)**
Port `:188-200`, komunikaty kopiowane znak w znak z oryginału (z „ " i polskimi znakami).
Kolejność sprawdzeń zachowana — ma znaczenie, bo pierwszy `fail()` wygrywa.

**4. Warstwa `acceptStaging` nad istniejącym `zatwierdzPozycjeStagingu`**
⚠ **Architektura: WARSTWA, nie zmiana w środku.** `zatwierdzPozycjeStagingu` zostaje
`original.accept` i **nie jest modyfikowane** — inaczej wszystkie istniejące scenariusze
charakteryzacyjne (`test/charakteryzacja/akceptacja/scenariusze.mjs`, żaden nie ma
`_policyVersion`) zaczną padać blokadą „stary import". Port `:202-226`: gałąź `wycofana`,
re-walidacja EAN z `protect()`, dziedziczenie EAN z katalogu, zapis przez `original.edit`
PRZED `accept`, zdjęcie auto-wstrzymania albo wymuszenie `wstrzymany/stan:0`, `clear`,
zapis `staging_matches`.

**5. `addStaging` / `updateStaging` (`:163-187`)**
Nowe zgłoszenie kasuje starą parę `(dostawca, kod)` w transakcji; edycja synchronizuje
`bieznik` z `model` (tylko automatyczną kopię) i przelicza `eanRaw`/`eanIsValid`/`eanSourceStatus`/
`_eanIssue`. Wpięcie w `PUT /api/staging/{id}` w `staging-mutacje.ts`.

**6. `resolveStaging` (`:227-250`)**
Trzy blokady wejściowe, `action` ∈ `link`/`new` (inne → `'Nieprawidłowa decyzja.'`), walidacja
`targetCode` przeciw `_candidates`, `syntheticCode` przy kolizji, transakcja `clear` + `addStaging`
(nowe zgłoszenie zastępuje stare, NIE edycja).

**7. `closeAbsenceReview` (`:251-266`) i `chooseAbsenceCard` (`:267-330`) — #106**
`candidates_hash` = `hash(_candidates.map(c=>[c.kod,c.ean,c.dot]).sort())` — **tylko kod+EAN+DOT,
posortowane**; stąd zmiana któregokolwiek otwiera sprawę ponownie, a reszta nie. Trójstronna
zgodność DOT w `options` (`:274-279`). Obie gałęzie wyboru: `selectedCode===row.kod` (stara karta
przejmuje ofertę, kandydat wstrzymany, `selected_source_code=candidate.kod`) i przeciwna
(kandydat przejmuje, stara karta wstrzymana, `selected_source_code=NULL`). Wołam repozytoria
I15.4a **bez zmian w jej pliku**, respektując trzy pułapki z jej „Do koordynatora":
`suspended_at` nietykane przy konflikcie, `maxItemCount` tylko w górę, trzy zapisy na
`staging_absence_decisions` różnią się WYŁĄCZNIE `selected_source_code`.

**8. Cztery trasy (`src/routes/staging-polityka.ts`, nowy) + `contract/openapi.yaml`**
Port `:620-664` z **jawną projekcją pól** (CLAUDE.md: `select()` bez listy pól oddaje camelCase
modelu, nie kolumny). Audyt przez `zapiszAudyt` z akcjami `wybor_karty_z_biezacej_oferty`,
`zamkniecie_sprawdzenia_starej_karty`, `rozstrzygniecie_stagingu` — nazwy dosłownie z oryginału.
`U.refreshAbsenceAvailability` → **no-op z logiem**: w oryginale (`:137-139`) strzela wyłącznie
gdy `path.resolve(db.name)==='/home/admin/private_apps/bridge/data.db'`, czyli u nas nigdy;
realne odświeżanie CSV/Selly to zakres I15.10 — **wystawiam punkt wpięcia, modułu nie portuję**.

**9. Pomiar #107** — osobny skrypt pomiarowy na kopii `db/snapshot.db`, wynik do `karta.md`.

## Strategia testów

- **Charakteryzacja (D129.5)** — `test/charakteryzacja/polityka/` : `require()` prawdziwego
  `staging_policy.cjs`, atrapa `U` na realnej bazie SQLite w katalogu tymczasowym, `install()`,
  i porównanie odpowiedzi/komunikatów z moim portem dla scenariuszy: każda z sześciu blokad,
  obie gałęzie `chooseAbsenceCard`, `closeAbsenceReview`, oba `action` w `resolve`. **To jest
  GATE tego ticketa** w miejsce nieistniejących fixtures — dowód na ZMIERZONYM zachowaniu oryginału.
- **Kontrakt** — walidacja odpowiedzi czterech tras względem dopisanych schematów `openapi.yaml`.
- **Regresja fixtures** — `GET_staging.json` i `GET_staging_paged.json` muszą przejść bez zmian
  (dotyka ich `addStaging`/`updateStaging`).
- **Testy zastane, które MUSZĄ zostać zielone:** `akceptacja.charakteryzacja.test.ts`,
  `akceptacja.odstepstwa.test.ts`, `staging.gate.test.ts`, `staging.odczyt.test.ts`,
  `staging-mutacje.test.ts`, `repos.staging-polityka.test.ts`. Warstwowa architektura (krok 4)
  jest po to, żeby pierwsze dwa nie padły.
- **`silnik.gate.test.ts`** — scenariusz „EAN w notacji naukowej" przepisany z okna przejściowego
  na oczekiwaną blokadę (D129.7).
- Dane testowe: **jedno bieżące zgłoszenie na parę `(dostawca, kod)`** — od migracji 012 stoi
  indeks unikalny `staging_one_current_product` (ostrzeżenie z `wejscie-124.md`).

## Poza zakresem

- `import/tk.ts`, `parsuj.ts`, konsumpcja `_bridgeFeedMeta`, `function importer()` (`:332-618`),
  logika #103/#104 po stronie IMPORTU — **karta I15.4b**, ticket 130, pracuje równolegle.
- Migracja 012, `db/schema.ts`, `repos/staging-polityka.ts` — **I15.4a**, gotowe, tylko wołam.
- Frontend przeglądu i rozstrzygania — **I15.5 / I15.11**.
- `availability_sync.cjs` (realne odświeżanie CSV i Selly) — **I15.10**; wystawiam punkt wpięcia.
- Rozstrzygnięcie dublującego się bezpiecznika `PustyImportBlad` vs `feed_safety`
  (`wejscie-120.md` pkt 3) — siedzi w `parsuj.ts`, czyli w plikach I15.4b. Zgłaszam koordynatorowi.
- Hunki `extensions.cjs` z `wejscie-120.md` pkt 5 — dotyczą importu i schedulera (I15.4b, I15.10).

## Definition of done

- [ ] Sześć blokad `checkAcceptance` odtworzonych, komunikaty znak w znak zgodne z `:188-200`
- [ ] Cztery trasy działają i są opisane w `contract/openapi.yaml`
- [ ] `addStaging` zastępuje poprzednie zgłoszenie pary; `updateStaging` przelicza status EAN
- [ ] #106: `candidates_hash` z kod+EAN+DOT, obie gałęzie wyboru karty, `selected_source_code`
      ustawiany/zerowany/zachowywany zgodnie z trzema różnymi zapisami
- [ ] Grupowanie `kod_importu` przez `compatibility()` na obu ścieżkach akceptacji
- [ ] Odstępstwo 14i usunięte, `silnik.gate.test.ts` przepisany na blokadę
- [ ] Testy charakteryzacyjne przeciw żywemu `staging_policy.cjs` zielone (GATE)
- [ ] Wszystkie testy zastane zielone; `lint`, `typecheck`, `build`, `test` w `rebuild/backend/`
- [ ] Pomiar #107 wykonany i opisany w `docs/karty/I15.4c/karta.md`
- [ ] `karta.md` opisuje STAN (zakres faktycznie dowieziony), statusy backlogu zaktualizowane
