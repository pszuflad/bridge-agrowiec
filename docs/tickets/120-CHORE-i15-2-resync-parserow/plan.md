# 120-CHORE-i15-2-resync-parserow — resync parserów z produkcji + `application_rules`, `payment_blocks`, `feed_safety`, część parserowa Staging v2

> Status: Draft → **Approved** → Implemented → Shipped
> Branch: `chore/120-i15-2-resync-parserow`
> Worktree: `.worktrees/120-CHORE-i15-2-resync-parserow`
> Karta: `docs/karty/I15.2/` · Iteracja 15, faza 2

## Opis ticketa

Karta **I15.2**. Resync warstwy parserów z produkcji (`origin/main` @ `88fa31c`, 23.09 13:00) do
`rebuild/backend/src/import/legacy/`, plus cztery NOWE moduły produkcji: `application_rules.cjs`,
`payment_blocks.cjs`, `feed_safety.cjs`, `staging_policy.cjs`. Metoda jak ticket 42
(`42-CHORE-i13a-resync-parserow`). Rozbiór `extensions.cjs` i przypisanie zmian do kart I15.4 / I15.8 /
I15.10. Wpisy backlogu: #73, #75, #78, #79, #80, #82, #83, #99, #103, #105.

## Kontekst

### Warunek startu — spełniony
PR #131 (`117-DOCS: decyzje fazy A`) jest w `origin/develop` (merge `2fdf9a1`). Karta I15.1 zmergowana,
startujemy normalnie z `origin/develop`.

### Źródło prawdy
`origin/main` @ **`88fa31c`**. Na `main` są 2 nowsze commity (`4a26cb3`, `233524b`), ale oba zmieniają
wyłącznie `mirror/frontend/ex-port-files/sellycsv-*.csv` — dane eksportu, **ani jednej linii kodu**.
Warstwa parserów na `88fa31c` i na `233524b` jest identyczna. Warunek stopu („nowszy commit z kodem")
**nie zachodzi** — decyzja D-A poniżej.

### Zmierzona powierzchnia resyncu
Osiem plików różni się między `origin/develop:rebuild/backend/src/import/legacy/` a `88fa31c:mirror/backend/`
(dodane/usunięte linie):

| Plik | +/− |
|---|---|
| `parsers/adapter.cjs` | +74 / −6 |
| `parsers/mo9_agrorami_api.cjs` | +56 / −11 |
| `parsers/tyre_params.cjs` | +28 / −39 |
| `parsers/mo2_jmk.cjs` | +4 / −19 |
| `common.cjs` | +6 / −3 |
| `parsers/dispatcher.cjs` | +5 / −1 |
| `parsers/_agrorami_fetch_helper.cjs` | +4 / −2 |
| `parsers/mo9_agrorami.cjs` | +1 / −0 |

Pozostałe siedem parserów (`mo1_bohnenkamp`, `mo3_grasdorf`, **`mo4_mo5_handlopex`**, `mo6_agrowiec`,
`mo7_nokian`, `mo8_trelleborg`, `mo10_gri`) jest **bajt w bajt identycznych** — resync ich nie dotyczy.

### Gdzie naprawdę leżą zmiany wymienione w promptcie
Prompt przypisuje je do dostawców; w kodzie leżą gdzie indziej. Zweryfikowane:

- **Handlopex MO4/MO5 `W2`** → `parsers/adapter.cjs:514-516` (`/^([0-9]{13})W2$/i`) i `:573`
  (`_supplierEanOriginal`). **NIE** w `mo4_mo5_handlopex.cjs`, który jest identyczny. Brak poszerzenia zakresu.
- **MO9 usunięcie samotnego `DOT`** → `parsers/mo9_agrorami_api.cjs`, regex
  `/\bDOT(?=\s+\d{1,2}\s*PR\b|\s+(?:TL|TT)\b|$)/gi`. Już w zakresie.
- **Usunięty cichy fallback do starych parserów** → `parsers/dispatcher.cjs`: `parseByKod` przemianowane na
  `parseRawByKod`, a nowe `parseByKod` owija je w `feed_safety.attach()`. Miejsce wywołania w
  `index.cjs` jest **niezmienione** — fallback znika wyłącznie przez rzucenie wyjątku
  (komunikat: „Import zatrzymany bez przełączania na stary format"). Dostarczamy to w całości
  portem `dispatcher.cjs` + `feed_safety.cjs`.
- **JMK bez łączenia po EAN** → `parsers/mo2_jmk.cjs` (+4/−19).

### Graf zależności nowych modułów (dlaczego wszystkie cztery są konieczne)
Zweryfikowane `grep`em po `require(` na `88fa31c`:

```
parsers/adapter.cjs:10   require('../payment_blocks.cjs')      ← top-level
parsers/adapter.cjs:11   require('../staging_policy.cjs')      ← top-level
parsers/adapter.cjs:733  require('../feed_safety.cjs').converted(...)
parsers/dispatcher.cjs:47 require('../feed_safety.cjs').attach(...)
common.cjs:395           require('./staging_policy.cjs').rawEan(rec)
parsers/tyre_params.cjs:6 require('../application_rules.cjs')
```

Wszystkie cztery są wymagane **po ścieżce względnej** przez pliki, które portujemy — muszą fizycznie
istnieć w `legacy/`, inaczej `require` padnie przy starcie.

### Gate, który rządzi tym ticketem
`rebuild/backend/test/charakteryzacja.test.ts` ma trzy warstwy; **warstwa 1** liczy sha256 KAŻDEGO pliku
w `src/import/legacy/` i porównuje z tą samą ścieżką w `mirror/backend/`, a lista wyjątków
(`PLIKI_SPOZA_PORTU`) jest pilnowana osobnym testem, żeby została jednoelementowa (`["package.json"]`).

Stąd dwa fakty, które kształtują ten plan:
1. `mirror/backend/` na `develop` jest **132 pliki za** `88fa31c` i **nie ma w ogóle** czterech nowych
   modułów → resync bez ruszenia `mirror/` = czerwony gate.
2. Okrojony („tylko czysta funkcja") port `payment_blocks.cjs` / `staging_policy.cjs` **nigdy** nie będzie
   bajt-w-bajt → kolizja z literą karty, rozstrzygnięta decyzją D-1.

### Baseline
Bramki na czystym `develop` w worktree: lint ✓, typecheck ✓, build ✓, **1632 testy / 100 plików ✓**
(3 skipped). Każda czerwień po resyncu jest nasza.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Ten ticket nie zmienia kształtu żadnej odpowiedzi API.** Warstwa parserów kończy się na
`adapter.recordsToSurowe()`, czyli przed zapisem do `staging_items` i przed jakąkolwiek trasą HTTP.
Jedyny konsument w `rebuild/` to `src/import/parsuj.ts`, który nie jest wpięty w żaden endpoint
zwracający pola parsera bezpośrednio.

Gate kontraktowy **nie obowiązuje** w wariancie „porównaj odpowiedź z `contract/fixtures/`". Zamiast niego
obowiązuje **mocniejszy** gate wierności, właściwy dla tej warstwy — charakteryzacja wobec ORYGINALNYCH
parserów produkcji (sekcja „Strategia testowania"). Weryfikacja negatywna, którą i tak wykonujemy:
pełny `npm test` (1632 testy, w tym `silnik.gate.test.ts`, `akceptacja.odstepstwa.test.ts`,
`bridge-ext.test.ts`) musi zostać zielony — to on złapie, gdyby zmiana parserów przeciekła do API.

## Decyzje

Cztery decyzje użytkownika, 2026-09-23, wszystkie zgodnie z rekomendacją:

- **D-1 — nowe moduły kopiujemy W CAŁOŚCI, bajt w bajt.** Karta mówiła „tylko czysta
  `getBlockedPaymentForms`" i „`staging_policy` w części używanej przez adapter/common". Zweryfikowałem, że
  **żaden z czterech modułów nie ma efektów ubocznych przy `require()`**: `payment_blocks.cjs` otwiera bazę
  wyłącznie wewnątrz `ensurePaymentBlocks()` (a `DB_PATH` to sama stała-string), `staging_policy.cjs`
  dostaje `db` jako argument `install()` i poza tym używa tylko `node:crypto`, `application_rules.cjs`
  wymaga tylko `path`, `feed_safety.cjs` jest czysty. *Za:* gate integralności zielony, reguła 1:1
  z `CLAUDE.md` zachowana, realny warunek karty („adapter nie może otwierać bazy") spełniony, bo żadna
  aktywowana ścieżka bazy nie dotyka; `install()`/`registerRoutes()` leżą uśpione dla I15.4.
  *Przeciw wariantowi okrojonemu:* wymagałby rozbrojenia strażnika `PLIKI_SPOZA_PORTU`, czyli trwałego
  osłabienia głównego dowodu wierności portu. **To świadome odstępstwo od LITERY karty**, zgodne z jej
  intencją.
- **D-2 — do `mirror/` wchodzi tylko warstwa parserów** (8 resyncowanych plików + 4 nowe moduły), nie całe
  132 pliki. Dokładnie metoda ticketu 42 (commit `bb020fb`: „sync warstwy parserów **mirror+port**").
  *Za:* diff czytelny w review, brak kolizji z kartami I15.3/I15.7 działającymi równolegle. *Przeciw
  całości:* wszedłbym w pliki Selly/availability, czyli cudzą własność, z ogromnym diffem.
- **D-3 — test akceptacyjny na próbkach z repo + PEŁNYCH cennikach z historii gita.** `/tmp/cenniki`
  nie istnieje na maszynie. Zamiast tego: (a) przenagranie `MOx.expected.json` oryginalnymi parserami
  z `88fa31c`, (b) `porownaj-parsery.cjs` na pełnych realnych cennikach z `72957d7^`
  (937 plików: MO1×1, MO2×202, MO3×166, MO4×184, MO5×183, MO9×201, każdy z `.meta.json` = niezależnym
  oracle'em z realnego przebiegu produkcji). **Nic z tego nie trafia do commita** — pliki lądują
  w katalogu tymczasowym.
- **D-4 — źródłem prawdy zostaje `88fa31c`.** Dwa nowsze commity to dane eksportu CSV, nie kod;
  reszta fali I15 też trzyma się `88fa31c`.

Dwie decyzje dodatkowe, po raporcie researchera (2026-09-23, obie zgodnie z rekomendacją):

- **D-5 — przenagrywamy TAKŻE wzorzec charakteryzacji silnika.** `test/silnik.charakteryzacja.test.ts:71`
  bierze rekordy wprost z `test/charakteryzacja/MOx.expected.json`, więc przenagranie wzorca parserów
  zmienia mu WEJŚCIE i test idzie na czerwono (10/10) — znany precedens 13a→13b. `db/snapshot.db`
  (32 MB, gitignored) jest w głównym repo, więc przenagranie jest wykonalne. `index.cjs` zostaje stary
  (D-2), więc obie strony porównania mają STARY silnik i NOWE wejście — to poprawnie izoluje dryf silnika
  od dryfu parserów, dokładnie jak opisuje nagłówek `charakteryzacja-silnik-nagraj.mjs`. *Za:* `develop`
  zostaje zielony po merge'u I15.2 samodzielnie. *Ryzyko konfliktu:* zerowe — I15.4 startuje dopiero
  po I15.2 (faza 3 po fazie 2).
- **D-6 — naprawiamy minimalnie `routes/import.ts`.** Po resyncu `dispatcher.parseByKod()` woła
  `feed_safety.attach()`, który RZUCA przy pustym cenniku i przy błędach parsera. Zweryfikowane:
  `routes/import.ts:136` wywołuje `parsujBufor()` **poza** `try/catch` (opakowane jest tylko
  `uruchomImport()`, żeby łapać `PustyImportBlad`), więc pusty cennik dałby niekontrolowane 500 zamiast
  dotychczasowego `{blad: ...}`. Owijamy `parsujBufor` tym samym tłumaczeniem wyjątku na odpowiedź HTTP.
  *Za:* regresja zamknięta w tym samym merge'u, który ją wprowadza. *Uwaga:* to plik spoza „wyłącznej
  własności" karty — zmiana jest celowo minimalna (kilka linii, bez dotykania logiki silnika).
  Dublowanie `PustyImportBlad` (odstępstwo D7) z nowym bezpiecznikiem produkcji **zostawiamy**
  do rozstrzygnięcia w I15.4 — wejście zapisane.

### Odstępstwa od zachowania oryginału
**Żadnych w warstwie parserów.** Cały port jest verbatim. Odstępstwa dotyczą wyłącznie *zakresu kopii*
(D-1: całe pliki zamiast okrojonych — zwiększa wierność) oraz *tłumaczenia wyjątku na HTTP* (D-6 —
zachowuje dotychczasowy kontrakt odpowiedzi, zamiast pozwolić na 500).

## Plan implementacji

Sześć kroków, każdy = jeden commit.

**Krok 1 — sync `mirror/` (warstwa parserów) do `88fa31c`.**
Do `mirror/backend/` wchodzi 12 plików: 8 resyncowanych + `application_rules.cjs`, `payment_blocks.cjs`,
`feed_safety.cjs`, `staging_policy.cjs`. To musi być PIERWSZE, bo `charakteryzacja-nagraj.mjs` (krok 3)
uruchamia oryginalne parsery właśnie z `mirror/backend/`.

**Krok 2 — port do `src/import/legacy/`.**
Te same 12 plików kopiowane bajt w bajt do `legacy/` (`parsers/` dla ośmiu, korzeń dla czterech modułów).
Weryfikacja: `sha256` każdej pary musi się zgadzać — to dokładnie to, co sprawdzi warstwa 1 gate'u.
`scripts/copy-parsery.mjs` jest rekurencyjny, więc build nie wymaga zmian.

**Krok 3 — przenagranie wzorca charakteryzacji.**
`node scripts/charakteryzacja-nagraj.mjs`, potem `git diff` na `MOx.expected.json` pokazuje DOKŁADNIE, co
zmieniło się w zachowaniu importu — to jest główny artefakt dowodowy tego ticketa i wchodzi do `raport.md`.
Oczekiwane zmiany: `ean_raw` w każdym rekordzie (nowe pole z `common.cjs:395`), kanonizacja `kategoria`
przez `capitalizeKategoria()`, `zastosowanie` z `application_rules`, `blokowane_formy_platnosci`
z `payment_blocks`, `_supplierEanOriginal` u MO4/MO5, model bez samotnego `DOT` u MO9, brak łączenia po
EAN u MO2.

**Krok 4 — test akceptacyjny na pełnych cennikach (D-3).**
Materializacja `88fa31c:mirror/backend/` do katalogu tymczasowego jako strona „PROD", `legacy/` jako
„PORT", wejście = pełne cenniki z `72957d7^`. Oczekiwanie: **zero różnic w polach**. Uwaga na pułapkę:
strona PROD wymaga całego drzewa `mirror/backend/` (adapter `require`uje moduły po ścieżce względnej).
MO9 idzie ścieżką offline (`test/charakteryzacja/mo9-offline.mjs` + `MO9.items.json`), bez haseł do API —
wbrew założeniu promptu MO9 **jest** testowalny.

**Krok 5 — weryfikacja stanu przejściowego D4 i rozszerzenie testów.**
Sprawdzenie, że `ean: null` + `ean_raw` nie psuje importu, zanim I15.4 pozna flagi. Wstępny dowód już jest:
`tk.ts:221` robi `rekord.ean == null ? "" : String(rekord.ean).trim()`, czyli degraduje się do „EAN pusty"
(jak odstępstwo 14i), a `tk.ts:110` już dziś sięga po `ean_raw`. Dokładam test charakteryzacyjny
na `feed_safety` (rzucanie przy pustym cenniku i przy błędach parsera, niewyliczalność `_bridgeFeedMeta`,
`excludedCodes` — MO3 daje 156 `odrzucone`, więc ta ścieżka ma realne pokrycie).

**Krok 5b — przenagranie wzorca silnika (D-5) + bezpiecznik HTTP (D-6).**
`node scripts/charakteryzacja-silnik-nagraj.mjs` (wymaga `db/snapshot.db` — kopiowany z głównego repo,
gitignored, nie wchodzi do commita) i minimalne owinięcie `parsujBufor` w `routes/import.ts`.

**Krok 6 — bramki + dokumentacja karty.**
lint, typecheck, build, `npm test` w `rebuild/backend/` (Node ≥ 20).

### Rozbiór `mo9_agrorami_api.cjs` hunk po hunku
Diff `+56/−11` zawiera kilka zmian naraz (#79, #105, normalizacja szerokości). Rozbijam go hunk po hunku,
żeby **nie przeoczyć #78** (MO9: odrzucanie po ID kategorii Magento 163), którego nie widać jako osobnego
wpisu — jeśli #78 nie ma w diffie, znaczy to, że wszedł wcześniej i trzeba to odnotować.

### Rozbiór `extensions.cjs` — przypisanie do kart
Diff `origin/develop` → `88fa31c` to **5 hunków, +34/−1**. Przypisanie (wykonane, do zapisania jako wejścia):

| Hunk | Linie @ main | Co robi | Karta |
|---|---|---|---|
| 1 | 18–21 | `require` `payment_blocks` + `application_rules` | I15.4 (startup) |
| 2 | 111–130 | `ensurePaymentBlocks()` + `ensureApplicationRules()` przy `register()` | **pokryte migracją 011 (I15.1)** — do potwierdzenia koordynatorowi |
| 3 | 479–494 | rejestracja `selly/routes_sync.cjs` + `installScheduler` | **I15.8** |
| 4 | 839–842 | `startScheduler` wygaszony (`return`) — „Scheduler delegated to core D4”, powód: duplikowane pobrania i liczniki nieobecności | **I15.4** + dotyka liczników nieobecności → **I15.10** |
| 5 | 948 | usunięty pusty wiersz na końcu | kosmetyka |

**Dla parsowania (ta karta) `extensions.cjs` nie wnosi NIC** — całe wpięcie `feed_safety` siedzi wewnątrz
`dispatcher.cjs:47` i `adapter.cjs:733`, czyli w plikach, które i tak portujemy.

## Strategia testowania

1. **Warstwa 1 — integralność (sha256).** 12 nowych/zmienionych plików musi być bajt w bajt zgodnych
   z `mirror/backend/`. Automatycznie w `charakteryzacja.test.ts`.
2. **Warstwa 2 — charakteryzacja.** Port na 10 próbkach dostawców daje wyjście identyczne z wzorcem
   nagranym ORYGINALNYMI parserami z `88fa31c`. To jest gate wierności zastępujący gate fixtures.
3. **Warstwa 3 — przydatność próbki.** Pilnuje, że zielony wynik nie bierze się z pustego wejścia.
4. **Test akceptacyjny karty (D-3).** `porownaj-parsery.cjs` na pełnych realnych cennikach —
   zero różnic w polach wobec potoku z `88fa31c`.
5. **Nowe testy `feed_safety`.** Wyjątek przy pustym cenniku, wyjątek przy błędach parsera,
   niewyliczalność `_bridgeFeedMeta`, zawartość `excludedCodes`.
6. **Regresja całości.** Pełny `npm test` — baseline 1632 zielone, ma zostać 1632+ zielonych.

Pomijamy: testy jednostkowe logiki wewnątrz portowanych plików. Powód: to kod produkcji kopiowany
verbatim, nie nasz — dowodem wierności jest sha256 + charakteryzacja, a nie testy pisane do cudzej logiki.

## Poza zakresem

- `src/import/tk.ts` i staging (**I15.4**) — w tym konsumpcja `_bridgeFeedMeta` i flag D4 przez silnik.
- `rebuild/schema/` — I15.1 zamknięta, migrację `012` robi I15.4.
- Selly (**I15.6/I15.7/I15.8**), katalog i eksport CSV (**I15.3**), dostępność (**I15.10**).
- `docs/rebuild-roadmap.md` — zmienia wyłącznie koordynator (`CLAUDE.md`, reguła 0).
- Naprawa spłaszczania `a ; b` przez trigger 011 — **świadomie nie naprawiamy**, opisujemy (patrz niżej).

## Ustalenia do przekazania innym kartom

- **I15.4** — `wejscie-120.md`: stan przejściowy D4, hunki 1/2/4 z `extensions.cjs`, kontrakt
  `_bridgeFeedMeta` i `converted()`, uśpione `install()`/`registerRoutes()` w `staging_policy.cjs`.
- **I15.8** — `wejscie-120.md`: hunk 3 (`routes_sync` + `installScheduler`).
- **I15.10** — `wejscie-120.md`: hunk 4, liczniki nieobecności a wygaszony scheduler.
- **I15.9** — `wejscie-120.md`: #83 łamie obietnicę z `docs/instrukcja-testow-I3.md` §11 pkt 10.
- **I15.4** (dodatkowo, z D-6): `PustyImportBlad` (odstępstwo D7) dubluje się teraz z bezpiecznikiem
  produkcji w `feed_safety.attach()` — do rozstrzygnięcia przy przepisywaniu tej ścieżki pod D4.
- **Do koordynatora** (w `docs/karty/I15.2/karta.md`): (e) **`#103` jest w backlogu zduplikowany** —
  dwa niepowiązane wpisy pod tym samym numerem (Selly `routes_sync.cjs` → 500 na `/sync-full-*`
  vs „Braki w cenniku"/`feed_safety`); numeracja wymaga korekty koordynatora. (f) `karta.md` wymienia
  węższy zakres plików niż `wejscie-110.md` i prompt — jest nieaktualna względem własnego wejścia.
- **Do koordynatora** (w `docs/karty/I15.2/karta.md`): (a) trigger 011 spłaszcza `a ; b` do
  `Uniwersalne/pozostałe` w kategorii kanonicznej, a `normalizeApplication()` takie łańcuchy **realnie
  produkuje** (`application_rules.cjs:150`, `parts.join(' ; ')`) — produkcja ma ten sam trigger, więc stan
  końcowy jest zgodny, ale warto to widzieć; (b) `wejscie-107(a)` zostaje **rozwiązane** tym ticketem —
  po resyncu adapter woła normalizatory przed zapisem, więc `staging_items.snapshot_json` przestaje pokazywać
  nieznormalizowane wartości; (c) rozjazd w źródle prawdy między `karta.md` (`7d6cfc9`),
  `wejscie-110.md` (`abe5f14`) i promptem (`88fa31c`); (d) karta mówi Selly → I15.6/I15.8, prompt → I15.8/I15.10.
- **Backlog**: #11 i odstępstwo 14i oznaczyć jako **zastąpione przez #99/D4**.

## Definition of done

- [ ] `mirror/backend/` (warstwa parserów, 12 plików) na stanie `88fa31c`
- [ ] `src/import/legacy/` bajt w bajt zgodne z `mirror/backend/` — warstwa 1 gate'u zielona
- [ ] Wzorzec charakteryzacji przenagrany; `git diff` na `MOx.expected.json` opisany w `raport.md`
- [ ] Test akceptacyjny: **zero różnic w polach** na pełnych cennikach wobec potoku z `88fa31c`
- [ ] MO9 rozliczone ścieżką offline (nie „nieprzetestowalne")
- [ ] Stan przejściowy D4 zweryfikowany — import się nie psuje; dowód w `raport.md`
- [ ] Nowe testy `feed_safety` (wyjątki, `_bridgeFeedMeta`, `excludedCodes`) zielone
- [ ] Wzorzec silnika przenagrany (D-5); `silnik.charakteryzacja.test.ts` zielony
- [ ] `routes/import.ts` tłumaczy wyjątek `feed_safety` na `{blad: ...}` (D-6), nie na 500
- [ ] `mo9_agrorami_api.cjs` rozebrany hunk po hunku; los #78 odnotowany
- [ ] lint ✓ typecheck ✓ build ✓ `npm test` ✓ (≥ 1632 zielonych)
- [ ] `docs/karty/I15.2/karta.md` opisuje STAN + „Do koordynatora”
- [ ] `wejscie-120.md` w I15.4, I15.8, I15.10, I15.9
- [ ] Backlog: #11 i 14i oznaczone jako zastąpione przez #99/D4; statusy #73/#75/#78/#79/#80/#82/#99/#103/#105
- [ ] `docs/spec-backend/wpis-120.md` z ustaleniami o backendzie
- [ ] Żaden plik cennika ani fragment danych dostawcy nie trafił do repo
