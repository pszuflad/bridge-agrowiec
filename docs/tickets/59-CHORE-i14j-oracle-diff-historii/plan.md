# 59-CHORE-i14j — oracle diff trzech tras Historii (zastępuje ręczny test §9 z I5)

> Status: **Draft** → Approved → Implemented → Shipped
> Branch: `chore/59-i14j-oracle-diff-historii`
> Worktree: `.worktrees/59-CHORE-i14j-oracle-diff-historii`

## Opis ticketa

Karta **POMIAROWA, zero kodu produkcyjnego**. Znaleziony rozjazd się OPISUJE i proponuje osobną
kartę — nie naprawia tutaj.

Ania przeszła `docs/instrukcja-testow-I5.md` i nie zgłosiła ani jednej usterki, ale zostawiła
**puste pole przy rozdziale 9** („Porównanie ze starym Bridge" — najcenniejszy test iteracji)
oraz przy rozdziale 8 („Szczegóły"). Tego testu prawdopodobnie już nie wykona ręcznie.
Zastępujemy go pomiarem, tą samą metodą, którą 14e zastosowała do cen (porównanie pełnego
katalogu, 7405 produktów, 0 różnic).

Trzy zadania:
- **A (główne)** — oracle diff `GET /api/history`, `/api/history/meta`, `/api/history/paged`
  między oryginałem a odbudową na tych samych danych, z filtrami i paginacją, na komplecie pól
  i na kolejności wierszy.
- **B** — czy nowe ścieżki (mutacje katalogu z 12a/12c) faktycznie zostawiają ślad; §3.3
  instrukcji I5 mówi Ani, że „wpisów typu edycja nie przybędzie", i to już nieprawda.
- **C** — wpis do backlogu o `LIMIT_AUDYTU = 5000`.

## Kontekst

### Co już jest w repo (nie piszemy tego od nowa)

Trzy trasy są **zaimplementowane i gęsto udokumentowane** — ta karta ich nie dotyka, tylko
mierzy:

| Trasa | Źródło danych | Implementacja odbudowy | Oryginał |
|---|---|---|---|
| `GET /api/history` | tabela `history` (46 916 wierszy w snapshocie) | `repos/dziennik-zmian.ts` | `:48692` → `listHistory()` `:44962-44964` |
| `GET /api/history/meta` | `audit_log` przez mapowanie | `historia/mapowanie.ts` + `routes/history.ts` | `:48335-48351` → `listAudit(5e3)` `:45068-45070` |
| `GET /api/history/paged` | jw. | jw. | `:48352-48391` |

`GET /api/history` NIE czyta `historia_cen` — roadmapa do I5 podawała to błędnie i zostało
sprostowane; rozróżnienie trzech podobnych tabel: nagłówek `repos/dziennik-zmian.ts`.

### Stan danych wejściowych — zmierzony, nie założony

`db/snapshot.db`:

| Co | Liczba |
|---|---|
| `history` — wszystkie wiersze | **46 916** |
| `audit_log` — wszystkie wiersze | **3 873** |
| `audit_log` — przechodzące przez słownik `typWpisu()` | **270** |
| z tego `edycja_produktu` (→ typ `edycja`) | 178 |
| z tego `upload_pliku` (→ typ `import`) | 92 |
| z tego `import_cennika`, `eksport_csv`, `eksport_shoper` | **0, 0, 0** |

Wnioski, które przesądzają kształt karty:
1. **Porównanie NIE będzie puste** — mamy 46 916 + 270 wpisów do zestawienia. Zdanie
   „0 różnic" pójdzie do raportu wyłącznie z liczbą porównanych wpisów.
2. **`LIMIT_AUDYTU = 5000` dziś nie gryzie** (3873 < 5000) — dokładnie to, co instrukcja I5 §11
   pkt 9 opisuje Ani jako „dziś niewidoczne, ale z czasem wypłynie". Uzasadnia zadanie C.
3. **Gałąź „eksport" i `import_cennika` są na żywych danych nieosiągalne** — stąd decyzja D3.

### Instrukcja I5 nie leży na `develop`

`docs/instrukcja-testow-I5.md` istnieje **wyłącznie** na niezmergowanej gałęzi
`origin/docs/instrukcja-testow-i5` (commity `322a176`, `4ea3b92`). Cytaty §3.3, §8, §9 i §11
w tej karcie pochodzą stamtąd. To nie jest problem do naprawienia w tej karcie, ale trzeba
o tym wiedzieć, szukając pliku.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Ścieżki: `contract/openapi.yaml:19356-19397` — `GET /api/history`, `GET /api/history/meta`,
`GET /api/history/paged`. Wszystkie trzy mają `security: []` (produkcja publiczna) + adnotację
`x-odbudowa-auth`.

Fixtures: `contract/fixtures/GET_history.json`, `GET_history_meta.json`,
`GET_history_paged.json`.

| Fixture | Kształt | Adnotacje nagrywarki |
|---|---|---|
| `GET_history.json` | tablica, 10 pól/wiersz, klucze **camelCase** (`kodProduktu`, `staraWartosc`, `wykonalUzytkownikId`) | `_body_przyciete_z: 46916` |
| `GET_history_meta.json` | `{dostawcy: […]}` | `_przyciete.dostawcy: 8` |
| `GET_history_paged.json` | `{items, total, pages, page, limit}`, 11 pól/wpis, `total: 270` | `_przyciete` |

⚠ `_body_przyciete_z` / `_przyciete` to adnotacje nagrywarki (`contract/README.md:32-34`),
**nie pola API** — harness musi je odsiać przed porównaniem.

**Ta karta kontraktu NIE ZMIENIA.** Gate odbudowy obowiązuje w wersji „nic się nie zepsuło":
istniejący `test/historia.gate.test.ts` ma nadal przechodzić. Nowy trwały test (D1) jest
**dodatkowym** dowodem ponad gate, nie jego zamiennikiem.

### Rozjazd spec↔oryginał↔fixtures: brak

Researcher nie znalazł żadnego nieznanego rozjazdu w zakresie tych trzech tras. Trzy
odstępstwa, które wyjdą w pomiarze, są **wcześniej zatwierdzone** i mają być zaraportowane jako
wynik OCZEKIWANY, nie jako znalezisko:
- `requireAuth` na trzech trasach historii (D1 z I1),
- field-allowlist na edycji produktu (backlog #14 / D1 ticketu 35),
- `requireAuth` na eksportach (oryginał loguje audyt eksportu tylko `if (c.user)`, więc
  anonimowy eksport nie zostawia śladu; u nas 401 zamiast 200 + cichy brak audytu).

## Decisions

**D1 — deliverable: skrypt pomiarowy + TRWAŁY test z zamrożoną wyrocznią.**
Skrypt oracle-diff ląduje w folderze ticketa (wymaga żywego oryginału, więc nie jest
uruchamialny w bramkach). Ponad to powstaje NOWY plik w `rebuild/backend/test/`, który zasiewa
prawdziwe wiersze `audit_log`/`history` ze snapshotu i asertuje odpowiedzi **zapisane
z oryginału podczas tego pomiaru**. Zysk: wyrocznia zostaje w bramkach na zawsze i złapie
regresję przyszłej karty 14k. Koszt: plik danych z zamrożonym wynikiem w `test/`.
*Odrzucone:* sam skrypt (pomiar jednorazowy, nic nie broni przed regresją); test zamrażający
wyłącznie naszą odpowiedź (zamroziłby też ewentualny błąd — to nie jest wyrocznia).

**D2 — zadanie B, parzystość danych: dobieramy produkt i pole o identycznej wartości
wyjściowej.** Oryginał chodzi na **surowym** snapshocie (tylko wygaszony scheduler), odbudowa
na kopii z migracjami 001–006. Ponieważ 004/006 zmieniają `products.kategoria` i
`products.nazwa`, przed edycją porównuję wiersz produktu po obu stronach i wybieram taki,
gdzie edytowane pola są bit w bit równe — inaczej `staraWartosc` w `history` rozjechałaby się
sztucznie. Dobór trafia do raportu, żeby pomiar był powtarzalny.
*Odrzucone:* doszczepianie oryginałowi naszych migracji konwencji (osłabia jego rolę wyroczni);
oba przebiegi (dwukrotnie dłuższy pomiar bez proporcjonalnego zysku).

**D3 — gałąź „eksport": zasiew identyczny po obu stronach, jako DRUGI przebieg.**
Najpierw przebieg na surowych danych produkcji (dowód wierności na 46 916 + 270 wpisach), potem
osobny przebieg na kopiach z doszytymi **identycznymi** wierszami `eksport_csv`,
`eksport_shoper` i `import_cennika` — bo inaczej pole `format`, tekst `uwagi: "Format: …"`
i filtr `typ=eksport` zostają bez pomiaru, a Ania ma na eksport checkbox w §8.2 instrukcji.
Raport **rozdziela** oba przebiegi: co jest dowodem z danych produkcji, a co z danych zasianych.
*Odrzucone:* brak zasiewu i opisanie luki (trzy z pięciu akcji słownika bez pomiaru).

**D4 — zadanie B uderza też w allowlistę, osobnym scenariuszem sondującym.**
Scenariusz główny idzie polami wspólnymi (czysta parzystość zapisu), drugi celowo wysyła pole
spoza `odsiejPolaEdytowalneProduktu` i mierzy, ile wierszy `history` powstaje po każdej stronie.
Znane odstępstwo #14/D1 dostaje LICZBĘ zamiast opisu.
*Odrzucone:* tylko pola wspólne (nie wiedzielibyśmy, jak duży jest ten rozjazd w praktyce).

**D5 (fakt, nie decyzja) — pułapka „projekcja Drizzle" w tym tickecie NIE WYSTĘPUJE.**
`listHistory()` oryginału to **Drizzle**, nie raw `better-sqlite3`
(`X.select().from(Wa).orderBy(desc(Wa.data)).all()`, `:44962-44964`), więc oryginał sam oddaje
nazwy PÓL modelu — i dlatego `GET_history.json` ma camelCase. `contract/README.md:36-40`
wymienia trasy raw-SQL (`uwagi-cena`, `hold-reasons`, `selly/log`) i historii tam nie ma. To
**inny przypadek niż `GET /api/selly/log`**. Mimo to harness porównuje **zestaw kluczy**, nie
tylko wartości — teza ma być potwierdzona pomiarem, nie rozumowaniem.

**D6 (fakt) — migracje 001–006 nie dotykają `history` ani `audit_log`.** Ani DDL, ani DML;
jedyne trafienia grepem to komentarze w 004/006 tłumaczące, że wierszy do `history` świadomie
NIE dokładają. Porównanie jest więc uczciwe mimo asymetrii migracji. Weryfikacja wchodzi do
harnessu jako **asercja startowa**, nie jako założenie.

**D7 (fakt) — brak cieniowania i brak nadpisania tras przez łatki.** `listHistory` i `listAudit`
mają po jednym wystąpieniu w `mirror/backend/index.cjs`; żaden `patch_*.cjs` ich nie dotyka.
`pagination_module.cjs:134-181` rejestruje `/meta` i `/paged` PONOWNIE z `requireAuth`, ale
zawsze PO rdzeniu (ładowany z `extensions.cjs:448-452` oraz wprost z `index.cjs`) — Express
bierze pierwszy handler, więc w produkcji wygrywa wariant BEZ auth.

**D8 (fakt) — scheduler oryginału nie pisze do `audit_log` ani `history`** (`L4()`/`D4()` wołają
wyłącznie `addAlert`/`updateSupplier`), więc tło nie zafałszuje liczby wierszy. Wygaszamy go
i tak — z powodu realnego `fetch()` po URL-e dostawców w ciągu 60 s od startu.

## Implementation plan

### Krok 1 — piaskownica obu stron (`skrypt/00-piaskownica`)

Przepis wzięty z `tools/record-write-fixtures.cjs`, nie wymyślany od nowa.

**Oryginał** (funkcje `zbudujPiaskownice`, `zainstalujZaleznosci`, `uruchomOryginal`):
kopia całego `mirror/backend` do katalogu tymczasowego, `db/snapshot.db` jako `data.db` OBOK
`index.cjs`, `npm install`, `UPDATE suppliers SET czestotliwosc_minuty = NULL` **przed**
startem, CWD = katalog piaskownicy, port efemeryczny, gotowość = `GET /api/me` → 401.
⚠ **Bez `przygotujBaze()`/`migrujKonwencje()`** — nasze migracje do wyroczni nie wchodzą (D2).
Kontrola w logu startu: `[scheduler] zaplanowano 0 dostawców z URL polling`.

**Odbudowa**: druga kopia tego samego `db/snapshot.db`, `DB_PATH` na nią, `npm run migrate:dev`,
`stworzApp(...)` + `listen(0)`.

**Logowanie — symetryczne.** `POST /api/login {email, password}` po OBU stronach, konto
`marta.bieguniak@agrowiec.eu`. Hasło do kopii snapshotu jest już znane i używane w repo
(`tools/record-write-fixtures.cjs:71-72,529-544`) — nie podmieniamy hashy i nie sięgamy po
sekrety. Oryginał na `/meta` i `/paged` auth nie wymaga; logujemy się do niego i tak, żeby obie
strony szły tą samą drogą i żeby zadanie B mogło wykonać edycję.

**Asercje startowe (STOP, jeśli nie przejdą):** `history` i `audit_log` mają po obu stronach
identyczną liczbę wierszy i identyczny `pragma table_info`; migracje niczego w nich nie
zmieniły (D6).

### Krok 2 — zadanie A: oracle diff (`skrypt/10-diff-historii`)

Siatka przypadków, każdy odpytany po obu stronach i porównany:

| Trasa | Przypadki |
|---|---|
| `/api/history` | bez parametrów (pełna tablica, 46 916 wierszy) |
| `/api/history/meta` | bez parametrów |
| `/api/history/paged` | bez filtrów; `typ` ∈ {all, import, eksport, edycja}; `dostawca` ∈ {all + każdy kod z `/meta`}; `search` ∈ {kilka fraz trafiających w kod produktu, dostawcę, nazwę pola, „Plik:", nazwę typu}; `limit` ∈ {25, 50, 100} × `page` ∈ {1, 2, 3, ostatnia, ostatnia+1} |

Porównanie: **głęboka równość całych ciał** po odsianiu adnotacji nagrywarki, czyli komplet pól
i kolejność wierszy. Dodatkowo raportowane osobno: zestaw kluczy pierwszego wpisu (D5),
`total`/`pages`, kolejność `dostawcy` w `/meta`.

Wynik: liczba porównanych wpisów i przypadków + lista rozjazdów albo jawne „brak".

### Krok 3 — zadanie A′: przebieg z zasianą gałęzią eksportu (D3)

Świeże kopie obu baz, do `audit_log` doszyte **identyczne** wiersze `eksport_csv`,
`eksport_shoper`, `import_cennika` (te same `id`, `kiedy`, `szczegoly_json`). Powtórka siatki
z kroku 2 zawężona do `typ=eksport`, `typ=import` i przypadków bez filtra. Raport oznacza ten
przebieg jako oparty o dane **zasiane**, nie produkcyjne.

### Krok 4 — zadanie B (`skrypt/20-slad-po-edycji`)

1. Dobór produktu i pól o identycznej wartości wyjściowej po obu stronach (D2) — z zapisem,
   który produkt i dlaczego.
2. `PATCH /api/products/{id}` tym samym ciałem po obu stronach; porównanie: ile wierszy
   przybyło w `/api/history`, jakie mają `pole`/`staraWartosc`/`nowaWartosc`/`zrodlo`/`kto`,
   oraz co pojawiło się w `/paged` (typ `edycja`, `kodProduktu`, `zmienionePola`,
   `liczbaPozycji`, `uwagi`).
3. Scenariusz sondujący (D4): ciało z polem **spoza** allowlisty; zliczenie wierszy `history`
   po obu stronach → liczba dla backlogu #14.
4. Ścieżka eksportu: `GET /api/export/*` po obu stronach → czy w `audit_log` przybywa
   `eksport_csv`/`eksport_shoper` i czy widać je w `/paged`.
   ⚠ **Odbudowa TE AKCJE ZAPISUJE** (`routes/export-shoper.ts:108,133,171`) — założenie karty
   („sprawdź, czy cokolwiek w odbudowie te akcje dziś zapisuje; jeśli nie, napisz to wprost")
   jest nieaktualne i raport to prostuje liczbą.

### Krok 5 — trwały test (D1)

NOWY plik `rebuild/backend/test/historia.wyrocznia.test.ts` + plik danych z wynikiem
zapisanym z oryginału. Zasiewa prawdziwe wiersze `audit_log`/`history` ze snapshotu i asertuje
odpowiedzi oryginału dla reprezentatywnego podzbioru siatki z kroku 2.
⚠ **NIE dopisujemy do `historia.gate.test.ts`, `historia.mapowanie.test.ts` ani
`historia.odczyt.test.ts`** i nie ruszamy `contract/fixtures/` — to zakres 14k.

### Krok 6 — zadanie C

Nowy wpis **#87** w `docs/rebuild-backlog.md` o `LIMIT_AUDYTU = 5000`, w formacie istniejących
wpisów, `Do nowej wersji?` = ⬜ **do decyzji**. Nie rozstrzygamy.

### Krok 7 — raport + roadmapa

`raport.md` z: liczbą porównanych wpisów, wynikiem per trasa i per filtr, listą rozjazdów albo
jawnym „brak", wynikiem B, numerem wpisu backlogu i **wskazaniem 2–3 wpisów, które Ania ma
obejrzeć na oczy** jako kontrolę. Podblok „14j" w `docs/rebuild-roadmap.md`.

## Testing strategy

- **Gate odbudowy:** karta nie zmienia kodu produkcyjnego ani kontraktu, więc gate obowiązuje
  w wersji regresyjnej — `test/historia.gate.test.ts` (trzy ścieżki + trzy fixtures) ma nadal
  przechodzić. Zapisane w `raport.md`.
- **Oracle diff** jest pomiarem, nie testem CI — wynik idzie do raportu, a jego trwały ślad to
  test z kroku 5.
- **Nowy test** z kroku 5 uruchamia się w zwykłych bramkach (`npm test`), bez oryginału.
- Bramki backendu zielone: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`.
- Pomijamy testy frontu — karta go nie dotyka (§8.3 instrukcji, przycinanie listy pól do
  sześciu, to FE i zakres 14k).

## Out of scope

- **Naprawa czegokolwiek.** Znaleziony rozjazd → opis + propozycja osobnej karty.
- `src/historia/**` i `contract/fixtures/` historii — zakres 14k (#21).
- `src/import/**` (14i), trasy produktów i katalogu (14h), `repos/ceny.ts` i `pages/narzuty/**`
  (14f).
- Rozstrzygnięcie, czy limit 5000 zmieniamy — to decyzja użytkownika, wpis jest ⬜.
- Rozszerzenie słownika `akcja → typ` (backlog #21) — nie ta karta.
- Uzupełnienie pustych pól Ani w §8/§9 instrukcji I5 (plik leży na niezmergowanej gałęzi).

## Definition of done

- [ ] Oryginał i odbudowa postawione na kopiach tego samego `db/snapshot.db`; log oryginału
      potwierdza `0 dostawców z URL polling`
- [ ] Asercje startowe: `history`/`audit_log` identyczne po obu stronach (liczba wierszy + schemat)
- [ ] Trzy trasy porównane na komplecie pól i kolejności wierszy, z filtrami `typ`/`dostawca`/
      `search` i paginacją `limit` 25/50/100 × kolejne strony
- [ ] Zestaw KLUCZY porównany osobno (D5), nie tylko wartości
- [ ] Każde „0 różnic" w raporcie stoi razem z liczbą porównanych wpisów
- [ ] Przebieg z zasianą gałęzią eksportu wykonany i **oznaczony jako dane zasiane**
- [ ] Zadanie B: zmierzony ślad po edycji w `/api/history` i `/paged` po obu stronach
- [ ] Zadanie B: scenariusz sondujący allowlistę dał liczbę
- [ ] Zadanie B: rozstrzygnięte pomiarem, czy odbudowa zapisuje `eksport_csv`/`eksport_shoper`
- [ ] Nowy trwały test w `rebuild/backend/test/` przechodzi w bramkach
- [ ] Wpis #87 w backlogu, `Do nowej wersji?` = ⬜ do decyzji
- [ ] Raport zawiera 2–3 wpisy wskazane Ani do kontroli wzrokowej
- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` — zielone
- [ ] Zero zmian w kodzie produkcyjnym (`git diff` po `rebuild/backend/src/` pusty)
