# 130-FEATURE-importer-staging-bezpieczenstwo — I15.4b: rdzeń importu na `importer()` ze `staging_policy`

> Status: Draft → **Approved** → Implemented → Shipped
> Branch: `feature/130-importer-staging-bezpieczenstwo`
> Worktree: `.worktrees/130-FEATURE-importer-staging-bezpieczenstwo`
> Karta: `docs/karty/I15.4b/` · Źródło prawdy: `origin/main` @ `88fa31c`

## Opis ticketa

Karta **I15.4b** — podmiana rdzenia importu (`rebuild/backend/src/import/tk.ts`) na port
`importer()` zwracanego przez `staging_policy.install()` (`88fa31c`,
`mirror/backend/staging_policy.cjs`). Ścieżka ZAPISU: świeże ceny i stany, wycofania,
`historia_cen`, konsumpcja `_bridgeFeedMeta`, blokada źródła, reguła wycofań,
auto-wstrzymania, dopasowanie po EAN z ochroną DOT, `assignKodImportu`, edycja modelu
w stagingu aktualizująca bieżnik.

## Kontekst

**Kluczowe ustalenie z oryginału:** w `mirror/backend/index.cjs` @ `88fa31c` silnik `tk`
NIE jest już osobną funkcją bundla — jest wprost wynikiem `install()`:

```js
tk = require("./staging_policy.cjs").install({U, db:Qi, normalize:Hq, classify:Zc, badName:Kq, ext:__BRIDGE_EXT});
```

Stary `tk()` z bundla (żywa definicja @ `backend-index.cjs:47584`) jest w `88fa31c` MARTWY —
nadpisany tą linią. To znaczy, że nasz `silnikStagingu()` z `tk.ts` odtwarza dziś silnik,
którego produkcja już nie używa, i cała warstwa charakteryzacji mierzy nieaktualny wzorzec.

`install()` to jedno domknięcie JS, w którym `importer()` (mój zakres) dzieli stan
z funkcjami akceptacji (`acceptStaging`, `resolveStaging`, `closeAbsenceReview`,
`chooseAbsenceCard` — zakres **I15.4c**). Wspólne: `suspend()`, `refreshAvailability()`,
`clear`, `aliases`, `find`, `originalUpdate`, `autoMarker` i flaga `availabilityChanged`.

Fundament (migracja `012`, model Drizzle, `repos/staging-polityka.ts` z **18** funkcjami)
dowiozła karta I15.4a (ticket 124) — wołam go bez zmian.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Import **nie zmienia kształtu żadnej odpowiedzi API** — zmienia dane w tabelach, które
czytają istniejące trasy. Gate dotyczy więc tras czytających:

| Ścieżka `openapi.yaml` | Fixture | Co dowodzi |
|---|---|---|
| `GET /api/staging` | `contract/fixtures/GET_staging.json` | kształt zgłoszeń pisanych przez `addStaging` |
| `GET /api/staging/paged` | `GET_staging_paged.json` | j.w., wariant stronicowany |
| `GET /api/products` | `GET_products.json` | 72 klucze produktu po `updateProduct` |
| `GET /api/analytics/prices/product-history` | `GET_analytics_prices_product-history.json` | poprawność zapisu do `historia_cen` |
| `GET /api/analytics/prices/last-import` | `GET_analytics_prices_last-import.json` | j.w. |

**Niezamrożone (kształt oznaczony w `openapi.yaml` jako „do zamrożenia w 2.4"):**
`POST /api/staging/import`, `POST /api/import/from-url`, `POST /api/import/parse-file`,
`POST /api/dostawcy/:kod/upload`. Tu obowiązuje wierność oryginałowi, nie fixture.

**Poza kontraktem:** trasy `review`/`resolve`/`choose-absence-card`/`close-absence-review`
z `registerRoutes()` nie istnieją w `openapi.yaml` (0 trafień) — to I15.4c.

## Decyzje

**Decyzje użytkownika z tej sesji (Krok 3):**

- **D-130.1 — #104 nanosimy w pełnym zakresie.** Auto-wstrzymania (`product_auto_suspensions`,
  ochrona ręcznych, pewny powrót) wchodzą w całości. Schemat istnieje od I15.4a, a I15.10
  dowiozła moduł dostępności pod ten mechanizm. Status wpisu **#104 w backlogu podnoszę na ✅**.
- **D-130.2 — podział `install()`: fabryka + wspólne helpery w moim pliku.**
  `stworzPolitykeStagingu(db, zaleznosci)` zwraca `importer` i eksportuje wspólne helpery
  jawnie; I15.4c je zaimportuje bez modyfikacji moich plików — ten sam wzorzec, którym
  I15.4a oddała repozytoria. Zachowuje semantykę wspólnego stanu oryginału.
- **D-130.3 — nadpisanie `U.updateProduct` nanoszę teraz w `repos/products.ts` / trasie PATCH.**
  Karta I15.1, jedyna deklarująca te pliki, jest zamknięta (✅ ticket 107), więc nie ma
  konfliktu równoległego. Bez tego #104 jest połowiczne: ręczne odwstrzymanie nie zdejmuje
  znacznika automatu i najbliższy import wstrzymuje produkt z powrotem.
  **Rozszerzenie zakresu poza pliki karty — odnotowane w „Do koordynatora".**
- **D-130.4 — blokady źródła dają 400, `PustyImportBlad` zostaje.** Nowe blokady #103
  dostają własne klasy domenowe i ten sam kod 400 co dzisiejsze `PustyImportBlad`/`BladCennika`.
  Kontynuacja zatwierdzonego odstępstwa D7 — patrz „Odstępstwa" niżej.
- **D-130.5 — punkt wpięcia dostępności jako wstrzykiwany szew.** `importer()` dostaje
  zależność `odswiezDostepnosc?: (dostawca: string) => void`, domyślnie no-op. I15.10
  (`src/selly/dostepnosc.ts`, `zadajOdswiezenie(dostawca)`) jest ZAMKNIĘTA, ale leży na
  niezmergowanej gałęzi `feature/119-selly-dostepnosc-zawor` — wpięcie to jedna linia
  po jej merge'u. Zadanie domykające do „Do koordynatora".
- **D-130.6 — wzorce charakteryzacji przenagrywam z `install()` @ `88fa31c`.**
  `scripts/charakteryzacja-silnik-nagraj.mjs` przepinam tak, żeby budował `tk` przez
  `staging_policy.install()` zamiast wycinać martwą funkcję z bundla; przenagrywam MO1–MO10
  z `db/snapshot.db`. `git diff` wzorców pokaże, co dokładnie zmieniło #99/#103/#104.

**Decyzje odziedziczone (blok I15):** D1 triggery jako migracja odporna · D2 poprawki danych
bez migracji · D3 Staging v2 przenosimy · **D4 błędny EAN = błąd blokujący akceptację** ·
D5 skrypt reconcile nie przenosimy.

### Świadome odstępstwa od oryginału (wszystkie zatwierdzone)

1. **D7 (istniejące, kontynuowane): kod HTTP blokad źródła = 400.** Produkcja daje 500 przy
   `POST /api/dostawcy/:kod/upload` (route łapie i robi `status(500)`) oraz 200 z `{ok:false,error}`
   przy synchronizacji z URL (`L4` zwraca obiekt błędu, nie rzuca). Odbudowa ma już
   `PustyImportBlad`/`BladCennika` → 400. Nowe blokady #103 idą tą samą ścieżką (D-130.4).
2. **D-130.5: `refreshAvailability()` jako szew.** Oryginał woła `availability_sync.request(db, supplier)`
   TYLKO gdy `path.resolve(db.name) === '/home/admin/private_apps/bridge/data.db'` — czyli
   poza produkcją i tak jest no-opem. Nasz domyślny no-op jest wierny temu zachowaniu;
   różnica jest wyłącznie w sposobie wstrzyknięcia.
3. **D-130.3: `U.updateProduct` jako jawna logika w `repos/products.ts`**, nie monkey-patch
   na współdzielonym obiekcie. Efekt identyczny, mechanizm inny (TS bez mutacji modułu CJS).

## Plan implementacji

### Krok 1 — `_bridgeFeedMeta` przez warstwę parsowania
- `src/import/typy.ts`: nowy typ `MetaCennika = {complete, parserErrors, source, rawCount, excludedCodes}`;
  pole `meta?: MetaCennika` w `WynikParsowania`.
- `src/import/parsuj.ts`: `parsujPlik()`/`parsujBufor()` przepisują `rekordy._bridgeFeedMeta`
  (własność `enumerable: false` — trzeba sięgnąć wprost, nie przez spread) do nowego pola.
- Test: meta przeżywa parsowanie dla pliku MO3.

### Krok 2 — szkielet fabryki polityki stagingu
- **Nowy** `src/import/polityka/fabryka.ts`: `stworzPolitykeStagingu(db, zaleznosci)`.
  Odtwarza domknięcie `install()` (`staging_policy.cjs:82-331` w części wspólnej):
  `suspend()`, `refreshAvailability()` (szew D-130.5), `clear`, `aliases`, `find`,
  `autoMarker`, flaga `availabilityChanged`. Zwraca `{ importer, ...helpery }`.
- Helpery eksportowane jawnie dla I15.4c (D-130.2) — z komentarzem, że to API międzykartowe.
- **Nowy** `src/import/polityka/zgodnosc.ts`: port `compatibility()` (:47-61),
  `separateDotBatch()` (:62-71), `codeKey`, `sourceKey`, `version`, `protect`, `KEYS`/`LABEL`.
  ⚠ `norm()` w JS jest Unicode-aware (`.toUpperCase()`), inaczej niż SQLite `UPPER()` —
  odnotować w komentarzu, żeby nikt nie pomylił tych dwóch mechanizmów.

### Krok 3 — `importer()`: dopasowanie i przygotowanie pozycji (`:332-443`)
Łańcuch dopasowania odtworzony w kolejności oryginału:
`manualChoice` (`staging_absence_decisions.selected_source_code`, przez
`kodProduktuDlaWybranegoZrodla`) → `remembered` (`staging_matches`, przez `dopasowanieStagingu`)
→ dokładny `kod` z ochroną DOT → `byCodeNorm` (wielkość liter) → `bySupplierCode`
→ **EAN tylko gdy dokładnie JEDEN zgodny kandydat** i żaden inny rekord cennika nie wskazuje
tego samego produktu (`:389-395`) → fallback po cechach, który NIE auto-matchuje, tylko
tworzy `matchIssue`.
- Ochrona DOT: `norm(d.dot) !== norm(current.dot)` zrywa dopasowanie (`:374`).
- Ochrona DEMO i wariantów: przez `variant()` wewnątrz `compatibility()`.
- Wykrywanie sprzecznych pozycji w jednym cenniku (`_sourceConflict`, `:441-449`).

### Krok 4 — blokady źródła (#103, `:455-461`)
- `meta.parserErrors > 0` → `BladOdczytuCennika` (400).
- `!incoming.length` → istniejący `PustyImportBlad` (400, D-130.4).
- `itemCount < minimumReliable` gdzie `minimumReliable = feedState?.max_item_count ?
  Math.max(1, Math.ceil(max*0.8)) : 1` → **nowa** `CennikPodejrzanieMalyBlad` (400).
- `feedState && itemCount>=20 && observed.size < min(itemCount, products.length)*0.5`
  → **nowa** `CennikMasowoNierozpoznanyBlad` (400).
- ⚠ Kolejność ma znaczenie: progi liczone PO zbudowaniu `prepared`, przed transakcją.
- `stanOfertyDostawcy()` z repo I15.4a.

### Krok 5 — odcisk oferty, kompletność, `distinctCompleteFeed` (`:462-466`)
- `fingerprint = hash(incoming.map(r=>[kod,kodDostawcy,identity(r),rawEan(r),cenaZakupu,stan]).sort(...))`.
- `complete = meta?.complete===true && options.feedComplete!==false && !(options.parserErrors>0)`.
- `elapsed` = brak `last_counted_at` lub ≥ 24 h.
- `distinctCompleteFeed = complete && !knownVersion && elapsed && (!reconcileOnly || verifyAbsence)`.
- `czyZnanaWersjaOferty()`, `zapiszWersjeOferty()`, `zapiszStanOfertyDostawcy()` z repo.
  ⚠ `zapiszWersjeOferty` to goły `INSERT` — wołać WYŁĄCZNIE pod `distinctCompleteFeed`
  (powtórka rzuca `UNIQUE constraint failed` i tak ma być).
  ⚠ `max_item_count` podawać już jako `Math.max(itemCount, feedState?.max_item_count||0)`
  mimo że SQL i tak robi `MAX(…)` — oba zabezpieczenia zostają.

### Krok 6 — transakcja: zapis zmian, `historia_cen`, pewny powrót (`:475-520`)
- Sprzątanie `oldQueue` dla kompletnej oferty.
- Wstrzymywanie kandydatów przy niejednoznacznym dopasowaniu.
- `patch` z `cenaZakupu, cenaSprzedazy, marzaPct, stan, magazyn` + EAN gdy poprawny.
- **Pewny powrót** (`:502-512`): `auto && complete && !reconcileOnly && cenaZakupu>0 &&
  (cenaSprzedazy ?? current.cenaSprzedazy)>0` → `status:'aktywny'` + `usunAutomatyczneWstrzymanie`
  + `usunDowodyNieobecnosci`. W przeciwnym razie produkt wstrzymany dostaje tylko `patch.stan=0`
  — **ręczne wstrzymania nie są odwstrzymywane**.
- `historia_cen` — INSERT bajt w bajt jak `:517-519` (kolumny `snake_case`, wartości z `current`
  poza ceną/stanem z `patch`).

### Krok 7 — auto-wstrzymania i wycofania (#104/#103, `:530-613`)
- `suspend(p, time, fingerprint, powod)`: zapis do `product_auto_suspensions` gdy
  `p.status==='aktywny' || czyAutomatycznieWstrzymany(...)`; aktualizacja produktu na
  `wstrzymany`/`stan:0`/`nieobecnoscPodRzad:0` tylko gdy stan faktycznie się zmienia.
  ⚠ `zapiszAutomatyczneWstrzymanie` NIE rusza `suspended_at` przy konflikcie.
- Brak w kompletnej ofercie → `suspend()` **natychmiast** (`:557`).
- Dowody nieobecności: `product_absence_checks.checks_json` = tablica
  `{fingerprint, checkedAt, source, items}`, **przycięta `slice(-3)`**; przy `count>=3`
  zgłoszenie `typZmiany:'wycofana'` z `_absenceEvidence`.
- „Wstrzymane/0 nie wracają": gałąź `:540-552`.
- Stare karty bez prefiksu i bez `kodDostawcy` → osobne zablokowane zgłoszenie `_absenceReview`.
- `meta.excludedCodes` → produkty odrzucone przez parser liczą się jako OBSERWOWANE
  (`:470-473`) — bez tego dałyby fałszywe braki.

### Krok 8 — `assignKodImportu` (#99, `:141-157`)
⚠ **Pierwsza gałąź DOSŁOWNIE**, bez „poprawiania":
```js
if(retained && /^\d{6}$/.test(retained)) { product.kodImportu = String(retained); return; }
```
Dalej: dopasowanie przez `compatibility()` po liście `listProducts()` (in-memory, nie SQL),
walidacja EAN, na końcu `crypto.randomInt` z pętlą unikalności do 100000 prób.
80 grup kolizji / 174 produkty (#108) to SKUTEK tej reguły — rozstrzygnięcie należy do Ani.
⚠ `bridge-ext.ts` eksportuje dziś `assignKodImportu` przez destructuring (kopia referencji) —
nadpisanie musi iść przez jawne przełączenie, nie mutację modułu CJS.

### Krok 9 — `updateStaging`: model → bieżnik (#105, `:168-187`)
Jeśli w starym snapshot `bieznik === model` (bieżnik był automatyczną kopią modelu)
i nie był zmieniany ręcznie, nowy `model` pociąga za sobą `bieznik`.

### Krok 10 — `updateProduct`: ochrona ręcznych wstrzymań (D-130.3, `:112-119`)
W `repos/products.ts` / trasie PATCH: jawna zmiana `status` kasuje wpis
z `product_auto_suspensions` (`usunAutomatyczneWstrzymanie`).

### Krok 11 — podmiana seamu i wywołań
- `tk.ts` staje się cienką warstwą nad `stworzPolitykeStagingu(...).importer`; typ
  `SilnikStagingu` rozszerzony o opcjonalne `options` (`feedComplete`, `reconcileOnly`,
  `verifyAbsence`, `parserErrors`).
- Wołający: `routes/import.ts`, `routes/suppliers.ts`, `routes/staging-mutacje.ts`,
  `import/synchronizuj.ts` — przekazują `meta` z `WynikParsowania` i mapują nowe klasy błędów na 400.

### Krok 12 — charakteryzacja (D-130.6)
- `scripts/charakteryzacja-silnik-nagraj.mjs`: budować `tk` przez
  `staging_policy.install({U, db, normalize, classify, badName, ext})` z `88fa31c`
  zamiast wycinać martwą funkcję z bundla.
- Przenagrać MO1–MO10 z `db/snapshot.db`; `git diff` wzorców opisać w `raport.md`
  jako skutek #99/#103/#104.
- `test/silnik.gate.test.ts`: przypadek „EAN w notacji naukowej" przepisać z okna
  przejściowego na **oczekiwaną blokadę akceptacji** (D4). Zmierzony konkret:
  `"8,05997E+12"` → `kod MO1_GATE-NORMEAN`, `ean null`, `eanRaw "8,05997E+12"`, `_eanLossy true`.

## Strategia testów

- **Gate odbudowy:** porównanie odpowiedzi z fixtures z tabeli „Kontrakt i fixtures" —
  kształt 1:1, wartości deterministyczne 1:1. `GET /api/products` musi nadal dawać 72 klucze
  (bez `uwagaCena` — kolumna z runtime'owego `ALTER TABLE` jest dla Drizzle niewidoczna).
- **Charakteryzacja:** MO1–MO10 przeciw wzorcom przenagranym z `install()` @ `88fa31c`.
  To jest główny dowód wierności portu.
- **Jednostkowe, na realnej bazie w katalogu tymczasowym** (bez mocków bazy):
  progi blokad źródła (pusty / błędy parsera / <80% maksimum / masowo nierozpoznany);
  reguła 3×24 h (trzy różne odciski, odrzucenie powtórki, brak upływu 24 h);
  auto-wstrzymanie i pewny powrót; **ochrona ręcznego wstrzymania** (nie wraca do `aktywny`);
  `suspended_at` niezmieniane przy konflikcie; dopasowanie po EAN przy 1 / 2 / 0 kandydatach;
  ochrona DOT, DEMO i wariantów; `assignKodImportu` — zachowanie istniejącego 6-cyfrowego kodu;
  model → bieżnik; `updateProduct` kasujące znacznik automatu.
- **Bez atrap Selly** — szew dostępności testowany jako wstrzyknięta funkcja licząca wywołania.
- Pomijamy: trasy `review`/`resolve` (I15.4c), realne wywołania `availability_sync` (I15.10).

## Poza zakresem

- Akceptacja i trasy `review`/`resolve`/`choose-absence-card`/`close-absence-review` — **I15.4c**.
- Migracja, model Drizzle, `repos/staging-polityka.ts` — **I15.4a** (tylko wołam).
- `legacy/**` — **I15.2**. Selly, `sync-delta`, `sync-full`, `dostepnosc.ts` — **I15.10**.
- Panel „Braki w cenniku" — **I15.5**. Rozstrzygnięcie kolizji `kod_importu` (#108) — decyzja Ani.
- `docs/rebuild-roadmap.md` — nie dotykam (CLAUDE.md reguła 0).

## Definition of done

- [ ] `_bridgeFeedMeta` dochodzi z parserów do silnika (pole w `WynikParsowania`)
- [ ] Cztery blokady źródła działają i dają 400 z własnymi klasami błędów
- [ ] Reguła wycofań: 3 różne kompletne oferty + 24 h, dowody w trzech tabelach
- [ ] Auto-wstrzymania działają; **ręczne wstrzymania przeżywają import i pewny powrót**
- [ ] `updateProduct` kasuje znacznik automatu przy jawnej zmianie `status`
- [ ] Dopasowanie po EAN tylko do jednej zgodnej opony; DOT, DEMO i warianty chronione
- [ ] `assignKodImportu` zachowuje istniejący sześciocyfrowy `kod_importu` (dosłownie)
- [ ] Edycja modelu w stagingu aktualizuje bieżnik, gdy był jego automatyczną kopią
- [ ] Szew dostępności wystawiony, domyślnie no-op, opisany w „Do koordynatora"
- [ ] Wzorce charakteryzacji przenagrane z `install()` @ `88fa31c`, rozjazdy opisane
- [ ] Gate odbudowy: fixtures z tabeli zgodne co do kształtu i wartości deterministycznych
- [ ] `lint`, `typecheck`, `build`, `test` zielone (baseline: 1754 przechodzi, 7 pominiętych)
- [ ] `docs/karty/I15.4b/karta.md` opisuje STAN; backlog #104 podniesiony na ✅
