# I15.4c — akceptacja: blokady `checkAcceptance`, cztery trasy polityki, decyzje o nieobecnych kartach

> **Stan:** ✅ 2026-09-23 · `129-FEATURE-akceptacja-stagingu`
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #99, #103, #104, #105, #106, #107 (wg zakresu) · **Zależy od:** I15.4a (tabele)
> **Ticket:** `129-FEATURE-akceptacja-stagingu` (PR do `develop`)

Założona przez koordynatora ticketem `123-DOCS-podzial-i15-4`, 2026-09-23 — **podział dawnej karty I15.4** (665 linii
`staging_policy.cjs`, 5 nowych tabel, podmiana rdzenia importu to za dużo na jeden przegląd; decyzja użytkownika 23.09).
Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”. Materiał wspólny: wejścia w katalogach kart.

## Zakres
Druga połowa `staging_policy` — **ścieżka odczytu i decyzji użytkownika**:

- **`checkAcceptance` — SIEDEM `fail()`, wszystkie 409, komunikaty DOSŁOWNIE** (#99). Pierwotny opis karty
  wymieniał cztery; ticket 129 zmierzył w oryginale (`:188-200`) siedem i odtworzył wszystkie: brak wiersza ·
  `_absenceReview` (sprawa starej karty ma własną ścieżkę) · brak trzech dowodów nieobecności przy wycofaniu ·
  brak `_policyVersion` („Odśwież cennik przed akceptacją”) · nierozstrzygnięte dopasowanie · błędny EAN (D4) ·
  `_catalogVersion` (produkt zmienił się po utworzeniu zgłoszenia).
  **Atomowość jest PER POZYCJA, nie per żądanie** — `POST /api/staging/accept` woła akceptację w pętli
  bez `try`/`catch` (`deminified/backend-index.cjs:48544`), więc pierwsza zablokowana pozycja przerywa całe
  żądanie, a wcześniejsze zostają zatwierdzone. Ochrona ręcznych poprawek przez `protect()`, bez osobnego błędu;
- **dodawanie i edycja zgłoszenia:** nowe zgłoszenie zastępuje poprzednie tej samej pary `(dostawca, kod)`;
  edycja przelicza status EAN (`eanRaw`, `eanIsValid`, `eanSourceStatus`);
- **CZTERY trasy** (pierwotny opis karty wymieniał dwie; `registerRoutes` `:620-664` ma cztery):
  `GET /api/staging/:id/review`, `POST /api/staging/:id/resolve` (`action`, `targetCode`),
  `POST /api/staging/:id/choose-absence-card` (`selectedCode`, `candidateVersion`) i
  `POST /api/staging/:id/close-absence-review` — te dwie ostatnie wystawiają #106.
  Opisane w `contract/openapi.yaml`. **Nagrań z oryginału nie ma i nie było czego nagrywać** —
  `contract/fixtures/` nie zawiera nic dla tych tras; dowodem wierności jest GATE różnicowy
  na uruchomionym `staging_policy.cjs` (D129.5);
- **decyzje o nieobecnych kartach (#106):** zapis do `staging_absence_decisions`, sprawa nie wraca przy kolejnym
  imporcie, a zmiana kodu, EAN lub DOT otwiera ją ponownie; porównanie starej karty z ofertą uwzględnia DOT
  (różne DOT nie tworzą zgłoszenia o scaleniu); wybór jednej karty przy naprawdę zgodnych (niewybrana zostaje
  wstrzymana, wybrana w katalogu, zapamiętany kod źródłowy);
- **#107 — wydajność:** ZMIERZONE, wynik w „Dowiezione”. Problem produkcji u nas nie występuje; pomiar odsłonił
  natomiast inny, realny koszt (grupowanie `kod_importu` przez `compatibility()`), którego backlog nie opisywał.
  ⚠ Pomiar wykonany na kopii `db/snapshot.db` z **13.08**, nie na kopii z 23.09 — staging to serwer zdalny
  i lokalnie innej bazy nie ma (D129.6).

## Pliki (wyłączna własność)
Repozytoria i trasy stagingu (akceptacja, `review`, `resolve`, `choose-absence-card`,
`close-absence-review`), `contract/openapi.yaml` (**cztery** trasy), testy akceptacji i tras.
NIE: `import/tk.ts` i `parsuj.ts` (I15.4b), migracja, model i `repos/staging-polityka.ts` (I15.4a),
frontend (I15.5, I15.11), `src/import/bulk.ts` i `repos/products.ts` (bez gospodarza — patrz „Do koordynatora”).

## Decyzje
**Decyzje użytkownika (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na istniejące obiekty ·
D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2 przenosimy ·
D4 błędny EAN = błąd blokujący akceptację (zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
⭐ **Produkcja zamrożona — Ania skończyła 23.09 i czeka na nową wersję do testów. Źródło prawdy: `origin/main`
na commicie `88fa31c` (23.09 13:00).** Nowy commit z kodem na `main` = ZATRZYMAJ SIĘ i zgłoś użytkownikowi.


## Dowiezione

**Zakres dowieziony w całości i SZERZEJ, niż zakładała karta** (ticket `129-FEATURE-akceptacja-stagingu`,
2026-09-23). Bramki rozliczone: `lint`/`typecheck`/`build` ✓, `npm test` ✓ **1800 testów w 109 plikach**
(przed kartą 1761 w 107), Node 20.20.2, `SNAPSHOT_DB` ustawione.

### Co weszło

- `src/import/polityka/` — siedem modułów portu `staging_policy.cjs:141-331`:
  `helpery.ts` (most ESM→CJS do niezminifikowanego oryginału + `hash`, `KEYS`, `BladPolityki`),
  `kontekst.ts` (`protect`, `suspend`, czyszczenie pary), `blokady.ts` (`checkAcceptance`),
  `akceptacja.ts` (warstwa nad `zatwierdzPozycjeStagingu`), `zgloszenia.ts`
  (`addStaging`/`updateStaging`/`resolveStaging`), `nieobecne.ts` (#106), `kod-importu.ts`.
- `src/routes/staging-polityka.ts` — **cztery** trasy + `contract/openapi.yaml` z realnymi kształtami.
- `test/polityka.charakteryzacja.test.ts` (23) + harness `test/charakteryzacja/polityka/oryginal.mjs`,
  `test/staging-polityka.trasy.test.ts` (14), `scripts/pomiar-107.ts`.

### Gdzie karta odbiegła od pierwotnego założenia (decyzje użytkownika, 2026-09-23)

1. **CZTERY trasy, nie dwie (D129.1).** Zakres karty wymieniał `review` i `resolve`; `registerRoutes`
   (`:620-664`) ma też `POST /choose-absence-card` (`:640`) i `POST /close-absence-review` (`:649`) —
   czyli dokładnie te, które wystawiają #106. Bez nich logika decyzji o nieobecnych kartach byłaby
   wdrożona, ale niewywoływalna, a I15.11 nie miałaby czego wołać.
2. **SIEDEM `fail()` w `checkAcceptance`, nie „cztery blokady" (D129.2).** Poza czwórką z nagłówka
   karty są: `_absenceReview` (`:192`), próg trzech dowodów nieobecności (`:193`, opisany w karcie
   osobno w `wejscie-110.md` pod #103) i `_catalogVersion` (`:198`). Wszystkie odtworzone,
   komunikaty zweryfikowane porównaniem ciągów znak w znak.
3. **Dowód wierności inny niż fixtures (D129.5).** Dla tych tras `contract/fixtures/` NIE MA nic
   (są tylko `GET_staging.json` i `GET_staging_paged.json`, oba o odczycie listy). Zamiast nagrań
   powstał GATE różnicowy: harness `require()`uje PRAWDZIWY `staging_policy.cjs` @ `88fa31c`,
   wykonuje `install()` na `U` wyciętym z produkcyjnego bundla i porównuje z portem **komunikat +
   status + stan pięciu tabel** w 23 scenariuszach.
4. **Odstępstwo 14i ZDJĘTE (D129.7).** D4 rozwiązuje ten sam problem wcześniej — zepsuty EAN nie
   wchodzi do akceptacji. Zerowanie `ean` usunięte z `import/akceptacja.ts`,
   `test/akceptacja.odstepstwa.test.ts` przepisany z „odstępstwo obowiązuje" na „zdjęte, port ==
   produkcja" plus dwa testy samej blokady.
5. **`assignKodImportu` wstrzykiwane, nie podmieniane globalnie (D129.4).** W produkcji to globalny
   monkey-patch; u nas `zatwierdzPozycjeStagingu` dostało parametr `nadajKod` (domyślnie stara
   wersja), a politykową wersję podaje warstwa. Powód: `silnik/bridge-ext.ts` dzieli z nami
   równoległa karta I15.4b, a harness charakteryzacyjny bazowej akceptacji tnie oryginał BEZ
   `install()`, więc musi dalej widzieć stare grupowanie.

### ⚠ POMIAR #107 — wykonany, wynik dwuczęściowy

Metoda: kopia `db/snapshot.db` (7405 produktów), 200 pozycji, `rebuild/backend/scripts/pomiar-107.ts`.
⚠ Baza z **2026-08-13**, nie z 23.09 — staging to serwer zdalny, lokalnie innej kopii nie ma (D129.6).

| wariant | średnia/pozycja | mediana | p95 | najwolniejsza | 200 pozycji |
|---|---|---|---|---|---|
| bazowy (grupowanie po EAN) | **6,7 ms** | 6,3 ms | 10,8 ms | 20,0 ms | 1,3 s |
| Staging v2 (`compatibility()`) | **386,0 ms** | 344,1 ms | 588,8 ms | 863,7 ms | **77,2 s** |

**(a) Problemu z #107 u nas NIE MA.** Pięć sekund na pozycję brało się z OSOBNEGO połączenia do bazy
w `uwaga_cena_patch.cjs`, czekającego na blokadę zapisu. Mamy jedno połączenie i `uwagaCena` jako
kolumnę modelu — najwolniejsza pozycja to 0,86 s, ~6× poniżej progu. **Łatki nie portujemy.**

**(b) Pomiar odsłonił INNY koszt, którego backlog nie opisuje.** Staging v2 jest **58× wolniejszy**
od wariantu bazowego. Przyczyna ZMIERZONA, nie domniemana: nadpisane `assignKodImportu` (`:145`)
woła `U.listProducts()` dla KAŻDEJ pozycji i przepuszcza cały katalog przez `compatibility()`.
Mikropomiar: `listaProduktow()` 251,7 ms + `compatibility()` po 7405 wierszach 116,4 ms =
**368,2 ms, czyli 95 % z 386 ms**. **To jest kod PRODUKCJI, nie nasz regres** — zgodnie z regułą
karty („zmierz i opisz — nie portuj mechanicznie") niczego nie optymalizowałem. Skala praktyczna:
zatwierdzenie całego stagingu z kopii produkcji (2502 pozycje po migracji 012) to **ok. 16 minut**.

### Błąd złapany w code review (wart zapamiętania)

`resolveStaging` gubiło DRUGIE czyszczenie pary. Oryginał (`:245`) woła **nadpisane** `U.addStaging`,
które czyści `(dostawca, kod)` jeszcze raz — tym razem dla kodu DOCELOWEGO (`:165`). Port wołał
wersję bazową, więc `action: "link"` na kod, pod którym wisiało już inne zgłoszenie, wywracał się
o indeks unikalny `staging_one_current_product` surowym 500 z treścią SQL-a. **Morał: przy porcie
monkey-patcha sprawdź, czy wołasz wersję NADPISANĄ, czy bazową — `original.*` w oryginale znaczy
„przed podmianą" i to rozróżnienie niesie zachowanie.** GATE tego nie łapał, bo żaden scenariusz
nie zasiewał konkurencyjnego zgłoszenia dla kodu docelowego; scenariusz dołożony.

## Do koordynatora

### 1. ⚠ KOLEJNOŚĆ MERGE'A z I15.4b (ticket 130) — najważniejsze

`_policyVersion: 2` ustawia **wyłącznie** `importer()` (`staging_policy.cjs:428`, `:571`, `:588`,
`:606`), czyli kod karty I15.4b. Blokada 3/7 (`:194`) odrzuca każdą pozycję bez tego pola. Skutek:
**do czasu merge'a I15.4b akceptacja na `develop` odrzuca wszystko, co produkuje obecny importer**
komunikatem „To zgłoszenie pochodzi ze starego importu. Odśwież cennik przed akceptacją.".

Decyzja użytkownika z 2026-09-23 (D129.8): **wpinamy mimo to**, bo obie karty idą tą samą falą.
**Obie powinny wejść do `develop` razem.** Gdyby I15.4b się opóźniła, akceptacja stagingu jest
na `develop` praktycznie zablokowana — to nie defekt, tylko skutek podziału karty I15.4.

### 2. Statusy backlogu podniesione decyzją D129.3

W `docs/rebuild-backlog.md` **tylko #99** miało `✅ TAK`; #103/#104/#105/#106/#107 miały
`⬜ do decyzji`. Decyzja użytkownika z 2026-09-23: **`88fa31c` traktujemy jako decyzję już podjętą**
(D3 „Staging v2 przenosimy" obejmuje całość zamrożonej produkcji, a moduł już te warstwy zawiera).
Podniosłem statusy wpisów, których ten ticket faktycznie dotknął. Szczegóły i zakres:
`docs/rebuild-backlog/wpis-129.md`.

### 3. `U.updateProduct` override (`:113-119`) NIE MA GOSPODARZA

W produkcji jawny wybór statusu przez człowieka kasuje znacznik automatycznego wstrzymania — dla
KAŻDEGO wywołania `U.updateProduct`, także z `PUT /api/products/:id`. To monkey-patch zakładany
przez `install()`. `repos/products.ts` i trasy katalogu nie należą ani do I15.4a, ani do I15.4b,
ani do tej karty, więc **nikt tego nie portuje**.

**Skutek różnicy:** ręczne odwstrzymanie produktu nie zdejmuje wiersza z `product_auto_suspensions`,
więc następny import może go wstrzymać ponownie — dokładnie ta sytuacja, przed którą broni #104
(„ręczne wstrzymania chronione"). **Do przypisania w następnej fali.**

### 4. `bulk.ts` zostaje na starym grupowaniu `kod_importu`

W produkcji nadpisanie `ext.assignKodImportu` jest globalne, więc obejmuje też `addProductsBulk`
(`src/import/bulk.ts:116`). Nie ruszam go z dwóch powodów: nie jest plikiem tej karty, a jego
harness charakteryzacyjny (`test/charakteryzacja/bulk/`) porównuje z oryginałem **bez** `install()`,
więc wymagałby tego samego zabiegu z wstrzykiwaniem co `akceptacja.ts` **plus decyzji, czy
przenagrać wzorzec**. Do przypisania osobno.

### 5. `test/silnik.gate.test.ts` — komentarz częściowo nieaktualny

Scenariusz „EAN w notacji naukowej — D4 daje ean=null, pozycja wchodzi pod własnym kodem"
(`:222-246`) opisuje okno przejściowe i zapowiada przepisanie „przy porcie SILNIKA w I15.4".
Port silnika to **I15.4b**, nie ta karta — moje zmiany nie dotykają `tk.ts`, więc asercje są nadal
prawdziwe i test przechodzi. Zmieniło się to, że taka pozycja nie da się już ZAAKCEPTOWAĆ (pokryte
w `test/akceptacja.odstepstwa.test.ts`). **Przepisanie należy do I15.4b**; pliku nie ruszałem, żeby
nie wejść w wiersze równoległej sesji.

### 6. Odbudowa nie ma globalnego error middleware

Produkcja ma go w `deminified/backend-index.cjs:48977-48982`
(`status = e.status || e.statusCode || 500`, ciało `{message}`). W `rebuild/` go nie ma, więc
wyjątek rzucony w trasie wychodzi jako HTML-owe 500 Express-a. Odtworzyłem jego kształt **lokalnie**
w trasie `POST /api/staging/accept`, żeby nie zmieniać zachowania innych tras w cudzych zakresach.
**Dołożenie go globalnie to osobny ticket** — wtedy lokalny `try` z `staging-mutacje.ts` znika.

### 7. Wydajność zatwierdzania zbiorczego — do decyzji

Patrz pomiar #107 punkt (b): 386 ms na pozycję, z czego 95 % to `listProducts()` +
`compatibility()` w nadpisanym `assignKodImportu`. Wierne wobec produkcji, więc **nie zmieniam**.
Jeśli 16 minut na pełny staging jest nie do przyjęcia dla Ani, potrzebna jest **decyzja
o świadomym odstępstwie** (np. cache katalogu na czas partii) — nie mieści się w regule 1:1.

### 8. Drobiazg: testy czułe na obciążenie maszyny

Przy `load average ≈ 22` (równoległe karty) potrafią wypaść na timeoucie
`test/alerty-katalogu.gate.test.ts` („paczka 20 000 id" — już odnotowane przez I15.4a),
`test/silnik.charakteryzacja.test.ts` (MO1/MO2/MO5) i `test/scheduler.test.ts`. **Osobno wszystkie
przechodzą**, a przy spokojnej maszynie pełny przebieg jest zielony (1800/1800, 154 s). Żaden
z nich nie dotyka kodu tej karty. Progi warte podniesienia osobnym ticketem.
