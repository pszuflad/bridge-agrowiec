# 25-FEATURE-analityka-dostepnosc-rotacja — raport z implementacji

## Podsumowanie

Blok 10e Iteracji 10 dowieziony w całości: sześć tras `/api/analytics/*` odtworzonych 1:1
z `mirror/backend/analytics_module.cjs`, pięć kart w dwóch istniejących zakładkach widoku
`/analityka` (trzy wypełniają „Dostępność", dwie dokładają się pod kartą marż z 10a).
Przy okazji wyszła rzecz, której nie opisywał żaden dokument projektu: **tabela `historia_cen`
nie ma kolumny `nazwa`**, o którą pytają oba zapytania dostępności — więc obie te karty są
w produkcji trwale puste. Odtworzone 1:1 (port `safeAll`), zamrożone testami, opisane
w backlogu jako wpis #32 do decyzji.

## Zmiany

**Backend**
- `rebuild/backend/src/repos/analityka.ts` — sześć nowych agregatów (`dostepnoscProduktow`,
  `tempoSchodzenia`, `sezonowoscMiesieczna`, `cyklZyciaModeli`, `rotacjaNieaktywnych`,
  `osCzasuImportow`), pomocnik `czyJestHistoria` (port `hasHistory`), `zacisnijDniRotacji`
  (port zacisków `?days`) oraz `bezpiecznieWiersze` (port `safeAll` — patrz „Odkrycia").
- `rebuild/backend/src/routes/analytics.ts` — sześć tras `GET` za `requireAuth`.
- **Nowy:** `rebuild/backend/test/analityka.dostepnosc.gate.test.ts` — GATE bloku (14 przypadków).
- **Nowy:** `rebuild/backend/test/analityka.dostepnosc.agregaty.test.ts` — semantyka agregatów
  (20 przypadków), w tym trzy charakteryzacyjne.

**Frontend**
- `rebuild/frontend/src/pages/analityka/api.ts` — sześć typów wiersza, pięć hooków;
  `useRotacjeNieaktywnych(dni)` z parametrem w kluczu zapytania.
- `rebuild/frontend/src/pages/analityka/filtrowanie.ts` — generyk `zastosujFiltry`
  + `wymiaryZMapowania` + typ `MapowanieWymiarow`; `zastosujFiltryMarz` została cienką
  nakładką na generyk (zachowanie bez zmian).
- **Nowe:** `NaglowekSekcji.tsx`, `PasekDostepnosci.tsx`, `SekcjaDostepnosciProduktow.tsx`,
  `SekcjaTempaSchodzenia.tsx`, `SekcjaSezonowosci.tsx`, `SekcjaRotacji.tsx`,
  `SekcjaCykluZycia.tsx`.
- `rebuild/frontend/src/pages/analityka/SekcjaMarze.tsx` — nagłówek karty przeniesiony do
  wspólnego `NaglowekSekcji`; markup i `data-testid` bez zmian.
- `rebuild/frontend/src/pages/Analityka.tsx` — montaż pięciu sekcji; `ZakladkaWPrzygotowaniu`
  znika z „Dostępności" i spod marż (zostaje w zakładkach 10b/10c/10d).
- `rebuild/frontend/test/msw/kontrakt.ts` — sześć loaderów fixtures 10e.
- **Nowe:** `test/analityka.dostepnosc.test.tsx` (12 przypadków),
  `test/analityka.dostepnosc.filtrowanie.test.ts` (10 przypadków).
- `rebuild/frontend/test/analityka.test.tsx` — dopisane handlery MSW nowych tras (bez nich
  `onUnhandledRequest: "error"` zgłasza żądanie bez mocka) i zawężenie jednej asercji do
  tabeli marż; asercje 10a bez zmian merytorycznych.

**Dokumentacja**
- `docs/rebuild-backlog.md` — wpisy **#32** (brak kolumny `nazwa`) i **#33** (funkcja okna po
  niepełnym `GROUP BY`), oba ⬜ do decyzji.
- `rebuild/frontend/src/pages/analityka/README.md` — inwentarz o trzy pozycje do reużycia,
  poprawiony wzorzec klucza zapytania z parametrem, sekcja o odstępstwach 10e.

## Odkrycia wobec planu

**1. `historia_cen` nie ma kolumny `nazwa` — dwie trasy zwracają pustkę zawsze.**
Nie wiedział o tym ani plan, ani `docs/analityka-bloki-10b-10f.md`, ani roadmapa. Kolumny nie
ma w zrzucie produkcji (`db/schema.sql`), w `rebuild/schema/001_schema.sql` ani w `ensureSchema()`
samego modułu analityki, który tę tabelę tworzy. Oba zapytania dostępności biorą z niej
`MAX(nazwa)` → `no such column: nazwa` → `safeAll()` połyka błąd → `rows: []`.
Dowód, że tak jest w produkcji: `GET_analytics_status.json` pokazuje 15 597 migawek historii,
a oba fixture'y dostępności mają `hasHistory: true` i `rows: []`.

Wobec braku decyzji użytkownika zastosowałem regułę domyślną projektu — **odtworzenie 1:1**:
doszedł port `safeAll` (`bezpiecznieWiersze`), więc trasy oddają dokładnie to, co produkcja,
zamiast 500. Naprawa byłaby świadomym odstępstwem i czeka jako **backlog #32**; trzy warianty
naprawy są tam opisane. **To jest rzecz do rozstrzygnięcia przez użytkownika** — dwie z trzech
kart zakładki „Dostępność" pokazują „Brak danych" niezależnie od danych.

**2. Decyzja D1 okazała się bezprzedmiotowa w praktyce.** Pułapka `GROUP BY` + `LAG`
w `sell-through`, dla której plan przewidywał test charakteryzacyjny, jest **nieosiągalna**:
zapytanie wywraca się wcześniej, na `MAX(nazwa)` z odkrycia (1). Test charakteryzacyjny
powstał i zamraża realny efekt (pusta lista mimo danych do policzenia), a sama pułapka jest
opisana jako **backlog #33** ze wskazaniem, że naprawa #32 ją odsłoni — obie sprawy trzeba
rozstrzygać razem.

**3. `punktyMiesieczne` wyeksportowane z sekcji sezonowości.** Plan nie przewidywał osobnej
funkcji; zwijanie „miesiąc × marka" do punktów wykresu jest czystą logiką i zostało wystawione
do testu jednostkowego zamiast być sprawdzane przez DOM.

**4. Trzy rzeczy wyprowadzone do reużycia zamiast pisane pięć razy.** Plan wymieniał
`PasekDostepnosci` i generyk filtrowania; doszedł `NaglowekSekcji` (tytuł karty + dwie notki
o filtrach), bo przy sześciu sekcjach był to szósty egzemplarz tego samego bloku JSX.

**5. `node_modules` głównego repo jest nieaktualne.** Brakuje w nim `@radix-ui/react-popover`
(zależność dodana w 10a), więc `npm ci` musiał pójść osobno w worktree frontendowym. Backend
korzysta z dowiązania do głównego repo bez problemów. Nie zmieniałem niczego w głównym repo.

## Wynik testów

- **Gate odbudowy (fixtures/kontrakt):** ✓ zgodne. Sześć ścieżek — `availability/products`,
  `availability/sell-through`, `seasonality/monthly`, `lifecycle/models`, `rotation/inactive`,
  `importy-timeline` — porównanych z sześcioma plikami `contract/fixtures/GET_analytics_*.json`
  i zwalidowanych wobec `contract/openapi.yaml`, plus 401 bez tokenu dla każdej z sześciu.
  Osobna asercja: żadna odpowiedź nie zawiera `_przyciete`.
  Siła siatki, nazwana wprost: kontrakt nie ma dla analityki schematów odpowiedzi, a cztery
  z sześciu nagrań są puste — GATE dowodzi tam koperty, nie kształtu wiersza. Dlatego zasiew
  GATE-u został poszerzony o migawki z marką i modelem, żeby dwie trasy z niepustym fixture'em
  (`lifecycle/models`, `seasonality/monthly`) porównały się wiersz w wiersz.
- **Backend, jednostkowe:** ✓ 20 nowych przypadków w `analityka.dostepnosc.agregaty.test.ts`
  (kształt wiersza czterech tras z pustym fixture'em, obie gałęzie `hasHistory`, zaciski
  `?days`, filtr akcji audytu, trzy charakteryzacje).
- **Backend, cały zestaw:** ✓ 718 testów / 45 plików.
- **Frontend, widok + jednostkowe:** ✓ 22 nowe przypadki; cały zestaw ✓ 413 testów / 28 plików.
- **Bramki:** `lint`, `typecheck`, `build` — czyste w backendzie i we frontendzie.

Jedna uwaga o stabilności: przy pierwszym pełnym przebiegu backendu odpadł
`test/scheduler.test.ts` (asercja na liczbie timerów), a w izolacji i w kolejnych przebiegach
przechodzi — to flak zależny od obciążenia maszyny, niezwiązany z tym ticketem. We frontendzie
`analityka.test.tsx` odpadał na czekaniu na leniwy chunk `/analityka`, który po dołożeniu
pięciu sekcji urósł do ~410 kB; limit oczekiwania podniesiony do 5 s w obu plikach testów widoku.

## Breaking changes

Brak. Sześć nowych tras `GET`, żadna istniejąca nie zmieniła kształtu odpowiedzi.

## Do dalszej decyzji / follow-up

1. **Backlog #32 — brak kolumny `nazwa`** (⬜ do decyzji): czy karty „4.1" i „4.2" mają
   zostać trwale puste jak w produkcji, czy naprawiamy (trzy warianty opisane we wpisie).
   Ta sama wada dotyczy dwóch widoków eksportu CSV — wejście dla bloku **10f**.
2. **Backlog #33 — okno po niepełnym `GROUP BY`** (⬜ do decyzji): do rozstrzygnięcia razem z #32.
3. **Blok 10f** dokłada przyciski „CSV" do kart „4.1", „4.2" i „Rotacja" (`availability-products`,
   `sell-through`, `rotation-inactive`) — świadomie ich tu nie ma, bo trasa eksportu nie istnieje.
4. **Blok 10d** ma **reużyć** `pages/analityka/PasekDostepnosci.tsx`, a nie pisać drugiego
   paska do kart „1.4/1.5"; komponent jest wpisany do inwentarza w README katalogu.
5. **`node_modules` w głównym repo** warto odświeżyć (`npm ci` w `rebuild/frontend`) — brakuje
   w nim zależności dodanej w 10a. Nie ruszałem tego, bo to katalog współdzielony z innymi
   równoległymi sesjami.

## Poprawki po review

Review: **0 BLOCKER**, 2 SHOULD-FIX, 1 NICE-TO-HAVE
(`docs/tickets/25-FEATURE-analityka-dostepnosc-rotacja/review.md`). Reviewer niezależnie
potwierdził odkrycie o brakującej kolumnie `nazwa` oraz zgodność wszystkich sześciu zapytań
SQL z oryginałem znak po znaku.

Obie uwagi SHOULD-FIX naprawione:

1. **Stan pola „Bez ruchu dni" ginął przy zmianie zakładki.** `Tabs.Content` bez `forceMount`
   odmontowuje nieaktywną zakładkę, więc `useState` trzymany w `SekcjaRotacji` wracał do „60"
   po każdym przejściu na inną zakładkę i z powrotem — czego oryginał nie robi, bo trzyma tę
   wartość w komponencie widoku (`frontend-index.js:27805`). Stan przeniesiony do
   `Analityka.tsx`; sekcja dostaje `dni` i `onZmianaDni` w propsach. Dołożony test regresji
   („wpisana wartość przeżywa przejście na inną zakładkę i z powrotem").
2. **Layout karty rotacji.** Oryginał daje jej `CardContent` z `p-4 space-y-3`
   (`frontend-index.js:28563`) — jako jedynej karcie analityki; pozostałe mają `p-0` i kreskę
   pod nagłówkiem. Karta dostała układ oryginału, a `NaglowekSekcji` — flagę `bezRamki`
   obsługującą ten jeden przypadek.

NICE-TO-HAVE (nazwa stałej `LIMIT_TEMPA_SCHODZENIA` zamiast zapowiedzianej w planie
`LIMIT_SELL_THROUGH`) zostawiony bez zmian: polska nazwa jest spójna z resztą pliku,
a plan był w tym miejscu roboczym szkicem, nie kontraktem.

Po poprawkach: frontend 414 testów / 28 plików ✓, `lint`/`typecheck`/`build` czyste.

## Aktualizacja dokumentacji

Cztery równoległe przeglądy `docs/` po zamknięciu bloku.

**`docs/rebuild-roadmap.md`** — blok 10e oznaczony ✅ z datą (2026-09-04) i ID ticketa, opis
przepisany na zakres faktycznie dowieziony; tablica postępu §4 uzupełniona; nota o generyku
filtrowania i `NaglowekSekcji` dopisana do wspólnej sekcji dla 10b–10e. **Ustalenia trafiły do
bloków, których dotyczą, nie do zamkniętego 10e:** do **10d** — nakaz reużycia
`PasekDostepnosci.tsx` w kartach „1.4/1.5"; do **10f** — brakujące przyciski „CSV" dla trzech
kart 10e oraz ostrzeżenie, że `export/availability-products` i `export/sell-through` mają tę samą
wadę co trasy dashboardu. Istniejący opis wzorca `queryKey` w roadmapie był poprawny i został bez zmian.

**`docs/rebuild-backlog.md`** — wpisy #32 i #33 zweryfikowane niezależnie wobec kodu i nagrań
(brak kolumny `nazwa` w trzech źródłach schematu, numery linii SQL, dowód z fixtures, źródło
duplikatu w `import/tk.ts`); poprawiony zakres linii `ensureSchema()` na `analytics_module.cjs:24-49`
(ta sama korekta naniesiona w komentarzu `repos/analityka.ts`). Do wpisu **#31** dopisane
powiązanie z #32/#33 wraz z wyraźnym „nie scalać" — trzy usterki tej samej tabeli, ale niezależne.

**`docs/analityka-bloki-10b-10f.md`** — §7 oznaczona ✅ ZROBIONE i przepisana na stan faktyczny;
§2 rozbudowana o kolumnę „Przyczyna", która rozróżnia dwa powody pustego fixture'a („nie było
danych w chwili nagrania" kontra „trasa jest zepsuta i nigdy nic nie zwraca") — dotychczas
dokument sugerował tylko pierwszy; §8.1 ostrzega blok 10f o tej samej wadzie w dwóch widokach
eksportu; §9 uzupełniona o trzy pozycje do reużycia; §10 o punkt kontrolny „sprawdź, czy kolumny
z SQL trasy istnieją w schemacie, bo `safeAll` maskuje błąd schematu jako pustą odpowiedź".

**`docs/spec-backend.md` / `docs/spec-frontend.md` / `CLAUDE.md`** — spec backendu dostała notę
o sześciu trasach 10e i o brakującej kolumnie `nazwa` (także przy opisie `historia_cen`); spec
frontendu — opis pięciu kart, filtru `?days`, wykresu O-10e-1 oraz ostrzeżenie, że dwie karty
pokazują „Brak danych" niezależnie od stanu bazy. W `CLAUDE.md` dopisane jedno zdanie do sekcji
o pułapkach: `safeAll()` zamienia błąd SQL w pustą listę, więc **nie ufaj `rows: []`** — zepsuta
trasa wygląda identycznie jak trasa bez danych. `docs/plan.md` bez zmian (dokument historyczny,
sam odsyła do roadmapy).

**Pre-existing issues:** żaden z czterech przeglądów nie znalazł nieścisłości spoza zakresu
tego ticketa.
