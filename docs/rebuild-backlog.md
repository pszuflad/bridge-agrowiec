# Rebuild backlog — zmiany produkcji do naniesienia na nową wersję

Powierzchnia kontroli nad tym, **które zmiany Ani z żywej produkcji trafiają do
odbudowywanego stosu** (`rebuild/`). Ty decydujesz per zmiana; ja opisuję i implementuję
zatwierdzone.

## Jak to działa

```
Ania zmienia produkcję → producent (commit + mail z diffem/etykietą)   [automat]
      → ja: opis biznesowy + rekomendacja (tu, w tabeli)               [Claude]
      → Ty: kolumna „Do nowej wersji?" = TAK / NIE / PÓŹNIEJ           [decyzja]
      → zatwierdzone: implementacja w rebuild/ + status DONE           [Claude Code]
```

**Zakres:** śledzimy zmiany **po snapshocie kontraktu z Fazy 2** (spec objął stan
bundla do ~2026-08-05, MD5 `b745bf95`). Wcześniejsze zmiany są już w specyfikacji.

**Legenda „Do nowej wersji?":** ⬜ do decyzji · ✅ TAK · ❌ NIE (świadomie pomijamy) · 🕒 PÓŹNIEJ
**Legenda „Status":** — nie zaczęte · 🔨 w toku · ✔ zrobione w rebuild

---

## Backlog

### #1 · 2026-08-18 · [BACKEND] · `sniegfix`

| Pole | Wartość |
|---|---|
| **Data** | 2026-08-18 09:03 |
| **Kategoria** | BACKEND (import / parsery) |
| **Pliki** | `parsers/adapter.cjs`, `parsers/tyre_params.cjs` (kopie `*.bak_pre_sniegfix_20260818090314`) |
| **Commit** | `7bd31de` sync(vps) |
| **Do nowej wersji?** | ✅ **TAK** (decyzja 2026-08-26, ticket `4-FEATURE-port-parserow-charakteryzacja`) |
| **Status** | ✔ zrobione w rebuild (wniesione **portem**, I3/3a) |

**Opis biznesowy:**
Kolumna „Śnieg" (zdolność zimowa opony) w katalogu pokazywała dla części opon
bezsensowne wartości techniczne — „0.0" albo „1.0" — zamiast czytelnego „Tak"
(opona z oznaczeniem zimowym) lub pustego pola (brak oznaczenia).
Przyczyna: import traktował oznaczenie śniegu jak *ilość sztuk* (liczbę), przez co
zapisywał „0.0/1.0" zamiast flagi. Poprawka: teraz kolumna pokazuje „Tak" tylko gdy
opona faktycznie ma oznaczenie zimowe (snow/3PMSF), inaczej zostaje pusta — nigdy
liczby. Naprawione w dwóch miejscach łańcucha importu (adapter + parametry opony).

**Szczegół techniczny (dla rebuildu):**
Dodano dwie funkcje normalizujące flagę: `normalizeLabelSnowValue(rawLabelSnow, snow3pmsf)`
(adapter) i `normalizeLabelFlag(value)` (tyre_params). Zwracają wyłącznie `'Tak'` albo
`null`. Wcześniej `enriched.labelSnow ?? enriched.snow3pmsf` oraz `normalizeQty(record.labelSnow)`
wpychały surową flagę 0/1 do kolumny TEXT.

**Zrealizowane (2026-08-26, I3/3a).** Wniesione **portem verbatim** `parsers/adapter.cjs`
+ `parsers/tyre_params.cjs` do `rebuild/backend/src/import/legacy/` — `normalizeLabelSnowValue()`
i `normalizeLabelFlag()` działają w nowym stosie bez reimplementacji. Poprawka `flagsfix`
(backlog #6) rozszerzyła tę samą konwencję na `cfo`/`stubbleResistant` i też weszła portem.
Potwierdzone charakteryzacją MO1–MO10 (`rebuild/backend/test/charakteryzacja.test.ts`,
711 rekordów wzorca): `labelSnow`, `snow3pmsf`, `ms`, `cfo` przyjmują wyłącznie `"Tak"`
albo `null` — nigdy 0/1.

⚠ **Otwarte, znalezione przy realizacji:** przewidywanie z rekomendacji poniżej („ta sama
zasada dotyczy prawdopodobnie innych pól-flag") **sprawdziło się dla dwóch pól, których
`flagsfix` nie objął**: `nro` i `cho` nadal przyjmują wartości **liczbowe 0/1**
(zweryfikowane na tych samych 711 rekordach). Port odtwarza to wiernie, bo taka jest
produkcja. Do rozstrzygnięcia jako osobna decyzja — patrz `raport.md` ticketa
`4-FEATURE-port-parserow-charakteryzacja`, sekcja „Follow-up".

**Rekomendacja (moja):** ✅ **nanieść** — to realna poprawka poprawności danych, którą
nowy backend musi odtworzyć. Dotyczy warstwy import/adapter (kierunek A Fazy 4).
Ta sama zasada dotyczy prawdopodobnie innych pól-flag etykiety UE (`label_ice`,
`ms`, `reinforced` itd.) — do sprawdzenia przy przepisywaniu adaptera, czy nie mają
tego samego błędu „ilość zamiast flagi".

### #2 · 2026-08-18 · [BACKEND][BAZA] · `kategoriafix`

| Pole | Wartość |
|---|---|
| **Data** | 2026-08-18 11:48 |
| **Kategoria** | BACKEND (import/adapter, klasyfikator) + BAZA (dane) |
| **Pliki** | `common.cjs`, `parsers/adapter.cjs`, `zastosowania/audit.cjs` (kopie `*.bak_pre_kategoriafix_20260818114801`) |
| **Commit** | `740b273` sync(vps) |
| **Do nowej wersji?** | ✅ **TAK** (decyzja 2026-08-26, ticket `4-FEATURE-port-parserow-charakteryzacja`) |
| **Status** | ✔ zrobione w rebuild (wniesione **portem**, I3/3a) |

**Opis biznesowy:**
Kategorie produktów miały **duplikaty różniące się tylko wielkością liter**
(np. „rolnicze" i „Rolnicze" jako dwie osobne kategorie) — **537 rekordów** —
co psuło statystyki i filtry w panelu. Ania scaliła je do jednej formy z wielkiej
litery (stan: Rolnicze 4533, Ciężarowe 1463, Przemysłowe 1195, Leśne 214) i naprawiła
**u źródła**, żeby nie wracały. Analogicznie ujednolicono `zastosowanie` (343 rekordy)
i dodano 5 brakujących wartości do słownika.

**Szczegół techniczny (dla rebuildu):**
- `classifyByName()` (common.cjs) zwraca teraz formy z wielkiej litery (było z małej).
- **Nowa `capitalizeKategoria()` (common.cjs)** — mapuje każdy wariant (mała/wielka,
  z/bez polskich znaków) na formę kanoniczną; wołana w **`adapter.cjs` → `recordToSurowe()`
  na KOŃCU potoku (przed zapisem)** → obejmuje wszystkich dostawców (też MO9 i hardkody
  w `tyre_params.cjs`) bez edycji każdego parsera.
- `zastosowania/audit.cjs` — słownik `SLOWNIK` ujednolicony, żeby audyt nie zgłaszał
  naprawionych wartości jako błędnych.

**Zrealizowane (2026-08-26, I3/3a).** Wniesione **portem verbatim** `common.cjs`
+ `parsers/adapter.cjs`. `capitalizeKategoria()` działa dokładnie tam, gdzie w produkcji —
na końcu `recordToSurowe()`. Charakteryzacja to potwierdza wprost: eksperymentalne cofnięcie
tego wywołania zapala 10 asercji gate'u (`przemysłowe` zamiast `Przemysłowe` itd.).
Zakres 3a nie obejmuje `zastosowania/audit.cjs` (skrypt audytowy, nie potok importu).

**Rekomendacja (moja):** ✅ **nanieść** — poprawka jakości danych + **dobry wzorzec
architektoniczny**. Potwierdza regułę: **`adapter.recordToSurowe()` to centralne miejsce
finalnej normalizacji** wszystkich pól przed zapisem (tu: kategoria; przy sniegfix: labelSnow).
Nowy adapter powinien mieć jeden blok „normalizacja końcowa" — kategoria, zastosowanie,
flagi etykiety UE — zamiast rozsypanych hardkodów po parserach.

Od Iteracji 2 (`3-FEATURE-katalog-odczyt`) katalog **wyświetla i filtruje** po kolumnie `kategoria`
(pass-through z bazy, bez normalizacji po stronie API) — ta decyzja dotyczy więc teraz również
tego, co użytkownik realnie widzi w panelu, nie tylko statystyk importu.

### #3 · 2026-08-18…19 · [BACKEND][BAZA][FRONTEND] · saga szerokości (`szerokoscfix`→`szerorig`→`szertxt`)

> **Trzy commity, jedna sprawa. Kolejne kroki COFAJĄ poprzedni** — dla odbudowy liczy się
> **tylko stan końcowy (`szertxt`)**. `szerokoscfix` został w całości wycofany, **NIE nanoś go**.

| Pole | Wartość |
|---|---|
| **Data** | 2026-08-18 12:12 → 2026-08-19 16:00 |
| **Kategoria** | BACKEND (parser/wymiary) + BAZA (typ kolumny) + FRONTEND (regeneracja eksportu) |
| **Pliki (stan końcowy)** | `parsers/tyre_params.cjs`, `bridge_ext.cjs`, `db/schema.sql` (kolumna `products.szerokosc`); skasowane `probe.cjs/2/3`; kopie `*.bak_pre_szerokoscfix_*`, `*.bak_pre_szerorig_*`, `*.bak_pre_szertxt_*` |
| **Commity** | `97ccb9f` (szerokoscfix — cofnięty) · `5c060b0` (szerorig) · `d5a43c9` (szertxt) |
| **Do nowej wersji?** | ✅ **TAK — NANIESIONE** (decyzja użytkownika 2026-08-27, ticket `7-FEATURE-silnik-zatwierdzanie-wycofania-overrides`, plan.md D3) |
| **Status** | ✅ **ZREALIZOWANE 2026-08-27 (I3/3d-1)** — migracja `rebuild/schema/003_szerokosc_text.sql` + `src/db/schema.ts` (`text()`). Zostaje JEDNO: przenagranie `GET_products.json` w **I12**. |

**Opis biznesowy:**
Kolumna „szerokość" opony była niespójna: ten sam rozmiar (np. „11.2-24") zapisywał się raz jako
11.2 (cale), raz 284.5 (mm) — 177 rozmiarów rozjechanych, 2027 rekordów. Ania naprawiała to w trzech
podejściach: **(1) szerokoscfix** — ujednolicić wszystko do mm (backfill 1827 rekordów); okazało się
błędne, bo przelicznik `tireWidthMm()` mylił notację opon rolniczych („14.9x28" = szerokość 14.9″, nie
średnica) i dawał bzdury „706.2"/„609.6". **(2) szerorig** — cofnięto mm, szerokość zostaje w **jednostce
oryginalnej** z rozmiaru, usunięto wadliwy fallback. **(3) szertxt** — dodatkowo zachować **oryginalny
zapis z zerami** („10.00", „14.9", „800"); że float tego nie utrzyma, **zmieniono typ kolumny
`products.szerokosc` na TEXT** i przemigrowano dane.

**Stan docelowy (co ma robić nowa wersja):** `products.szerokosc` = **TEXT**, przechowuje **pierwszą
liczbę z tekstu rozmiaru 1:1, z zerami końcowymi**, bez konwersji jednostek.

**Szczegół techniczny (dla rebuildu) — TYLKO stan końcowy:**
- `parseSize()` (tyre_params.cjs): dalej liczy `widthCm` (float) na potrzeby `wysokoscBokuCm` /
  `wysokoscRzeczywistaCm` (formuła wymaga cm — **nie ruszać**), ale `result.szerokosc` = **string** =
  pierwsza liczba z rozmiaru (regex `(\d+(?:[.,]\d+)?)`, przecinek→kropka). Pole pomocnicze
  `szerokoscRaw` trzyma to samo.
- `bridge_ext.cjs applyDims()`: **usunąć fallback `tireWidthMm()`** — gdy parser nie wykrył szerokości,
  zostaje `null`. `tireWidthMm()` z `tire_dims.js` jest odtąd martwy dla szerokości (bug AxB/WxD).
- **Schemat:** `products.szerokosc` `REAL` → **`TEXT`** (`szerokosc_paczki` zostaje REAL — inna kolumna).
- Skrypty jednorazowe Ani (`backfill_szerokosc_*`, `migrate_szer_to_text.cjs`, `patch_szertxt*`,
  `backup_szertxt.cjs`) — operacyjne, **nie są celem odbudowy** (nowy import od razu zapisuje poprawnie).

**⚠ Rozjazdy — stan po 3d-1 (2026-08-27):**
- ✅ **Schemat ZROBIONY.** `001_schema.sql` zostaje NIETKNIĘTY (jest datowanym punktem zerowym =
  stan produkcji 2026-08-17, `rebuild/schema/README.md`); zmianę wnosi migracja przyrostowa
  `003_szerokosc_text.sql`, która przebudowuje tabelę (SQLite nie ma `ALTER COLUMN`). Strażnik
  przed dryfem duplikatu DDL: `test/db.migracje.test.ts` porównuje kolumny żywej tabeli z kanonem.
- ⬜ **Fixture — ZOSTAJE do I12.** `GET_products.json` ma `szerokosc` liczbową (nagrany przed
  migracją produkcji). GATE I2 przepuszcza to przez **zadeklarowany, samoczyszczący się wyjątek**
  `WYJATKI_SZEROKOSC` (`test/katalog.gate.test.ts`): niesie powód i wskazanie na I12, a gdy
  przestanie cokolwiek pokrywać — zapali test i wymusi swoje usunięcie.
- 🔎 **Warto wiedzieć przy przenagrywaniu:** `db/snapshot.db` (2026-08-13) jest STARSZY niż
  migracja `szertxt` (2026-08-19) i ma jeszcze `szerokosc REAL`, więc sam nie nadaje się na
  źródło wartości „z zerami końcowymi".

**Warstwa parsera — zrobiona (2026-08-26, I3/3a), decyzja o schemacie nadal otwarta.**
Port verbatim `tyre_params.cjs` wniósł stan końcowy `szertxt` do `rebuild/backend`: `parseSize()`
zwraca `szerokosc` jako **string** z zerami końcowymi (`"10.00"`, `"400"`), a `widthCm` dalej liczy
`wysokoscBokuCm`/`wysokoscRzeczywistaCm` z floata. W 3a nie ma bazy, więc dotyczy to wyłącznie
kształtu rekordu w pamięci. **Zmiana `products.szerokosc` REAL→TEXT została naniesiona
w 3d-1 (2026-08-27); zostaje wyłącznie przenagranie `GET_products.json` w I12.**

⭐ **Dlaczego to NIE była kosmetyka (ustalenie z 3d-1).** Port parsera od 3a produkuje napisy,
ale SQLite stosuje TYPE AFFINITY: do kolumny `REAL` napis `"10.00"` wchodzi jako liczba `10.0`
i zera przepadają — kanon fizycznie niszczył dokładnie to, po co `szertxt` powstał. Dopóki nikt
tej kolumny nie zapisywał, było to nieszkodliwe; `acceptStaging` (sesja **3d-2**) jest jej
JEDYNYM pisarzem, więc od jego wejścia każda zaakceptowana pozycja zapisywałaby uszkodzoną
wartość. Stąd decyzja, żeby zmienić typ TERAZ, przed 3d-2.

🔎 **PRZYCZYNA ŹRÓDŁOWA — namierzona 2026-08-26. Fallback na mm jest OBJAWEM, nie chorobą.**

Właściwy błąd siedzi w `parseSize()` (`tyre_params.cjs:214`), w regexie notacji ze slashem:

```js
/^(VF|IF)?(\d{2,4}(?:\.\d+)?)\/(\d{1,3}(?:\.\d+)?)([RBD-])(\d{1,3}(?:\.\d+)?)$/i
//          ^^^^^^^ szerokość wymaga 2-4 CYFR przed kropką
```

`\d{2,4}` nie dopuszcza **jednocyfrowej części całkowitej**, więc rozmiary małych opon
rolniczych/przyczepkowych w ogóle nie są rozbijane. Zweryfikowane:

| Rozmiar | `parseSize()` |
|---|---|
| `6.5/80-12`, `6.50/80-12` | ❌ szerokość, profil, średnica = `null` |
| `9.5/65-15`, `7.5/80-12`, `5.5/65-12` | ❌ wszystko `null` |
| `10.0/75-15.3`, `12.5/80-18`, `16.5/70-18`, `65/80-12` | ✅ rozbite poprawnie |

Dopiero **dlatego** odpala się fallback `parseWidthFallbackMm(record.szerokosc)` i przelicza
`6.5` cala na `165.1` mm. Naprawa samego fallbacku ukryłaby objaw, ale rozmiar dalej nie miałby
profilu ani średnicy — a te idą do wyliczeń wymiarów i wagi gabarytowej.

**Rekomendacja: naprawić regex** (`\d{2,4}` → `\d{1,4}`, do rozważenia także w dwóch
bliźniaczych wzorcach w liniach 195 i 204), a dopiero potem zdecydować, co ma robić fallback.
Po naprawie regexu fallback dla tych rozmiarów przestanie się w ogóle odpalać.

✅ **POTWIERDZONE PRZEZ ANIĘ (2026-08-26): fallback na milimetry to BŁĄD, nie zamierzone
zachowanie.** „To jest ewidentnie błąd, który nie został naprawiony przy naprawie parserów […]
to nie powinno się tak przeliczać na te milimetry, tylko powinno być w calach." Do usunięcia
razem z decyzją o typie kolumny.

⚠ **Znalezione przy realizacji — `szertxt` NIE jest kompletny.** `normalizeJmk` (MO2)
i `normalizeHandlopex` (MO4/MO5) mają fallback `size.szerokosc ?? parseWidthFallbackMm(record.szerokosc)`
(`tyre_params.cjs:520` i `:1069`). `parseWidthFallbackMm()` to pozostałość po **cofniętym**
`szerokoscfix` — przelicza cale na milimetry i zwraca **float**, nie string. Odpala się, gdy
`parseSize()` nie rozbije rozmiaru: w próbce MO2 (200 wierszy) trafił 1 rekord, `rozmiar
"6.5/80-12"` → `szerokosc 165.1` zamiast `"6.5"`. Efekt: kolumna `szerokosc` może dostać
**liczbę w mm obok stringów w calach** — dokładnie ta niespójność, którą `szerorig`/`szertxt`
miały zlikwidować. Port odtwarza to wiernie (nie naprawiamy zachowania w 3a), ale przy decyzji
o REAL→TEXT trzeba to domknąć, inaczej TEXT dostanie wartości w dwóch różnych jednostkach.

**Rekomendacja (moja):** ✅ **nanieść stan końcowy (szertxt)**, ❌ **pominąć szerokoscfix** (cofnięty).
Realna poprawka poprawności danych. Wzorzec architektoniczny: `szerokosc` staje się polem
**prezentacyjnym** (TEXT, oryginał), a liczby do obliczeń (`widthCm`) żyją osobno — nowy parser powinien
rozdzielić „surowy zapis do wyświetlenia" od „liczby do matematyki".

**Ustalenia z Iteracji 2 (ticket `3-FEATURE-katalog-odczyt`) — odblokowują tę decyzję, ale jej NIE
podejmują (status zostaje 🕒 PÓŹNIEJ):**
1. Backend czyta `szerokosc` bez konwersji (pass-through) — Drizzle `real()` nie mapuje wartości z drivera,
   a SQLite jest dynamicznie typowany, więc ta sama linia kodu oddaje **liczbę** na kanonie/`db/snapshot.db`
   (kolumna REAL, potwierdzone `620`, `typeof number`) i **string** na stagingu po `szertxt` (kolumna TEXT,
   potwierdzone `"10.00"`, `typeof string` — po odtworzeniu migracji na bazie testowej).
2. Kanoniczny schemat **fizycznie nie potrafi** przechować tego, co trzyma staging — SQLite *type affinity*
   konwertuje zapis `'10.00'` do kolumny REAL na liczbę `10.0`. GATE nie łapie tego rozjazdu, bo baza testowa
   powstaje z kanonu — to nie luka harnessu, tylko właściwość schematu.
3. **⚠ Najważniejsze: w UI rozjazd jest w większości niewidoczny, bo oryginał już go rozwiązał.** `Wfmt`
   (`deminified/frontend-index.js:23098-23119`, odtworzona jako `formatujSzerokosc`,
   `rebuild/frontend/src/pages/katalog/formatowanie.tsx`) nie ufa wartości z bazy — odzyskuje zapis z pola
   `rozmiar`, szukając tokenu liczbowego równego szerokości, i zwraca go w oryginalnym brzmieniu. Dopóki
   `rozmiar` zawiera pasujący token, `10` (REAL) i `"10.00"` (TEXT) renderują się identycznie. To istotnie
   obniża koszt i ryzyko przejścia na TEXT.
4. Różnica JEST widoczna przy sortowaniu po kolumnie „Szerokość opony" — liczby sortują się numerycznie,
   stringi leksykalnie (`"100"` przed `"9"`); zachowanie oryginału.
5. Propozycja domknięcia (do decyzji tutaj, nie w I2): przyjąć `szertxt` w całości — schemat i Drizzle
   REAL→TEXT, przenagrać `GET_products.json` — plus rozstrzygnąć, czy sortowanie po szerokości ma zostać
   leksykalne (po przejściu na TEXT stanie się jedynym wariantem). Szczegóły i dowody empiryczne:
   `docs/tickets/3-FEATURE-katalog-odczyt/raport.md`, sekcja „Rozjazd `szerokosc`".
6. **Świadomie NIE ruszone przy 3b** (ticket `5-FEATURE-staging-endpointy-importu`, 2026-08-26).
   `staging_items` nie ma kolumny `szerokosc` — wartość jedzie w `snapshot_json` jako TEXT, więc
   staging zachowuje `szertxt` wiernie bez żadnej migracji; kolumnę `products.szerokosc` zapisuje
   wyłącznie `acceptStaging`, czyli 3d. Zmiana REAL→TEXT nadal łamie zielony gate I2
   (`GET_products.json` ma `"szerokosc": 620` jako liczbę), a przenagranie fixtures należy do I12.
   Dochodzi argument merytoryczny: `szertxt` jest niekompletny — `parseWidthFallbackMm()` nadal
   zwraca milimetry jako float (punkt wyżej); Ania to poprawia. Decyzja → 3d/I12.
7. **Świadomie NIE ruszone przy 3c** (ticket `6-FEATURE-silnik-tk-dopasowanie-klasyfikator`,
   2026-08-26). Silnik dopasowania (`tk()`) przepuszcza `szerokosc` jako string bez konwersji —
   `products.szerokosc` w rebuild pozostaje `REAL`. Różnica ujawni się dopiero przy zapisie do
   katalogu, czyli w `acceptStaging` (3d), gdy pole trafi z `snapshot_json` z powrotem do
   kolumny produktu. Decyzja o typie kolumny nadal → 3d/I12.

### #4 · 2026-08-24 · [BAZA][BACKEND][FRONTEND] · `uwaga_cena` (cena „na zapytanie")

| Pole | Wartość |
|---|---|
| **Data** | 2026-08-24 13:00–16:00 |
| **Kategoria** | BAZA (nowa kolumna) + BACKEND (endpoint, patche) + FRONTEND (tooltip) |
| **Pliki** | `db/schema.sql` (kolumna `uwaga_cena`), `uwaga_cena_patch.cjs` (nowy), `parsers/adapter.cjs`, `parsers/mo7_nokian.cjs`, `extensions.cjs` |
| **Commity** | `33455c8`, `c5d3d63`, `16bc37c` |
| **Do nowej wersji?** | ✅ **TAK** (parser + kolumna wniesione — I3/3a i 3b, 2026-08-26; otwarte: endpoint + propagacja) |
| **Iteracja** | **→ I3** (schemat: 3b ✔; endpoint + propagacja importu: 3d) **+ injection-tooltip** (późniejsza iteracja; wzorzec jak pending/selly/freq-injection) |
| **Status** | 🔨 częściowo zrobione (kolumna `products.uwaga_cena` w rebuild, I3/3b, 2026-08-26) — endpoint i propagacja → 3d |

**Opis biznesowy:** dostawcy czasem zwracają „cena na zapytanie" (np. „- zł" w Nokian dla wielkoformatowych VF Float King). Zamiast pokazywać 0/pustą cenę, produkt dostaje notatkę i jest „wstrzymany"; frontend pokazuje tooltip z powodem.

**Szczegół techniczny:** nowa kolumna `products.uwaga_cena TEXT`; `uwaga_cena_patch.cjs`: idempotentny `ALTER TABLE ADD COLUMN` + monkey-patch `U.acceptStaging` (odczyt `uwagaCena` ze `snapshotJson`) i `U.addProductsBulk`; **nowy endpoint `GET /api/products/uwagi-cena`** (lista wstrzymanych, dla tooltipu). Parser `mo7_nokian.cjs` i `adapter.cjs` propagują pole `uwagaCena`.

**Warstwa parsera — zrobiona (2026-08-26, I3/3a).** Port verbatim `parsers/adapter.cjs`
i `parsers/mo7_nokian.cjs` wniósł propagację pola `uwagaCena` (`detectPriceOnRequest()`);
to samo dotyczy MO8 Trelleborg, gdzie ten sam wzorzec doszedł 2026-08-25. Pole jest w typie
`RekordSurowy` i przechodzi przez charakteryzację. (W próbkach charakteryzacyjnych `uwagaCena`
jest wszędzie `null` — żaden z 711 rekordów nie trafił na „cenę na zapytanie"; to luka pokrycia
próbki, nie brak obsługi.)

**Kolumna — zrobiona (2026-08-26, I3/3b).** `products.uwaga_cena TEXT` dodana w migracji
`rebuild/schema/002_import.sql` (ta sama migracja co #7). Wartość już dziś dociera do stagingu
w `snapshot_json`, bo parsery z 3a propagują pole `uwagaCena`. Kolumna jest w bazie, ale
świadomie NIE wychodzi w `GET /api/products` — pilnuje tego jawna projekcja kontraktowa
(`rebuild/backend/src/repos/kolumny.ts`), dzięki czemu zamrożony `GET_products.json` (72 klucze)
pozostaje nietknięty do czasu przenagrania fixtures w I12.

**Podział doprecyzowany 2026-08-27 (I3/3d-1, decyzja użytkownika — plan.md D4):**
- **propagacja** w `acceptStaging` (odczyt `uwagaCena` ze `snapshotJson` → `products.uwaga_cena`)
  → **3d-2**, u swojego pisarza;
- **endpointy** → **I12**, razem z dopisaniem do `openapi.yaml`. ⚠ **Endpointy są DWA, nie jeden**
  — produkcja realizuje to monkey-patchem `mirror/backend/uwaga_cena_patch.cjs`, który dokłada
  `GET /api/products/uwagi-cena` ORAZ `GET /api/products/hold-reasons` (powód wstrzymania liczony
  w locie: `uwaga_cena` dosłownie / brak ceny i stanu / brak ceny / brak stanu / „sprawdź ręcznie").
  Ten sam patch monkey-patchuje też `addProductsBulk` — to trzeci pisarz, do uwzględnienia w 3d-2.

**Potwierdzone przy 3c (2026-08-26).** Silnik dopasowania serializuje `snapshotJson` z rekordu
PO `znormalizujPozycje()` (`Hq()`), która kopiuje wszystkie pola wejścia przez spread —
`uwagaCena` przechodzi bez zmian. Materiał dla `acceptStaging` (3d) jest więc już na miejscu
w stagingu, nic dodatkowego nie trzeba było robić w 3c.

**Rekomendacja:** ✅ **nanieść, ale NIE jako łatka do I2.** Po przeglądzie raportu I2 (2026-08-25): `uwaga_cena` rozkłada się jak inne rzeczy odłożone przez I2 — **schemat** (nowa kolumna, razem z decyzją #3) + **endpoint `/api/products/uwagi-cena`** + **propagacja w imporcie** (`acceptStaging`, parser mo7/adapter) → **I3**; **frontend to skrypt injection do tooltipu** (wprost z komentarza w `uwaga_cena_patch.cjs`) → wchłonięcie injection w późniejszej iteracji. Katalog I2 odtworzył bundle **sprzed** `uwaga_cena`, a dołożenie pola do `GET /api/products` złamałoby GATE wobec zamrożonego `GET_products.json` (przenagranie fixtures należy do I12). Dlatego I2 zostaje zamknięte, a to wchodzi u swoich właścicieli.

### #5 · 2026-08-24 · [BACKEND] · `frazy` (dopasowanie fraz — rozstrzygnięte: poza zakresem importu)

| Pole | Wartość |
|---|---|
| **Pliki** | `frazy_migruj.cjs` (nowy, +64), `common.cjs` (+23), `frazy_niedopasowane.json` (dane), `frazy_raport.json` |
| **Commit** | `33455c8` |
| **Do nowej wersji?** | ❌ **NIE** jako zadanie importu (rozstrzygnięte 2026-08-26, I3/3a — patrz niżej); ⬜ **DO DECYZJI** jako osobne narzędzie Selly, świadomie poza zakresem całej I8 (8a+8b, zamknięta 2026-09-04) |
| **Iteracja** | → rozstrzygnięte przy **I3/3a**: nie jest normalizacją w adapterze; backend Selly dowieziony w **I8/8a**, natywny panel `/selly` we froncie w **I8/8b**, oba BEZ `frazy` — poza zakresem obu sesji (`docs/tickets/28-FEATURE-selly-eksport-backend/plan.md`, „Poza zakresem"; `docs/tickets/30-FEATURE-selly-panel-frontend/plan.md`, D1) |
| **Status** | ✔ zbadane i rozstrzygnięte (I3/3a, 2026-08-26); narzędzie `frazy` samo nadal nieportowane po zamknięciu I8 |

**Opis (stan na 2026-08-24, przed zbadaniem):** system migracji/dopasowania „fraz" — podejrzewany
jako normalizacja `zastosowanie`/nazw w adapterze. Changelog Ani nieaktualny, szczegóły wymagały
potwierdzenia z diffa — zbadane niżej.

**ROZSTRZYGNIĘTE (2026-08-26, I3/3a) — to NIE jest normalizacja w adapterze.** Zbadane w kodzie:
`frazy_migruj.cjs` to **samodzielny skrypt jednorazowy**, który czyta statyczny plik
`/tmp/frazy_migracja.json` i woła `selly/client.cjs` (PUT do zewnętrznego Selly). W `common.cjs`
słowo „frazy" **nie występuje ani razu** (grep: 0 trafień) — przyrost +23 linii w tym commicie
dotyczy czegoś innego. Nic w potoku `parser → adapter → recordToSurowe()` się o to nie opiera.

**Wniosek:** poza zakresem I3. To narzędzie operacyjne integracji Selly — jeśli w ogóle ma
odpowiednik w odbudowie, to przy **I8 (Selly)**, nie przy imporcie ani atrybutach.
**Rekomendacja: ❌ NIE** jako zadanie importu; do rozważenia w I8, gdy będziemy odtwarzać
integrację Selly.

**Aktualizacja 2026-09-04 — I8 zamknięta w całości (8a + 8b).** Backend Selly (10 tras panelu —
słowniki, producenci/kategorie, synchronizacja produktu/dostawcy, status/log, eksport CSV,
ticket `28-FEATURE-selly-eksport-backend`) i natywny panel `/selly` we froncie
(ticket `30-FEATURE-selly-panel-frontend`) są dowiezione. `frazy_migruj.cjs` to osobny,
jednorazowy skrypt operacyjny (czyta `/tmp/frazy_migracja.json`, woła Selly bezpośrednio) i
celowo NIE wszedł w zakres żadnej z sesji — pozostaje ⬜ do decyzji, czy w ogóle potrzebuje
odpowiednika w odbudowie.

### #6 · 2026-08-21…25 · [BACKEND] · bieżące poprawki parserów (`flagsfix`, mo8, batch) → obsłużone PORTEM

| Pole | Wartość |
|---|---|
| **Pliki** | `parsers/adapter.cjs`, `parsers/tyre_params.cjs`, `parsers/mo8_trelleborg.cjs`, `parsers/mo7_nokian.cjs` + inne w źródle |
| **Commity** | `3be0ccc` (flagsfix), `08be0f3` (mo8), część `ba3cc6e` |
| **Do nowej wersji?** | ✅ **TAK (automatycznie)** |
| **Iteracja** | **→ I3 (port)** |
| **Status** | ✔ zrobione w rebuild (I3/3a, 2026-08-26) |

**Opis:** bieżące poprawki parserów Ani (flagi etykiet, MO8 Trelleborg, itd.). **Rekomendacja:** ✅ **objęte strategią „port parserów z najświeższego źródła" (I3/3a)** — nie wymagają osobnej implementacji; portując aktualny stan `parsers/`, dostajemy je wszystkie za darmo. To główny argument za portem, nie rewrite.

### #7 · 2026-08-26 · [BACKEND][KONFIGURACJA] · MO6 Agrowiec — wycofanie dostawcy z importu

| Pole | Wartość |
|---|---|
| **Data** | 2026-08-26 |
| **Kategoria** | BACKEND (konfiguracja dostawców) |
| **Pliki** | konfiguracja `suppliers` (nie kod parsera) |
| **Do nowej wersji?** | ✅ **TAK** (decyzja produkcji, potwierdzona 2026-08-26) |
| **Iteracja** | **→ 3b** (uruchamianie importu) / **I11** (edycja dostawcy) |
| **Status** | ✔ zrobione w rebuild (I3/3b, 2026-08-26) — strażnik importu; edycja dostawcy nadal I11 |

**Opis biznesowy:** dostawca MO6 (Agrowiec / Uniglory) przestaje być importowany. Decyzja dotyczy
**również żywej produkcji** — Ania wyłącza go u siebie — więc dla odbudowy to nadal wierne
odtworzenie stanu, nie nasze odstępstwo.

**Co dokładnie oznacza:**
- **W katalogu NIE MA żadnych produktów MO6** — zweryfikowane na kanonicznym snapshocie
  (`db/snapshot.db`, stan 2026-08-13): tabela `products` nie zawiera ani jednego rekordu
  z `dostawca = 'MO6'`. Kwestia „co z danymi historycznymi" jest więc bezprzedmiotowa; nie ma
  czego zachowywać ani kasować. Zgadza się to ze słowami Ani: „a jak nie ma nic w bazie,
  to też nie powinno tam nic być".
- **Parser `mo6_agrowiec.cjs` zostaje w porcie** (`rebuild/backend/src/import/legacy/parsers/`) —
  port jest kopią bajt-w-bajt produkcji i wybiórcze usuwanie plików łamie jego główną własność
  (test integralności sha256). Parser po prostu przestaje być wołany.
- **Wyłączenie realizuje się w konfiguracji `suppliers`**, nie w warstwie parserów.
- **Próbka charakteryzacyjna MO6 zostaje** — dalej dowodzi wierności portu, nic nie kosztuje,
  a gdyby dostawca wrócił, pokrycie jest gotowe.

**Sprawdzone, żeby nie stracić danych:** automatyczne wycofywanie po 3 nieobecnościach **nie
zagraża** pozycjom MO6. Licznik `nieobecnosc_pod_rzad` rośnie wyłącznie wewnątrz `tk()`, a `tk()`
działa na produktach jednego dostawcy (`deminified/backend-index.cjs:47598`). Skoro MO6 nie jest
importowany, `tk('MO6', …)` nigdy się nie wykonuje. Ryzyko powstałoby tylko przy uruchomieniu
importu MO6 z pustym plikiem — i dotyczy tak samo każdego innego dostawcy.

✅ **DOPRECYZOWANE PRZEZ ANIĘ (2026-08-26): MO6 nigdy nie był importem automatycznym.**
Uniglory wgrywano **ręcznie**; na serwerze nie ma dla niego skonfigurowanego auto-pulla.
Wycofanie sprowadza się więc do „nikt już nie wrzuca pliku" — nie ma czego wyłączać w harmonogramie
ani czego kasować. Wpis `MO6` w mapie `URLS` w `dispatcher.cjs` jest zapisem nieużywanym.

**Konsekwencja dla 3b:** mapa `URLS` w dispatcherze wymienia wszystkich 10 dostawców, ale
**co najmniej MO6 i MO8 są w praktyce importami ręcznymi** (patrz #8 — Trelleborg przychodzi
mailem „raz na jakiś czas" i Marta wgrywa go ręcznie). Projektując endpointy importu, ścieżka
uploadu pliku jest dla tych dostawców jedyną realną, a nie wariantem pobocznym auto-pulla.

**Zrealizowane w 3b (2026-08-26).** Nowa kolumna `suppliers.import_wylaczony INTEGER NOT NULL
DEFAULT 0` (migracja `rebuild/schema/002_import.sql`), ustawiona na `1` dla MO6; oba endpointy
importu (`rebuild/backend/src/routes/import.ts`) odrzucają wywołanie dla wyłączonego dostawcy
komunikatem „Dostawca MO6 jest wyłączony z importu" (400). Osobna kolumna zamiast
`suppliers.status`: produkcyjne endpointy importu po każdym udanym przebiegu robią
`updateSupplier({status:'aktywny'})` (`extensions.cjs:155-160`, `:247-252`), więc `status` sam
kasowałby się jako flaga — do tego jest przeliczany w locie przy odczycie (`przeliczStatus`) i
miesza stan zdrowia dostawcy z decyzją „importujemy czy nie". Parser `mo6_agrowiec.cjs` został
w porcie bajt-w-bajt, zgodnie z ustaleniem wyżej — po prostu nie jest wołany.

**Zastrzeżenie:** `UPDATE ... WHERE kod='MO6'` działa tylko, gdy wiersz MO6 istnieje w
`suppliers`. W produkcyjnej bazie istnieje. W świeżej bazie zbudowanej z samego kanonu tabela
jest pusta i flaga nie ma czego ustawić — wtedy strażnik przepuści MO6, bo adres z mapy `URLS`
dispatchera wystarcza do przejścia bramki „znany dostawca". Domknięcie → I11 albo seed
produkcyjny.

### #8 · 2026-08-26 · [BACKEND] · MO8 Trelleborg — cichy import zera pozycji przy pliku CSV

| Pole | Wartość |
|---|---|
| **Data** | 2026-08-26 (znalezione przy I3/3a) |
| **Kategoria** | BACKEND (parser MO8) |
| **Pliki** | `parsers/mo8_trelleborg.cjs` |
| **Do nowej wersji?** | ✅ **TAK** (decyzja Ani 2026-08-26) |
| **Iteracja** | **→ 3b** (bezpiecznik, pierwsza wersja) **→ 3c** (bezpiecznik przeniesiony do `tk()`, zakrywa wszystkie trasy); poprawka parsera MO8 — patrz „Gdzie naprawiamy" na końcu pliku |
| **Status** | 🔨 częściowo zrobione (bezpiecznik `PustyImportBlad` w `tk()`, I3/3c, 2026-08-26 — zakrywa wszystkie trasy silnika) — poprawka parsera MO8 nadal do portu (#6, Wariant A) |

**Opis biznesowy:** jeśli Trelleborg przyśle cennik jako CSV zamiast XLSX, import kończy się
**zerem zaimportowanych pozycji i bez żadnego komunikatu błędu**. Wygląda jak udany import
pustego cennika.

⚠ **ESKALACJA (2026-08-26, po prześledzeniu ścieżki uploadu): to nie jest tylko „import zera
pozycji" — to uruchomienie licznika wycofania na CAŁYM katalogu dostawcy.**

Prześledzona realna ścieżka, z której korzysta Marta (`POST /api/dostawcy/:kod/upload`,
`backend-index.cjs:48243`):
1. `nq(kod, bufor, rozszerzenie)` (`:48005`) zapisuje bufor do pliku tymczasowego i woła
   `dispatcher.parseByKod()` — **bez żadnej konwersji formatu**;
2. handler ma fallback na parser AI (`Wc`), ale **tylko w bloku `catch`** — odpala się wyłącznie,
   gdy parsowanie **rzuci wyjątek**;
3. MO8 na pliku CSV **nie rzuca** — zwraca `{records: [], errors: []}`, czyli „sukces". Fallback
   AI nigdy nie startuje;
4. `tk(kod, [])` (`:47584`) **nie ma zabezpieczenia przed pustym wejściem** — pętla
   `for (let u of r) if (!o.has(u.id))` podnosi `nieobecnosc_pod_rzad` **każdemu** produktowi
   tego dostawcy.

**Skutek: trzy takie uploady pod rząd i cały katalog Trelleborga (624 pozycje) idzie do stagingu
jako „wycofana".** Import wygląda przy tym na udany — alert w panelu mówi „wgrano plik
(0 produktów)".

**Czy to już się wydarzyło — nie.** Sprawdzone na kanonicznym snapshocie bazy (`db/snapshot.db`,
stan 2026-08-13): MO8 ma 624 produkty i **wszystkie mają `nieobecnosc_pod_rzad = 0`**. Ten CSV
nie był wgrywany panelem, przynajmniej do tej daty. Dla porównania liczniki > 0 mają MO1 (8),
MO2 (115), MO3 (29), MO4 (71), MO5 (109) — to normalna rotacja cenników.

**Szczegół techniczny:** `mo8_trelleborg.cjs` czyta plik przez `XLSX.readFile()` i iteruje
wyłącznie po arkuszach o nazwach `Radial` i `XPly`. SheetJS wczytuje CSV jako pojedynczy arkusz
`Sheet1`, więc filtr nie łapie nic i parser zwraca `records: []`, `errors: []`. Zweryfikowane
uruchomieniowo na realnym pliku od Ani (`_Trelleborg List Price_AG_April 2026_New_EPL_PL_BAL.csv`,
446 wierszy, układ kolumn arkusza XPly) — 0 rekordów.

✅ **DECYZJA ANI (2026-08-26): naprawić — MO8 ma czytać oba formaty.** „Trzeba dorobić to samo
w MO8." Ania dodała kontekst: wykrywanie formatu wprowadziła **tylko w jednym miejscu panelu**
(zakładka „Dostawcy"), a pozostałe ścieżki importu tego nie mają — MO8 jest właśnie taką ścieżką.

**Kontekst operacyjny:** Trelleborg wysyła **jeden plik, mailem, raz na jakiś czas**, a **Marta
wgrywa go ręcznie**. Nie ma tu auto-pulla, więc cichy import zera pozycji jest tym groźniejszy:
nie ma cyklicznego przebiegu, który następnym razem by to nadrobił.

**Aktualizacja 2026-08-26:** dostaliśmy już właściwy plik XLSX (arkusze `Radial`/`XPly`,
626 rekordów, 0 błędów) i jest w repo jako próbka charakteryzacyjna. **Nie unieważnia to
problemu** — parser dalej po cichu zwraca zero rekordów przy pliku CSV, a `tk()` dalej nie ma
zabezpieczenia przed pustym wejściem. Ryzyko jest tym bardziej realne, że **plik CSV o tej samej
nazwie i treści krąży obok właściwego skoroszytu** (sami dostaliśmy najpierw jego), a Trelleborg
to import ręczny.

**Rekomendacja (moja):** ✅ **naprawić**, ale wzorem istniejącego rozwiązania, nie od zera:
`mo10_gri.cjs` ma dokładnie ten sam problem rozwiązany poprawnie — wykrywa format po **sygnaturze
bajtów** (`PK\x03\x04` = XLSX) i ma osobną ścieżkę CSV, bo „dostawca zmienił format bez zmiany
adresu URL" (komentarz Ani z 2026-07-14). MO8 tego nie ma. Minimalnie: zgłaszać błąd zamiast
cichego zera, gdy w skoroszycie nie ma ani `Radial`, ani `XPly`.

**Zrealizowane w 3b (2026-08-26): bezpiecznik D4.** Potwierdzone w kodzie, nie na słowo:
`parsujBufor('MO8', <plik CSV>)` faktycznie zwraca 0 rekordów i 0 błędów. Endpointy importu
(`rebuild/backend/src/routes/import.ts`) przy pustym wyniku parsowania zwracają `400` i **nie
wołają silnika stagingu** ani nie dotykają liczników nieobecności — dla WSZYSTKICH dostawców, nie
tylko MO8. To domyka eskalację opisaną wyżej: żaden import nie może już po cichu wycofać całego
katalogu dostawcy. Poprawka samego parsera MO8 (czytanie obu formatów) nadal należy do Ani i
wejdzie portem przez #6 — to się nie zmieniło.

**Nowa obserwacja z 3b: ten sam cichy zerowy wynik daje też `MO10` przy śmieciowej treści** (0
rekordów, 0 błędów) — problem nie jest specyficzny dla MO8, bezpiecznik D4 pokrywa oba przypadki
jednakowo. Poprawka parsera MO10 to również poprawka Ani, portem (#6).

**✅ Domknięte w 3c (2026-08-26, D7)** — dokładnie rekomendacją z akapitu wyżej. Bezpiecznik
pustego wejścia przeniesiono z tras importu **DO samego `tk()`** (`PustyImportBlad`,
`src/import/tk.ts`), więc od 3c zakrywa WSZYSTKIE trzy wejścia silnika naraz — także
`POST /api/staging/import`, który powstanie dopiero w 3d i który wcześniej byłby trzecią,
niezasłoniętą ścieżką (`backend-index.cjs:48502-48512`, pozycje wprost z ciała żądania).
`routes/import.ts` stracił swój duplikat bramki i tylko tłumaczy wyjątek `PustyImportBlad` na 400.

**Powiązanie z #11:** gałąź `ZT()`/`Lq()` opisana we wpisie #11 (komunikat „null cyfr
znaczących") jest dziś osiągalna w produkcji m.in. właśnie w scenariuszu z tego wpisu — **MO8
dostarczony jako CSV** zamiast XLSX — bo wtedy arkusz zapisuje EAN tekstem w notacji naukowej
zamiast liczbą.


### #9 · 2026-08-26 · [BACKEND] · pola `nro` i `cho` zapisywane jako liczby 0/1

| Pole | Wartość |
|---|---|
| **Data** | 2026-08-26 (znalezione przy I3/3a) |
| **Kategoria** | BACKEND (adapter / normalizatory) |
| **Pliki** | `parsers/adapter.cjs` (`recordToSurowe` — `nro`, `cho`), normalizatory w `tyre_params.cjs` |
| **Do nowej wersji?** | ✅ **TAK** (decyzja Ani 2026-08-26) |
| **Iteracja** | **→ 3b**; gdzie naprawiamy — patrz koniec pliku |
| **Status** | — |

**Opis biznesowy:** oznaczenia NRO i CHO zapisują się jako `0`/`1` zamiast „Tak"/pustego pola —
czyli dokładnie ten sam objaw, który poprawki `sniegfix` (18.08) i `flagsfix` (25.08) usunęły
z pozostałych oznaczeń. Ania: *„nie może tak być, mają być wszędzie albo Tak, albo puste pole.
To po prostu zostało, przy którymś imporcie znowu wrzuciło śmieci."*

**Szczegół techniczny:** `adapter.cjs` przepuszcza `nro: enriched.nro ?? null` i
`cho: enriched.cho ?? null` **bez** `tyre.normalizeLabelFlag()`, którym objęte są `cfo`,
`stubbleResistant`, `ms` i `snow3pmsf`. Zweryfikowane na 1214 rekordach charakteryzacji:
`nro` i `cho` przyjmują wartości `0`, `1`, `null`, podczas gdy wszystkie pozostałe flagi —
wyłącznie `"Tak"` albo `null`.

**Zapowiedziane już w #1:** rekomendacja przy `sniegfix` brzmiała *„ta sama zasada dotyczy
prawdopodobnie innych pól-flag etykiety UE — do sprawdzenia przy przepisywaniu adaptera"*.
Sprawdzone; te dwa pola zostały pominięte.

**Naprawa — dwie linie w `parsers/adapter.cjs` (596-597):**

```js
// było:
nro: enriched.nro ?? null,
cho: enriched.cho ?? null,
// ma być:
nro: tyre.normalizeLabelFlag(enriched.nro),
cho: tyre.normalizeLabelFlag(enriched.cho),
```

`normalizeLabelFlag()` jest już zaimportowany jako `tyre.*` i używany linijkę niżej dla `cfo`
i `stubbleResistant`. Zweryfikowane, że mapuje dokładnie tak, jak trzeba: `0 → null`,
`1 → "Tak"`, `"0" → null`, `"1" → "Tak"`, `null/undefined → null`.

Źródłem wartości `0`/`1` jest `parseTechnicalMarks()` (`tyre_params.cjs:377-378`,
`/\bNRO\b/.test(upper) ? 1 : 0`) — **tego nie ruszamy**, bo `marks.nro` jest używany także
wewnątrz normalizatorów jako wartość logiczna. Naprawa na końcu potoku, w adapterze, to ten sam
wzorzec, który zadziałał przy `kategoriafix` (#2).

**Rekomendacja (moja):** ✅ opakować oba w `normalizeLabelFlag()` w `recordToSurowe()` — jedna
linia na pole, w tym samym miejscu i tą samą funkcją co reszta flag. Uwaga na dane zastane:
kolumny mogą już zawierać `0`/`1` z wcześniejszych importów.

### #10 · 2026-08-26 · [BACKEND] · `WULSTBAND` z Bohnenkampa importowany jako opona

| Pole | Wartość |
|---|---|
| **Data** | 2026-08-26 (znalezione przy I3/3a) |
| **Kategoria** | BACKEND (klasyfikator „czy opona") |
| **Pliki** | `parsers/adapter.cjs` (`shouldRejectRecord` → `accessoryRe`) |
| **Do nowej wersji?** | ✅ **TAK** (decyzja Ani 2026-08-26) |
| **Iteracja** | **→ 3c** (klasyfikator) lub wcześniej u źródła; patrz koniec pliku |
| **Status** | — |

**Opis biznesowy:** 16 pozycji `WULSTBAND` z cennika Bohnenkampa trafia do katalogu jako opony.
To taśma ochronna obręczy, nie opona — wpada z pustym rozmiarem. Ania: *„dokładnie, trzeba to
dopisać do listy odrzucanych, bo to jest błąd, to nie powinno być importowane."*

**Szczegół techniczny:** lista `accessoryRe` w `shouldRejectRecord()` zawiera polskie nazwy
akcesoriów oraz — po poprawce z 18.06 — niemieckie `ventil` (dla `PKW-VENTIL`, `FELGENVENTIL`).
`WULSTBAND` to ta sama klasa przeoczenia: niemieckie słowo spoza listy. Zweryfikowane na pełnym
pliku `MO1__20260821__08471__bohnenkamp.csv`: 161 pozycji nie jest oponami, klasyfikator odrzuca
145, przechodzi dokładnie 16 sztuk `WULSTBAND`.

**Rekomendacja (moja):** ✅ dopisać `wulstband` do wzorca (analogicznie do `ventil` — jako fragment
słowa, bez granic wyrazu, bo w niemieckich złożeniach nie ma separatora). Przy okazji warto
przejrzeć cennik Bohnenkampa pod kątem innych niemieckich nazw akcesoriów.

### #11 · 2026-08-26 · [BACKEND] · `ZT()` woła `Lq()` z sha1 zamiast licznika cyfr — komunikat „null cyfr znaczących"

| Pole | Wartość |
|---|---|
| **Data** | 2026-08-26 (znalezione przy I3/3c) |
| **Kategoria** | BACKEND (silnik importu, normalizacja EAN) |
| **Pliki** | `index.cjs` — `ZT()` (deminified `:46971`, wywołanie `:46984`), `Lq()` (`:46965` i `:47312`) |
| **Do nowej wersji?** | ⬜ **DO DECYZJI ANI** |
| **Iteracja** | odtworzone 1:1 w **3c**; naprawa u Ani — do rozstrzygnięcia |
| **Status** | zgłoszone |

**Opis biznesowy:** przy EAN-ie zapisanym w notacji naukowej (Excel zamienia „8059970000000"
na „8,05997E+12") pozycja w stagingu dostaje ostrzeżenie o treści:

```
EAN: scientific_notation_uncertain (zapis naukowy ma tylko null cyfr znaczących — EAN niepewny)
```

Słowo **„null"** w miejscu liczby to nie literówka w tłumaczeniu — tak wygląda dziś komunikat
w produkcji. Miało być np. „ma tylko 6 cyfr znaczących".

**Szczegół techniczny:** `index.cjs` ma DWIE funkcje `Lq` w tym samym zakresie — `Lq(t)`
liczącą cyfry znaczące zapisu naukowego (`:46965`) i `Lq(t, e)` generującą identyfikator sha1
(`:47312`). W JavaScripcie przy dwóch deklaracjach funkcji o tej samej nazwie wygrywa
PÓŹNIEJSZA, dla całego pliku. `ZT()` woła `Lq(i)` z jednym argumentem, licząc na licznik cyfr,
ale trafia w generator sha1: ten składa klucz z `e?.ean|e?.nazwa|…`, a przy `e === undefined`
klucz jest pusty i funkcja zwraca `null`. Dalej `a < 13` to `null < 13`, czyli **zawsze true**,
więc gałąź „za mało cyfr znaczących" wykonuje się bezwarunkowo, a `${a}` drukuje „null".

Licznik cyfr z `:46965` jest przez to **kodem całkowicie martwym** — w całym
`mirror/backend/index.cjs` są tylko dwa miejsca wywołania `Lq(`, oba trafiają w wersję sha1.

**Skąd się biorą duplikaty:** nie z buildu — esbuild przy kolizji nazw zmienia nazwę. Obie
deklaracje są w wysłanym bundlu fizycznie, bo `index.cjs` jest po buildzie **łatany skryptami
`patch_*.cjs`** (w `mirror/backend/` jest ich kilkanaście). Ten sam mechanizm dał drugą
definicję `tk`. To warto mieć z tyłu głowy przy każdej kolejnej łatce.

**Jak duży to problem — uczciwie:** dziś mniejszy, niż wygląda. Dziewięć z dziesięciu parserów
woła `common.normalizeEan()` **przed** silnikiem, więc do `ZT()` trafiają już same cyfry.
Dziesiąty (MO8 Trelleborg) przepuszcza wartość surową, ale przy pliku XLSX arkusz oddaje EAN
jako liczbę. W charakteryzacji 3c na 1838 realnych rekordach ta gałąź nie odpaliła ani razu.

Staje się osiągalna, gdy: **MO8 przyjdzie jako CSV** (Excel zapisuje wtedy EAN tekstem
w notacji naukowej — to ten sam plik, który opisuje #8) albo gdy pozycje wejdą przez
`POST /api/staging/import`, z pominięciem parserów.

**Naprawa (propozycja):** nadać unikalną nazwę późniejszej definicji, np. `LqId`, i podmienić
jej trzy miejsca wywołania w `tk()`. Wtedy `Lq(i)` w `ZT()` znów trafia w licznik cyfr.
Można to zrobić kolejnym skryptem łatającym, tą samą drogą co dotychczasowe poprawki.

**Uwaga na skutek uboczny naprawy:** dla EAN-u w notacji naukowej z **co najmniej 13 cyframi
znaczącymi** komunikat nie tylko się zmieni, ale ZNIKNIE (`ean_validation_error` będzie `null`,
jeśli suma kontrolna się zgadza). Samo ostrzeżenie „EAN: scientific_notation_uncertain" zostaje
— status nie zależy od tego warunku. Czyli: mniej hałasu przy poprawnych EAN-ach, prawdziwa
liczba cyfr przy obciętych.

**Co zrobiła odbudowa:** odtworzyła zachowanie 1:1, łącznie z komunikatem, i wywołuje tę samą
funkcję z jednym argumentem zamiast wpisywać `null` na sztywno — żeby mechanizm był widoczny
w kodzie tam, gdzie działa (`rebuild/backend/src/import/silnik/ean.ts`). Gdy Ania zdecyduje
o naprawie, wchodzi ona przez re-synchronizację i przenagranie wzorca charakteryzacji.

## Gdzie naprawiamy zatwierdzone błędy parserów — ✅ WARIANT A (decyzja 2026-08-26)

Wpisy **#3** (szerokość w mm), **#8** (MO8 i format pliku), **#9** (`nro`/`cho`) i **#10**
(`WULSTBAND`) to **zatwierdzone poprawki dotykające kodu parserów**. Port w `rebuild/backend`
jest kopią **bajt-w-bajt** produkcji i pilnuje tego test integralności, więc trzeba rozstrzygnąć,
po której stronie te zmiany powstają.

**Od I3/3c wzorzec charakteryzacji ma DWIE warstwy, nie jedną** — patrz procedura niżej. Każda
z tych czterech poprawek zmienia wyjście parsera (`test/charakteryzacja/*.expected.json`), a przez
to pośrednio też wejście silnika dopasowania, czyli wzorzec
`test/charakteryzacja/silnik/*.expected.json`. Przenagranie tylko połowy zostawia repo w stanie
niespójnym z realnym zachowaniem.

> ✅ **PODJĘTA DECYZJA: wariant A.** Poprawki #3, #8, #9 i #10 powstają **w produkcji**, u Ani.
> My podciągamy je portem — patrz „Procedura po stronie odbudowy" na końcu tej sekcji.

**Wariant A — Ania poprawia w produkcji, my podciągamy portem (WYBRANY).**
- Żywa produkcja, z której Marta korzysta codziennie, przestaje produkować śmieci **od razu**,
  a nie dopiero po cutoverze.
- Port zostaje bajt-w-bajt; re-synchronizacja to `cp` + przenagranie OBU wzorców charakteryzacji,
  a `git diff` na `MOx.expected.json` **pokaże pole po polu, co dokładnie się zmieniło** — czyli
  poprawka jest przy okazji zweryfikowana.
- To jest dokładnie mechanizm, dla którego przyjęto strategię portu (patrz #6).
- Koszt: zależy od czasu Ani.

**Wariant B — poprawiamy u siebie w porcie.**
- Port przestaje być kopią 1:1 → test integralności wymaga listy wyjątków, a każda kolejna
  poprawka Ani wymaga ręcznego scalania zamiast czystego `git diff`.
- Produkcja zachowuje błędy aż do cutoveru.
- Sensowne tylko wtedy, gdy Ania nie chce już dotykać starego stosu.

### Procedura po stronie odbudowy (po każdej poprawce Ani)

```bash
# 1. Podciągnij lustro produkcji (tools/sync — albo poczekaj na commit sync(vps))
# 2. Podmień port kopią z lustra
cp mirror/backend/parsers/adapter.cjs      rebuild/backend/src/import/legacy/parsers/
cp mirror/backend/parsers/tyre_params.cjs  rebuild/backend/src/import/legacy/parsers/
# (analogicznie pozostałe zmienione pliki — BEZ *.bak_*)

# 3. Przenagraj wzorzec charakteryzacji PARSERÓW z NOWEGO oryginału
cd rebuild/backend && node scripts/charakteryzacja-nagraj.mjs

# 4. Przenagraj wzorzec charakteryzacji SILNIKA (I3/3c) — DRUGI wzorzec, osobny krok.
#    Wymaga db/snapshot.db (zrzut produkcji; .gitignore, 32 MB — nie ma go w świeżym klonie):
BRIDGE_SNAPSHOT_DB=/ścieżka/do/snapshot.db node scripts/charakteryzacja-silnik-nagraj.mjs

# 5. Obejrzyj, co poprawka realnie zmieniła — pole po polu, w OBU wzorcach
git diff test/charakteryzacja/

# 6. Potwierdź, że port i oba wzorce się zgadzają
npm test -- test/charakteryzacja.test.ts test/silnik.charakteryzacja.test.ts
```

**Krok 5 jest sensem wariantu A.** `git diff` na `MOx.expected.json` i na
`test/charakteryzacja/silnik/*.expected.json` pokazuje dokładnie, które rekordy, wiersze stagingu
i pola zmieniły wartość — czyli poprawka Ani zostaje przy okazji **zweryfikowana na 1838
rekordach z realnych plików dostawców i na katalogu 7405 produktów**, zanim ktokolwiek zobaczy ją
w panelu.

**Wzorzec silnika ma własny strażnik integralności**, niezależny od kroku 4:
`test/charakteryzacja/silnik/integralnosc.json` trzyma sha256 fragmentu wyciętego
z `mirror/backend/index.cjs` (żywy `tk()` + helpery). Zmiana w mirrorze — nawet niezwiązana
z poprawką parsera — zapala ten test z jawną instrukcją przenagrania. To sygnał „zmieniła się
produkcja", nie „popraw test".

Czego się spodziewać w diffie wzorca PARSERÓW przy każdej z czterech poprawek:

| Poprawka | Oczekiwana zmiana we wzorcu parserów |
|---|---|
| #3 szerokość | `MO2.expected.json`: 1 rekord (`6.5/80-12`), `szerokosc` `165.1` → `"6.5"` albo `null` |
| #9 `nro`/`cho` | wszystkie pliki: wartości `0` → `null`, `1` → `"Tak"` |
| #10 `WULSTBAND` | `MO1.expected.json`: **ubędzie 16 rekordów** (199 → mniej, zależnie od próbki) |
| #8 MO8 i format | wzorzec **bez zmian** (próbka MO8 to XLSX, który już działa) — zmiana widoczna dopiero przy pliku CSV |

**Wpływ na wzorzec SILNIKA (I3/3c, krok 4 procedury) — obowiązkowy, nie opcjonalny:**

| Poprawka | Wpływ na wzorzec silnika |
|---|---|
| #3 szerokość | `snapshotJson.szerokosc` dla dotkniętego rekordu zmieni wartość na wejściu do silnika; może przesunąć klasyfikację wiersza między `bezZmian` a `zmiana_kluczowa`, jeśli to jedyna wykryta różnica |
| #9 `nro`/`cho` | jeśli `nro`/`cho` są jedyną różnicą wykrywaną przez `Vq`, klasyfikacja wiersza może się zmienić razem z `powod` |
| #10 `WULSTBAND` | dotknięte rekordy znikają z wejścia silnika razem z parserem — ubędzie odpowiadających im wierszy stagingu (dokładna liczba zależy od tego, ile z nich w ogóle trafiało do stagingu) |
| #8 MO8 i format | bez zmian, dopóki próbka MO8 to XLSX; dołożenie próbki CSV odblokuje też gałąź opisaną w #11 (`ZT()`/`Lq()`, EAN w notacji naukowej) |

Jeśli diff pokaże **coś więcej** niż powyżej — w którymkolwiek z dwóch wzorców — to sygnał, że
poprawka ma efekt uboczny, którego nikt się nie spodziewał. Dokładnie po to ten mechanizm istnieje.

*Utworzono 2026-08-26 przy tickecie `4-FEATURE-port-parserow-charakteryzacja`; decyzja o wariancie
A podjęta tego samego dnia. Rozszerzono 2026-08-26 przy tickecie
`6-FEATURE-silnik-tk-dopasowanie-klasyfikator` (I3/3c) o drugą warstwę wzorca (silnik).*

---

### #12 · 2026-09-01 · [BACKEND] · `__restoreZastosowanie()` po każdej akceptacji — objaw czy naprawa?

> **Zgłoszone przy tickecie `9-FEATURE-acceptstaging-endpointy-mutacji` (I3/3d-2).**
> Świadomie NIE przeportowane — decyzja użytkownika, plan.md D2.
>
> **Aktualizacja 2026-09-04, ticket `28-FEATURE-selly-eksport-backend` (I8/8a).**
> Właścicielstwo ROZSTRZYGNIĘTE: wpis należy do **I8**, nie do I7 — `selly_zastosowanie_category_map`
> i jej jedyny konsument (`mapujZastosowanieNaKategorie`, `rebuild/backend/src/selly/mapper.ts`)
> mieszkają w tej iteracji. Decyzja użytkownika z tej samej daty: **nadal NIE portujemy**
> (kontynuacja 3d-2), ale konsekwencja jest teraz zmierzona i opisana niżej.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (import / dane) |
| **Pliki** | `deminified/backend-index.cjs:44105` (funkcja), `:48546` (wywołanie); dane: `mirror/backend/zastosowania/zastosowania_master.csv` (6823 wiersze) |
| **Do nowej wersji?** | ⬜ **DO DECYZJI** — najpierw ustalić przyczynę (niżej) |
| **Status** | otwarte; I8 (8a+8b) zamknięta 2026-09-04 BEZ portowania — decyzja „nie portujemy" podtrzymana, konsekwencja dla Selly zmierzona |

**Co robi produkcja.** Endpoint `POST /api/staging/accept` po zatwierdzeniu pozycji woła
`__restoreZastosowanie()`. Funkcja czyta CSV z **zahardkodowanej ścieżki produkcyjnej**
(`/home/admin/private_apps/bridge/zastosowania/zastosowania_master.csv`, kolumny `kod,zastosowanie`)
i wykonuje:

```sql
UPDATE products SET zastosowanie=? WHERE kod=? AND (zastosowanie IS NULL OR TRIM(zastosowanie)='')
```

czyli uzupełnia **wyłącznie puste** wartości. Wynik (`{ok, updated}`) trafia tylko do
`console.log`, nie do odpowiedzi HTTP.

**Dlaczego to wygląda na OBJAW, a nie na chorobę.** Odtwarzanie kolumny z pliku CSV po każdej
akceptacji to obejście, nie funkcja. Ktoś albo coś kasuje `products.zastosowanie` — i to jest
właściwe pytanie. Podejrzani: import (`acceptStaging` buduje rekord ze snapshotu, który
`zastosowania` nie niesie, więc przy INSERCIE pole wychodzi puste) albo synchronizacja Selly.
Zwróć uwagę, że warunek `zastosowanie IS NULL OR TRIM(...)=''` pasuje dokładnie do produktu
świeżo wstawionego przez akceptację.

**Dlaczego 3d-2 tego nie przeportowała.** Trzy powody, wszystkie do rozstrzygnięcia razem:
1. **model wdrożenia** — CSV leży poza repo, a deploy kopiuje tylko `dist/`; port wymaga
   decyzji, czy plik wciągamy do repo, czy czytamy ze ścieżki z konfiguracji;
2. **przynależność** — z importem funkcja nie ma nic wspólnego; jej miejsce jest przy
   atrybutach (**I7**) albo przy Selly (**I8**, gdzie żyje `selly_zastosowanie_category_map`);
3. **brak szkody z pominięcia** — uzupełnia tylko puste wartości, więc jej brak niczego nie
   psuje. Po prostu nie uzupełnia — a to Ania zauważy, jeśli coś jej `zastosowanie` czyści.

**Rekomendacja:** przy I7 albo w kolejnej sesji dotykającej Selly (I8 zamknięta bez tego)
najpierw ODTWORZYĆ przyczynę (zaimportować pozycję, zatwierdzić, sprawdzić, czy `zastosowanie`
znika), a dopiero potem decydować, czy portować naprawę, czy usunąć potrzebę.

---

#### Konsekwencja dla Selly — zmierzona w 8a (2026-09-04)

Punkt 3 wyżej („brak szkody z pominięcia") był prawdziwy DOPÓKI nie istniał konsument
`products.zastosowanie`. Po 8a konsument istnieje i szkoda jest konkretna.

`mapujZastosowanieNaKategorie` (`rebuild/backend/src/selly/mapper.ts`, port `mapper.cjs:135-170`)
wyznacza kategorię produktu w Selly **z pola `zastosowanie`**: pierwsza wartość to kategoria
główna, kolejne (po `" + "`) idą do `multi_cat`. Puste `zastosowanie` przełącza funkcję w gałąź
`source: "fallback_kategoria"`, czyli produkt trafia do Selly **wyłącznie do kategorii głównej
wyliczonej z `products.kategoria`** — bez podkategorii z `selly_zastosowanie_category_map`
i bez żadnej kategorii dodatkowej. Jeśli w dodatku `products.kategoria` nie ma odpowiednika
w `selly_kategoria_norm_map`, `category_id` wychodzi `null`, walidacja odrzuca payload
(`Brak category_id (nieznana kategoria)`) i produkt zostaje policzony jako `skipped`
w `POST /api/selly/sync-supplier` — czyli **w ogóle nie dojdzie do sklepu**.

Obie gałęzie są zamrożone w testach (`rebuild/backend/test/selly.mapper.test.ts`,
`selly.synchronizacja.test.ts`), więc skutek tej decyzji jest widoczny w kodzie, nie tylko tutaj.

**Co to zmienia w rekomendacji.** Kolejność „najpierw przyczyna, potem naprawa" zostaje bez
zmian, ale zyskuje mierzalny test akceptacyjny: po zaimportowaniu i zatwierdzeniu pozycji
sprawdź nie tylko, czy `zastosowanie` znika, ale też ile produktów wpada w
`fallback_kategoria`/`fallback_empty` przy synchronizacji z Selly. To jest liczba, którą widać
w `selly_sync_log.szczegoly_json` jako `skipped` — porównywalna między przebiegami.

**Opcje, gdyby decyzja się zmieniła** (spisane 2026-09-04, żeby następna sesja nie zaczynała
od zera):
- **(A)** wciągnąć `zastosowania_master.csv` do repo jako seed — odtwarza zachowanie 1:1,
  wymaga dostarczenia pliku przez operatora produkcji (6823 wiersze, dziś poza repo);
- **(B)** portować funkcję ze ścieżką z konfiguracji/env, bez pliku działa jako no-op z logiem;
- **(C)** naprawić przyczynę w akceptacji stagingu (snapshot nie niesie `zastosowania`,
  więc INSERT zostawia pole puste) — czystsze, ale to odstępstwo od zachowania oryginału;
- **(D)** zostawić jak jest i traktować jako znaną degradację (stan na 2026-09-04).


---

*Pominięte (nie kod, brak zadania rebuild):*
- 2026-08-18 06:00 [FRONTEND] — regeneracja pliku eksportu `sellycsv-...csv` (odświeżenie
  danych, nie zmiana UI/kodu).
- 2026-08-19 15:00 [FRONTEND] (szerorig) — kolejna regeneracja `sellycsv-...csv` (dane) + usunięcie
  skryptów debugowych `probe.cjs/probe2.cjs/probe3.cjs` (sprzątanie, nie logika produktu).
- 2026-08-21 16:00 (`ba3cc6e`) — usunięcie starych backupów `index.cjs.v3/v4/v6/broken/before_v6…`
  + adapter backup (sprzątanie, ~4100 linii); pliki `*.json` danych. Kod istotny (uwaga_cena/parsery)
  ujęty w #4/#6.
- `archive_module.cjs` (nowy, obsługa `import_archive`) — archiwizacja zrzutów importu; my `import_archive`
  wykluczyliśmy z mirrora, więc **→ później (Ix)**, nie cel wczesnych iteracji.

---

### #13 · 2026-09-01 · [FRONTEND] · `LE()` — pusta kolumna daje komplet trafień każdej sygnaturze

> **Znalezione i NAPRAWIONE przy tickecie `13-FEATURE-wgrywanie-plikow` (I3/3f-1).**
> Odstępstwo od portu 1:1 — decyzja użytkownika, 2026-09-01.

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (detekcja dostawcy przy wgrywaniu) |
| **Pliki** | `deminified/frontend-index.js:18377` (`LE`), `:18388` (`FE`), `:18309` (tablica `qu`); port: `rebuild/frontend/src/pages/konfiguracja/detekcja.ts` |
| **Do nowej wersji?** | ❌ **NIE — defektu nie odtwarzamy** (decyzja 2026-09-01) |
| **Status** | ✔ naprawione w rebuild (3f-1), w produkcji **nadal obecne** |

**Co robi produkcja.** `LE(naglowkiPliku, sygnatura)` liczy, ile nagłówków sygnatury dostawcy
występuje w pliku, dopasowując luźno w OBIE strony:

```js
n.some(e => e.includes(t) || t.includes(e))
```

Luźne dopasowanie jest celowe („Cena netto" ma trafiać i w „cena", i w „cena netto szt").
Problem jest gdzie indziej: **pusty łańcuch jest podciągiem każdego tokenu**, więc
`"id".includes("")` daje `true`. Wystarczy jedna pusta kolumna w wierszu nagłówków, żeby
KAŻDA sygnatura dostała komplet trafień — a pustą kolumnę ma każdy cennik kończący wiersz
średnikiem.

**Skutek.** Wygrywa sygnatura najdłuższa, czyli MO9 (8 tokenów). Zmierzone na próbkach
z `rebuild/backend/test/charakteryzacja/probki/`, przy nazwie pliku niepasującej do wzorca:

| Cennik | Trafienia MO9 (produkcja) | Trafienia MO9 (po naprawie) | Rozpoznanie |
|---|---|---|---|
| MO4 Handlopex WR | 8 / 8 | 2 / 8 | MO9 → **MO4** |
| MO5 Handlopex RZ | 8 / 8 | 2 / 8 | MO9 → **MO4*** |
| MO7 Nokian | 8 / 8 | 6 / 8 | MO9 → **MO7** |

(\* MO4 i MO5 mają identyczną sygnaturę nagłówków — rozróżnia je wyłącznie nazwa pliku.)

Wszystkie trzy pokazują się jako **MO9 „z wysoką pewnością"**. Etykieta pewności każe Ani
zaufać wynikowi, a wgranie cennika Handlopexu na katalog MO9 przepisuje dane cudzego dostawcy.

**Dlaczego w produkcji nie bije mocniej.** Wzorce NAZWY PLIKU sprawdzane są PIERWSZE i pokrywają
wszystkich dziesięciu dostawców, a pliki od Ani mają nazwy zgodne z wzorcami. Detekcja po
nagłówkach jest ścieżką awaryjną — i to ona jest zepsuta.

**Naprawa w rebuild.** `policzTrafienia()` pomija nagłówki puste po normalizacji (i puste
tokeny sygnatury). Reszta `LE()` — łącznie z luźnym dopasowaniem w obie strony — bez zmian.
Test regresyjny: `rebuild/frontend/test/konfiguracja.detekcja.test.ts`, sekcja
„pusty nagłówek nie jest dopasowaniem (odstępstwo 3f-1)".

**Czego NIE ruszamy** (port 1:1, zachowanie zmierzone i zapisane w teście): MO3 po samych
nagłówkach przegrywa z MO9 (5 trafień własnych vs 6 cudzych), bo `FE()` porównuje LICZBĘ
trafień, a nie ich udział w sygnaturze. To osobna cecha oryginału i osobna decyzja.

**Do rozważenia dla produkcji.** Ta sama jedna linia naprawia to w starym Bridge. Poza
zakresem odbudowy — decyzja użytkownika, czy i kiedy.

---

### #14 · 2026-09-01 · [BACKEND][BEZPIECZEŃSTWO] · mutacje zapisują CAŁE ciało żądania — wzorzec systemowy, nie jednostkowy

> **Znalezione przy bloku I3/3f-2 (2026-09-01).** Dla dostawców NAPRAWIONE decyzją
> użytkownika; dla narzutów i promocji NAPRAWIONE w bloku 4a (2026-09-02); dla spedycji
> i configu NAPRAWIONE w Iteracji 11 (2026-09-03); dla produktów **czeka na Iterację 12**.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (warstwa danych + trasy mutacji) |
| **Pliki** | `deminified/backend-index.cjs:45043` (`updateSupplier`), `:44975` (`updateMarkup`), `:44998` (`updatePromotion`), `:44824` (`updateStaging`), `:44728` (`updateProduct`), `:45077-45085` (`upsertSpedycja`), `:45083-45089` (`U.setConfig`); trasy `:48230`, `:48699`, `:48722`, `:48415`, `:48736`, `:48745` |
| **Do nowej wersji?** | ❌ **NIE — defektu nie odtwarzamy** (decyzja 2026-09-01, dotyczy dostawców; dla narzutów/promocji NAPRAWIONE 4a, dla spedycji/configu NAPRAWIONE I11, dla produktów patrz „Co z tego wynika") |
| **Status** | ✔ dostawcy naprawieni w rebuild (3f-2) · ✔ narzuty i promocje naprawione w rebuild (4a, 2026-09-02) · ✔ spedycja i config naprawione w rebuild (I11, 2026-09-03) · ⬜ produkty (I12) · w produkcji **nadal obecne** |

**Co robi produkcja.** Metody warstwy danych przyjmują obiekt i wrzucają go do `SET` bez
żadnego filtra:

```js
updateSupplier(t, e)  { X.update(Ot).set(e).where(se(Ot.id, t)).run(), … }   // :45043
updateMarkup(t, e)    { X.update(Bt).set(e).where(se(Bt.id, t)).run(); … }   // :44975
updatePromotion(t, e) { X.update(hn).set(e).where(se(hn.id, t)).run(); … }   // :44998
```

Trzy trasy podają im ciało żądania **wprost od użytkownika**:

| Trasa | Co przekazuje | Iteracja odbudowy |
|---|---|---|
| `PATCH /api/dostawcy/:id` (`:48230`) | `c.body` — bez zmian | **3f-2 ✔** |
| `PATCH /api/markups/:id` (`:48701`) | `{...c.body, zmienilUzytkownikId, zmienionoData}` | **Iteracja 4a ✔** |
| `PATCH /api/promotions/:id` (`:48724`) | `{...c.body, zmienilUzytkownikId, zmienionoData}` | **Iteracja 4a ✔** |
| `PUT`+`PATCH /api/products/:id` (`:48415-48424`, rejestracja `:48452`) | `c.body` bez klucza `_reason` | **Iteracja 12** |
| `POST /api/spedycja` (`:48736`) | `c.body` — bez zmian | **Iteracja 11 ✔** |

**⭐ Kluczowa obserwacja: produkcja NIE jest w tym konsekwentna.** `PUT /api/staging/:id`
(`:48598`) ma jawną listę ośmiu pól i pętlę `if (!r.includes(v)) continue;` —
`["nazwa","marka","model","kategoria","rozmiar","ean","cenaZakupuNowa","magazyn"]`. Czyli
mechanizm istnieje w tym samym pliku, kilkadziesiąt linii dalej, i **został tam użyty
świadomie**. Nasza lista dla dostawców nie jest więc wymysłem odbudowy — doprowadza resztę
tras do wzorca, który produkcja już stosuje. Port stagingu z 3d-2 tę listę odtworzył 1:1
(`rebuild/backend/src/routes/staging-mutacje.ts:34`, `POLA_EDYTOWALNE`).

**Skutek dla dostawców (dlaczego naprawiliśmy TERAZ).** Każdy zalogowany użytkownik mógł
jednym PATCH-em ustawić dowolną kolumnę: `liczbaProduktow`, `ostatniPlik`, `ostatniaSync`,
`parser`, `kodowanie`. Dwa z nich są groźne poza samą nieporządnością:

- `ostatniPlik` steruje `przeliczStatus()` (`:45028`) — dało się nim **podrobić status
  „aktywny"** dostawcy, który od miesięcy nic nie zaimportował;
- u nas doszłaby kolumna `importWylaczony` (migracja 002), czyli **bramka wyłączająca MO6
  z importu (backlog #7) dałaby się zdjąć jednym żądaniem**. Bramka z furtką nie jest bramką
  — i to przesądziło.

**Naprawa w rebuild (3f-2).** `POLA_EDYTOWALNE_DOSTAWCY` w `rebuild/backend/src/repos/suppliers.ts`
— dziesięć pól konfiguracyjnych; odcięte `importWylaczony`, `liczbaProduktow`, `ostatniPlik`,
`ostatniaSync`, `id`, `kod`. Odpowiedź idzie w projekcji kontraktowej, bo oryginał odsyła
CAŁY wiersz i `importWylaczony` wyciekłby do API. Testy:
`rebuild/backend/test/dostawcy.patch.test.ts`.

**Czego NIE ruszamy** (port 1:1, decyzja zaklepana w roadmapie): **niespójność audytu**.
Zapis obejmuje dziesięć pól, a do `audit_log` wchodzą wyłącznie cztery — `status`, `url`,
`czestotliwoscMinuty`, `sposobDostarczania` (`:48234`). Zmiana `uwagi` czy `parser` przechodzi
bez śladu. Dlatego lista pól edytowalnych jest ŚWIADOMIE szersza niż czwórka audytowana:
zawężenie jej do czwórki skasowałoby tę niespójność po cichu.

**⚠ Przy okazji: komentarz w `mirror/frontend/assets/freq-injection.js:9-12` jest BŁĘDNY.**
Mówi „whitelist pól: status, url, czestotliwoscMinuty, sposobDostarczania" — to jest lista
AUDYTU, nie zapisu. Autor skryptu wziął jedną za drugą. Do 3f-2 żadnej listy zapisu nie było.
Skrypt jest już wchłonięty (3f-2), więc rzecz ma znaczenie wyłącznie archiwalne.

**Co z tego wynika dla kolejnych iteracji:**

- **Iteracja 4a (narzuty i promocje) — NAPRAWIONE (2026-09-02).** `POLA_EDYTOWALNE_NARZUTU`
  (`rebuild/backend/src/repos/markups.ts`: `typ, zakres, warunki, nazwa, wartosc, jednostka,
  priorytet, status`) i `POLA_EDYTOWALNE_PROMOCJI` (`rebuild/backend/src/repos/promotions.ts`:
  `nazwa, rabatPct, zasieg, warunki, priorytet, start, koniec, status`) odcinają `id`,
  `zmienilUzytkownikId`, `zmienionoData` (ustawia je SERWER). Testy:
  `rebuild/backend/test/narzuty.patch.test.ts`. **Różnica wobec dostawców:** filtr działa
  także na **POST**, nie tylko na PATCH (plan.md D3) — u dostawców trasy POST nie ma, więc
  ta powierzchnia ataku tam nie istniała. **Nowa niespójność, wprowadzona świadomie (D2):**
  audyt loguje **surowe `req.body`** (port 1:1 z `:48699-48737`, wszystkie sześć wywołań
  `be(...)` przekazują `c.body` w całości), podczas gdy zapis idzie przez filtr pól. Skutek:
  `szczegoly_json` może zawierać pole, które NIE zostało zapisane — audyt opisuje ZAMIAR, nie
  stan bazy. To **odwrotność** sytuacji u dostawców opisanej wyżej w tym wpisie: tam
  niespójność audytu jest własnością ORYGINAŁU i była odtwarzana 1:1; tu jest NASZA, cena
  naprawy zapisu. Uzasadnienie: ten sam sens co przy `synchronizacja_reczna` z I3 (audyt
  powstaje nawet dla nieistniejącego dostawcy), a przy okazji próba mass-assignmentu zostaje
  w dzienniku jako sygnał bezpieczeństwa, zamiast zniknąć bez śladu.
- **Iteracja 11 (spedycja i config) — NAPRAWIONE (2026-09-03).** Ten sam wzorzec na dwóch
  nowych trasach ticketu `18-FEATURE-konfiguracja-config-spedycja`. `POST /api/spedycja`
  (`repos/spedycja.ts`, `odsiejPolaSpedycji`) filtruje ciało do pięciu pól — `dostawcaKod,
  progNetto, kosztPonizej, kosztPowyzej, dodatkoweReguly` (`id` odcięte) — dokładnie ten sam
  ruch co przy narzutach/promocjach w 4a; oryginał podaje `c.body` wprost do `upsertSpedycja`
  (`:48736`). `POST /api/config` dostał **wariant tego samego wzorca dla innego kształtu
  zasobu**: zamiast filtra pól obiektu — zamknięta lista 13 dozwolonych KLUCZY
  (`KLUCZE_KONFIGURACJI`, `repos/config.ts`), bo `config` to magazyn klucz-wartość bez
  kolumn do odsiania; klucz spoza listy → `400`. Oryginał (`U.setConfig(l, p)`, `:48745`)
  przyjmuje dowolny klucz — literówka w nazwie zakłada w tabeli nowy, martwy wiersz. Audyt
  spedycji zachował się tak jak przy narzutach (surowe ciało, port 1:1). Szczegóły:
  `docs/tickets/18-FEATURE-konfiguracja-config-spedycja/plan.md` D4/D5, oraz backlog #29/#30
  (odstępstwa od 1:1 zatwierdzone przy tej samej okazji).
- **Iteracja 12 (produkty + hardening)** — `PATCH /api/products/:id` odsiewa wyłącznie klucz
  `_reason`; cała reszta 72 kolumn jest zapisywalna. Ta trasa dodatkowo zapisuje
  `manual_overrides` dla KAŻDEGO zmienionego pola, więc lista pól decyduje też o tym,
  co import przestanie nadpisywać.
- **Reguła, którą warto przyjąć na stałe:** trasa mutacji dostaje jawną listę pól, a kolumny
  wyliczane i kolumny własne odbudowy (`importWylaczony`, `uwagaCena`) na tę listę **nigdy**
  nie wchodzą.

**Do rozważenia dla produkcji.** W starym Bridge to nadal działa. Poza zakresem odbudowy —
decyzja użytkownika, czy i kiedy.

---

### #15 · 2026-09-01 · [BACKEND] · `L4()` nie czyści timera po odrzuconym `fetch`

> **Znalezione i NAPRAWIONE przy bloku I3/3f-2 (2026-09-01).** Odstępstwo bez wpływu
> na obserwowalne zachowanie.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (import z URL, scheduler) |
| **Pliki** | `deminified/backend-index.cjs:48053-48057`; port: `rebuild/backend/src/import/synchronizuj.ts` |
| **Do nowej wersji?** | ❌ **NIE — defektu nie odtwarzamy** |
| **Status** | ✔ naprawione w rebuild (3f-2), w produkcji **nadal obecne** |

**Co robi produkcja.** `L4()` uzbraja 30-sekundowy timer przerywający pobranie i rozbraja go
DOPIERO po powrocie z `await fetch`:

```js
let i = new AbortController,
    r = setTimeout(() => i.abort(), 3e4),
    a = await fetch(n.url, { signal: i.signal });
if (clearTimeout(r), !a.ok) …          // :48057 — tylko na ścieżce udanej
```

Gdy `fetch` **odrzuci** (a to jest częsty przypadek — 339 alertów „Błąd pobierania"
w `db/snapshot.db`), sterowanie skacze do `catch` i `clearTimeout` nie wykonuje się nigdy.
Zostaje wiszący timer, który po 30 s woła `abort()` na zakończonym już kontrolerze.

**Skutek.** Sam `abort()` jest bezczynny, ale **timer trzyma pętlę zdarzeń** przez pełne
30 s po każdej nieudanej próbie. W produkcji nie widać tego, bo proces i tak żyje ciągle.
Zaboli dwa razy: w testach (wiszący uchwyt wywraca sprzątanie) i przy schedulerze z **3f-3**,
który powtarza to cyklicznie dla pięciu dostawców.

**Naprawa w rebuild.** `clearTimeout` w bloku `finally` wokół samego `fetch`. Zachowanie
obserwowalne — timeout, komunikat, alert, status — **bez żadnej zmiany**.

**Powiązane:** 3f-3 ma dodatkowo dać `unref()` na interwałach schedulera; obie rzeczy dotyczą
tego samego: żeby import nie zostawiał po sobie uchwytów.

---

### #16 · 2026-09-01 · [BACKEND] · alert „Błąd pobierania" obejmuje TAKŻE błędy parsera

> **Znalezione przy bloku I3/3f-2 (2026-09-01). ODTWORZONE 1:1** — świadomie, bo widok
> alertów z Iteracji 6 musi widzieć te same wartości co produkcja.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (alerty pisane przez import) |
| **Pliki** | `deminified/backend-index.cjs:48100-48115`; port: `rebuild/backend/src/import/synchronizuj.ts` |
| **Do nowej wersji?** | ✅ **TAK — port 1:1** (nazwa typu zostaje myląca) |
| **Status** | ✔ odtworzone w rebuild (3f-2) |

**Co robi produkcja.** `L4()` ma JEDEN blok `catch` wokół całości: pobrania, zapisu do
archiwum, parsowania i wpisu do stagingu. Każdy wyjątek z tego zakresu daje alert
`typ: "Błąd pobierania"` — także taki, w którym pobranie się powiodło, a wywrócił się parser.
W oryginale było to częściowo maskowane fallbackiem `Wc()` (druga próba starym parserem);
po decyzji o **braku fallbacku** (roadmapa §5, blok 3f — zaklepane) błąd parsera trafia
do tego `catch` bezpośrednio.

**Skutek.** Typ alertu myli przyczynę: „Błąd pobierania" przy cenniku, który pobrał się
poprawnie. Powód jest w treści (`opis`), nie w typie.

**Dlaczego mimo to odtwarzamy.** Zmiana typu przy zapisie rozjechałaby grupowanie w widoku
alertów z **Iteracji 6** względem 339 wierszy historycznych, które są w bazie i mają stary
typ. Zgodność z danymi produkcji jest tu więcej warta niż trafniejsza etykieta.

**Co dowiozła Iteracja 6** (2026-09-03, ticket `18-FEATURE-widok-alerty`). Widok grupuje po
`(dostawca, typ, status)`, więc dwie przyczyny „Błędu pobierania" faktycznie lądują w jednej
grupie — zgodnie z zapowiedzią wyżej. Rozróżnienie sieć/parser zostaje w treści (`opis`)
pojedynczego wpisu i jest widoczne dopiero po rozwinięciu grupy: błąd sieci to dosłowny
komunikat undici („fetch failed", „This operation was aborted", „terminated"), błąd parsera to
komunikat z portu parserów. Wyszukiwarka po `opis`, która mogłaby to filtrować bez rozwijania,
została w tym samym ticketcie **odrzucona przez użytkownika** (decyzja D8) — patrz
`docs/tickets/18-FEATURE-widok-alerty/plan.md`, logika grupowania w
`rebuild/frontend/src/pages/alerty/grupowanie.ts`.

---

### #17 · 2026-09-01 · [BACKEND] · scheduler dobiera po statusie PRZELICZANYM — samozakleszczenie po 30 dniach

> **Znalezione przy bloku I3/3f-3 (2026-09-01). ODTWORZONE 1:1** — bo to zachowanie
> produkcji, a nie usterka naszego portu. Luka otwarta, **właściciel do ustalenia.**

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (scheduler importu) |
| **Pliki** | `deminified/backend-index.cjs:48121` (`D4`), `:45026` (`listSuppliers`), `:48039` (`L4`); port: `rebuild/backend/src/import/scheduler.ts` |
| **Do nowej wersji?** | ✅ **port 1:1**, z NASZĄ diagnostyką w logu |
| **Status** | ✔ odtworzone w rebuild (3f-3), problem zgłoszony |

**Co robi produkcja.** `D4()` dobiera dostawców do automatu z `U.listSuppliers()`, a ta
funkcja **przelicza `status` w locie** (`:45026`) zamiast czytać kolumnę:

```
if (ostatniPlik) {
  wiek > 30 dni  → "wstrzymany"
  else           → liczbaProduktow === 0 ? "blad" : "aktywny"
}
else             → liczbaProduktow === 0 ? "wstrzymany" : status_z_kolumny
```

Warunek `status !== "wstrzymany"` w `D4()` widzi więc wartość WYLICZONĄ, a nie tę zapisaną.

**Skutek 1 — samozakleszczenie.** Dostawca, którego ostatni udany import był ponad 30 dni
temu, wypada z automatu. Skoro wypadł, nie zostanie odświeżony. Skoro nie zostanie
odświeżony, jego `ostatniPlik` się nie odmłodzi — i **już nigdy nie wróci** bez ręcznego
„Synchronizuj teraz". Dostawca padnięty na dłużej niż miesiąc cichnie na zawsze.
W produkcji niewidoczne, bo proces żyje ciągle i odświeża znacznik co godzinę.

**Skutek 2 — staging planuje ZERO.** Baza postawiona od zera (`ostatniPlik = null`, zero
produktów w `products`) daje wyliczony status „wstrzymany" u WSZYSTKICH, więc automat
planuje zero dostawców, mimo poprawnych URL-i i częstotliwości. To samo dotyczy stagingu
ze snapshotu starszego niż 30 dni: `db/snapshot.db` ma u piątki `url`
`ostatni_plik = 2026-08-13`, czyli **po 2026-09-13 ten snapshot planuje zero**.

**Co zrobiliśmy w rebuild.** Dobór portowany 1:1. Dołożona wyłącznie **druga linia logu**
(decyzja użytkownika 2026-09-01), wypisująca pominiętych dostawców z powodem — w tym
jawnie „status wstrzymany PRZELICZONY — ostatni plik sprzed N dni (próg: 30)". Zero wpływu
na dobór i na dane; różnica między `zaplanowano 0` a wiedzą, dlaczego zero.

**Propozycja naprawy (do decyzji).** Filtrować po kolumnie `suppliers.status`, a nie po
statusie prezentacyjnym — czyli w schedulerze czytać surowe wiersze zamiast
`listaDostawcow()`. To zdejmuje oba skutki naraz i nie rusza niczego w odczycie API.
**Nie robimy tego bez decyzji**, bo zmienia dobór dostawców do automatu.

---

### #18 · 2026-09-01 · [BACKEND][FRONTEND] · status „wstrzymany" z panelu nie jest widoczny na karcie dostawcy

> **Znalezione przy bloku I3/3f-3 (2026-09-01). ODTWORZONE 1:1.** Ta sama przyczyna
> co #17, inny objaw — i ten objaw Ania widzi. **Właściciel do ustalenia.**

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (projekcja odczytu) + FRONTEND (karta dostawcy) |
| **Pliki** | `deminified/backend-index.cjs:45026`; port: `rebuild/backend/src/repos/suppliers.ts` (`przeliczStatus`) |
| **Do nowej wersji?** | ✅ **port 1:1** |
| **Status** | ✔ odtworzone w rebuild (I2), opisane Ani w `docs/instrukcja-testow-I3.md` §4 pkt 11 |

**Objaw.** Ania ustawia dostawcy status **wstrzymany**, zapisuje, dostaje „Zapisano" —
a karta dalej pokazuje *aktywny* albo *błąd*. Zapis PRZESZEDŁ (kolumna ma nową wartość),
ale `GET /api/dostawcy` odsyła status wyliczony, który kolumnę nadpisuje. Wartość
z pola **Status** przebija się do widoku wyłącznie w jednym przypadku: dostawca bez
`ostatniPlik`, ale z produktami w katalogu.

**Wstrzymanie mimo to DZIAŁA** — blokadę automatu realizuje `L4()` (`:48039`), które czyta
status z SUROWEGO wiersza (`getSupplierByKod`). Stąd druga rzecz warta odnotowania:
wstrzymany dostawca ze świeżym `ostatniPlik` **dostaje od schedulera timer** (bo `D4()`
widzi status wyliczony „aktywny"), tylko każde odpalenie kończy się natychmiast na
„Wstrzymany", bez pobrania. Efekt dla użytkownika jest właściwy, mechanizm — mylący.
Pokryte testem w `test/scheduler.test.ts`, żeby nikt tego „nie poprawił" przypadkiem.

**Propozycja naprawy (do decyzji).** Odsyłać oba pola osobno (`status` z kolumny +
`statusWyliczony`) i pokazywać na karcie jedno, a w formularzu edycji drugie. Zmienia
kontrakt `GET /api/dostawcy` (19. klucz), więc wymaga przenagrania `GET_dostawcy.json`
i `GET_suppliers.json` — stąd osobna decyzja, nie doklejka do 3f-3.

---

### #19 · 2026-09-02 · [BACKEND] · silnik cen IGNORUJE daty promocji — wygasła promocja nadal obniża cenę

> **Znalezione przy bloku I4/4a (2026-09-02). ODTWORZONE 1:1** — naprawa świadomie
> odłożona, bo wymagałaby wyjątku w charakteryzacji importu. **Właściciel do ustalenia.**
> **Uzupełnione w 4b (frontend):** widok `/narzuty` odtwarza dokładnie ten sam defekt
> po stronie klienta i teraz go pokazuje — patrz „Co robi produkcja" niżej.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (silnik cen) [+FRONTEND — prezentacja, 4b] |
| **Pliki** | `deminified/backend-index.cjs:44615-44628` (`__bridgePromoMatches`); port: `rebuild/backend/src/repos/ceny.ts` (`promocjaPasuje`). Frontend: `frontend-index.js:9309-9314` (`Qd`), `:9508-9514` (`_b`), `:9568` (`queryFn`), `:9183-9193` (`Gr`/`un`, IndexedDB); port: `rebuild/frontend/src/pages/narzuty/status.ts` |
| **Do nowej wersji?** | ✅ **port 1:1** — naprawa ⬜ **do decyzji** (odrzucona w tym tickecie, patrz niżej) |
| **Status** | ✔ odtworzone w rebuild (4a backend, 4b frontend), defekt zgłoszony |

**Co robi produkcja.** `__bridgePromoMatches` (`:44615-44628`) nie czyta ani `start`, ani
`koniec` — o zastosowaniu promocji decyduje wyłącznie `status === "aktywna"` i dopasowanie
po `warunki`/`zasieg`. Kolumny `start` i `koniec` są w schemacie **NOT NULL** i nigdzie
w silniku nieużywane — istnieją, ale są martwe dla logiki cen. **Front produkcji dodatkowo
maskuje ten defekt na liście.** `Qd(start, koniec)` (`:9309-9314`) przelicza etykietę statusu
z dat i woła to `_b()` (`:9508-9514`) przy KAŻDYM odczycie `/api/promotions` (`queryFn`,
`:9568`) — wynik idzie do lokalnej tablicy, do cache'u zapytania i do IndexedDB
(`Gr()` → `un()`, `:9183-9193`), **ale nigdy na serwer**. Kolumna `status` w bazie zostaje
nietknięta i to jej używa silnik cen.

**Skutek.** Wygasła promocja nadal obniża ceny **w nieskończoność**. Jedynym sposobem jej
wyłączenia jest ręczna zmiana `status` na coś innego niż `"aktywna"`; upływ daty `koniec`
nie robi nic. Dotyczy obu ścieżek silnika: masowego `przeliczCenyZRegul`
(`recalcPricesFromRules`) wołanego po każdej mutacji narzutu/promocji, i gałęzi cenowej
importu (`acceptStaging`, wpiętej w 4a). **Na liście `/narzuty` skutek jest niewidoczny**:
etykieta pokazuje „zakończona" (liczona z dat), a backend promocję nadal stosuje — Ania nie
ma jak zauważyć rozjazdu, patrząc tylko na badge.

**Decyzja użytkownika (2026-09-02): odtworzyć 1:1, naprawy NIE robimy teraz.** Uzasadnienie:
naprawa wymagałaby wyjątku w charakteryzacji importu (test z bloku 3d-2, rozszerzony w 4a
o trzynaście scenariuszy cenowych, w tym `promocja-wygasla-nadal-obniza-cene`), czyli
osłabienia najmocniejszej siatki bezpieczeństwa, jaką w tym projekcie mamy. Odtworzone
dosłownie w `promocjaPasuje`, z testem pilnującym tego zachowania:
`rebuild/backend/test/ceny.silnik.test.ts` („⚠ promocja WYGASŁA nadal działa — silnik nie
czyta start ani koniec") i scenariuszem charakteryzacji
`rebuild/backend/test/charakteryzacja/akceptacja/scenariusze.mjs`
(`promocja-wygasla-nadal-obniza-cene`).

**Do rozważenia dla produkcji.** Naprawa jest jednoliniowa (dodać warunek na `start`/`koniec`
w `__bridgePromoMatches`), ale zmienia ceny na żywym katalogu. Poza zakresem odbudowy —
decyzja użytkownika, czy i kiedy.

**Uzupełnienie 4b (frontend, 2026-09-02).** Widok `/narzuty` portuje `_b()`/`Qd()` 1:1
(`rebuild/frontend/src/pages/narzuty/status.ts`) — etykieta statusu promocji liczona z dat
przy każdym odczycie, bez zapisu na serwer, dokładnie jak produkcja. Ponad port dołożony
**widoczny znacznik rozbieżności** (`rozbieznosc-statusu-{id}`, `data-testid` w
`TabelaPromocji.tsx`): gdy etykieta wyliczona z dat nie zgadza się z kolumną `status` z
serwera, wiersz pokazuje ostrzeżenie w stylu „wg dat zakończona, ale nadal obniża ceny".
To **nie jest naprawa** — dane i mechanika bez zmian, znika wyłącznie niewidzialność defektu
na liście (plan.md D5, decyzja użytkownika 2026-09-02). Naprawa (czytanie dat w silniku)
zostaje po stronie backendu i jest nadal ⬜ do decyzji.

---

### #20 · 2026-09-02 · [BACKEND] · `PATCH /api/promotions/{id}` nie ma 404 — bliźniacza trasa narzutu ma

> **Znalezione przy bloku I4/4a (2026-09-02). ODTWORZONE 1:1.** Nota dla sesji 4b
> (frontend): odpowiedź na nieistniejące id NIE zawiera obiektu. **Zrealizowane w 4b** —
> klient czyta ciało warunkowo, patrz niżej.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (trasy mutacji) [+FRONTEND — klient, 4b] |
| **Pliki** | `deminified/backend-index.cjs:48699` (`PATCH /api/markups/:id`, ma 404), `:48722-48731` (`PATCH /api/promotions/:id`, brak 404); port: `rebuild/backend/src/routes/markups.ts`, `rebuild/backend/src/routes/promotions.ts`. Frontend: `rebuild/frontend/src/pages/narzuty/api.ts` (`odczytajCialo`) |
| **Do nowej wersji?** | ✅ **port 1:1** |
| **Status** | ✔ odtworzone w rebuild (4a backend, 4b frontend), asymetria zgłoszona |

**Co robi produkcja.** `e.patch("/api/markups/:id", …)` (`:48699`) sprawdza jawnie
`if (!p) return u.status(404)`. Bliźniacza trasa `e.patch("/api/promotions/:id", …)`
(`:48722-48731`) tego sprawdzenia **NIE MA** — dla nieistniejącego id `updatePromotion`
zwraca `undefined`, a trasa mimo to oddaje **200 z pustym ciałem**. Dodatkowo audyt
`edycja_promocji` powstaje także wtedy — zapis ZAMIARU, nie wyniku, ten sam wzorzec co
przy `synchronizacja_reczna` (I3) i przy DELETE obu zasobów (`deleteMarkup`/
`deletePromotion` kasują w próżnię bez 404, audyt powstaje mimo to — port 1:1, bez
osobnego wpisu, bo tu obie trasy CRUD są zgodne między sobą).

**Skutek.** Klient, który PATCH-uje nieistniejącą promocję, dostaje sukces (`200`) zamiast
błędu — nie ma sposobu odróżnić „zaktualizowano" od „id nie istniało" po samym kodzie
odpowiedzi, trzeba czytać ciało.

**Decyzja użytkownika (2026-09-02): port 1:1**, zgodnie z zasadą „odtwarzasz zachowanie
1:1, odstępstwo wymaga decyzji" — asymetria między dwiema bliźniaczymi trasami jest
zachowaniem produkcji, nie usterką portu. **Nota dla sesji 4b:** frontend nie może zakładać,
że odpowiedź PATCH-a promocji zawiera obiekt promocji przy nieistniejącym id. Testy:
`rebuild/backend/test/narzuty.patch.test.ts` (404 przy narzucie, 200 z pustym ciałem przy
promocji).

**Do rozważenia dla produkcji.** Jednoliniowa naprawa (dodać ten sam strażnik co przy
narzutach). Poza zakresem odbudowy — decyzja użytkownika, czy i kiedy.

**Uzupełnienie 4b (frontend, 2026-09-02).** Klient promocji (`rebuild/frontend/src/pages/narzuty/api.ts`,
`odczytajCialo`) czyta odpowiedź przez `text()` i parsuje warunkowo — gołe `.json()` rzucałoby
wyjątkiem na pustym ciele, które trasa oddaje dla nieistniejącego id. Pusta odpowiedź jest
raportowana wywołującemu jako „nie znaleziono", nie jak sukces. Pokryte testem
`rebuild/frontend/test/narzuty.api.test.ts`. Status wpisu bez zmian — to nadal port 1:1
asymetrii tras, nie jej naprawa.

---

### #21 · 2026-09-02 · [BACKEND] · widok `/historia` nie pokazuje importów z URL ani ręcznych synchronizacji

> **Zgłoszone przy tickecie `15-FEATURE-historia-zmian` (I5). Port 1:1** — świadomie,
> decyzja użytkownika, plan.md D2.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (historia / mapowanie audytu) |
| **Pliki** | `deminified/backend-index.cjs:48341,48363` (słownik `akcja → typ`); port: `rebuild/backend/src/historia/mapowanie.ts` |
| **Do nowej wersji?** | ⬜ **DO DECYZJI** |
| **Status** | ✔ port 1:1 zrobiony w rebuild (I5) · rozszerzenie słownika — nie zaczęte |

**Co robi produkcja.** `/api/history/meta` i `/paged` mapują `akcja` z `audit_log` na `typ`
sztywnym słownikiem pięciu wartości (`upload_pliku`, `import_cennika` → import;
`eksport_csv`, `eksport_shoper` → eksport; `edycja_produktu` → edycja) i **odrzucają**
wszystko inne. Z dwunastu akcji, które dziś zapisuje rebuild, przez ten filtr przechodzą
tylko dwie — `upload_pliku` i `import_cennika`. Niewidoczne zostają m.in. `import_z_url`
i `import_pliku` (trasy importu z I3) oraz `synchronizacja_reczna` (automat z 3f-3).

**Dlaczego to jest jak w produkcji, a nie usterka.** Zachowanie odtworzone 1:1 (decyzja D2,
`docs/tickets/15-FEATURE-historia-zmian/plan.md`) — w oryginale te akcje też są niewidoczne
w tym widoku.

**Dlaczego mimo to warto zdecydować.** Od 3f-3 automatyczny import z URL jest głównym
kanałem zasilania danych. Historia, która go nie pokazuje, może dla Ani wyglądać na
dziurawą, mimo że ekran działa zgodnie ze specyfikacją oryginału. Rozszerzenie słownika
o nasze akcje importu/synchronizacji byłoby świadomym odstępstwem od produkcji.

**Rekomendacja:** do decyzji Ani — czy rozszerzyć słownik `akcja → typ` o `import_z_url`,
`import_pliku`, `synchronizacja_reczna` (i ew. inne), czy zostawić 1:1. Szczegóły
i rozważone alternatywy: `docs/tickets/15-FEATURE-historia-zmian/plan.md` (D2),
`raport.md` (Follow-up #2).

---

### #22 · 2026-09-02 · [FRONTEND] · kolumna „Promocja" w `/katalog` jest MARTWA

> **Znalezione przy bloku I4/4b (2026-09-02). Port 1:1** — decyzja użytkownika D1
> (`docs/tickets/16-FEATURE-widok-narzuty-promocje/plan.md`).

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (katalog) |
| **Pliki** | `deminified/frontend-index.js:23162-23182` (render kolumny); port: `rebuild/frontend/src/pages/katalog/kolumny.ts`, `katalog/formatowanie.tsx:118-138` |
| **Do nowej wersji?** | ✅ **port 1:1** — ożywienie ⬜ **do decyzji** (kandydat na I12) |
| **Status** | ✔ odtworzone w rebuild (4b), martwota potwierdzona |

**Co robi produkcja.** Render czyta `produkt._reguly?.promocja` (`:23162-23182`), a `_reguly`
**nie jest ustawiane nigdzie w bundlu** — jedno wystąpienie w całym pliku, wyłącznie odczyt
(potwierdzone `grep`em). Żadne z 66 pól produktu w `contract/fixtures/GET_products.json`
nie niesie promocji ani rabatu. Kolumna jest mimo to w domyślnym zestawie kolumn katalogu
i od zawsze renderuje `—`.

**Skutek.** Ania widzi w `/katalog` pustą kolumnę, która obiecuje pokazać obowiązującą
promocję, a nigdy nic nie pokaże — bo dane, które by ją zasiliły, nie istnieją nigdzie
w systemie produkcyjnym.

**Decyzja użytkownika (2026-09-02): port 1:1** — odbudowa ma to samo zachowanie
w `rebuild/frontend/src/pages/katalog/formatowanie.tsx`. Ożywienie wymagałoby danych
z backendu (pole dopasowanej promocji przy produkcie); liczenie po stronie klienta
duplikowałoby silnik dopasowania reguł (`rebuild/backend/src/repos/ceny.ts`) — drugie
miejsce, które musiałoby zgadzać się z pierwszym.

**Do rozważenia dla produkcji/odbudowy.** Ożywienie kolumny (backend dokłada pole przy
produkcie, wyliczone tym samym silnikiem co ceny) — kandydat na I12, poza zakresem 4b.

---

### #23 · 2026-09-02 · [FRONTEND] · `Mb()` liczy ceny inaczej niż własny backend

> **Znalezione przy bloku I4/4b (2026-09-02). NIE portowane — świadome odstępstwo**
> (decyzja użytkownika D8, `docs/tickets/16-FEATURE-widok-narzuty-promocje/plan.md`).

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (silnik cen klienta — symulator) |
| **Pliki** | `deminified/frontend-index.js:9481-9506` (`Mb`); zamiennik w odbudowie: `rebuild/frontend/src/pages/narzuty/ceny.ts` (liczy jak `rebuild/backend/src/repos/ceny.ts`) |
| **Do nowej wersji?** | ❌ **NIE — świadomie NIE portujemy rozjazdu** |
| **Status** | ✔ w rebuild klient liczy zgodnie z backendem (4b); defekt oryginału opisany, w produkcji nadal obecny |

**Co robi produkcja.** Klientowy silnik cen `Mb()` (`:9481-9506`) rozjeżdża się z własnym
backendem w trzech miejscach: (1) test „czy reguła jest specyficzna" sprawdza PRAWDZIWOŚĆ
napisu `warunki` (`"globalny" !== n.typ || n.warunki`, `:9485`) zamiast liczby warunków po
sparsowaniu — więc reguła z `warunki: "[]"` (dokładnie ta z `contract/fixtures/GET_markups.json`)
jest dla frontendu specyficzna, a dla backendu globalna, i przy dwóch regułach naraz każda
strona wybierze inną; (2) brak domyślnych `priorytet ?? 50` i `vat ?? 23`; (3) brak
`Math.floor`.

**Skutek.** Symulator ceny w produkcji potrafi pokazać rozbicie ceny, której w katalogu
nie ma — bo liczy inną formułą i innym doborem reguły niż silnik, który faktycznie ustawia
`cenaSprzedazy`.

**Decyzja użytkownika (2026-09-02): 4b świadomie NIE portuje tej rozbieżności.**
`rebuild/frontend/src/pages/narzuty/ceny.ts` liczy tak samo jak
`rebuild/backend/src/repos/ceny.ts`, a zgodności obu implementacji pilnują bliźniacze
testy po obu stronach (`narzuty.ceny.test.ts` / `ceny.silnik.test.ts`). Uzasadnienie:
błędne wyjaśnienie ceny jest gorsze niż jego brak, a od tej samej logiki zależy ostrzeżenie
o sprzedaży poniżej kosztu. W produkcji defekt **nadal obecny**.

---

### #24 · 2026-09-02 · [FRONTEND] · ostrzeżenie „poniżej kosztu" to TRZECI, osobny sposób liczenia

> **Znalezione przy bloku I4/4b (2026-09-02). Port 1:1** — decyzja użytkownika D6
> (`docs/tickets/16-FEATURE-widok-narzuty-promocje/plan.md`).

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (dialog reguł — kontrola przed zapisem) |
| **Pliki** | `deminified/frontend-index.js:24563-24597` (przy zapisie), `:24473-24513` (pasek na żywo); port: `rebuild/frontend/src/pages/narzuty/ceny.ts` (`produktyPonizejKosztu`), `DialogReguly.tsx` |
| **Do nowej wersji?** | ✅ **port 1:1** |
| **Status** | ✔ odtworzone w rebuild (4b), zweryfikowane liniowo w review rundy 2 |

**Co robi produkcja.** `el()` liczy ostrzeżenie „poniżej kosztu" (przy zapisie i na żywo)
jako `cenaSprzedazy × (1 − rabat/100)` porównywane z `cenaZakupu`, z WŁASNYM dopasowaniem
(`_matchProd`): globalna obejmuje wszystkie produkty, `marka`/`kategoria`/`dostawca`/`produkt`
po RÓWNOŚCI, `rozmiar`/`bieznik` przez zawieranie, nieznany typ odrzuca. To nie jest ani
`Mb()` (symulator, #23), ani silnik backendu (`rebuild/backend/src/repos/ceny.ts`) — trzeci,
niezależny sposób liczenia tej samej rzeczy.

**Skutek.** Ostrzeżenie jest przybliżeniem (backend i tak przeliczy katalog od ceny zakupu
swoim silnikiem) i **nie obejmuje warunków typu `konstrukcja`, `srednica`, `vfIf`** — także
tych, które 4b dołożyła do buildera warunków (D4 tego ticketa) ponad 6 typów oryginału.

**Decyzja użytkownika (2026-09-02): port 1:1** (D6) — zachowanie, wyliczenie i treść listy
bez zmian, wygląd dialogu inny (Radix zamiast `window.confirm`, bo ten blokuje wątek i nie
da się go stylować/testować). Odtworzone świadomie, ⬜ do rozważenia w przyszłości, czy
ujednolicić trzy niezależne sposoby liczenia ceny w widoku `/narzuty`.

---

### #25 · 2026-09-02 · [FRONTEND] · promocja „globalna" nie obniża żadnych cen, ale ostrzega o całym katalogu

> **Znalezione przy pisaniu instrukcji testów I4 (ticket `17-DOCS-instrukcja-testow-i4`),
> POMIAREM, nie lekturą.** Dotyczy zarówno produkcji, jak i odbudowy — port jest 1:1.

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (widok `/narzuty`, dialog reguły) |
| **Pliki** | `deminified/frontend-index.js:24613` (`zasieg: R ? "globalny" : …`), `:9473-9479` (`Tb`), `:24473-24513` i `:24563-24597` (ostrzeżenie); port: `rebuild/frontend/src/pages/narzuty/DialogReguly.tsx`, `ceny.ts` |
| **Do nowej wersji?** | ⬜ **do decyzji** — port 1:1 wykonany, naprawa czeka na rozstrzygnięcie |
| **Status** | odtworzone świadomie w 4b · w produkcji **nadal obecne** |

**Co robi produkcja.** Zaznaczenie w dialogu checkboxa „Reguła globalna (wszystkie produkty,
bez warunków)" wysyła przy promocji `zasieg: "globalny"` i `warunki: "[]"` (`:24613`).
Dopasowanie promocji (`Tb`, `:9473-9479`, u nas `promocjaPasuje`) przy pustych `warunki`
sprawdza natomiast, czy **`zasieg` ZAWIERA markę albo kategorię produktu**:

```js
const r = (e.zasieg ?? "").toLowerCase();
return !!r && (r.includes((t.marka ?? "").toLowerCase()) || r.includes((t.kategoria ?? "").toLowerCase()))
```

Napis `"globalny"` nie zawiera ani `"bkt"`, ani `"rolnicze"` — więc **promocja globalna nie
pasuje do żadnego normalnego produktu**. Pasuje wyłącznie do pozycji z PUSTĄ marką albo pustą
kategorią, bo `"globalny".includes("")` jest prawdą.

**Zmierzone** (`promocjaPasuje` z `rebuild/frontend/src/pages/narzuty/ceny.ts`, port `Tb` 1:1):

| Produkt | `zasieg: "globalny"`, `warunki: "[]"` |
|---|---|
| marka `BKT`, kategoria `Rolnicze` | **`false`** — promocja NIE działa |
| marka `null`, kategoria `null` | `true` |

**Skutek — i tu jest sedno.** Ostrzeżenie „poniżej kosztu" liczy dopasowanie **innym kodem**
(`_matchProd`, wpis #24), w którym `if (_isGlobal) return true`, czyli globalna obejmuje
**WSZYSTKIE** produkty. Użytkownik dostaje więc czerwony pasek „⚠ UWAGA: 7400 produktów będzie
miało cenę sprzedaży PONIŻEJ ceny zakupu", potwierdza zapis — i **nie zmienia się ani jedna
cena**. Dwa mechanizmy w tym samym oknie odpowiadają na to samo pytanie przeciwnie.

Dla narzutów problemu NIE MA: tam „globalna" wysyła `typ: "globalny"`, a `narzutPasuje`
zwraca dla tego typu `true` bezwarunkowo. Niespójność dotyczy wyłącznie promocji.

**Co z tego wynika.**
- **Obejście na dziś:** promocjom ZAWSZE ustawiać warunek (choćby szeroki, np. kategoria).
  Zapisane w `docs/instrukcja-testow-I4.md` §3.7 i §4 pkt 4.
- **Naprawa** jest jednolinijkowa po stronie dopasowania (traktować `zasieg === "globalny"`
  jak dopasowanie do wszystkiego, tak jak robi to ostrzeżenie), ale jest **zmianą zachowania
  produkcji**: promocje, które dziś nic nie robią, zaczęłyby nagle obniżać ceny całego
  katalogu. Wymaga świadomej decyzji użytkownika i sprawdzenia, czy w produkcyjnej bazie nie
  leżą uśpione promocje globalne.
- Alternatywa: usunąć checkbox „globalna" z formularza promocji, skoro w tej roli nie działa.

---

### #26 · 2026-09-03 · [FRONTEND] · widok `/alerty` w oryginale NIE czyta `/api/alerts` — pseudo-alerty katalogowe pominięte

> **Znalezione przy Iteracji 6 (2026-09-03), ticket `18-FEATURE-widok-alerty`.**
> **POMINIĘTE ŚWIADOMIE, decyzja użytkownika** — nowy `/alerty` stoi na realnych alertach
> importu. Ten wpis pilnuje, żeby wiedza o porzuconej funkcji nie zginęła.

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (widok `/alerty`) |
| **Pliki** | `deminified/frontend-index.js:25177-25340` (`HT()`), `:16631-16705` (`pv()`), `:9165-9193` (IndexedDB `cn`/`un`) |
| **Do nowej wersji?** | ⬜ **do decyzji** |
| **Status** | — nie zaczęte (Iteracja 6 dowiozła INNY widok pod tym adresem) |

**Co robi produkcja.** Ekran `/alerty` w oryginale **nie woła `GET /api/alerts` ani razu**,
mimo że backend obsługuje tę trasę od zawsze (`backend-index.cjs:48688-48691`). Zamiast tego
pobiera `GET /api/products` i wylicza po stronie klienta **pseudo-alerty katalogowe** (`pv()`):
marża ujemna, marża poniżej progu i „nie-opona" w katalogu opon. Stan ich obsługi trzyma
w **IndexedDB** (klucz `alerty-statusy`), nie na serwerze — więc oznaczenie „przejrzany" żyje
w jednej przeglądarce i ginie razem z jej danymi. Operuje przy tym poziomem `krytyczny`
i statusem `przejrzany`, których backend **nigdy nie produkuje** (w `db/snapshot.db` nie ma
ani jednego takiego wiersza). Potwierdza to `docs/incoming/frontend-perplexity/dokumentacja/02_WIDOKI.md`
§`/alerty` pkt 6.

**Co dowiozła Iteracja 6.** Widok na REALNYCH alertach importu z `/api/alerts` (błąd HTTP,
błąd pobierania, synchronizacja, ręczny upload), ze statusem trzymanym na serwerze i powtórkami
zwiniętymi w grupy `(dostawca, typ, status)`. To odpowiedź na pytanie „lokalnie czy przez API"
ze `spec-frontend.md` §4 — z tym, że pytanie było źle postawione: chodziło nie o miejsce
przechowywania statusu tych samych alertów, tylko o **dwa różne zestawy danych**.

**Dlaczego nie odtworzyliśmy pseudo-alertów.** Alerty importu niosą informację o tym, co się
w nocy nie pobrało — 339 wierszy „Błąd pobierania" w snapshocie, do 23 na dobę dla jednego
dostawcy. Pseudo-alerty katalogowe to inne zagadnienie (jakość danych cenowych), a wrzucone
na ten sam ekran mieszałyby dwa pojęcia „alertu" w jednej liście i psuły grupowanie
(nie mają `dostawca`, `typ` ani `data` w sensie tabeli `alerts`).

**Do decyzji.** Czy pseudo-alerty katalogowe wracają w ogóle, a jeśli tak — to gdzie:
(a) osobna zakładka w `/alerty`, (b) własny widok „jakość danych", (c) kolumna/filtr
w `/katalog`, gdzie te produkty i tak są widoczne, (d) nie wracają wcale. Powiązane: marża
liczona w `pv()` to **czwarty** sposób liczenia ceny w oryginale — patrz wpisy #23 i #24.

**Decyzja utrzymana po raz drugi w bloku 10f (2026-09-04).** Pulpit `/` oryginału
(`deminified/frontend-index.js:16836-17090`, funkcja `N2`) liczy te same pseudo-alerty przez
`pv()` (`:16631-16745`) i pokazuje pięć najnowszych w karcie „Najnowsze powiadomienia".
Odbudowa karmi ten sam układ realnymi alertami importu z `GET /api/alerts` (decyzja D1
z 2026-09-04, `docs/tickets/26-FEATURE-analityka-export-pulpit/plan.md`, odstępstwo O-10f-1) —
dobór (poziom `krytyczny`/`ostrzezenie`, status `nowy`), sortowanie (poziom, potem data
malejąco) i limit pięciu są portem 1:1, zmieniło się wyłącznie ŹRÓDŁO. Pseudo-alerty
katalogowe są teraz porzucone na DWÓCH ekranach (`/alerty` i `/`), nie jednym.

---

### #27 · 2026-09-03 · [FRONTEND] · lista przewoźników i dzielników żyje wyłącznie w IndexedDB przeglądarki

> **Znalezione przy tickecie `18-FEATURE-waga-gabarytowa` (I9). Port 1:1** — decyzja D3
> (`docs/tickets/18-FEATURE-waga-gabarytowa/plan.md`).

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (widok `/waga-gabarytowa`, edytor przewoźników) |
| **Pliki** | `deminified/frontend-index.js:9165-9193` (store IndexedDB); port: `rebuild/frontend/src/lib/magazynKV.ts`, `pages/waga-gabarytowa/przewoznicy.ts` |
| **Do nowej wersji?** | ✅ **port 1:1** — przeniesienie na backend ⬜ **do decyzji** |
| **Status** | ✔ odtworzone w rebuild (I9) |

**Co robi produkcja.** Edytor przewoźników i dzielników (dodawanie własnego, zmiana nazwy/
dzielnika per wiersz, usuwanie z blokadą „min. 1 przewoźnik", „Przywróć domyślne") trzyma
cały stan wyłącznie w IndexedDB przeglądarki (baza `bridge-store-v2`). Zmiany Ani nie
przenoszą się między urządzeniami i giną przy czyszczeniu danych witryny.

**Decyzja użytkownika (2026-09-03): port 1:1** — odbudowa ma to samo zachowanie
(`magazynKV`, ten sam mechanizm co inne dane lokalne widoku). Przeniesienie listy
przewoźników na backend (persystencja niezależna od urządzenia) byłoby nową funkcją,
nie odbudową — do rozważenia osobno.

---

### #28 · 2026-09-03 · [BACKEND] · `POST /api/waga-gabarytowa/oblicz` nie ma konsumenta

> **Znalezione przy tickecie `18-FEATURE-waga-gabarytowa` (I9). Port 1:1** — decyzja D1
> (`docs/tickets/18-FEATURE-waga-gabarytowa/plan.md`).

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (endpoint kalkulatora paletowego) |
| **Pliki** | `deminified/backend-index.cjs:48749-48769`; port: `rebuild/backend/src/waga-gabarytowa/formula.ts`, `routes/waga-gabarytowa.ts` |
| **Do nowej wersji?** | ✅ **port 1:1** — podłączenie pod UI ⬜ **do decyzji** |
| **Status** | ✔ zrobione w rebuild (I9), przetestowane jednostkowo i przez GATE, bez wywołań z frontendu |

**Co robi produkcja.** Endpoint liczy wagę gabarytową wg formuły **paletowej/oponowej**
(progi półpalety/palety, sterowana configiem `waga_gab.*`), ale żaden fragment frontendu go
nie woła — widok `/waga-gabarytowa` liczy **innym, wolumetrycznym** wzorem, lokalnie,
z dzielnikiem per przewoźnik (patrz #27). Dwa merytorycznie różne kalkulatory pod tą samą
nazwą, oba odtworzone 1:1 w I9 (D1).

**Decyzja użytkownika (2026-09-03): dowieźć oba, bez podłączania FE do endpointu.** Gdyby
formuła paletowa miała się kiedyś pojawić w UI, to osobna decyzja produktowa (nowy widok
albo zakładka), nie podmiana istniejącego kalkulatora wolumetrycznego.

---

### #29 · 2026-09-03 · [FRONTEND][BACKEND] · zakładka „Spedycja" połączona z backendem — w produkcji dane żyją wyłącznie w IndexedDB

> **Znalezione i naprawione przy tickecie `18-FEATURE-konfiguracja-config-spedycja` (I11,
> 2026-09-03). Decyzja użytkownika D2 — odstępstwo świadome od 1:1.**

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (zakładka `/konfiguracja` → Spedycja) + BACKEND (trasy już istniały, nieużywane) |
| **Pliki** | `deminified/frontend-index.js:10381` (`Ee.setQueryDefaults(["/api/spedycja"], …)`), `:10365-10371` (`un("spedycja", …)`, zapis do IndexedDB), `:25808-25938` (`qT()`, render); backend `deminified/backend-index.cjs:48735-48739` (`GET`/`POST /api/spedycja`, sprawne, ale nieużywane przez UI); port: `rebuild/backend/src/routes/spedycja.ts`, `rebuild/frontend/src/pages/konfiguracja/Spedycja.tsx` |
| **Do nowej wersji?** | ✅ **TAK — odstępstwo od 1:1** (decyzja użytkownika 2026-09-03, ticket `18-FEATURE-konfiguracja-config-spedycja`, plan.md D2) |
| **Status** | ✔ zrobione w rebuild (I11, 2026-09-03) |

**Co robi produkcja.** Zakładka „Spedycja" nie wysyła ani nie pobiera niczego z serwera.
`Ee.setQueryDefaults(["/api/spedycja"], { queryFn: async () => [...an] })` (`:10381`)
podstawia zapytaniu tablicę z pamięci modułu (`an`), a zapis idzie do IndexedDB
(`un("spedycja", …)`, `:10365-10371`). Backend ma przy tym sprawne `GET`/`POST /api/spedycja`
(`:48735-48739`) — po prostu nikt ich z UI nie woła. Limity spedycyjne żyją więc wyłącznie
w przeglądarce jednej osoby: inny komputer, albo wyczyszczone dane witryny, i limitów nie ma.

**To NIE jest to samo, co cache IndexedDB przy promocjach (wpis #19).** Tam dane realnie idą
przez sieć, a IndexedDB jest tylko cache'em zapytania. Tu przez sieć nie idzie NIC.

**Decyzja użytkownika (2026-09-03): podpiąć widok pod istniejące trasy backendu.** Limity są
teraz trwałe i wspólne dla wszystkich, zamiast lokalne dla jednej przeglądarki. Reszta
zakładki (układ tabeli, `data-testid`, konwersje pól, pojawianie się przycisku „Zapisz"
dopiero po zmianie w wierszu) to port 1:1 z `qT()`. Zapis filtruje ciało whitelistą pól
(`odsiejPolaSpedycji` — `dostawcaKod, progNetto, kosztPonizej, kosztPowyzej, dodatkoweReguly`,
`id` odcięte) — ten sam wzorzec co wpis #14. Szczegóły: plan.md D2 i D5 ticketu
`18-FEATURE-konfiguracja-config-spedycja`.

**Do rozważenia dla produkcji.** Poza zakresem odbudowy — w starym Bridge zakładka nadal nie
łączy się z serwerem.

---

### #30 · 2026-09-03 · [BACKEND] · `POST /api/config` filtruje klucze whitelistą — oryginał przyjmuje dowolny

> **Znalezione i naprawione przy tickecie `18-FEATURE-konfiguracja-config-spedycja` (I11,
> 2026-09-03). Decyzja użytkownika D4 — odstępstwo świadome od 1:1.**

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (trasa mutacji configu) |
| **Pliki** | `deminified/backend-index.cjs:48745` (`U.setConfig`), `:45083-45089` (zapis bez walidacji klucza), `:48746` (maskowanie audytu `klucz.includes("klucz_api")`), `:45633-45644` (seed `vR`, 11 kluczy), `:48750-48760` (`POST /api/waga-gabarytowa/oblicz`, czyta `waga_gab.*`); port: `rebuild/backend/src/repos/config.ts` (`KLUCZE_KONFIGURACJI`, `czyKluczDozwolony`), `src/routes/config.ts` |
| **Do nowej wersji?** | ✅ **TAK — odstępstwo od 1:1** (decyzja użytkownika 2026-09-03, ticket `18-FEATURE-konfiguracja-config-spedycja`, plan.md D4) |
| **Status** | ✔ zrobione w rebuild (I11, 2026-09-03) |

**Co robi produkcja.** `U.setConfig(klucz, wartosc)` (`:48745`, `:45083-45089`) zapisuje
DOWOLNY klucz bez walidacji — `config` to magazyn klucz-wartość bez schematu. Literówka
w nazwie (np. „shoper.separaator") zakłada w tabeli nowy, martwy wiersz i funkcja cicho
przestaje działać; nic tego nie sygnalizuje.

**Decyzja użytkownika (2026-09-03): zamknięta lista 13 kluczy, klucz spoza listy → `400`.**
Ten sam wzorzec dyscypliny co `odsiejPola` przy dostawcach/narzutach/promocjach/spedycji
(wpis #14) — z tą różnicą, że tu filtrujemy dozwolone KLUCZE zasobu klucz-wartość, nie pola
obiektu. Lista: 11 kluczy z seeda produkcji `vR` (5× `waga_gab.*`, 3× `ai_fallback.*`,
`shoper.adres_sklepu`, `shoper.token_api`, `shoper.format_eksportu`) + `shoper.kolumny`
i `shoper.separator`, które zapisuje zakładka Shoper, a których w produkcji nikt jeszcze nie
zapisał (dlatego nie ma ich w `contract/fixtures/GET_config.json`). Szczegóły: plan.md D4.

**Dwie powiązane własności oryginału, odtworzone 1:1 (nie są zmianą tego ticketa):**
- **Maskowanie w audycie patrzy na NAZWĘ klucza, nie na listę sekretów** —
  `klucz.includes("klucz_api") ? "***" : wartosc` (`:48746`). Efekt: `ai_fallback.klucz_api`
  jest maskowany w `audit_log`, ale **`shoper.token_api` trafia do dziennika JAWNIE**.
  Pilnowane testem; zawężenie/poszerzenie maski to osobna decyzja.
- **`GET /api/config` oddaje sekrety niezamaskowane** (bo widok potrzebuje wartości do pola
  edycji) — w produkcji trasa jest przy tym PUBLICZNA (bez auth); w odbudowie stoi za
  `requireAuth` (wzorzec D1 z I1a, utrwalony w I2, 3b, 3d-2, 4a i I5).

**Pięć kluczy `waga_gab.*` nie mają w oryginale ŻADNEGO edytora** (0 wystąpień `waga_gab`
w `frontend-index.js`), choć czyta je `POST /api/waga-gabarytowa/oblicz` (`:48750-48760`).
Podtytuł ekranu Konfiguracji sugerujący „osobną zakładkę wagi gabarytowej" jest martwy —
takiej zakładki nie ma i I11 jej nie dodaje (plan.md D7).

**Do rozważenia dla produkcji.** Poza zakresem odbudowy — decyzja użytkownika, czy i kiedy
dodać walidację klucza albo zawęzić maskowanie w starym Bridge.

---

### #31 · 2026-09-03 · [BACKEND] · `POST /api/analytics/bootstrap-current` nie jest idempotentne — każde wywołanie dubluje migawkę

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (trasa analityki, tabela `historia_cen`) |
| **Pliki** | `mirror/backend/analytics_module.cjs:81-91` (handler, `INSERT … SELECT` bez `ON CONFLICT`); port: `rebuild/backend/src/repos/analityka.ts` (`zbudujSnapshotBiezacy`), `rebuild/backend/src/routes/analytics.ts` |
| **Do nowej wersji?** | ⬜ **do decyzji Ani** — port 1:1 wykonany, naprawa czeka na rozstrzygnięcie |
| **Iteracja** | odtworzone 1:1 w **10a**; trasa świadomie bez przycisku w UI (decyzja D4, `docs/tickets/19-FEATURE-analityka-fundament/plan.md`) |
| **Status** | ✔ odtworzone w rebuild (10a) · w produkcji **nadal obecne** |

**Co robi produkcja.** Handler robi `INSERT INTO historia_cen (…) SELECT … FROM products
WHERE status='aktywny'` bez żadnego `ON CONFLICT`/`WHERE NOT EXISTS`. Każde wywołanie dokłada
po jednym wierszu `historia_cen` na każdy aktywny produkt, niezależnie od tego, czy migawka
z tego dnia już istnieje — dwa wywołania pod rząd dublują całą partię.

**Skutek.** Statystyki liczone z `historia_cen` (snapshoty, zakres dat) rosną liniowo z liczbą
wywołań, nie z liczbą realnych zdarzeń cenowych. Oryginalny frontend nigdy nie woła tej trasy
(grep `bootstrap` po `frontend-index.js` — zero trafień), więc w produkcji ryzyko jest dziś
teoretyczne — uruchamia się ją tylko ręcznie/skryptem.

**Co zrobiła odbudowa.** Port 1:1, nieidempotentność udokumentowana w nagłówku funkcji
i pokryta testem charakteryzacyjnym (`bootstrap-current` zwraca `inserted` równe liczbie
aktywnych produktów i rośnie przy drugim wywołaniu). Trasa przechodzi GATE (openapi + 401 +
test jednostkowy), ale świadomie nie dostała przycisku w UI, żeby nikt nie kliknął jej dwa razy.

**Naprawa (propozycja).** `INSERT … SELECT` z `WHERE NOT EXISTS (SELECT 1 FROM historia_cen
WHERE …)` per produkt/dzień, albo unikalny indeks na `(produkt, data)` + `ON CONFLICT DO NOTHING`.
Poza zakresem odbudowy — decyzja użytkownika, czy i kiedy naprawiać zachowanie produkcji.

**Powiązanie z #32/#33.** Inny błąd tej samej tabeli `historia_cen`, niezależny od tego wpisu:
`INSERT` powyżej nie odwołuje się do kolumny `nazwa` (jej też nie ma w `historia_cen`), więc
naprawa #32 na ten insert nie wpływa. Trzy wpisy dotyczą tej samej tabeli, ale trzech osobnych
usterek — nie scalać.

---

### #32 · 2026-09-04 · [BACKEND] · `historia_cen` NIE MA kolumny `nazwa` — obie karty „Dostępności" są trwale puste

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (dwie trasy analityki, tabela `historia_cen`) |
| **Pliki** | `mirror/backend/analytics_module.cjs:161` (`availability/products`), `:176` (`availability/sell-through`), `:316-317` (te same dwa widoki eksportu); schemat: `db/schema.sql`, `rebuild/schema/001_schema.sql`, `analytics_module.cjs:24-49` (`ensureSchema`); port: `rebuild/backend/src/repos/analityka.ts` (dashboard), `rebuild/backend/src/repos/analityka-eksport.ts` (eksport CSV) |
| **Do nowej wersji?** | ⬜ **do decyzji Ani** — port 1:1 wykonany, naprawa czeka na rozstrzygnięcie |
| **Iteracja** | odtworzone 1:1 w **10e** (dashboard, `docs/tickets/25-FEATURE-analityka-dostepnosc-rotacja/`) i **10f** (eksport CSV, `docs/tickets/26-FEATURE-analityka-export-pulpit/`) |
| **Status** | ✔ odtworzone w rebuild (10e + 10f) · w produkcji **nadal obecne** |

**Co robi produkcja.** `GET /api/analytics/availability/products` w gałęzi z historią robi
`SELECT kod, ean, dostawca, MAX(nazwa) AS nazwa, … FROM historia_cen`, a
`GET /api/analytics/availability/sell-through` bierze `MAX(nazwa)` w CTE `seq` z tej samej
tabeli. **Tabela `historia_cen` nie ma kolumny `nazwa`** — nie ma jej ani zrzut produkcji
(`db/schema.sql`), ani `rebuild/schema/001_schema.sql`, ani `ensureSchema()` samego modułu
analityki, który tę tabelę tworzy (`analytics_module.cjs:24-49`). SQLite odpowiada
`no such column: nazwa`, a `safeAll()` (`:51`) połyka wyjątek i zwraca pustą listę.

**Dowód z nagrań, nie z rozumowania.** `contract/fixtures/GET_analytics_status.json` pokazuje
**15 597 migawek** w `historia_cen`, a mimo to
`GET_analytics_availability_products.json` i `GET_analytics_availability_sell-through.json`
mają `hasHistory: true` i `rows: []`. Nie jest to więc „pusta baza w chwili nagrania" —
te dwie trasy nie zwróciły ani jednego wiersza mając 15 597 migawek do policzenia.

**Skutek.** Obie karty zakładki „Dostępność" w oryginale — „4.1 Historia dostępności pozycji"
i „4.2 Tempo schodzenia z magazynu" (`deminified/frontend-index.js:28421-28487`) — pokazują
użytkownikowi „Brak danych" **od zawsze**, niezależnie od danych. Ta sama wada dotyczy dwóch
widoków eksportu CSV (`export/availability-products`, `export/sell-through`, `:316-317`),
które w tej sytuacji oddają sam znacznik BOM — to jest wejście dla bloku **10f**.

**Co zrobiła odbudowa.** Port 1:1, łącznie z portem `safeAll` (`bezpiecznieWiersze`
w `repos/analityka.ts`), żeby zachowanie było identyczne z produkcją zamiast dawać 500.
Zamrożone dwoma testami charakteryzacyjnymi backendu i jednym testem widoku — gdyby te trasy
kiedyś zaczęły zwracać wiersze, testy o tym powiedzą. **Blok 10f odtworzył tę samą wadę**
w dwóch widokach eksportu CSV (`export/availability-products`, `export/sell-through`, port
w `repos/analityka-eksport.ts`) — oba oddają sam znacznik BOM mimo danych w `historia_cen`,
zamrożone `test/analityka.eksport.agregaty.test.ts` (poziom repo) i
`test/analityka.eksport.gate.test.ts` (przez HTTP).

**Naprawa (propozycja).** Trzy warianty, każdy to zmiana zachowania produkcji:
(a) `LEFT JOIN products p ON p.kod = h.kod` i `MAX(p.nazwa)` — pełne kolumny oryginału, ale
nazwa znika dla pozycji usuniętych z katalogu; (b) usunięcie `nazwa` z obu zapytań — karty
zaczynają działać, pozycję rozpoznaje się po kodzie i EAN-ie; (c) dołożenie kolumny `nazwa`
do `historia_cen` i wypełnianie jej przy zapisie — najbliżej pierwotnego zamiaru autora,
ale wymaga migracji i nie wypełni danych historycznych. Poza zakresem odbudowy — decyzja
użytkownika, czy i kiedy naprawiać.

---

### #33 · 2026-09-04 · [BACKEND] · `sell-through`: funkcja okna liczona PO niepełnym `GROUP BY` — wynik niedeterministyczny przy duplikacie

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (trasa analityki, poprawność SQL) |
| **Pliki** | `mirror/backend/analytics_module.cjs:175-179` (dashboard), `:317` (widok eksportu `sell-through`); port: `rebuild/backend/src/repos/analityka.ts` (`tempoSchodzenia`), `rebuild/backend/src/repos/analityka-eksport.ts` (eksport); źródło duplikatu: `rebuild/backend/src/import/tk.ts:171,548-564` |
| **Do nowej wersji?** | ⬜ **do decyzji Ani** — dziś zamaskowane przez #32 |
| **Iteracja** | odtworzone 1:1 w **10e** (`docs/tickets/25-FEATURE-analityka-dostepnosc-rotacja/`) |
| **Status** | ✔ odtworzone w rebuild (10e) · **nieosiągalne, dopóki żyje #32** |

**Co robi produkcja.** CTE `seq` wybiera `stan` **gołe, bez agregatu**, obok
`GROUP BY dostawca, kod, zarejestrowano_at`, i liczy na tym
`LAG(stan) OVER (PARTITION BY dostawca, kod ORDER BY zarejestrowano_at)`. To nie jest poprawny
SQL wg standardu; SQLite na to pozwala i liczy okno **po** agregacji. Sprawdzone empirycznie
na SQLite 3.47.2: gdy na `(dostawca, kod, zarejestrowano_at)` przypada jeden wiersz, wynik jest
poprawny; gdy przypada ich ≥ 2, SQLite bierze `stan` z **arbitralnego** wiersza grupy
(implementation-defined — w teście trafił wiersz wstawiony jako pierwszy).

**Kiedy duplikat powstaje.** `import/tk.ts:171,548-564` liczy znacznik `zarejestrowanoAt`
**raz na cały import**, więc dwie linie tego samego `kod` w jednym cenniku dostawcy dają dwa
wiersze `historia_cen` o identycznym kluczu grupowania. Ta sama konstrukcja jest w legacy.

**Dlaczego to dziś nie boli.** Zapytanie i tak nigdy nie dobiega do końca — wywraca się
wcześniej na `MAX(nazwa)` (wpis **#32**). Naprawa #32 **odsłoni** ten problem, więc obie
sprawy trzeba rozstrzygać razem.

**Co zrobiła odbudowa.** Port 1:1 z komentarzem opisującym pułapkę i testem
charakteryzacyjnym, który zamraża realny efekt (pusta lista mimo danych do policzenia).
To samo dotyczy widoku eksportu `export/sell-through` (port w `repos/analityka-eksport.ts`,
blok **10f**) — tam też dziś zamaskowane przez #32.

**Naprawa (propozycja).** Rozdzielić agregację od funkcji okna: najpierw CTE zwijające
duplikaty (`MAX(stan)` albo `MIN(id)` per klucz), dopiero na nim `LAG`. Poza zakresem
odbudowy — decyzja użytkownika, razem z #32.

---

### #34 · 2026-09-04 · [FRONTEND] · kafel „Ostatni eksport CSV" na Pulpicie jest TRWALE MARTWY

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (widok `/`, Pulpit) |
| **Pliki** | `deminified/frontend-index.js:16852` (`N2`); `contract/fixtures/GET_history.json`; nagłówek `rebuild/backend/src/routes/history.ts`; port: `rebuild/frontend/src/pages/pulpit/kpi.ts` (`ostatniEksport`/`ostatniImport`) |
| **Do nowej wersji?** | ⬜ **do decyzji Ani** — port 1:1 wykonany, naprawa czeka na rozstrzygnięcie |
| **Iteracja** | odtworzone 1:1 w **10f** (`docs/tickets/26-FEATURE-analityka-export-pulpit/`, decyzja D3) |
| **Status** | ✔ odtworzone w rebuild (10f) · w produkcji **nadal obecne** |

**Co robi produkcja.** Pulpit oryginału (`N2`) robi `r.find(e => "eksport" === e.typ)` na
odpowiedzi `GET /api/history`, a druga zmienna analogicznie szuka `"import"`. `GET /api/history`
oddaje wiersze tabeli `history` — dziennik zmian PÓL PRODUKTU, kształt
`{id, data, kodProduktu, nazwa, pole, staraWartosc, nowaWartosc, zrodlo, kto,
wykonalUzytkownikId}` (`contract/fixtures/GET_history.json`). **Pola `typ` tam nie ma.**
Rozróżnienie dwóch tabel opisuje nagłówek `routes/history.ts`. Pole `typ` niesie INNA trasa:
`GET /api/history/paged` (czyta `audit_log`, wartości m.in. `eksport_csv`, `import_cennika`).

**Skutek.** Kafel pokazuje „—" i „Brak eksportów ani importów" ZAWSZE, niezależnie od danych.

**Co zrobiła odbudowa.** Port 1:1 (decyzja użytkownika D3, 2026-09-04), z komentarzem w
`pages/pulpit/kpi.ts` (funkcja `ostatniEksport`/`ostatniImport` — sygnatura celowo nie pozwala
odczytać `typ`) i dwoma testami zamrażającymi (`test/pulpit.kpi.test.ts`, `test/pulpit.test.tsx`).

**Do decyzji.** Czy podpiąć kafel pod `audit_log` (`/api/history/paged` albo `/meta`), czy
zostawić martwy.

---

### #35 · 2026-09-04 · [BACKEND] · `Content-Disposition` w eksporcie CSV bierze `{view}` bez sanityzacji

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (trasa `GET /api/analytics/export/:view`) |
| **Pliki** | `mirror/backend/analytics_module.cjs:308` (nagłówek), `:321` (nieznany widok → `sendRows([])`); port: `rebuild/backend/src/routes/analytics.ts:324-335` |
| **Do nowej wersji?** | ⬜ **do decyzji Ani** — port 1:1 wykonany, naprawa czeka na rozstrzygnięcie |
| **Iteracja** | odtworzone 1:1 w **10f** (`docs/tickets/26-FEATURE-analityka-export-pulpit/`) |
| **Status** | ✔ odtworzone w rebuild (10f) · w produkcji **nadal obecne** |

**Co robi produkcja.** `analytics_module.cjs:308`:
``res.setHeader('Content-Disposition', `attachment; filename=${view}.csv`)`` — `view` pochodzi
wprost z `req.params`, bez cudzysłowów i bez `filename*`.

**Skutek.** Node odrzuca wartość nagłówka ze znakiem sterującym, więc `{view}` z `\n` kończy
w `catch` jako 500 (nie jako wstrzyknięcie nagłówka) — ale nazwa pliku nadal przyjmuje dowolny
„legalny" napis.

**Co zrobiła odbudowa.** Port 1:1 w `routes/analytics.ts`, bez sanityzacji, z komentarzem
w kodzie.

**Do decyzji.** Czy ograniczyć `{view}` do listy znanych widoków (odpowiedź 404/400 zamiast
pustego CSV) albo owinąć nazwę w cudzysłowy. ⚠ Powiązanie: to zmieniłoby też zachowanie
„nieznany `{view}` → 200 i sam BOM", które jest portem `return sendRows([])` (`:321`).

---

### #36 · 2026-09-04 · [FRONTEND] · niejednolite renderowanie `AppShell` w widokach odbudowy

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (regresja wierności wobec oryginału, nie tylko architektura odbudowy) |
| **Pliki** | renderują `AppShell`: `rebuild/frontend/src/pages/{Pulpit,Konfiguracja,Atrybuty,Selly,MojeKonto}.tsx` (`MojeKonto.tsx` od I12/12b); NIE renderują: `Katalog.tsx`, `Staging.tsx`, `Historia.tsx`, `Narzuty.tsx`, `Alerty.tsx`, `WagaGabarytowa.tsx`, `Analityka.tsx`; `App.tsx` (routing bez wspólnego layoutu wokół `<Switch>`); `WidokWPrzygotowaniu.tsx` USUNIĘTY w 12b (ostatni placeholder zniknął); oryginał: `deminified/frontend-index.js:16329` (`mn()`, sidebar+topbar) |
| **Do nowej wersji?** | ⬜ **do decyzji Ani** |
| **Status** | — nie zaczęte (zastane, ujawnione przy **10f**, powiększone przy **8b** o `/selly`) |

**Co znaleziono.** `App.tsx` rejestruje trasy bezpośrednio pod `<Switch>`, bez wspólnego
layoutu — każdy widok sam decyduje, czy owinąć się w `AppShell` (komponent z sidebarem,
`components/AppShell.tsx:59-87`). Dziś robią to `Pulpit`, `Konfiguracja`,
(od 7b) `Atrybuty`, (od 8b) `Selly` i (od 12b) `MojeKonto`; **siedem** pozostałych widoków
(`Katalog`, `Staging`, `Historia`, `Narzuty`, `Alerty`, `WagaGabarytowa`, `Analityka`) zwraca
samą treść (np. `Katalog.tsx:172`: `<div className="p-6 max-w-full">` bez `AppShell` ani
`Sidebar` w drzewie) — sprawdzone `grep`em, sidebar na tych siedmiu ekranach faktycznie się
nie renderuje.

**Poprawka 2026-09-04 (przy 8b): to JEST rozjazd z oryginałem, nie tylko porządek wewnętrzny.**
Sprawdzone w `deminified/frontend-index.js`: funkcja `mn()` (:16329) to dokładny odpowiednik
`AppShell` (sidebar + topbar mobilny) i **każdy** komponent widoku podpięty pod trasę w tabeli
routera (:28641-28680) owija nią swój zwracany JSX — potwierdzone po kolei dla `N2` (`/`),
`JP` (`/staging`), `AT` (`/katalog`), `VT` (`/narzuty`), `HT` (`/alerty`), `GT` (`/historia`),
`eM` (`/konfiguracja`), `nM` (`/waga-gabarytowa`), `iM` (`/atrybuty`), `lM` (`/moje-konto`) i
`zM` (`/analityka`) — bez wyjątku (12 wywołań `mn(` w bundlu). Tylko `/login` i nieznana trasa
(404) go nie mają. Wcześniejsza wersja tego wpisu twierdziła, że katalog/analityka w oryginale
też nie mają sidebara (stąd wniosek „to nie wierność, to architektura odbudowy") — **to było
błędne ustalenie, niepoparte pełnym odczytem funkcji** (sprawdzono tylko początek definicji,
nie faktyczny `return`). Poprawny wniosek: oryginał pokazuje sidebar na WSZYSTKICH ekranach
zalogowanego użytkownika — odbudowa na sześciu z jedenastu (po dołożeniu `MojeKonto.tsx` w 12b).

**Skąd wzięło się przy 10f.** Zastane, nie wprowadzone przez ten blok: `/` było placeholderem
(`WidokWPrzygotowaniu`, komponent który ramę renderował — usunięty w 12b, gdy zniknął ostatni
placeholder), więc problem był niewidoczny. 10f zdjęło placeholder i Pulpit musiał dołożyć
`AppShell` samodzielnie, żeby nie zgubić nawigacji — przy tej okazji rozjazd między widokami
stał się widoczny. 8b dołożyła kolejny widok (`Selly.tsx`) do tej samej, już istniejącej luki
— zastane, poza zakresem tego ticketa.

**Skutek.** Wizualna regresja wobec ZACHOWANIA ORYGINAŁU (sidebar znika) na ośmiu ekranach —
Ania na produkcji nigdy nie traci sidebara przechodząc między widokami, w odbudowie traci go
na większości.

**Do decyzji.** Czy ujednolicić przez wspólny layout w `App.tsx` (jedno miejsce), czy dołożyć
`AppShell` pojedynczo do ośmiu widoków.

---

### #37 · 2026-09-04 · [BACKEND] · odświeżanie słowników Selly nieatomowe — padnięcie sieci w połowie zostawia mieszany stan

> **Znalezione przy tickecie `28-FEATURE-selly-eksport-backend` (I8/8a). ODTWORZONE 1:1** —
> bo to zachowanie produkcji, a nie usterka naszego portu. **DO DECYZJI**, gdy kiedyś
> dotkniemy tego kodu.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (Selly, odświeżanie słowników) |
| **Pliki** | `mirror/backend/selly/routes.cjs:26-61` (`refreshDict`); port: `rebuild/backend/src/selly/slowniki.ts` |
| **Do nowej wersji?** | ✅ **port 1:1** (odtworzone zachowanie oryginału, świadomie) |
| **Status** | ✔ odtworzone w rebuild (I8/8a), luka nieusunięta |

**Co robi produkcja.** `refreshDict()` odświeża jeden słownik Selly (producenci, kategorie,
stawki VAT, magazyny): najpierw `DELETE` całej zawartości z `selly_dict` dla danego słownika,
potem wstawia wpisy po jednym wierszu na podstawie odpowiedzi z czterech osobnych wywołań HTTP
do zewnętrznego API Selly. Całość NIE jest owinięta w transakcję.

**Skutek.** Padnięcie sieci albo błąd Selly w połowie odświeżania zostawia część słowników
odświeżoną, a część skasowaną-i-niewstawioną-na-nowo (albo częściowo wstawioną) — panel może
przez jakiś czas widzieć niepełne mapowanie nazwa→id, dopóki kolejne odświeżenie się nie uda.

**Co zrobiliśmy w rebuild.** Port 1:1 — ten sam wzorzec DELETE-a-potem-INSERT przeplatany
z HTTP, bez transakcji (`src/selly/slowniki.ts`).

**Do decyzji.** Czy owinąć `refreshDict`/`ensureDict` w transakcję DB (co nie chroni przed
częściowo pobranymi danymi z Selly, tylko przed połówkowym zapisem lokalnym) — do rozważenia,
jeśli kiedyś ten kod będzie dotykany ponownie.

---

### #38 · 2026-09-04 · [BACKEND] · `selly_dict` — klucz po `toLowerCase()` w kluczu głównym gubi kategorie różniące się tylko wielkością liter

> **Znalezione przy tickecie `28-FEATURE-selly-eksport-backend` (I8/8a). ODTWORZONE 1:1** —
> zastane zachowanie produkcji, nieruszane. **DO DECYZJI.**

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (BAZA) · Selly, tabela `selly_dict` |
| **Pliki** | `rebuild/schema/001_schema.sql:257-311` / `src/db/schema.ts:331-403` (`PRIMARY KEY (slownik, klucz)`); zapis: `rebuild/backend/src/selly/slowniki.ts` |
| **Do nowej wersji?** | ✅ **port 1:1** (schemat już istniał, zachowanie odtworzone świadomie) |
| **Status** | ✔ odtworzone w rebuild (I8/8a), luka nieusunięta |

**Co robi produkcja.** `selly_dict` ma klucz główny złożony `(slownik, klucz)`, gdzie `klucz`
to nazwa kategorii/producenta z Selly po `toLowerCase()`. Dwie pozycje w Selly różniące się
wyłącznie wielkością liter (np. dwie kategorie o nazwach różniących się tylko capsem) zwijają
się w jeden wiersz — wygrywa ta, która przyszła później w odpowiedzi API.

**Skutek.** Mapowanie nazwa→id dla takiej pary jest niedeterministyczne (zależy od kolejności
w odpowiedzi Selly) i traci jedną z dwóch pozycji.

**Co zrobiliśmy w rebuild.** Zastany schemat i zachowanie, nieruszane — poza zakresem 8a.

**Do decyzji.** Czy to w ogóle występuje w realnych danych Selly (do zbadania, jeśli kiedyś
pojawi się kolizja) i czy warto zmieniać klucz na case-sensitive po stronie bazy.
### #39 · 2026-09-04 · [BACKEND][BEZPIECZEŃSTWO] · akcje kolejki pending nie zostawiają ŻADNEGO śladu w audycie

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (trasy kolejki atrybutów, audyt) |
| **Pliki** | `mirror/backend/pending_module.cjs:199` (`const { we } = ctx` — bez `be`), `:287-289` i `:331` (masowy `UPDATE products`); dla kontrastu `mirror/backend/atrybuty_module.cjs:142,161,177,208,226,243` (sześć zapisów `be(...)`); port: `rebuild/backend/src/routes/atrybuty.ts` (`audytuj()` wołane tylko przy CRUD słownika) |
| **Do nowej wersji?** | ⬜ **do decyzji Ani** — port 1:1 wykonany, naprawa czeka na rozstrzygnięcie |
| **Iteracja** | odtworzone 1:1 w **7a** (`docs/tickets/29-FEATURE-atrybuty-backend/`, decyzja D4) |
| **Status** | ✔ odtworzone w rebuild (7a) · w produkcji **nadal obecne** · skutek widoczny dla Ani opisany w `docs/instrukcja-testow-I7.md` §4 pkt 7 |

**Co robi produkcja.** `registerPending` (`:199`) destrukturyzuje z ctx wyłącznie `we`
(middleware auth) — funkcja audytu `be` **nie trafia do modułu w ogóle** (w całym
`pending_module.cjs` nie ma ani jednego wystąpienia `be`). Żadna z siedmiu tras kolejki
(`akceptuj`, `akceptuj-z-edycja`, `akceptuj-jako-alias`, `odrzuc`, `scan-pending`,
`DELETE /api/atrybuty/pending`, `GET /api/atrybuty/pending`) nie pisze do `audit_log`.
Bliźniaczy `atrybuty_module.cjs` audyt MA — sześć akcji CRUD słownika
(`atrybut_rodzaj_dodano|zmieniono|usunieto`, `atrybut_wartosc_dodano|zmieniono|usunieto`).

**Skutek.** Dwie z tych tras robią masowy `UPDATE products SET <kolumna>=? WHERE <kolumna>=?`
(`:287-289` akceptacja z edycją, `:331` akceptacja jako alias) — jedno kliknięcie przepisuje
markę albo bieżnik w CAŁYM katalogu. Po fakcie nie da się ustalić, kto to zrobił, kiedy ani
jaka była wartość poprzednia: dziennik `history` (zmiany pól produktu) też nie dostaje wpisu,
bo UPDATE idzie surowym SQL-em z pominięciem pisarza.

**Co zrobiła odbudowa.** Port 1:1 (D4): `routes/atrybuty.ts` woła `audytuj()` wyłącznie przy
sześciu trasach CRUD słownika, kolejka pending nie loguje nic. Luka opisana komentarzem w kodzie.

**Do decyzji.** Czy dołożyć audyt akcjom kolejki (osobne akcje `atrybut_pending_*`, z liczbą
przepisanych produktów w szczegółach). Naprawa jest tania i nie zmienia kształtu żadnej
odpowiedzi — koszt to rozjazd z produkcją w zawartości `audit_log`, widocznej przez
`GET /api/history/paged`.

**Uzupełnienie 7b.** Sesja frontendowa nie naprawiła luki (poza zakresem), ale UI ostrzega
przed masowym `UPDATE products`: dialogi „Akceptuj z edycją" i „jako alias" pokazują liczbę
produktów, których dotknie zmiana (`GET /api/atrybuty/uzycie` → `count`), a toast po sukcesie
podaje `produktow_zaktualizowano`. To nie zastępuje wpisu w dzienniku.

---

### #40 · 2026-09-04 · [BACKEND] · seed słownika `bieznik` bierze wartości z `products.model`, nie z `products.bieznik`

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (seed słownika atrybutów, uruchamiany przy każdym starcie procesu) |
| **Pliki** | `mirror/backend/atrybuty_module.cjs:79-83` (`SELECT DISTINCT model` → `insWartosc('bieznik', …)`), `:75-78` (analogiczny, poprawny seed marki), `:99` (`seed(db)` przy rejestracji modułu); `rebuild/schema/001_schema.sql:53` (`products.bieznik TEXT` istnieje); dowód skutku: `contract/fixtures/GET_atrybuty_pending.json`; port: `rebuild/backend/src/repos/atrybuty.ts:355` (`zasiejSlownikAtrybutow`) |
| **Do nowej wersji?** | ⬜ **do decyzji Ani** — port 1:1 wykonany, naprawa czeka na rozstrzygnięcie |
| **Iteracja** | odtworzone 1:1 w **7a** (`docs/tickets/29-FEATURE-atrybuty-backend/`, decyzja D1) |
| **Status** | ✔ odtworzone w rebuild (7a) · w produkcji **nadal obecne** · skutek widoczny dla Ani opisany w `docs/instrukcja-testow-I7.md` §4 pkt 1 |

**Co robi produkcja.** `seed()` zasila słownik `marka` z `SELECT DISTINCT marka FROM products`,
a zaraz potem słownik `bieznik` z `SELECT DISTINCT model FROM products` — **z kolumny `model`**,
mimo że `products`
ma własną kolumnę `bieznik`. Seed leci przy KAŻDYM starcie procesu (`registerAtrybuty:99`),
więc katalog wartości `bieznik` jest po każdym restarcie na nowo dosypywany nazwami modeli.

**Skutek — widoczny wprost w nagraniu produkcji.** Wszystkie 5 pozycji w
`GET_atrybuty_pending.json` to rodzaj `bieznik` i KAŻDA sugeruje SAMĄ SIEBIE z
`podobienstwo: 100` („AGRI STAR II", „HAKKAPELIITTA TRI", „TORQUEMAX", „FARMAX R85",
„AGRIFLEX 372 +"). Mechanizm: skan dopisał wartość do kolejki, gdy nie było jej jeszcze
w słowniku; kolejny start procesu wsypał ją do słownika z `products.model`; skan nie usuwa
z kolejki pozycji, które trafiły już do katalogu, więc wpis wisi dalej i jako „sugerowany alias"
dostaje swój własny odpowiednik. Ania widzi w kolejce propozycję „zamień X na X".

**Co zrobiła odbudowa.** Port 1:1 (D1), z komentarzem w `repos/atrybuty.ts` opisującym quirk
i jego ślad w fixture.

**Do decyzji.** Czy przestawić seed na `products.bieznik`. Ryzyko: zawartość słownika `bieznik`
rozjedzie się z produkcją (wypadną z niego nazwy modeli, dojdą realne bieżniki), a to zmienia
wyniki `scan-pending`, listę sugerowanych aliasów i zamrożony `GET_atrybuty_pending.json` —
czyli wymaga przenagrania fixture'a. Sprzątanie samego objawu (usuwanie z kolejki pozycji
obecnych już w słowniku) to osobna, mniejsza zmiana.

**Uzupełnienie 7b.** Skutek jest teraz widoczny NA EKRANIE, nie tylko w fixture: w kolejce
pending pozycja „AGRI STAR II" dostaje self-match z `podobienstwo: 100` (widać w
`contract/fixtures/GET_atrybuty_pending.json` i w widoku `/atrybuty` → panel „Do akceptacji"),
bo wartość zasiana z `model` trafia do słownika `bieznik`.

---

### #41 · 2026-09-04 · [BACKEND] · dwie rozjeżdżone mapy rodzaj→kolumna (15 vs 13) — pozycji pending rodzaju `model`/`zastosowanie` nie dałoby się zaakceptować

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (mapowanie atrybut → kolumna `products`) |
| **Pliki** | `mirror/backend/atrybuty_module.cjs:251-267` (`RODZAJ_KOLUMNA`, 15 pozycji — `liczniki` i `uzycie`), `mirror/backend/pending_module.cjs:22-36` (`RODZAJE_KOLUMNY`, 13 pozycji — skan i akceptacje), `:283-284` i `:326-327` (400 „Nieznany rodzaj"); port: `rebuild/backend/src/repos/atrybuty.ts:49` i `rebuild/backend/src/repos/atrybuty-pending.ts:25` |
| **Do nowej wersji?** | ⬜ **do decyzji Ani** — port 1:1 wykonany, naprawa czeka na rozstrzygnięcie |
| **Iteracja** | odtworzone 1:1 w **7a** (`docs/tickets/29-FEATURE-atrybuty-backend/`, decyzja D6) |
| **Status** | ✔ odtworzone w rebuild (7a) · **nieosiągalne dzisiejszą ścieżką UI** · skutek widoczny dla Ani opisany w `docs/instrukcja-testow-I7.md` §4 pkt 4 |

**Co robi produkcja.** Dwa moduły trzymają własne, niezależne mapy „rodzaj atrybutu → kolumna
`products`". `liczniki` i `uzycie` używają mapy 15-pozycyjnej; skan kolejki i obie akceptacje
przepisujące produkty — 13-pozycyjnej, która jest jej **podzbiorem** bez `model`
i `zastosowanie` (wbrew intuicji `wentyl` jest w OBU — te dwa rodzaje to jedyna różnica).

**Skutek.** Dla pozycji kolejki rodzaju `model` albo `zastosowanie` `akceptuj-z-edycja`
i `akceptuj-jako-alias` odbiłyby żądanie `400 {ok:false, error:"Nieznany rodzaj: model"}`
i wpisu nie dałoby się rozstrzygnąć inaczej niż odrzuceniem. Dziś nieosiągalne, bo skan
iteruje po tej samej 13-pozycyjnej mapie i takich pozycji nie tworzy — ale wystarczy dopisać
rodzaj do mapy skanu (albo wstawić wiersz do `atrybuty_wartosci_pending` ręcznie), żeby mina
odpaliła.

**Co zrobiła odbudowa.** Obie mapy odtworzone osobno (D6), każda przy swoim repozytorium,
z komentarzem opisującym rozjazd i jego konsekwencję.

**Do decyzji.** Czy zunifikować mapy. ⚠ Uwaga na kierunek: dołożenie `model` i `zastosowanie`
do mapy SKANU sprawi, że `scan-pending` zacznie zgłaszać nowe wartości także tych rodzajów
(dla `model` to praktycznie cały katalog — patrz **#40**) i zaleje kolejkę. Bezpieczniejszy
wariant to zostawić zakres skanu bez zmian, a pełną mapę dać tylko akceptacjom.

**Uzupełnienie 7b.** Konsekwencja widoczna teraz w UI: dla pozycji kolejki rodzaju
`model`/`zastosowanie` akcje „Akceptuj z edycją" i „jako alias" zwrócą 400 „Nieznany rodzaj",
a widok `/atrybuty` pokaże ten komunikat użytkowniczce (`komunikatBledu()` w
`rebuild/frontend/src/pages/atrybuty/api.ts`).

---

### #42 · 2026-09-04 · [BACKEND] · porównanie wartości bez normalizacji — „BKT" i „bkt" mają podobieństwo 0

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (algorytm sugerowania aliasów w kolejce atrybutów) |
| **Pliki** | `mirror/backend/pending_module.cjs:41-55` (`levenshtein`), `:57-62` (`similarity`), `:65-72` (`shouldSuggestAlias`); port: `rebuild/backend/src/repos/atrybuty-pending.ts:57,80,96`, testy `rebuild/backend/test/atrybuty.podobienstwo.test.ts` |
| **Do nowej wersji?** | ⬜ **do decyzji Ani** — port 1:1 wykonany, naprawa czeka na rozstrzygnięcie |
| **Iteracja** | odtworzone 1:1 w **7a** (`docs/tickets/29-FEATURE-atrybuty-backend/`) |
| **Status** | ✔ odtworzone w rebuild (7a) · w produkcji **nadal obecne** · skutek widoczny dla Ani opisany w `docs/instrukcja-testow-I7.md` §4 pkt 2 |

**Co robi produkcja.** `similarity` liczy odległość Levenshteina na SUROWYCH napisach — bez
`toLowerCase()`, bez `trim()`, bez zwijania wielokrotnych spacji. Jedyna normalizacja w całym
module to reguła „nie sugeruj, gdy różnica to wyłącznie `+`" (`:65-72`). Próg sugestii:
`sim ≥ 0.9`.

**Skutek.** „BKT" wobec „bkt" to dystans 3 na 3 znaki, czyli podobieństwo **0** — kolejka
nigdy nie zaproponuje aliasu dla wartości różniącej się tylko wielkością liter, choć dla
człowieka to ta sama marka. Im krótsza wartość, tym gorzej: różnica w jednej literze mieści
się w progu 0,9 dopiero od 10 znaków. To ten sam rodzaj rozjazdu, który w katalogu prostował
`kategoriafix` (**#2** — duplikaty różniące się wyłącznie wielkością liter).

**Co zrobiła odbudowa.** Port 1:1, jawnie odnotowany w `plan.md` („bez normalizacji wielkości
liter i spacji — oryginał jej nie ma"); testy jednostkowe zamrażają wyniki policzone ze wzoru
oryginału.

**Do decyzji.** Czy porównywać wartości po normalizacji (`trim().toLowerCase()`, zwinięte
spacje), zostawiając w słowniku i w `products` formę oryginalną. Ryzyko: sugestii będzie
WIĘCEJ i będą inne niż dziś, a przycisk „akceptuj jako alias" przepisuje produkty w całym
katalogu — rośnie więc koszt pomyłki (tym bardziej, że nie ma z tego audytu, **#39**). Zmiana
rozjeżdża pole `sugerowane_aliasy` z zamrożonym `GET_atrybuty_pending.json`.

**Uzupełnienie 7b.** Skutek widoczny w kolejce: „BKT" i „bkt" nie dostają sugestii aliasu,
kolumna „Sugerowane aliasy" w widoku `/atrybuty` pokazuje dla nich „brak podobnych".

---

### #43 · 2026-09-04 · [BACKEND][KONTRAKT] · `contract/openapi.yaml` nie zna kodów 403/404/409 — GATE nie może ich objąć

| Pole | Wartość |
|---|---|
| **Kategoria** | KONTRAKT (opis API, nie kod) — problem systemowy, ujawniony przy atrybutach |
| **Pliki** | `contract/openapi.yaml` — w CAŁYM pliku zero wystąpień `403:` / `404:` / `409:` (sprawdzone grepem); trasy, które te kody zwracają: `mirror/backend/atrybuty_module.cjs:174` (403), `:158,:173,:225,:241` i `mirror/backend/pending_module.cjs:257,281,318,349` (404), `atrybuty_module.cjs:146,:212,:230` (409); dowód po naszej stronie: `rebuild/backend/test/atrybuty.crud.test.ts` |
| **Do nowej wersji?** | ⬜ **do decyzji Ani** — kandydat do zakresu **I12** („Odświeżenie kontraktu + nagranie fixtures", `docs/rebuild-roadmap.md:296`) |
| **Iteracja** | ujawnione przy **7a** (`docs/tickets/29-FEATURE-atrybuty-backend/`) |
| **Status** | — nie zaczęte (luka po stronie kontraktu, kod jest zgodny z oryginałem) |

**Co znaleziono.** Zamrożony kontrakt deklaruje dla operacji wyłącznie 200/401/400. Moduł
atrybutów zwraca ponadto **403** (próba usunięcia wbudowanego rodzaju `core=1`), **404**
(„Nie znaleziono", „Pozycja pending nie istnieje") i **409** (duplikat rodzaju albo wartości)
— wszystkie w kształcie `{ok:false, error}`, odtworzone co do znaku.

**Skutek.** `sprawdzZgodnoscZKontraktem` nie może objąć tych odpowiedzi, więc GATE ich nie
pilnuje — dowodzą ich tylko testy integracyjne. Rozjazd kodu z kontraktem na tych trzech
kodach nie zapali się maszynowo, i to nie tylko przy atrybutach: brak dotyczy całego pliku.

**Do decyzji.** Dopisać 403/404/409 do `openapi.yaml` przy odświeżaniu kontraktu w I12, razem
z pozostałymi zaległościami kontraktowymi (**#4** — `GET /api/products/uwagi-cena` i
`/hold-reasons`; przenagranie fixtures po **#3**). Ryzyko dla runtime'u zerowe — to zmiana
opisu, nie zachowania; koszt to przegląd wszystkich tras, bo luka jest systemowa.

**Uzupełnienie 7b.** Sesja frontendowa `31-FEATURE-atrybuty-frontend` obsłużyła te kody po
stronie klienta mimo luki w kontrakcie: `komunikatBledu()` w
`rebuild/frontend/src/pages/atrybuty/api.ts` rozpakowuje `{ok:false,error}` i pokazuje
komunikat serwera, a `rebuild/frontend/test/integracja/atrybuty.integracja.test.ts` sprawdza
403 i 409 na żywym backendzie. Luka w `contract/openapi.yaml` **nadal istnieje** — GATE jej
nie pilnuje.

---

### #44 · 2026-09-04 · [FRONTEND] · przycisk „Nowy rodzaj" w produkcji NIE ZAPISUJE rodzaju

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (dialog „Nowy rodzaj atrybutu", widok `/atrybuty`) |
| **Pliki** | `deminified/frontend-index.js:27195-27277` (`sg()`, dialog), `:9965-9977` (`Lb()`); mostek wbudowany w bundle `:9960-10268` (patchuje `Hb`/`Qb`/`Gb` i definiuje `window.__atrybutyAddRodzaj`, ale `Lb` zostawia nietknięte — `grep "Lb *="` daje zero trafień); port: `rebuild/frontend/src/pages/atrybuty/api.ts` (`dodajRodzaj`), `rebuild/frontend/src/pages/atrybuty/DialogNowyRodzaj.tsx` |
| **Do nowej wersji?** | ✅ **TAK — już naprawione w odbudowie (7b)** |
| **Iteracja** | znalezione i naprawione w **7b** (`docs/tickets/31-FEATURE-atrybuty-frontend/`, decyzja D5) |
| **Status** | ✔ naprawione w rebuild · w produkcji **nadal obecne** |

**Co znaleziono.** Dialog „Nowy rodzaj atrybutu" (`sg()`) woła `Lb()`, które dopisuje rodzaj
WYŁĄCZNIE do lokalnej tablicy `dt` i cache'u Query (`setQueryData(["/api/attribute-kinds"], …)`)
— i nic więcej. Mostek wbudowany w bundle opatchował zapis WARTOŚCI (`Hb`/`Qb`/`Gb` →
POST/PUT/DELETE `/atrybuty/wartosci`) i wystawił `window.__atrybutyAddRodzaj`
(POST `/rodzaje`), ale `Lb` pominął.

**Skutek.** Rodzaj utworzony przyciskiem „Nowy rodzaj" **znika po odświeżeniu strony** (żyje
tylko w karcie przeglądarki), mimo że użytkowniczka dostaje toast „Rodzaj dodany". Ten SAM
rodzaj wpisany w polu „Rodzaj" dialogu „Dodaj wartość" (`rg()`, `:27006` →
`__atrybutyAddRodzaj`) zapisuje się normalnie — dwie ścieżki do tego samego celu zachowują się
różnie.

**Co zrobiła odbudowa.** **Nie odtworzyła cichej utraty danych.** `DialogNowyRodzaj.tsx` woła
`POST /api/atrybuty/rodzaje` (backend istnieje od 7a). Uzasadnienie: to skutek rozjazdu
bazowego bundla z mostkiem, a nie zachowanie produktu; decyzja D5 planu 7b („dodawanie rodzaju
TAK") tego wymagała.

**Do decyzji.** Brak — status końcowy, nie czeka na rozstrzygnięcie. Wpis dokumentuje
odstępstwo od parytetu 1:1 (odbudowa jest tu LEPSZA od produkcji świadomie).

---

### #45 · 2026-09-04 · [FRONTEND] · filtr „Źródło" w liście wartości atrybutów jest martwy

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (panel wartości, widok `/atrybuty`) |
| **Pliki** | `mirror/frontend/assets/pending-injection.js:741-744,766-772` (filtr i kolumna po `w.origin`, domyślka `'user'`); backend nie zwraca pola: `mirror/backend/atrybuty_module.cjs:185-196` (`GET /api/atrybuty/wartosci` → `{id,rodzaj,wartosc}`), potwierdzone w `contract/fixtures/GET_atrybuty_wartosci.json`; pominięte w porcie: `rebuild/frontend/src/pages/atrybuty/PanelWartosci.tsx` |
| **Do nowej wersji?** | ⬜ **do decyzji Ani** — czy `origin` ma być w ogóle wystawiane przez backend |
| **Iteracja** | ujawnione przy **7b** (`docs/tickets/31-FEATURE-atrybuty-frontend/`, decyzja D4) |
| **Status** | — nie zaczęte (zastane, ujawnione przy 7b) · skutek widoczny dla Ani opisany w `docs/instrukcja-testow-I7.md` §5 |

**Co znaleziono.** `pending-injection.js` filtruje i pokazuje kolumnę „Źródło" po polu
`w.origin` (`catalog`/`user`/`preset`, z domyślką `'user'`, gdy pole brakuje), ale ŻADNA trasa
backendu tego pola nie zwraca — `GET /api/atrybuty` i `GET /api/atrybuty/wartosci` oddają
`{id, rodzaj, wartosc}`. Kolumna `origin` istnieje w schemacie bazy, ale nie w odpowiedzi API.

**Skutek.** W produkcji filtr zawsze pokazuje „user" dla wszystkich wartości i nie zawęża
niczego; liczniki przy pozostałych źródłach są zerowe — element UI, który nic nie robi.

**Co zrobiła odbudowa.** **Pominęła filtr i kolumnę** (decyzja D4 planu 7b, zatwierdzona przez
użytkownika) — odtwarzanie martwego elementu UI byłoby parytetem usterki, nie zachowania.
Backend 7a też `origin` nie eksponuje (zgodnie z fixture).

**Do decyzji.** Czy `origin` ma w ogóle trafiać do odpowiedzi API (wtedy filtr miałby sens do
odtworzenia), czy pole zostaje wyłącznie wewnętrzne (baza), a filtr w produkcji zostaje
uznany za martwy kod, którego nie warto portować.

---

### #46 · 2026-09-05 · [BACKEND][BEZPIECZEŃSTWO] · tabela `users` nie ma kolumny roli — „admin" nie jest technicznie odróżnialny

> **Znalezione przy tickecie `36-FEATURE-konto-admin-maintenance` (I12/12b). Zastane** — stan
> zgodny z produkcją, nie regresja odbudowy.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (schemat, autoryzacja) |
| **Pliki** | `rebuild/schema/001_schema.sql` (`users`: `id, email, haslo_hash, imie_nazwisko, utworzono, ostatnie_logowanie` — bez roli); oryginał: strony `/admin/*` chronione samym `requireAuth`, `mirror/backend/extensions.cjs:296+` |
| **Do nowej wersji?** | ⬜ **do decyzji** |
| **Status** | — nie zaczęte (zastane, ujawnione przy 12b) |

**Co znaleziono.** Tabela `users` nie ma kolumny roli/uprawnień — każdy zalogowany użytkownik
jest technicznie równy każdemu innemu. 12b dołożyła zakładki „Admin" i „Dziennik" w
`/konfiguracja` (dostawcy, użytkownicy, utrzymanie, surowy audyt) chronione wyłącznie
`requireAuth`, tak jak w oryginale chronione są serwerowe strony `/admin/*`.

**Skutek.** Każdy zalogowany użytkownik widzi i może użyć zakładek admina (edycja
konfiguracji dostawców, usuwanie nie-opon, czyszczenie całego katalogu, podgląd dziennika
audytu z e-mailami i URL-ami dostawców) — nie tylko faktyczny administrator.

**Dlaczego to jest jak w produkcji, a nie usterka.** Oryginał ma ten sam brak rozróżnienia —
strony admina chroni tam sam middleware autoryzacji, bez sprawdzania roli. 12b odtworzyła to
1:1, świadomie (patrz `docs/tickets/36-FEATURE-konto-admin-maintenance/plan.md`, Kontekst).

**Do decyzji.** Czy wprowadzić kolumnę roli w `users` (zmiana schematu) i realną autoryzację
dla zakładek admina — decyzja Ani, kandydat do rozstrzygnięcia przy 12e (finalny przegląd
bezpieczeństwa).

---

### #47 · 2026-09-05 · [BACKEND] · kopie bazy po `POST /api/products/clear` nigdy nie są sprzątane

> **Znalezione przy tickecie `36-FEATURE-konto-admin-maintenance` (I12/12b). Zastane** — stan
> zgodny z produkcją, port 1:1.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (utrzymanie, miejsce na dysku) |
| **Pliki** | `deminified/backend-index.cjs:48319-48331` (`copyFileSync` best-effort przed czyszczeniem); port: `rebuild/backend/src/routes/maintenance.ts` (`POST /api/products/clear`, D5 ticketa 36) |
| **Do nowej wersji?** | ⬜ **do decyzji** |
| **Status** | — nie zaczęte (zastane, ujawnione przy 12b) |

**Co znaleziono.** Przed czyszczeniem katalogu trasa robi best-effort kopię
`<baza>.bak_before_clear_<ISO>` (w odbudowie z checkpointem WAL, D5) — i nic nigdy tych
plików nie usuwa, ani w oryginale, ani w porcie.

**Skutek.** Każde użycie przycisku „Usuń wszystko z katalogu" (`/konfiguracja` → „Katalog")
zostawia nowy plik kopii; przy częstym użyciu (np. testowanie parsera) katalog danych rośnie
bez ograniczeń.

**Dlaczego to jest jak w produkcji, a nie usterka.** Zachowanie odtworzone 1:1 — oryginał ma
ten sam brak retencji.

**Do decyzji.** Czy wprowadzić rotację/retencję kopii (np. limit liczby plików albo TTL) —
decyzja Ani, nie blokuje 12b.

---

### #48 · 2026-09-05 · [BACKEND][FRONTEND] · `parsujSzczegoly` istnieje w repo w dwóch kopiach (backend i frontend)

> **Znalezione przy tickecie `36-FEATURE-konto-admin-maintenance` (I12/12b). Świadoma decyzja
> użytkownika D4 tego ticketa** — nie jest to błąd do naprawienia.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND + FRONTEND (architektura odbudowy — brak wspólnego pakietu) |
| **Pliki** | `rebuild/backend/src/historia/mapowanie.ts:87` i `rebuild/frontend/src/pages/konfiguracja/dziennik.ts` (kotwice do siebie, testy na te same trzy wejścia: NULL, zepsuty JSON, wartość nie-obiektowa) |
| **Do nowej wersji?** | ⬜ **do decyzji** |
| **Status** | ✔ obie kopie zrobione w rebuild (12b), zamierzony duplikat |

**Co znaleziono.** `rebuild/backend` i `rebuild/frontend` to dwa rozłączne projekty bez
wspólnego pakietu (w całym froncie nie ma ani jednego importu kodu z backendu). `GET
/api/audit-log` oddaje surowy `szczegoly_json` (string) — parsowanie robi wyłącznie front,
przy renderowaniu kolumny „Szczegóły" w zakładce „Dziennik". Wzorzec ma precedens
(`waga-gabarytowa/obliczenia.ts` obok `backend/waga-gabarytowa/formula.ts`).

**Dlaczego to nie jest usterka.** Decyzja D4 planu 36-FEATURE: wspólny pakiet (`rebuild/shared/`)
zmieniałby strukturę całej odbudowy (buildy, tsconfigi, lint, deploy obu stron) za 12 linii
kodu; alias Vite/tsconfig do pliku backendu wciągałby `drizzle-orm` i schemat bazy do grafu
typów frontu. Obie kopie mają komentarz-kotwicę wskazujący na drugą.

**Do decyzji.** Czy `rebuild/` powinien kiedyś dostać wspólny pakiet dla logiki
współdzielonej BE/FE — nie blokuje 12b, kandydat do rozważenia przy większej liczbie takich
duplikatów.
