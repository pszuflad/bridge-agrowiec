# 129-FEATURE-akceptacja-stagingu — raport z wdrożenia

## Podsumowanie

Sportowana druga połowa `staging_policy.cjs` @ `88fa31c` — ścieżka odczytu i decyzji użytkownika:
bramka akceptacji (siedem `fail()`), nadpisania dodawania i edycji zgłoszenia, rozstrzyganie
dopasowań, decyzje o nieobecnych kartach (#106) oraz **cztery** trasy HTTP (karta wymieniała dwie).
Wierność dowiedziona GATE-em charakteryzacyjnym na URUCHOMIONYM oryginale — 22 scenariusze
porównujące komunikaty i stan pięciu tabel. Odstępstwo 14i zdjęte decyzją D4. Pomiar #107 wykonany:
problem produkcji u nas nie występuje, ale pomiar odsłonił inny, realny koszt (niżej).

## Zmiany

**Nowe — port polityki:**
- `rebuild/backend/src/import/polityka/helpery.ts` — most ESM→CJS do `staging_policy.cjs`
  (`validateEan`, `rawEan`, `syntheticCode`, `compatibility`, `identity`, `norm`, `version`)
  plus `hash`, `KEYS` i `BladPolityki`/`odmow` (odpowiednik `fail()`, zawsze 409).
- `rebuild/backend/src/import/polityka/kontekst.ts` — helpery domknięć `install()`:
  `produktPoKodzie`, `pozycjaStagingu`, `usunZgloszeniaPary`, `chron` (`protect`),
  `wstrzymajAutomatycznie` (`suspend`).
- `rebuild/backend/src/import/polityka/blokady.ts` — `checkAcceptance`, siedem `fail()`.
- `rebuild/backend/src/import/polityka/akceptacja.ts` — `acceptStaging` jako WARSTWA.
- `rebuild/backend/src/import/polityka/zgloszenia.ts` — `addStaging`, `updateStaging`, `resolveStaging`.
- `rebuild/backend/src/import/polityka/nieobecne.ts` — `closeAbsenceReview`, `chooseAbsenceCard` (#106).
- `rebuild/backend/src/import/polityka/kod-importu.ts` — nadpisanie `assignKodImportu`.
- `rebuild/backend/src/routes/staging-polityka.ts` — cztery trasy.

**Zmienione:**
- `rebuild/backend/src/import/akceptacja.ts` — nadawanie `kodImportu` wstrzykiwane
  (`NadawanieKoduImportu`, domyślnie stara wersja); **usunięte odstępstwo 14i**.
- `rebuild/backend/src/routes/staging-mutacje.ts` — `accept` przez politykę + odtworzenie
  kształtu błędu; `PUT /{id}` przez `zaktualizujZgloszenie`.
- `rebuild/backend/src/app.ts` — rejestracja tras polityki.
- `contract/openapi.yaml` — cztery trasy z realnymi kształtami żądań i odpowiedzi.

**Testy:**
- **Nowe:** `test/polityka.charakteryzacja.test.ts` (22), `test/staging-polityka.trasy.test.ts` (14),
  `test/charakteryzacja/polityka/oryginal.mjs` + `.d.mts` (harness).
- **Zmienione:** `test/akceptacja.odstepstwa.test.ts` — przepisany z „odstępstwo 14i obowiązuje"
  na „14i zdjęte, port == produkcja" + dwa nowe testy blokady D4;
  `test/staging-mutacje.test.ts` — zasiew niesie `_policyVersion`/`_catalogVersion`.
- **Nowe narzędzie:** `rebuild/backend/scripts/pomiar-107.ts` — powtarzalny pomiar.

## Odstępstwa od planu

**Jedno, uzgodnione z użytkownikiem w trakcie (D129.8).** Plan nie przewidywał, że `_policyVersion`
ustawia WYŁĄCZNIE `importer()` (`:428`, `:571`, `:588`, `:606`) — czyli kod karty I15.4b. Do czasu
jej merge'a bramka odrzuca każdą pozycję z obecnego importera. Decyzja użytkownika: **wepnij teraz,
popraw testy** — `POST /api/staging/accept` idzie przez politykę, a zasiew w `staging-mutacje.test.ts`
niesie pola polityki. **Konsekwencja operacyjna w Follow-up.**

**Drugie odstępstwo — niewykonana część D129.7.** Plan zapowiadał przepisanie scenariusza
„EAN w notacji naukowej" w `test/silnik.gate.test.ts` na oczekiwaną blokadę. **Nie zrobione i nie
powinno być zrobione w tej karcie.** Ten test sprawdza, co produkuje SILNIK IMPORTU (`tk.ts`):
pozycja wchodzi do stagingu pod własnym kodem dostawcy z `ean: null`. Moja karta nie dotyka silnika,
więc te asercje są nadal PRAWDZIWE i test przechodzi. Zmieniło się co innego: takiej pozycji nie da
się już ZAAKCEPTOWAĆ — i to jest pokryte w `test/akceptacja.odstepstwa.test.ts`
(„blokada oddaje 409 i DOSŁOWNY komunikat"). Komentarz w `silnik.gate.test.ts` mówi wprost
„przy porcie SILNIKA w I15.4 trzeba go przepisać" — port silnika to karta I15.4b, więc przepisanie
należy do niej. Pliku nie ruszam, żeby nie wejść w wiersze równoległej sesji (ticket 130).
Zgłoszone w „Do koordynatora" karty i w Follow-up.

Poza tym plan zrealizowany 1:1, łącznie z czterema trasami (D129.1) i pełnym zestawem blokad (D129.2).
Doprecyzowanie: `checkAcceptance` ma **siedem** `fail()` (brak wiersza + sześć blokad treści), nie
sześć — plan poprawiony w trakcie.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt):** ✓ — z zastrzeżeniem, że dla czterech tras tego ticketa
  **fixtures nie istnieją** (`contract/fixtures/` ma tylko `GET_staging.json`
  i `GET_staging_paged.json`, oba dotyczą odczytu listy). Zgodnie z decyzją D129.5 gate zbudowany
  inaczej i **mocniej**: `test/polityka.charakteryzacja.test.ts` ładuje PRAWDZIWY
  `staging_policy.cjs` @ `88fa31c`, instaluje go przez `install()` na `U` wyciętym z produkcyjnego
  bundla i porównuje z portem **komunikat + status + stan pięciu tabel** (`products`,
  `staging_items`, `staging_matches`, `product_auto_suspensions`, `staging_absence_decisions`)
  w 22 scenariuszach. Dwa istniejące fixtures stagingu przechodzą bez zmian.
- **Kontrakt:** ✓ — cztery trasy dopisane do `contract/openapi.yaml`, plik parsuje się jako YAML,
  odpowiedzi tras zgodne z opisanymi kształtami (sprawdzone testami HTTP).
- **Charakteryzacja polityki:** ✓ 23/23 (w tym scenariusz regresyjny z review) — w tym siedem blokad co do znaku, kolejność blokad,
  obie gałęzie wyboru karty (#106).
- **Testy HTTP tras:** ✓ 14/14 — kody 200/401/404/409, kształt `{message}`, wpisy audytu.
- **Pełny przebieg:** ✓ **1799 testów w 109 plikach** (przed ticketem 1761 w 107).
- **Bramki:** `lint` ✓, `typecheck` ✓, `build` ✓, `test` ✓ (Node 20.20.2, `SNAPSHOT_DB` ustawione).

### Pomiar #107 — wykonany, wynik NIEOCZYWISTY

Metoda: kopia `db/snapshot.db` (7405 produktów), 200 pozycji zatwierdzanych po kolei,
`rebuild/backend/scripts/pomiar-107.ts`. ⚠ Baza jest z **2026-08-13**, nie z 23.09 — staging to
serwer zdalny, lokalnie innej kopii nie ma (decyzja D129.6).

| wariant | średnia/pozycja | mediana | p95 | najwolniejsza | 200 pozycji |
|---|---|---|---|---|---|
| bazowy (grupowanie po EAN) | **6,7 ms** | 6,3 ms | 10,8 ms | 20,0 ms | 1,3 s |
| Staging v2 (`compatibility()`) | **386,0 ms** | 344,1 ms | 588,8 ms | 863,7 ms | **77,2 s** |

**1. Problem z backlogu #107 NIE WYSTĘPUJE.** Pięć sekund na pozycję brało się z OSOBNEGO
połączenia do bazy w `uwaga_cena_patch.cjs`, które czekało na naszą blokadę zapisu. Odbudowa ma
jedno połączenie i `uwagaCena` jako kolumnę modelu, więc nie ma na co czekać — najwolniejsza
pozycja to 0,86 s, czyli ~6× poniżej progu. **Łatki nie portujemy** (i nie ma czego portować).

**2. Pomiar odsłonił INNY koszt, którego backlog nie opisuje.** Staging v2 jest **58× wolniejszy
od wariantu bazowego** i przyczyna jest zmierzona, nie domniemana: nadpisane `assignKodImportu`
(`staging_policy.cjs:145`) woła `U.listProducts()` dla KAŻDEJ pozycji i przepuszcza cały katalog
przez `compatibility()`. Mikropomiar na tej samej bazie: `listaProduktow()` 251,7 ms
+ `compatibility()` po 7405 wierszach 116,4 ms = **368,2 ms**, czyli **95 % z 386 ms**.

**To jest zachowanie PRODUKCJI, nie nasz regres** — tam stoi dokładnie ten sam kod. Dlatego zgodnie
z regułą karty („zmierz i opisz — nie portuj mechanicznie") **niczego nie optymalizuję**; optymalizacja
byłaby odstępstwem wymagającym decyzji użytkownika. Skala praktyczna: zatwierdzenie całego stagingu
z kopii produkcji (2502 pozycje po migracji 012) zajęłoby **ok. 16 minut**.

## Zmiany łamiące zgodność

**Jedna, świadoma i uzgodniona:** `POST /api/staging/accept` odrzuca teraz pozycje bez
`_policyVersion` (409, „To zgłoszenie pochodzi ze starego importu…"). Do czasu merge'a karty I15.4b
dotyczy to **wszystkich** pozycji z obecnego importera. Patrz „Odstępstwa od planu" i Follow-up.

Drugorzędnie: `POST /api/staging/accept` może teraz zwrócić **409 z `{message}`** — wcześniej ta
trasa zwracała wyłącznie 200. Trasy polityki używają klucza `message`, nie `error`; to wierne
odtworzenie (dwa osobne moduły produkcji), nie do ujednolicenia.

## Poprawki po review

- **BLOCKER (wierność) — `rozstrzygnijZgloszenie` gubiło drugie czyszczenie pary.** Oryginał
  (`:245`) woła NADPISANE `U.addStaging`, które czyści parę `(dostawca, kod)` jeszcze raz, tym
  razem dla kodu DOCELOWEGO (`:165`). Port wołał wersję bazową, więc `action: "link"` na kod,
  pod którym wisiało już inne zgłoszenie, wywracał się o indeks unikalny
  `staging_one_current_product` — surowe 500 z treścią SQL-a zamiast zastąpienia zgłoszenia.
  Naprawione (`zgloszenia.ts:166`). Dołożony scenariusz regresyjny do GATE-u; **sprawdzone, że
  naprawdę łapie**: z poprzednią wersją test pada na
  `UNIQUE constraint failed: staging_items.dostawca, staging_items.kod`. GATE miał tu lukę —
  żaden scenariusz `resolveStaging` nie zasiewał konkurencyjnego zgłoszenia dla kodu docelowego.
- **SHOULD-FIX — `silnik.gate.test.ts`:** patrz „Odstępstwa od planu"; świadomie zostawione
  karcie I15.4b, teraz opisane wprost zamiast milczeniem.

## Follow-up

1. **⚠ NAJWAŻNIEJSZE — kolejność merge'a z I15.4b (ticket 130).** Akceptacja działa poprawnie
   dopiero na pozycjach z `_policyVersion`, które nadaje `importer()` z tamtej karty. Obie karty
   powinny wejść do `develop` w tej samej fali. Gdyby 130 się opóźniła, na `develop` akceptacja
   stagingu jest w praktyce zablokowana.
2. **Globalny error middleware.** Produkcja ma go w `:48977-48982` (`status = e.status ||
   e.statusCode || 500`, ciało `{message}`); odbudowa nie ma. Odtworzyłem jego kształt lokalnie
   w trasie `accept`, żeby nie zmieniać zachowania innych tras. Dołożenie go globalnie to osobny
   ticket — wtedy lokalny `try` z `staging-mutacje.ts` można usunąć.
3. **`U.updateProduct` override (`:113-119`) nie ma gospodarza.** W produkcji jawny wybór statusu
   przez człowieka kasuje znacznik automatycznego wstrzymania — dla KAŻDEGO wywołania, także
   z `PUT /api/products/:id`. `repos/products.ts` i trasy katalogu nie należą do tej karty,
   więc tego nie ruszam. Skutek różnicy: ręczne odwstrzymanie produktu nie zdejmuje znacznika,
   więc następny import może go wstrzymać ponownie. Zapisane w „Do koordynatora".
4. **`bulk.ts` zostaje na starym grupowaniu `kod_importu`.** W produkcji nadpisanie jest globalne,
   więc obejmuje też `addProductsBulk`. Nie ruszam go, bo jego harness charakteryzacyjny
   (`test/charakteryzacja/bulk/`) porównuje z oryginałem BEZ `install()` i wymagałby tego samego
   zabiegu z wstrzykiwaniem, co `akceptacja.ts` — plus decyzji, czy przenagrać wzorzec.
5. **Wydajność zatwierdzania zbiorczego** — patrz pomiar #107 punkt 2. Do decyzji użytkownika,
   czy odstępować od produkcji (np. cache katalogu na czas partii).
6. **`zapiszPozycjeStagingu` a `dodajPozycjeBazowo`.** Mam własny odpowiednik `U.addStaging`
   (`:44923`), bo wersja wsadowa w `repos/staging.ts` ma tę logikę wpisaną w pętlę, a plik karmi
   importer karty I15.4b. Po scaleniu obu kart warto, żeby wsad wołał jedną funkcję.
7. **Przepisanie scenariusza „EAN w notacji naukowej"** w `test/silnik.gate.test.ts` — należy
   do karty I15.4b razem z portem silnika. Komentarz w tym teście opisuje dziś okno przejściowe
   i po stronie akceptacji jest już nieaktualny.
8. **`PustyImportBlad` vs `feed_safety`** (`wejscie-120.md` pkt 3) — rozstrzygnięcie siedzi
   w `parsuj.ts`, czyli w plikach I15.4b. Nie moja karta; zgłoszone koordynatorowi.
