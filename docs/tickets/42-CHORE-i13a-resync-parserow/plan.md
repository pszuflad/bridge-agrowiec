# 42-CHORE-i13a-resync-parserow — I13/13a: re-sync warstwy parserów z produkcji 08.09

> Status: Draft → Approved → Implemented → Shipped
> Branch: `chore/42-i13a-resync-parserow`
> Worktree: `.worktrees/42-CHORE-i13a-resync-parserow`

## Opis ticketa

13a — Iteracja 13: re-sync warstwy parserów z produkcji 08.09 (FUNDAMENT I13).

Producent milczał 25.08–08.09; dwa tygodnie zmian Ani wciągnięto ręcznie w commit `6872aea`
na gałęzi `main` — to ŹRÓDŁO PRAWDY dla I13. Na `develop` `mirror/` jest ŚWIADOMIE cofnięty
do 25.08, żeby bramki wierności były zielone (rewert `6594525`). Zasada I13: każda karta
dociąga TYLKO swój wycinek `mirror/` z `main`, razem z portem i przenagraniem bramek —
develop zostaje zielony po każdej karcie. NIE merge'ować całego `main` w `develop`.

Zadanie: zaktualizować bajt-w-bajt kopie parserów w `rebuild/backend/src/import/legacy/`
do stanu produkcji 08.09 i odświeżyć charakteryzację. To FUNDAMENT — karty 13b (silnik)
i 13c (migracje) zależą od 13a.

Mechanika: dla KAŻDEGO pliku z listy aktualizujemy RÓWNOLEGLE dwie kopie z `main`
(`git checkout main -- <ścieżka>`): oracle `mirror/backend/<plik>` i port
`rebuild/backend/src/import/legacy/<odpowiednik>` — żeby test byte-for-byte porównywał
świeży port ze świeżym oryginałem, a field-char liczył się na stanie 08.09.

## Kontekst (ustalenia researchera — zweryfikowane w repo)

**`6872aea` w warstwie parserów rusza DOKŁADNIE 9 plików** (`git diff 6872aea^..6872aea --numstat`):

| Plik (`mirror/backend/`) | +/- |
|---|---|
| `common.cjs` | +23/-1 |
| `parsers/adapter.cjs` | +9/-3 |
| `parsers/tyre_params.cjs` | +132/-34 |
| `parsers/mo1_bohnenkamp.cjs` | +4/-1 |
| `parsers/mo2_jmk.cjs` | +13/-10 |
| `parsers/mo6_agrowiec.cjs` | +13/-10 |
| `parsers/mo7_nokian.cjs` | +14/-11 |
| `parsers/mo8_trelleborg.cjs` | +81/-3 |
| `parsers/mo9_agrorami_api.cjs` | +47/-11 |

Lista z promptu jest **kompletna i poprawna**. Brak `parsers/mo4_mo5_handlopex.cjs` NIE jest
błędem: zmiana **b10** („Handlopex sufiksy w polu `model`") siedzi w `tyre_params.cjs`
(`extractHandlopexModel`, `HANDLOPEX_STOPWORDS_RE`, wołane z `normalizeHandlopex` w tym samym
pliku), a `mo4_mo5_handlopex.cjs` ma 0 zmian od baseline `e03e2aa`. Potwierdzone diffem treści
i wpisami CHANGELOG (`mirror/backend/CHANGELOG.md:196-217`).

**Następny commit na `main` (`d88ac15`) rusza tylko `tools/vps-sync.sh`** — `6872aea` jest
ostatnim stanem warstwy parserów na 08.09.

**Stan wyjściowy `develop`:** rewert `6594525` cofnął wszystkie 9 plików bez wyjątku;
`git diff origin/develop main -- <9 ścieżek>` daje identyczny diff jak `6872aea^..6872aea`.
`cmp` mirror↔port zielone dla wszystkich 9 — dziś oba są na 25.08.

**Odpowiedniki oracle→port** są 1:1 po nazwie (`mirror/backend/X` → `src/import/legacy/X`).
Pliki obecne tylko w porcie (`parsers/dispatcher.cjs`, `parsers/mo9_agrorami.cjs`,
`parsers/_agrorami_fetch_helper.cjs`) to normalne kopie z mirror, nie shimy — poza zakresem 13a
(`6872aea` ich nie ruszył). Jedyny plik spoza portu to `legacy/package.json` (marker `commonjs`).

**Konsument portu:** `rebuild/backend/src/import/parsuj.ts` (`createRequire` na
`legacy/parsers/dispatcher.cjs` + `adapter.cjs`). 13a nie zmienia tego pliku.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Brak bezpośredniego gate'a kontraktowego (`contract/openapi.yaml` / `contract/fixtures/`).**
Uzasadnienie: parsery kończą się na `adapter.recordsToSurowe()`, PRZED jakimkolwiek zapisem do
bazy — punkt przechwycenia charakteryzacji (`test/charakteryzacja/ZRODLA.md`). Żaden plik
`contract/fixtures/` nie jest nagraniem wyjścia parsera. Zmiany, które przesuną się niżej do
`GET /api/products` / analityki (Wielka litera kategorii z `katunify`, słowa konstrukcji
z `konstr`, WIELKIE nazwy z CAPS), są świadomie przypisane do **13c** (migracje + przenagranie
`katalog.gate`, `analityka.*`, `produkty.*`) — roadmapa `docs/rebuild-roadmap.md` blok I13.

**Realny GATE tej karty** to `rebuild/backend/test/charakteryzacja.test.ts`, trzy warstwy:

1. **Integralność portu** — sha256 CAŁEGO drzewa `src/import/legacy/**` vs `mirror/backend/**`
   (jedyny wyjątek: `legacy/package.json`; osobny test pilnuje, że lista wyjątków pozostaje
   jednoelementowa). Uwaga: warstwa obejmuje **całe drzewo**, nie tylko 9 plików 13a.
2. **Field-characterization** MO1–MO10 — port vs `test/charakteryzacja/MOx.expected.json`,
   porównanie pole-po-polu (`dostawca`, liczba rekordów, `odrzuconePrzezAdapter`, `bledy`,
   `odrzucone`, każde pole każdego rekordu).
3. **Przydatność próbki** — rekordy niepuste, parser bez błędów.

Regresyjnie: `rebuild/backend/test/import.test.ts` (realny `POST /api/import/parse-file`
na próbce MO1 — asercje dynamiczne przez `oczekiwaneRekordy()`, nie hardkodowane).

## Decyzje

**Domyślnie odtwarzamy 1:1 — świadomych odstępstw od zachowania produkcji 08.09 w tej karcie NIE MA.**
Kopia bajtowa z definicji odtwarza zachowanie oryginału; nie piszemy własnej logiki parsowania.

1. **Dwa commity, nie jeden** (decyzja użytkownika). Commit 1: sync mirror+port (9 plików).
   Commit 2: przenagranie charakteryzacji (`MOx.expected.json`). Powód: w diffie PR widać osobno
   „co zmieniła Ania w oryginale" vs „jak zmieniło się wyjście parserów" — to jest dokładnie ta
   różnica, której 13b/13c potrzebują. Zgodne z `ZRODLA.md` („krok 3 uruchamiaj po KAŻDEJ
   re-synchronizacji parserów").
2. **Różnica sha256 w pliku SPOZA listy 9 → STOP i zgłoszenie** (decyzja użytkownika).
   Nie rozszerzam sync'u „żeby gate był zielony". Plik spoza listy oznaczałby, że zakres 13a jest
   źle wyznaczony albo że rewert `6594525` czegoś nie cofnął — to decyzja użytkownika, nie automat.
   Odpowiada zasadzie I13 „karta dociąga TYLKO swój wycinek".
3. **Zżółknięcie wzorców charakteryzacji SILNIKA → STOP i zgłoszenie** (decyzja użytkownika).
   `test/charakteryzacja/silnik/*` i `akceptacja/*` wycinają fragmenty wprost z
   `mirror/backend/index.cjs` po kotwicach tekstowych + sha256 na wycinku; `index.cjs` NIE jest
   w zakresie 13a, więc te wzorce nie mają prawa się ruszyć. Gdyby padły — istnieje niezauważona
   zależność parsery→silnik, fakt wart zapisania dla 13b, a nie coś do cichego przenagrania.
4. **`odswinch` (#64) rozkładamy diffem i opisujemy w raporcie** — zmiana niezalogowana
   w CHANGELOG. Wstępne ustalenie researchera (do potwierdzenia w implementacji): wariant calowy
   „OD×SW-Rim" dla małych opon wózkowych (`16x6-8`, `23x10-12`), wstawiony PRZED klasyczny wzorzec
   `WxP-D`, plus rozszerzenie strażnika `isWxSxD` o wariant calowy.
5. **Decyzja 13f przyjęta do wiadomości:** backfilli nie odtwarzamy, reguły `tl_tt` B/C NIE wchodzą
   do parsera. Karta 13a nic w tej sprawie nie robi — parser i tak niesie default TL dla Ciężarowych
   i wchodzi on kopią bajtową, bez naszej ingerencji.

## Plan implementacji

**Krok 0 — punkt odniesienia.** Zapisz `sha256sum` 9 plików mirror i 9 portu PRZED zmianą
(dowód, że oba były na 25.08 i że zmieniły się razem). Uruchom pełne bramki backendu na czysto
(`lint`, `typecheck`, `test`), żeby mieć zielony baseline — inaczej nie odróżnimy regresji 13a
od zastanego czerwonego.

**Krok 1 — sync oracle + port (commit 1).**
Dla każdego z 9 plików RÓWNOLEGLE:
```
git checkout main -- mirror/backend/<plik>
git checkout main -- rebuild/backend/src/import/legacy/<plik>
```
Uwaga: ścieżka portu na `main` to ta sama względna nazwa. Jeśli `git checkout main -- <ścieżka portu>`
zawiedzie (bo na `main` port nie był aktualizowany), kopiujemy zawartość z mirror@main
(`git show main:mirror/backend/<plik> > rebuild/backend/src/import/legacy/<plik>`) — port ma być
bajt-w-bajt tym samym plikiem, więc źródłem prawdy jest mirror@main.
Po syncu: `cmp` mirror↔port dla wszystkich 9 (musi być cicho) + sha256 całego drzewa
(warstwa 1 gate'a) — TU zadziała decyzja 2, jeśli wyjdzie plik spoza listy.

**Krok 2 — rozłożenie `odswinch` (#64).**
`git diff` między `mirror/backend/parsers/tyre_params.cjs.bak_odswinch_20260904_1403` (z `main`)
a `mirror/backend/parsers/tyre_params.cjs` (z `main`). Wynik → sekcja w `raport.md`: które funkcje,
jaka semantyka, jakie wejścia zaczynają się parsować inaczej. Kopia `.bak_` NIE trafia do portu
(warstwa 1 gate'a ma test „nie wciąga kopii zapasowych" na wzorzec `\.bak_`) — sprawdź, czy jest
w ogóle śledzona w `mirror/` i czy jej zaciągnięcie nie zepsuje tego testu; jeśli tak, użyj
`git show main:<ścieżka>` do porównania bez dodawania pliku do drzewa.

**Krok 3 — przenagranie charakteryzacji (commit 2).**
Wg `test/charakteryzacja/ZRODLA.md`, z `rebuild/backend/` i z Node ≥ 20
(`export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`):
```
node scripts/charakteryzacja-probki.mjs             # MO1–MO5 z historii repo
node scripts/charakteryzacja-probki-odtworzone.mjs  # MO6, MO9 (MO7/MO8/MO10 = realne pliki, nie generowane)
node scripts/charakteryzacja-nagraj.mjs             # wzorzec z ORYGINALNYCH parserów mirror@08.09
```
`git diff` na `MOx.expected.json` = **materiał dowodowy karty**: pokazuje, co realnie zmieniło się
w zachowaniu importu. Trafia do `raport.md` jako podsumowanie per dostawca (ile rekordów, które pola).
Kroki 1 i 2 (próbki) powinny być no-op, jeśli próbki są deterministyczne — jeśli `git status` pokaże
zmiany w `probki/`, to sygnał, że próbka nie jest odtwarzalna; opisz i NIE commituj przypadkowego szumu.

**Krok 4 — bramki.** `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`
w `rebuild/backend/`. Szczególnie: `charakteryzacja.test.ts` (3 warstwy), `import.test.ts`,
oraz `charakteryzacja/silnik` + `akceptacja` (decyzja 3 — jeśli zżółkną, STOP).

**Krok 5 — weryfikacja merytoryczna przesunięć.** Na diffie `MOx.expected.json` potwierdź, że widać
oczekiwane zmiany: Wielka litera w `kategoria` (katunify), słowa `Radialna`/`Diagonalna`
w konstrukcji (konstr), `Tak`/`null` w NRO/CHO (bug2), rozmiary WxSxD (b4), L-series (p2_4),
rozwinięte indeksy nośności w MO9 (mo9expand), sufiksy w `model` (b10). Brak spodziewanej zmiany
przy danym dostawcy = albo próbka jej nie pokrywa (opisz), albo coś nie doszło (STOP).

## Strategia testowania

- **Gate odbudowy (kontrakt/fixtures): N/D** — karta nie dotyka API ani `contract/`; uzasadnienie
  w sekcji „Kontrakt i fixtures" wyżej. Zamiast niego obowiązuje **gate charakteryzacji** (3 warstwy).
- **Warstwa 1 (byte-for-byte)** — musi być zielona dla całego drzewa `legacy/**`, bez rozszerzania
  listy wyjątków.
- **Warstwa 2 (field-char MO1–MO10)** — zielona PO przenagraniu wzorca. Przenagranie jest częścią
  karty, nie obejściem: wzorzec jest nagrywany z ORYGINALNYCH parserów `mirror/backend@08.09`, więc
  zielony wynik nadal dowodzi zgodności portu z oryginałem, tylko na nowym stanie oryginału.
- **Warstwa 3 (próbka niepusta)** — strażnik przed „zielono, bo pusto".
- **Nowych testów jednostkowych NIE piszemy.** Kod parserów jest kopią bajtową wykonywanego
  oryginału — własny test jednostkowy sprawdzałby nasze wyobrażenie o zachowaniu Ani zamiast
  samego zachowania; field-characterization robi to lepiej i na realnych próbkach.
- **Regresja szersza:** pełne `npm test` backendu — port jest wołany przez `parsuj.ts`, więc
  `import.test.ts` i wszystko, co idzie przez pipeline importu, musi zostać zielone.

## Poza zakresem

- `mirror/backend/index.cjs` i reimplementacja silnika `tk()`/`acceptStaging` (P3, CAPS/Xq) — **13b**.
- Migracje danych (nazwa→UPPER, konstrukcja kody→słowa, historyczne kategorie) i przenagranie
  `katalog.gate`, `analityka.*`, `produkty.*` — **13c**.
- `mirror/backend/selly/*`, `extensions.cjs`, `generate_selly_export.cjs` — **13d**.
- Frontend (rebrand „Bridge ONE", etykiety) — **13e**.
- Backfille i reguły `tl_tt` B/C — **13f, rozstrzygnięte: nie odtwarzamy**.
- Merge całego `main` w `develop` — zakazane zasadą I13 (wywaliło 12 bramek).
- Przenagrywanie wzorców charakteryzacji silnika (`silnik/`, `akceptacja/`) — nie powinny się ruszyć;
  gdyby się ruszyły → STOP (decyzja 3).

## Definition of done

- [ ] 9 plików zsynchronizowanych z `main` RÓWNOLEGLE w `mirror/backend/` i `rebuild/backend/src/import/legacy/`
- [ ] `cmp` mirror↔port cichy dla wszystkich 9; warstwa 1 gate'a (sha256 całego drzewa `legacy/**`) zielona
- [ ] Żaden plik spoza listy 9 nie został ruszony (potwierdzone `git diff --stat`)
- [ ] `MOx.expected.json` przenagrane skryptem `charakteryzacja-nagraj.mjs` (osobny commit)
- [ ] Warstwy 2 i 3 gate'a charakteryzacji zielone (MO1–MO10)
- [ ] Wzorce charakteryzacji silnika i akceptacji NIETKNIĘTE i zielone
- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` w `rebuild/backend/` zielone
- [ ] `raport.md` zawiera: rozłożony diffem realny zakres `odswinch` (#64), podsumowanie przesunięć
      w `MOx.expected.json` per dostawca, potwierdzenie że wzorce silnika (13b) są poza zakresem
- [ ] `docs/rebuild-roadmap.md` blok I13: 13a oznaczone jako zrobione (data + ID ticketa), zakres
      faktycznie dowieziony; ustalenia dla 13b/13c wpisane DO ICH bloków, nie do 13a
- [ ] `docs/rebuild-backlog.md`: statusy #8, #9, #10, #53, #54, #55, #57, #58, #63, #64 zaktualizowane
      w części parserowej; #64 domknięty opisem realnego zakresu
