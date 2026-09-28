# 31-FEATURE-atrybuty-frontend — raport z realizacji

## Podsumowanie

Widok `/atrybuty` działa natywnie w Reakcie: kafle rodzajów → panel wartości z pełnym CRUD-em
→ kolejka „Do akceptacji" z czterema akcjami, modalem produktów i dwoma trybami czyszczenia —
bez `pending-injection.js`, bez React Fiber i bez `MutationObservera`. Placeholder zdjęty
(w `placeholdery.ts` został wyłącznie `/moje-konto`). Dialog reguł w `/narzuty` zasila listy
ze słownika atrybutów, co domyka degradację z sesji 4b. Suita frontu: **564 testy / 38 plików**,
plus **17 testów integracyjnych** przeciw żywemu backendowi; lint, typecheck i build czyste.

## Zmiany

**Widok (nowe):**
- `rebuild/frontend/src/pages/Atrybuty.tsx` — widok, trzy stany ekranu (`kafle`/`wartosci`/`pending`), `AppShell`
- `rebuild/frontend/src/pages/atrybuty/api.ts` — typy z fixtures, 13 ścieżek, `komunikatBledu`, `slugRodzaju`
- `rebuild/frontend/src/pages/atrybuty/KafleRodzajow.tsx` — kafle, pasek stanu, „Sieroty w DB"
- `rebuild/frontend/src/pages/atrybuty/PanelWartosci.tsx` — CRUD wartości, szukajka, sort `pl`
- `rebuild/frontend/src/pages/atrybuty/PanelPending.tsx` — kolejka, cztery akcje, dwa czyszczenia
- `rebuild/frontend/src/pages/atrybuty/DialogProduktow.tsx` — modal „Produkty używające atrybutu"
- `rebuild/frontend/src/pages/atrybuty/DialogNowyRodzaj.tsx`, `DialogNowaWartosc.tsx` — dialogi nagłówka
- `rebuild/frontend/src/components/DialogPotwierdzenia.tsx`, `DialogTekstu.tsx` — zamienniki `confirm`/`prompt`

**Zmienione:**
- `rebuild/frontend/src/App.tsx` — trasa `/atrybuty`
- `rebuild/frontend/src/pages/placeholdery.ts` — usunięty wpis `/atrybuty`
- `rebuild/frontend/src/pages/narzuty/DialogReguly.tsx` — listy ze słownika i `/api/suppliers`
- `rebuild/frontend/src/pages/narzuty/warunki.ts` — wycofana stała `TYPY_ZE_SLOWNIKA` (z uzasadnieniem)
- `rebuild/frontend/test/msw/kontrakt.ts` — pięć nowych fabryk z fixtures atrybutów
- `rebuild/frontend/test/narzuty.dialog.test.tsx` — mocki `/api/atrybuty` i `/api/suppliers`
  + nowy blok „6. Listy wyboru ze słownika atrybutów" (5 testów; 25 → 30)

**Nowe (część B i testy):**
- `rebuild/frontend/src/pages/narzuty/slownik.ts` — czysta logika scalania list
- `rebuild/frontend/test/atrybuty.test.tsx` (22), `atrybuty.pending.test.tsx` (19),
  `atrybuty.slownik.test.ts` (14), `test/integracja/atrybuty.integracja.test.ts` (17)

## Odstępstwa od planu

Brak odstępstw od zatwierdzonych decyzji D1–D12. **Jedno rozstrzygnięcie dołożone w trakcie**,
bo fakt wyszedł dopiero przy porcie i plan go nie przewidywał — opisane niżej (defekt „Nowy rodzaj").

## Ustalenia o oryginale wykryte w trakcie (nie było ich w planie)

1. **Ekran produkcyjny ma TRZY warstwy, nie dwie.** Poza bazowym Reactem i `pending-injection.js`
   w samym bundlu siedzi **mostek** (`deminified/frontend-index.js:9960-10268`): `setQueryDefaults`
   + `setQueryData` na martwych kluczach, `fetch("/panel/api/atrybuty")` oraz **write-through** —
   opatchowane `Hb`/`Qb`/`Gb` wysyłają POST/PUT/DELETE na `/atrybuty/wartosci`, a
   `window.__atrybutyAddRodzaj` POST-uje na `/rodzaje`. Mapa kodu (`mapa-kodu-do-wiki.md:57`)
   wymienia tylko injection. To samo dotyczy licznika użycia i modalu podglądu, które są
   wbudowane w bundle (`:29404-29469`), a nie w injection.
2. **DEFEKT: przycisk „Nowy rodzaj" w produkcji NIE ZAPISUJE.** `sg()` woła `Lb()` (`:9965-9977`),
   które dopisuje rodzaj wyłącznie do lokalnej tablicy `dt` i cache'u Query — mostek tej funkcji
   NIE patchuje (patchuje `Hb`/`Qb`/`Gb` i definiuje `__atrybutyAddRodzaj`). Efekt: rodzaj
   utworzony tym przyciskiem znika po odświeżeniu strony, a ten sam rodzaj wpisany w „Dodaj
   wartość" (`:27006`) zapisuje się normalnie. **Odbudowa zapisuje w obu ścieżkach** — odtworzenie
   cichej utraty danych byłoby odtworzeniem skutku rozjazdu bundla z mostkiem, a nie zachowania
   produktu. Decyzja D5 („dodawanie rodzaju TAK") tego wymagała; szczegóły w komentarzu przy
   `dodajRodzaj` i w nowym wpisie backlogu.
3. **Teza briefu o dostawcach OBALONA.** Dialog reguł nie bierze dostawców ani ze słownika, ani
   z produktów: ma osobne `useQuery(["/api/suppliers"])` (`:24193`), wartością opcji jest `kod`,
   etykietą `"kod · nazwa"`, bez dedupu i sortu. Zgodność z silnikiem cen sprawdzona:
   `repos/ceny.ts:52` porównuje `produkt.dostawca === wartosc`, a `products.dostawca` = `"MO9"`
   = `suppliers.kod` (fixtures) — zmiana źródła nie psuje dopasowania istniejących reguł.
4. **`konstrukcja`/`vfIf` mają w oryginale gotowe selecty słownikowe** (`:24286-24313`, zasilane
   `ty()` = wartości rodzaju posortowane `localeCompare(pl)`). Były nieosiągalne wyłącznie dlatego,
   że lista TYPÓW warunku miała sześć pozycji. 4b dołożyło typy jako pola tekstowe — 7b dokończyło
   port, dokładając ich listy.
5. **Trzy operacje backendu 7a nie mają konsumenta w UI i to jest zgodne z produkcją:**
   `PUT /rodzaje/{value}` (zero wywołań w całym froncie), `DELETE /rodzaje/{value}` („Usuń rodzaj"
   istnieje w bazowym Reakcie, ale injection chowa kafle, a mostek go nie patchuje — nieosiągalne),
   `POST /scan-pending` (skan odpala backend po `POST /api/staging/accept`).

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt):** ✓ — ticket nie zmienia backendu ani kontraktu, więc gate
  realizowany dwutorowo: (a) wszystkie mocki MSW i typy TS biorą dane wprost z
  `contract/fixtures/GET_atrybuty*.json` przez `test/msw/kontrakt.ts`, więc zmiana kształtu
  fixtura wywala testy; (b) test integracyjny sprawdza kształty na ŻYWYM backendzie 7a.
  Sprawdzone ścieżki: `GET /api/atrybuty`, `/rodzaje`, `/wartosci`, `/liczniki`, `/uzycie`,
  `/pending` + mutacje `POST/PUT/DELETE /wartosci`, `POST /rodzaje`, cztery akcje kolejki,
  `DELETE /pending`. Potwierdzone trzy asymetrie: `utworzony` tylko w `/api/atrybuty`,
  goła mapa bez `ok` w `/liczniki`, 400 na `/uzycie` bez parametrów (tak powstał fixture).
- **Unit (`npm test`):** ✓ 564 testy / 38 plików (przed ticketem 504; +60 nowych).
- **Integracyjne (`npm run test:integracja`):** ✓ 17/17 w `atrybuty.integracja.test.ts`.
- **Lint / typecheck / build:** ✓ czyste.
- **Regresja `/narzuty` (4b):** ✓ 30/30 w `narzuty.dialog.test.tsx` — 25 testów sprzed ticketa
  przechodzi z NIEZMIENIONYMI asercjami (jeden wymagał dołożenia mocków `/api/atrybuty`
  i `/api/suppliers`, bo kategoria „Rolnicze" pochodziła wcześniej z produktów), plus 5 nowych
  na okablowanie części B.
- **Test mutacyjny reguły scalania** (sprawdzenie, czy testy realnie łapią regresję, a nie tylko
  przechodzą): dwie mutacje wprowadzone tymczasowo w `slownik.ts` — (a) kategorie liczone jak
  marki → pada „KATEGORIA spoza katalogu jest wybieralna"; (b) kategorie ze słownika PLUS
  z katalogu, czyli dokładnie degradacja z 4b → pada „KATEGORIE nie biorą się z katalogu".
  Oba kierunki odwrócenia reguły są wykrywane; mutacje wycofane.
- **Grep kontrolny:** ✓ zero WYWOŁAŃ `/api/attributes(-kinds)` w `rebuild/frontend/src`.
  Pozostałe trafienia to komentarze opisujące, czym były te martwe klucze, oraz `data-testid`
  przeniesione 1:1 z oryginału (`button-add-attribute`, `button-save-attribute`).

## Breaking changes

Brak. Zmiana w `DialogReguly.tsx` dokłada dwa zapytania (`/api/atrybuty`, `/api/suppliers`)
i zmienia ŹRÓDŁO list, ale kształt zapisywanych warunków zostaje ten sam (`{typ, wartosc}`),
a wartość dla `dostawca` to nadal kod dopasowywany przez `repos/ceny.ts:52`.

## Follow-up

- **Defekt oryginału „Nowy rodzaj nie zapisuje"** (punkt 2 wyżej) — do wpisania w backlog jako
  usterka produkcji, którą odbudowa świadomie naprawia.
- **Martwy filtr „Źródło"** — kolumna `origin` istnieje w bazie, ale żadna trasa jej nie zwraca,
  więc filtr w produkcji zawsze pokazuje „user". Pominięty (D4); do backlogu jako obserwacja.
- **Backlog #39** (brak audytu akcji kolejki) — nietknięty, ⬜ do decyzji. UI ostrzega o skali
  masowego `UPDATE products`, ale nie zastępuje to wpisu w dzienniku.
- **Backlog #36** (`AppShell` w siedmiu widokach) — nietknięty; `/atrybuty` owija się w `AppShell`,
  żeby zdjęcie placeholdera nie zabrało sidebara.
- **Sesja 7c** — `/katalog` i degradacja D3 z I2, po merge 8b.

## Poprawki po review (iteracja 1)

Review: 0 BLOCKER, 3 SHOULD-FIX, 2 NICE-TO-HAVE — wszystkie rozliczone.

1. **SHOULD-FIX (trafny, mój błąd): brakujące testy części B w `narzuty.dialog.test.tsx`.**
   Podmiana wstawiająca nowy blok testów po cichu nie zadziałała (wzorzec nie pasował przez
   escapowany cudzysłów w źródle), a raport twierdził, że testy powstały. Blok dopisany
   (5 testów, 25 → 30) i **zweryfikowany mutacyjnie**: (a) kategorie liczone jak marki →
   pada test „KATEGORIA spoza katalogu jest wybieralna"; (b) kategorie ze słownika PLUS
   z katalogu (degradacja z 4b) → pada test „KATEGORIE nie biorą się z katalogu". Doszedł też
   test, że wartością warunku „dostawca" jest `kod`, a nie etykieta.
2. **SHOULD-FIX: sprzeczność w raporcie** — sekcja „Zmiany" poprawiona, teraz zgadza się z diffem.
3. **SHOULD-FIX: detekcja duplikatu po treści komunikatu** (`DialogNowaWartosc.tsx`) — rozpoznanie
   przeniesione na ETAP mutacji. Błąd zakładania rodzaju jest teraz połykany, co jest zarazem
   wierniejsze (oryginał wysyła ten POST jako `fetch(...).catch(console.warn)`, `:10250-10259`)
   i usuwa mylący komunikat w wyścigu: do `onError` docierają wyłącznie błędy dodawania WARTOŚCI.
4. **NICE-TO-HAVE: dwa `queryFn` na jednym kluczu** — `DialogReguly.tsx` używa teraz tego samego
   `pobierzSlownik()` co widok `/atrybuty`. Wcześniej o zachowaniu na wygasłej sesji (null vs rzut)
   decydowała kolejność montowania komponentów.
5. **NICE-TO-HAVE: „Anuluj" nie czyści pól** — zostawione bez zmian, bo to zachowanie ORYGINAŁU
   (`sg()`: reset pól tylko w gałęzi sukcesu, `:27203` vs `:27265`); dopisany komentarz, żeby
   następny czytelnik nie wziął tego za przeoczenie.

Po poprawkach: **564 testy / 38 plików** oraz 17 integracyjnych; lint, typecheck, build czyste.

## Poprawki po review (iteracja 2)

Review iteracji 2: **0 BLOCKER, 0 SHOULD-FIX, 1 nowa uwaga NICE-TO-HAVE** — naniesiona.

Reviewer zweryfikował poprawki działaniem, nie na słowo: powtórzył test mutacyjny (trzy mutacje,
w tym podmiana kod↔etykieta dostawcy — wszystkie łapane), potwierdził w oryginale wzorzec
`fetch(...).catch(console.warn)` przy zakładaniu rodzaju oraz cytat dla „Anuluj nie czyści pól",
i sprawdził, że wspólny `queryFn` NIE wywala `/narzuty` na wygasłej sesji (brak `throwOnError`
i Suspense w `QueryClient`, odczyt zabezpieczony `slownikAtrybutow?.wartosci ?? []`) — dialog
degraduje się do pustych list.

6. **NICE-TO-HAVE: pusty `catch`** przy połykaniu błędu zakładania rodzaju
   (`DialogNowaWartosc.tsx`) nie zostawiał śladu, choć oryginał loguje
   (`console.warn("[atrybuty] POST rodzaj failed", e)`, `:10258`) i taka jest konwencja repo.
   Dodany `console.warn` — użytkowniczki nadal nie zawiadamiamy, ale diagnostyka zostaje.

## Aktualizacja dokumentacji

Cztery pliki `docs/` sprawdzone równolegle; dwa dodatkowe (`docs/plan.md`, `docs/spec-backend.md`)
zweryfikowane i świadomie zostawione bez zmian.

**`docs/rebuild-roadmap.md`** (+79/−49)
- §3: wiersz „Martwe ścieżki FE" ⬜ → ✅ (naprawione w 7b); wiersz „Skrypty injection" —
  `pending-injection.js` ✅ wchłonięty, zostaje tylko `selly-injection.js` (I8).
- §4: wiersz iteracji 7 ma sesje „7a BE · 7b FE · 7c FE", status 🔨, daty per sesja.
- Podblok 7b oznaczony ✅ (2026-09-04, ticket `31-FEATURE-atrybuty-frontend`); sześć „ustaleń
  z 7a" (wiedza zużyta) zastąpione opisem faktycznie dowiezionego zakresu wraz z odstępstwami
  D2/D4/D7, nieodtworzonym kaflem D3 i trzema operacjami bez konsumenta w UI (D5).
- Dopisany fakt o TRZECH warstwach ekranu produkcyjnego (luka w `mapa-kodu-do-wiki.md:57`).
- **Obie noty „DO ZROBIENIA OD ZARAZ" USUNIĘTE** (nie przekreślone): I4b jako wykonana,
  I2 przeniesiona do nowego bloku.
- **Założony podblok 7c** z kompletem zweryfikowanych faktów o `/katalog` (patrz niżej).
- Ponadto agent sprostował dwa miejsca poza zleceniem, oba nieaktualne: notę w bloku Iteracji 4
  (opisywała degradację `DialogReguly.tsx` jako wciąż aktualną) i wiersz w tabeli „Co I2
  świadomie odłożyła" (przekierowany z ogólnego „I7" na konkretną sesję 7c).

**`docs/rebuild-backlog.md`** (+91)
- **#44** [FRONTEND] przycisk „Nowy rodzaj" w produkcji nie zapisuje rodzaju — ✅ TAK,
  naprawione w odbudowie (7b).
- **#45** [FRONTEND] filtr „Źródło" w liście wartości jest martwy — ⬜ do decyzji Ani.
- Uzupełnienia (bez zmiany rozstrzygnięć) w #36, #39, #40, #41, #42, #43 — opisują skutki
  tych defektów widoczne teraz na ekranie `/atrybuty`.

**`docs/spec-frontend.md`** (+44/−10)
- §1 i §2A: martwe ścieżki opisane jako błąd ORYGINAŁU, z notą o stanie odbudowy.
- §2B: `pending-injection.js` oznaczony jako wchłonięty, z listą komponentów, które go zastąpiły.
- §3: `/atrybuty` przeniesiony z placeholderów do widoków odbudowanych (został 1 placeholder).
- Nota przy `/katalog` doprecyzowana: odłożenie słowników dotyczy WYŁĄCZNIE filtrów `/katalog`
  (sesja 7c) i nie należy jej mylić z dialogiem reguł, który słownik czyta od 7b.
- Nowy blok „Odbudowa (7b…)" w §5 — trzy warstwy produkcji, układ widoku, odstępstwa.

**`docs/instrukcja-testow-I4.md`** (+22/−8)
- Punkt 9 sekcji 4 przepisany: opis źródeł list wyboru w dialogu reguł po zmianie (marka = suma,
  kategoria = wyłącznie słownik z praktycznym skutkiem dla testera, dostawca jako `KOD · Nazwa`
  z zapisem kodu, konstrukcja i VF/IF jako listy zamiast pól tekstowych) plus wskazówka, co
  zrobić, gdy lista kategorii jest pusta.
- Z tabeli „Czego jeszcze NIE MA" usunięte dwa wiersze wskazujące na Iterację 7 — dowiezione.

**Bez zmian (zweryfikowane):** `docs/plan.md` — dokument jawnie historyczny (Faza wstępna),
jego wzmianki o atrybutach to zapis ówczesnego kontekstu; `docs/spec-backend.md` — nigdzie nie
twierdzi, że trasy `/api/atrybuty*` nie mają konsumenta, a ticket nie zmienia backendu.

**Pre-existing issues zgłoszone przez doc-checkerów:** brak.

## Do decyzji użytkownika (nowe, wykryte w tej sesji)

1. **Backlog #45** — czy `origin` ma być wystawiane przez backend (wtedy filtr „Źródło" miałby
   sens), czy pole zostaje wyłącznie wewnętrzne.
2. **Dialog edycji produktu `LT()`** (`deminified/frontend-index.js:23909-23980`) — czwarty
   konsument słownika atrybutów, w odbudowie NIEPRZEPORTOWANY i nieprzypisany do żadnej sesji
   roadmapy (`src/pages/katalog/` ma tylko `PodgladProduktu.tsx`, bez edycji; I2 świadomie
   dowiozła podgląd read-only zamiast modalu edycji). Zapisane w roadmapie jako otwarte pytanie
   o przypisanie zakresu — wymaga decyzji, nie jest zadaniem 7c.
