# 77-FEATURE-pseudo-alerty-katalogowe — raport z implementacji

## Podsumowanie

Pseudo-alerty katalogowe wróciły jako zakładka „Katalog" na `/alerty`, obok „Import". Silnik to
port 1:1 `v2()`/`pv()` z żywego bundla na `origin/main` (po łatkach `tr_fix` i `ackalerts`
z 04.09). Na całym `db/snapshot.db` daje wynik **identyczny co do bajtu** z oryginałem wyciętym
z bundla. Status alertu trzymamy na serwerze w nowej tabeli (migracja `007`), zapisuje go nowa
trasa `GET/PUT /api/alerty-katalogu/statusy`, a tabela sprząta się sama przy zapisie. Pulpit
pokazuje oba źródła: kafel sumuje, karta ma dwie sekcje.

## Zmiany

**Backend**
- **Nowy:** `rebuild/schema/007_alerty_katalogu_statusy.sql` — tabela
  `alerty_katalogu_statusy (id PK, klucz, produkt_id, status CHECK przejrzany|rozwiazany,
  uzytkownik_id, uzytkownik_imie, kiedy)` + indeks na `klucz`. Idempotentna (`IF NOT EXISTS`).
- `rebuild/backend/src/db/schema.ts` — model `alertyKataloguStatusy`, dopisany ręcznie.
- **Nowy:** `src/repos/alerty-katalogu.ts`:
  - `rozbierzIdAlertu` rozpoznaje cztery formy `id` produkowane przez silnik;
  - `listStatusyKatalogu` ma jawną projekcję `{id, status, kto, kiedy}`;
  - `ustawStatusyKatalogu` robi w jednej transakcji upsert, wypieranie tej samej pary
    (produkt/dostawca, reguła) i kasowanie sierot. `nowy` kasuje wpis.
- **Nowy:** `src/routes/alerty-katalogu.ts`:
  - `GET` oddaje gołą tablicę;
  - `PUT {ids, status}` odpowiada `{ok, zmienione}`;
  - 400 dla nieznanego statusu, pustej listy lub listy ponad 20 000 pozycji, `id` nie-tekstowego,
    pustego lub dłuższego niż 2000 znaków, albo `id` w formie, której silnik nie produkuje
    (także reguły wyłączone `if(false)`);
  - obie metody za `requireAuth`, bez `audit_log` (spójnie z D4 z I6).
- `src/app.ts` — rejestracja trasy.
- `test/db.migracje.test.ts` — lista migracji +007, tabel 27, indeksów 14.
- **Nowy:** `test/alerty-katalogu.gate.test.ts` (35 testów) — kontrakt GET/PUT (ciało sprawdzane
  wobec schematu czytanego z `openapi.yaml`), „kto i kiedy", `nowy` kasuje, paczka z duplikatami,
  wypieranie (marża i dni dostawcy), brak wypierania między regułami i produktami, sieroty,
  9 przypadków 400, 401, rozbiór `id` (z `|`, polskimi znakami, nową linią, myślnikami w kodzie).

**Kontrakt**
- `contract/openapi.yaml` — ścieżka `/api/alerty-katalogu/statusy` (get, put) z blokiem
  „ODSTĘPSTWO OD PRODUKCJI — P6.2". Schematy są inline i wielowierszowe, poza generowanym blokiem
  `components.schemas`, więc generator ich nie zdejmuje. `generate-openapi-schemas.cjs --sprawdz`
  zielone. **`contract/fixtures/` bez zmian.**

**Frontend**
- **Nowy:** `src/pages/alerty/silnik-katalogu.ts` — `klasyfikujOpone` (port `v2`),
  `policzAlertyKatalogu` (port `pv`), `SLOWA_NIE_OPONA` (h2 bez `"tr-"`),
  `WYKLUCZENI_Z_BRAKU_IMPORTU` (MO7, MO8), progi 7/30. Regexy słów są budowane raz, nie przy
  każdym produkcie.
- **Nowy:** `src/pages/alerty/katalog-api.ts` — `useAlertyKatalogu()`, jedno źródło dla zakładki
  i Pulpitu; `pobierzStatusyKatalogu` (błąd jest błędem, nie `null`); `zmienStatusyKatalogu`
  (jeden PUT).
- **Nowy:** `src/pages/alerty/filtry-katalogu.ts` — filtr poziomu i statusu (stała
  `FILTR_NIEROZWIAZANE` z P6.1), `doZaakceptowania`, `podsumowanieKatalogu`.
- **Nowy:** `src/pages/alerty/ListaAlertowKatalogu.tsx` — widok zakładki (port `HT()`), przyciski
  z `PrzyciskiStatusu` P6.1, „Zaakceptuj wszystko", toasty.
- **Nowy:** `src/pages/alerty/zakladki.ts` — `?zakladka=katalog` i `adresZakladki`.
- `src/pages/Alerty.tsx` — powłoka z `Tabs` Import / Katalog, zakładka w adresie.
- `src/pages/pulpit/kpi.ts` — `najswiezszeAlerty`/`aktywneAlerty` generyczne dla obu źródeł.
- `src/pages/Pulpit.tsx` — kafel sumuje oba źródła, karta ma sekcje „Import" i „Katalog",
  wiersze linkują do właściwej zakładki.
- `test/msw/pulpit.ts`, `test/pulpit.test.tsx` — handler statusów. Stare testy dostają
  pseudo-alerty z fixture'a jako rozwiązane (id liczy silnik, więc test nie zależy od daty);
  doszedł blok 6 (6 testów Pulpitu z P6.2).
- **Nowe:** `test/alerty.silnik-katalogu.test.ts` (27), `test/alerty.katalog.test.tsx` (11).

## Odstępstwa od planu

- W planie limit `id` w paczce wynosił 10 000; w kodzie jest **20 000**. Teoretyczny sufit to
  ok. dwa razy katalog (marża i nie-opona u każdego produktu), więc 10 000 mogło nie wystarczyć
  przy „Zaakceptuj wszystko".
- Schematy nowej trasy są **inline** w opisie ścieżki, nie w `components.schemas`. Cały ten blok
  generuje narzędzie z fixtures i ręczny wpis by skasowało. Ciało sprawdza test BE, który czyta
  schemat z `openapi.yaml`.
- Poza tym zgodnie z planem.

## Pomiar kosztu liczenia (decyzja 5)

Dane: `db/snapshot.db`, 7405 produktów w kształcie API, Node 20, 30 biegów.

| | mediana | max |
|---|---|---|
| **port (`policzAlertyKatalogu`)** | **25,3 ms** | 35,8 ms |
| oryginał `pv()` wycięty z bundla | 284,7 ms | 551,3 ms |

Oryginał buduje `new RegExp` dla 35 słów przy KAŻDYM produkcie; port robi to raz. Wynik jest
ten sam, a koszt ok. 11 razy niższy. 25 ms raz na zmianę danych (`useMemo` po katalogu
i statusach) jest nieodczuwalne, więc **powrotu z pytaniem nie było**. Żądań nie przybywa:
`["/api/products"]` Pulpit ładuje i tak, a zakładka dzieli z nim cache react-query.

## Dowód wierności silnika

Skrypt w scratchpadzie wycina `h2…pv` z `git show origin/main:mirror/frontend/assets/index-PRICEFMT1783512500.js`
i odpala oryginał oraz port na tych samych 7405 produktach, z zegarem zamrożonym na 2026-09-21 12:00Z:
- **22 alerty w obu, identyczne co do bajtu** (JSON całej listy, w tej samej kolejności):
  7 × „Brak importu cennika" (krytyczny; snapshot jest z 13.08, 9 dostawców minus MO7/MO8)
  i 15 × „Bardzo niska marża";
- z nadanymi statusami (5 alertów przejrzanych lub rozwiązanych) wynik też identyczny;
- `v2` kontra `klasyfikujOpone`: **0 różnic na 7405 produktach**.

Snapshot nie ma ani jednej marży ujemnej ani nie-opony, dlatego te gałęzie i wszystkie progi
pokrywają testy jednostkowe.

## Sprzątanie tabeli statusów (decyzja 2, wybór Q2)

**Wypieranie + sieroty**, przy każdym `PUT`, w tej samej transakcji:
1. zapis statusu dla `id` kasuje wiersze o tym samym `klucz` (produkt/dostawca + reguła, bez
   odcisku) i innym `id`;
2. kasowane są wiersze z `produkt_id` spoza `products`.

Skutek: tabela ma najwyżej ok. jeden wiersz na parę (produkt, reguła) plus jeden na dostawcę.
Górne ograniczenie to ok. dwa razy katalog i jest osiągalne tylko przy masowym „Zaakceptuj
wszystko" na tysiącach alertów. Nie ma procesu w tle ani crona.

Świadome różnice:
- jeśli marża wróci do DOKŁADNIE starej wartości, alert przyjdzie jako „nowy" (w IndexedDB
  oryginału stary wpis by przetrwał);
- wiersze dostawców, którzy stracili wszystkie produkty, zostają. Jest ich najwyżej tyle, ilu
  dostawców (10), więc nie sprzątamy ich osobno.

## Pulpit: co pokazuje kafel „Aktywne alerty" (decyzja 3)

- **Wartość** to liczba alertów w statusie `nowy` z OBU źródeł (import + katalog). Oryginał liczył
  tu pseudo-alerty `nowy` (`pv(...).filter(nowy)`); O-10f-1 liczyło alerty importu `nowy`. Suma
  zachowuje oba znaczenia.
- **Podpis** „N krytycznych" liczy krytyczne z obu źródeł łącznie. Alerty importu mają poziomy
  `info`/`ostrzezenie`, więc w praktyce są to krytyczne z katalogu.
- **Karta „Najnowsze powiadomienia"** ma dwie sekcje, „Import" i „Katalog", w każdej najwyżej 5
  pozycji dobranych i posortowanych jak w oryginale. Nagłówek podaje „N aktywnych alertów łącznie".
  Pusta sekcja znika, a karta znika, gdy obie są puste. Wiersze prowadzą do właściwej zakładki
  (`/alerty` albo `/alerty?zakladka=katalog`).
- **Synchronizacja** (łatki `ackalerts` pkt 2 i 3): zapis statusu unieważnia klucz
  `["/api/alerty-katalogu/statusy"]`, a Pulpit czyta ten sam klucz. Bez `window.dispatchEvent`.
  Pilnuje tego test 6.6 w `pulpit.test.tsx`.

## Wyniki testów

- **Gate odbudowy (kontrakt):** ✓ zgodne.
  - Nowa trasa `GET/PUT /api/alerty-katalogu/statusy`: statusy 200/400/401 zadeklarowane
    w kontrakcie (`sprawdzZgodnoscZKontraktem`), ciało odpowiedzi zgodne ze schematem z
    `openapi.yaml` (walidator w teście).
  - Fixture'a nie ma i być nie może (w produkcji status żyje w IndexedDB); to zatwierdzone
    odstępstwo (decyzja 2).
  - Istniejące trasy `GET /api/products` i `GET /api/alerts` bez zmian w kodzie; ich GATE
    (`alerty.gate.test.ts` i inne) zielone.
  - `contract/fixtures/` nietknięte. `kontrakt.spojnosc.test.ts` i
    `generate-openapi-schemas.cjs --sprawdz` zielone.
- **Backend:** lint ✓, typecheck ✓, build ✓ (copy-schema: 7 plików .sql), test ✓ **1437/1437**
  (89 plików; po scaleniu develop z P7.1/P7.3).
- **Frontend:** lint ✓, typecheck ✓, build ✓ (ostrzeżenie o rozmiarze chunka było już
  wcześniej), test ✓ **874/874** (51 plików).
- **Testy reguł** (`alerty.silnik-katalogu.test.ts`, 27):
  - każda z czterech reguł osobno;
  - marża −0,01 / 0 / 4,99 / 5;
  - dni 6,99 / 7 / 29,99 / 30;
  - MO7/MO8 przy 100 dniach i dostawca bez daty;
  - nowy odcisk przywraca „nowy" dla marży, nazwy i dni dostawcy;
  - BKT `18.4-38 BKT TR-135 146A8 TT` nie jest nie-oponą, z dowodem, że stary `"tr-"` by ją
    złapał;
  - reguły `if(false)` nie wychodzą; sortowanie.
- **E2E:** brak (projekt nie ma E2E; przepływ pokrywają testy RTL + MSW na `<App/>`).

## Zmiany łamiące zgodność

Brak dla API i danych. Wdrożenie wymaga `npm run migrate` (nowa migracja 007), tak jak każda
migracja. Bez niej `GET/PUT /api/alerty-katalogu/statusy` rzuci błąd SQL, a zakładka „Katalog"
pokaże „Nie udało się policzyć alertów katalogu" (zakładka „Import" działa dalej).

## Do zrobienia później

- **P6.3 — instrukcja I6** (`docs/instrukcja-testow-I6.md`) przestaje być prawdziwa, m.in. §5
  („alerty o jakości danych … decyzja") i §4 pkt 9. Dojdzie do tego zmiana Pulpitu (dwa źródła
  i suma na kaflu). Warto też uprzedzić Anię, że alert „Brak importu cennika" oznaczony jako
  przejrzany wraca następnego dnia jako „nowy" (dni są w `id`). Tak działa oryginał od łatki
  `ackalerts`. Pliku nie ruszałem.
- **PR.3 musi wziąć migrację `008`** (007 zajęła ta karta). Nota wpisana do bloku PR.3
  w roadmapie.
- **Nieaktualne komentarze w plikach P6.1**, których ta karta nie mogła ruszyć:
  - nagłówek `pages/alerty/TabelaAlertow.tsx` mówi „pseudo-alerty katalogowe czekają na decyzję
    w backlogu";
  - `pages/alerty/api.ts` pisze o „przyszłej liście P6.2".
  Do poprawki przy następnym dotknięciu tych plików.
- `rebuild/schema/README.md` wymienia migracje do `006`; dopisanie `007` należy do synchronizacji
  dokumentacji.
