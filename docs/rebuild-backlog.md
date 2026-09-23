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

> **Od ticketu 128 (2026-09-23) ten plik NIE ROŚNIE.** Nowe wpisy backlogu, listy „Pominięte”
> i podsumowania partii trafiają do `docs/rebuild-backlog/wpis-<numer ticketu>.md`, a identyfikator
> wpisu ma postać `#<ticket>.<kolejny>` (np. `#131.1`). Powód: koniec listy, bloki „Pominięte”
> i akapity podsumowań były trzema punktami, w które dopisywały wszystkie karty naraz — ten sam
> wzorzec konfliktów, co kiedyś w roadmapie i w `spec-backend.md`. Reguła i szablon:
> `docs/rebuild-backlog/README.md`. Przegląd całości: `tools/stan-backlogu.sh`.
> Wpisy `#1`–`#108` zostają tutaj jako historia — odnośniki do nich są nadal ważne.

**Partia #72–#83 (triaż 2026-09-18) — ROZSTRZYGNIĘTA przez użytkownika tego samego dnia.**
Dziesięć wpisów ✅ TAK, jeden ❌ NIE (#72 — odbudowa ma lepsze rozwiązanie, zostawiamy nasze),
jeden 🕒 PÓŹNIEJ (#81 → odłożony do **13d**, zapisany w roadmapie w bloku 13d).
✅ **Blokada #82/#83 ZDJĘTA 2026-09-18** (`57-CHORE-triaz-uzasadnienia-ani`). Oba wpisy szły przez
dobę bez uzasadnienia biznesowego; Ania dopisała brakujący wpis CHANGELOG o 15:39 i przyszedł on
commitem `86d9090`. Powód w obu przypadkach okazał się ten sam i jest **produktowy, nie techniczny:
porządki w wartościach filtrów katalogu** — „Ładowarka" miała zniknąć z filtra Rolniczych (#82),
a `5`/`5.0`/`5.00` przestać rozbijać filtr „Szerokość opony" (#83). To ta sama motywacja co #79
(zdublowane kategorie). **Cała partia #72–#83 jest teraz gotowa do implementacji.**
Sugerowane sklejenie w tickety: **CSV** = #73 + #76 + #77(część) · **application_rules** = #75 + #79
+ #80 + #82 · **MO9** = #78 + #79(drugi hunk) · **szerokość** = #83 · **13d** = #74 + #77(delta) + #81.

**Backlog rozliczony w sesji 12e (2026-09-08).** Wszystkie wpisy ✅ zostały naniesione,
❌ świadomie pominięte. Pozostałe ⬜ (#11, #12, #19, #21, #25, #31–#35, #43) to
**defekty PRODUKCJI odtworzone świadomie 1:1**, czekające na decyzję produktową Ani — żaden nie
jest regresją odbudowy i żaden nie blokuje cutoveru. (#26 ✅ zrobione 2026-09-21, ticket
`77-FEATURE-pseudo-alerty-katalogowe` — patrz wpis #26.) Szczegóły rozliczenia:
`docs/tickets/39-CHORE-audyt-bezpieczenstwa-domkniecie/raport.md` (sekcja „Rozliczenie
backlogu"). **#39 i #41 rozstrzygnięte przez Anię i wdrożone 2026-09-21**
(`docs/tickets/74-FEATURE-slad-kolejki-atrybutow/`). **#40 i #42 rozstrzygnięte przez Anię
i wdrożone 2026-09-21** (`docs/tickets/78-FEATURE-seed-bieznikow-podobienstwo/`). **#31–#35 rozstrzygnięte 2026-09-21** —
#32 i #34 przez Anię (naprawa), #31, #33, #35 i wariant #32 przez użytkownika (naprawa, karta P10.1 —
wdrożenie #34 w P10.2). **#31, #32, #33, #35 WDROŻONE 2026-09-22**, ticket
`90-FEATURE-ozywienie-kart-dostepnosci` (karta P10.1) — w produkcji te cztery usterki nadal obecne.

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

⚠ Port naprawiał U ŹRÓDŁA (nowe importy) — rekordów już siedzących w bazie nie dotykał.
Produkcja domknęła to osobnym skryptem `mirror/backend/apply_kategoria.cjs` (537 rek.),
którego stronę DANYCH odbudowa domknęła dopiero migracją
`rebuild/schema/004_kategoria_wielka_litera.sql` w **13c**
(`44-CHORE-i13c-migracje-konwencji`, 2026-09-09) — patrz #57.

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
| **Status** | ✅ **ZAMKNIĘTE 2026-09-08 (sesja 12d, ticket `38-CHORE-kontrakt-fixtures-odswiezenie`)** — migracja `rebuild/schema/003_szerokosc_text.sql` + `src/db/schema.ts` (`text()`) od 3d-1 (2026-08-27); potwierdzone w I12a (2026-09-05), że kanon nie ożywił starego wyjątku; 12c (2026-09-05) doniosła wadę ręcznej edycji do frontu (D3, 1:1); 12d przenagrał `GET_products.json` z ORYGINAŁU (`szerokosc` jako TEXT z zerami końcowymi) i usunął wyjątek `WYJATKI_SZEROKOSC` — GATE katalogu zielony bez ani jednego zadeklarowanego wyjątku. Nic nie zostaje otwarte. |

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

**⚠ Rozjazdy — domknięte w sesji 12d (2026-09-08):**
- ✅ **Schemat ZROBIONY.** `001_schema.sql` zostaje NIETKNIĘTY (jest datowanym punktem zerowym =
  stan produkcji 2026-08-17, `rebuild/schema/README.md`); zmianę wnosi migracja przyrostowa
  `003_szerokosc_text.sql`, która przebudowuje tabelę (SQLite nie ma `ALTER COLUMN`). Strażnik
  przed dryfem duplikatu DDL: `test/db.migracje.test.ts` porównuje kolumny żywej tabeli z kanonem.
- ✅ **Fixture PRZENAGRANY (sesja 12d).** `GET_products.json` ma teraz `szerokosc` jako TEXT
  z zerami końcowymi (potwierdzone wartości: `"620"`, `"240"`, `"8.00"`, `"540"`, `"600"`),
  nagrany z ORYGINAŁU (`mirror/backend/index.cjs`) na kopii bazy. Wyjątek `WYJATKI_SZEROKOSC`
  (`test/katalog.gate.test.ts`) zapalił się sam po przenagraniu — dokładnie jak zaprojektowała
  to sesja 3d-1 — i został usunięty razem z test-strażnikiem swojej jednoelementowości. GATE
  katalogu jest zielony bez ani jednego zadeklarowanego wyjątku.
- 🔎 **Skąd wzięły się wartości „z zerami końcowymi" mimo starego snapshotu.** `db/snapshot.db`
  (2026-08-13) faktycznie jest STARSZY niż migracja `szertxt` (2026-08-19/20) i ma `szerokosc
  REAL` — ale **nadaje się** jako źródło, bo produkcja ma własny skrypt migracyjny
  `mirror/backend/migrate_szer_to_text.cjs`, który backfilluje `szerokosc` z kolumny `rozmiar`
  (pierwsza liczba jako string 1:1, z zerami). Nagrywarka 12d (`tools/record-write-fixtures.cjs`)
  uruchamia ten skrypt na KOPII bazy (podmieniona wyłącznie jedna linia z zahardkodowaną ścieżką
  produkcyjną) i dostaje dokładnie te napisy z zerami — kod produkcji domyka wiek snapshotu sam.
- ⚠ **Znalezione w I12a (2026-09-05), potwierdzone i ZANIESIONE w sesji 12c (2026-09-05,
  decyzja D3, `docs/tickets/37-FEATURE-katalog-edycja-produktu/plan.md`).** Produkcyjny dialog
  edycji `LT()` renderuje `szerokosc` jako `type="number"` z `parseFloat`
  (`deminified/frontend-index.js:24076-24079`), więc RĘCZNA edycja wysyła LICZBĘ do kolumny TEXT
  i gubi zera końcowe („10.00" → „10") — dokładnie to, czego broniła cała saga `szertxt`. Import
  ich nie gubi (parser pisze napis, kolumna jest TEXT); traci je tylko ścieżka ręcznej edycji.
  To zastane zachowanie produkcji, nie regres odbudowy — 12c odtworzyła je 1:1 świadomie
  (`rebuild/frontend/src/pages/katalog/poleEdycji.ts`), pole jest mimo to na liście pól
  edytowalnych produktu (`POLA_EDYTOWALNE_PRODUKTU`, backlog #14), bo produkcja to pole
  realnie edytuje.

**Warstwa parsera — zrobiona (2026-08-26, I3/3a), decyzja o schemacie nadal otwarta.**
Port verbatim `tyre_params.cjs` wniósł stan końcowy `szertxt` do `rebuild/backend`: `parseSize()`
zwraca `szerokosc` jako **string** z zerami końcowymi (`"10.00"`, `"400"`), a `widthCm` dalej liczy
`wysokoscBokuCm`/`wysokoscRzeczywistaCm` z floata. W 3a nie ma bazy, więc dotyczy to wyłącznie
kształtu rekordu w pamięci. **Zmiana `products.szerokosc` REAL→TEXT została naniesiona
w 3d-1 (2026-08-27); `GET_products.json` przenagrany w sesji 12d (2026-09-08) — saga zamknięta.**

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
| **Do nowej wersji?** | ✅ **TAK — DOMKNIĘTE** (parser i kolumna I3/3a-3b; propagacja `acceptStaging` 3d-2; oba endpointy + propagacja bulku I12a, 2026-09-05) |
| **Iteracja** | **→ I3** (schemat: 3b ✔; propagacja importu: 3d-2 ✔) **→ I12a** (endpointy + propagacja bulku ✔) **+ injection-tooltip** (późniejsza iteracja; wzorzec jak pending/selly/freq-injection) |
| **Status** | ✅ **ZAMKNIĘTE (I12a, 2026-09-05; potwierdzone dowodem z oryginału w sesji 12d, 2026-09-08)** — kolumna, obaj pisarze (`acceptStaging`, `addProductsBulk`) i oba czytelniki (`uwagi-cena`, `hold-reasons`) gotowe. `uwagaCena` **celowo zostaje ukryta** w `GET /api/products` — 12d ustaliła, że produkcja też jej tam nie oddaje (patrz niżej), więc ukrycie jest wiernym odtworzeniem, nie długiem. |

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
(`rebuild/backend/src/repos/kolumny.ts`). **Trwałe, nie przejściowe** — 12d (2026-09-08)
potwierdziła dowodem z oryginału, że produkcja też tej kolumny tam nie oddaje (patrz niżej, D1).

**Podział doprecyzowany 2026-08-27 (I3/3d-1, decyzja użytkownika — plan.md D4):**
- **propagacja** w `acceptStaging` (odczyt `uwagaCena` ze `snapshotJson` → `products.uwaga_cena`)
  → **3d-2 ✔**, u swojego pisarza;
- **endpointy** → **I12 ✔ (sesja 12a, 2026-09-05)**, razem z dopisaniem do `openapi.yaml`.
  ⚠ **Endpointy są DWA, nie jeden** — produkcja realizuje to monkey-patchem
  `mirror/backend/uwaga_cena_patch.cjs`, który dokłada `GET /api/products/uwagi-cena` ORAZ
  `GET /api/products/hold-reasons` (powód wstrzymania liczony w locie: `uwaga_cena` dosłownie /
  brak ceny i stanu / brak ceny / brak stanu / „sprawdź ręcznie"). Ten sam patch monkey-patchuje
  też `addProductsBulk` — trzeci pisarz, **domknięty natywnie w tej samej sesji** (`src/import/bulk.ts`,
  pętla po całej partii PO transakcji, 1:1 z `uwaga_cena_patch.cjs:72-93`: brak klucza w pozycji
  CZYŚCI kolumnę, kolejność `it.uwagaCena !== undefined ? it.uwagaCena : (it.uwaga_cena || null)`).

**Domknięcie w I12a (2026-09-05).** Oba czytelniki dowiezione: `GET /api/products/uwagi-cena`
(`{ok, items:[{id, kod, ean, uwaga_cena}]}` — klucz w **snake_case**, bo produkcja czyta te
wiersze surowym `better-sqlite3`; projekcja w odbudowie wypisana jawnie z aliasem) i
`GET /api/products/hold-reasons` (`{ok, items:[{id, kod, ean, reason}]}`, powód liczony w locie,
pięć przypadków, `uwaga_cena` bije wszystkie pozostałe warunki). Obie ścieżki dopisane do
`contract/openapi.yaml`; schematy ciał (w tym `uwaga_cena` w snake_case) dopisane w 12d
z nagrań `GET_products_uwagi-cena.json` / `GET_products_hold-reasons.json`.

**⭐ Rozstrzygnięte w sesji 12d (2026-09-08), obala wcześniejsze założenie — patrz D1
`docs/tickets/38-CHORE-kontrakt-fixtures-odswiezenie/plan.md`.** Roadmapa i ten wpis zakładały,
że kolumna `uwagaCena` jest ukryta przed `GET /api/products` **tymczasowo**, do przenagrania
fixtures w 12d. **To założenie było błędne.** Sesja 12d zmierzyła na uruchomionym oryginale
(`mirror/backend/index.cjs` na kopii bazy): `U.listProducts()` to `X.select().from(he).all()`
(`deminified/backend-index.cjs:44699-44701`) — Drizzle bez jawnej listy kolumn, więc oddaje
pola MODELU, nie kolumny tabeli; model `he` nie deklaruje `uwagaCena`
(`grep -c "uwagaCena" mirror/backend/index.cjs` = 0); `uwaga_cena_patch.cjs` monkey-patchuje
`U.acceptStaging` i `U.addProductsBulk`, ale **nie** `listProducts`. Kolumna dodana runtime'owym
`ALTER TABLE` jest dla Drizzle niewidoczna. **Zmierzone empirycznie:** `GET /api/products`
z żywego oryginału oddaje **72 klucze bez `uwagaCena`**, tak samo `PUT`/`PATCH
/api/products/{id}`. Produkcja więc tej kolumny NIE ujawnia — ukrycie w
`KOLUMNY_POZA_KONTRAKTEM` (`repos/kolumny.ts`) jest **odtworzeniem produkcji 1:1**, nie długiem
do spłacenia; „ujawnienie" byłoby odstępstwem. Kolumnę czytają wyłącznie dwie trasy surowym
SQL-em (`GET /api/products/uwagi-cena`, `/hold-reasons`, klucz `uwaga_cena` w **snake_case**) —
obie mają teraz nagrania, i pilnuje tego strażnik w `test/katalog.gate.test.ts` („`GET
/api/products` ma dokładnie 72 klucze i nie zawiera `uwagaCena`"). `kolumny.ts` dostał
zaktualizowany komentarz oparty na tym dowodzie; zero zmian logiki.

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
| **Status** | 🔨 częściowo zrobione (bezpiecznik `PustyImportBlad` w `tk()`, I3/3c, 2026-08-26 — zakrywa wszystkie trasy silnika) — poprawka parsera MO8 nadal do portu (#6, Wariant A). **2026-09-01: Ania wdrożyła fix produkcyjny (Bug#4 — detekcja CSV vs XLSX przez `isZipBuffer` w `mo8_trelleborg.cjs`, dedykowany parser CSV; 704 rek. z 704 wierszy). ✅ sportowane w `42-CHORE-i13a-resync-parserow` (2026-09-08) — kod wszedł kopią bajtową, ale NIEPOTWIERDZONY pomiarem: próbka MO8 to stały plik `MO8.xlsx`, gałąź CSV (`isZipBuffer`) nieuruchomiona.** |

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
| **Status** | **2026-09-01: Ania wdrożyła fix produkcyjny (Bug#2 — NRO/CHO → `'Tak'`/null; `tyre_params.cjs:423-424` + `adapter.cjs:596-597` `normalizeLabelFlag`; UPDATE bazy: 16×`Tak` NRO, 13×`Tak` CHO, reszta NULL). ✅ sportowane i POTWIERDZONE pomiarem w `42-CHORE-i13a-resync-parserow` (2026-09-08): `nro` `1`→`'Tak'`, `nro`/`cho` `0`→`null`; MO1 199, MO3 44, MO9 12 rek.** |

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
| **Status** | **2026-09-01: Ania wdrożyła fix produkcyjny (Bug#1 — filtr dętki/akcesoria case-insensitive w `mo1_bohnenkamp.cjs` i `mo9_agrorami_api.cjs` + usunięcie 16 rek. WULSTBAND ze `staging_items`). ⚠ To była REGRESJA po katunify (#57): filtr porównywał małą literą z Wielką od 18.08. ✅ sportowane i POTWIERDZONE pomiarem w `42-CHORE-i13a-resync-parserow` (2026-09-08): MO1 `odrzuconePrzezAdapter` 1→0 przy tych samych 199 kodach (bug1) — rekord odrzucany już w parserze, nie dopiero w adapterze. Uwaga: katunify (#57), choć sportowane w tym samym syncu, NIE jest potwierdzone pomiarem — patrz #57.** |

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
| **Do nowej wersji?** | ⚠️ **ZASTĄPIONE przez #99/D4 (decyzja użytkownika 2026-09-22).** Puste pole w katalogu (58/14i) przestało być docelowym zachowaniem — Ania zdecydowała, że błędny EAN (w tym notacja naukowa) ma BLOKOWAĆ akceptację, nie wchodzić po cichu jako puste pole. |
| **Iteracja** | odtworzone 1:1 w **3c**; puste pole w katalogu → **I14, karta 14i** (`58-FEATURE-i14i-ean-naukowy-pusty`, 2026-09-18) → **ZASTĄPIONE decyzją D4/#99**: `eanRaw`/`_eanLossy` w parserach — **I15.2** (ticket 120, ✅ dowiezione); blokada akceptacji — **I15.4** (otwarte) |
| **Status** | ⚠️ **ZASTĄPIONE przez #99/D4 — obie części tego wpisu są dziś historią decyzji, nie stanem docelowym.** (a) puste pole w katalogu (58, 2026-09-18): nieaktualne, produkcja od 22.09 traktuje taki EAN jako błąd. (b) cieniowanie `Lq()` / komunikat „null cyfr znaczących": nieaktualne z tego samego powodu — ścieżka, którą ten komunikat opisywał (cichy fallback na puste pole), nie jest już docelowym zachowaniem do naprawienia, tylko zastąpiona blokadą akceptacji. Część parserowa D4 dowieziona w **I15.2** (ticket 120, 2026-09-23): stan przejściowy zmierzony na pełnych cennikach — **+6 rekordów z 4 843 (0,12 %)**, wyłącznie MO5, import się nie psuje. |

**Ten wpis miesza dwie osobne rzeczy — rozdzielone tu, żeby nie sprawiały wrażenia jednego
zagadnienia:**

**(a) Puste pole w katalogu — ZREALIZOWANE.** DECYZJA ANI (2026-09-18), pytanie 8: „EAN który
jest zepsuty notacją naukową ma być importowany jako **puste pole w katalogu**". Wdrożone kartą
`58-FEATURE-i14i-ean-naukowy-pusty`: `products.ean` jest `NULL` dla pozycji ze statusem
`scientific_notation_uncertain`, cięcie stoi w `src/import/akceptacja.ts` (na `doZapisu`, tuż
przed zapisem), **nie** w silniku. Szczegóły: `docs/tickets/58-FEATURE-i14i-ean-naukowy-pusty/plan.md`,
`raport.md`.

⚠ **Wpis pierwotnie zakładał** „Rusza silnik importu, więc wzorce charakteryzacji trzeba
PRZENAGRAĆ, nie poprawiać ręcznie" — **to okazało się błędne i niewykonalne**, ustalone przy
wdrożeniu 58:
- Cięcie **nie jest** w silniku (`silnik/ean.ts`) ani w `tk.ts` — oba nietknięte (0 scenariuszy
  charakteryzacji, 0 testów, 0 fixtures ruszonych). Cięcie jest wyłącznie w `akceptacja.ts`,
  na obiekcie do zapisu, po tym jak silnik i staging już zrobiły swoje.
- Przenagranie by i tak nie zadziałało: `scripts/charakteryzacja-silnik-nagraj.mjs` uruchamia
  **ŻYWY oryginał** z `mirror/backend/index.cjs`, który nie zna decyzji Ani i odtworzyłby STARĄ
  wartość (`"ean":"6419440000000"`).
- Powód, dla którego cięcie NIE mogło być w `ean.ts`: `tk.ts:302-305` dopasowuje pozycję do
  produktu w katalogu po `znormalizowana.ean` — wyzerowanie EAN-u przy normalizacji zrywa to
  dopasowanie (klasyfikacja „nowa" zamiast „zmiana_kluczowa", ryzyko duplikatu w katalogu).
  Dowód: `test/silnik.gate.test.ts` — „dopasowanie po EAN ZNORMALIZOWANYM — surowy EAN nie
  trafia, rozwinięty już tak".
- Pułapka wykryta dopiero w code review 58 (BLOCKER rundy 1): `assignKodImportu()`
  (`src/import/legacy/bridge_ext.cjs:164-167`) grupuje produkty tego samego towaru w różnych
  magazynach po kluczu `EAN:<ean>`, ale **tylko gdy `ean` niepusty ORAZ `eanIsValid === 1`**.
  Zapis naukowy z poprawną sumą kontrolną spełnia oba warunki (`8,05997E+12` →
  `8059970000000`, suma kontrolna poprawna). Zerowanie EAN-u **za wcześnie** (na `rekord`,
  przed `assignKodImportu`) zrywało dziedziczenie numeru grupy między magazynami — dlatego
  finalne cięcie stoi na `doZapisu`, tuż przed `INSERT`/`UPDATE`, żeby `assignKodImportu()`
  widziała prawdziwy EAN. Realna pułapka dla każdej przyszłej zmiany dotykającej `products.ean`.

„Otwarte przy wdrożeniu — czy ostrzeżenie w stagingu ma zostać" — **rozstrzygnięte: ZOSTAJE**.
`staging_items.ostrzezenie`/`powod`, `eanRaw`/`eanIsValid`/`eanSourceStatus`/`eanCandidates`
i `snapshotJson.ean` są nietknięte — pominięty EAN nie jest niewidzialny.

Zmierzone na `db/snapshot.db` przy wdrożeniu: **0 z 7405** produkcyjnych produktów ma dziś
status `scientific_notation_uncertain` (rozkład `ean_source_status`: `ok` 7246, `NULL` 157,
`no_valid_candidate` 1, `memory` 1) — realny zasięg zmiany jest dziś zerowy, staje się
niezerowy w warunkach z sekcji „Jak duży to problem" niżej (MO8 jako CSV, albo
`POST /api/staging/import` z pominięciem parserów).

**(b) Komunikat „null cyfr znaczących" (cieniowanie `Lq()`) — NADAL OTWARTE.** Karta 58 wprost
zabraniała naprawy przy okazji, żeby nie mieszać dwóch zmian naraz. Opis defektu i propozycja
naprawy — niżej, bez zmian.

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

> **Nowe listy „Pominięte” dopisuje się we własnym pliku ticketu**
> (`docs/rebuild-backlog/wpis-<N>.md`), nie tutaj — poniższe bloki to historia sprzed ticketu 128.
> Widać po ich kolejności, jak je poskładał git: blok ticketu 104 stoi przed blokiem ticketu 94.

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
  **Zrealizowane w tickecie 91 (karta PR.1, 2026-09-22):** zapis od 3b (`import/archiwum.ts`),
  odczyt (3 trasy `GET /api/import-archive*`) i widok `/archiwum` odtworzone 1:1 —
  `docs/tickets/91-FEATURE-archiwum-importow/`.

*Pominięte — triaż 2026-09-18 (zakres `94bdf11..9d1b09f`):*
- **Dziewięć commitów `[FRONTEND]` z codziennego cyklu 06:00** — wyłącznie regeneracja pliku
  eksportu `sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv` (dane, zero zmian UI/kodu):
  `a65057a` (10.09), `43965ce` (11.09), `543a205` (12.09), `71e5b6e` (13.09), `7acfa4f` (14.09),
  `a147c3c` (15.09), `8b46ddb` (16.09), `700ae74` (17.09), `8ad81eb` (18.09).
  ⚠ Tag `[FRONTEND]` w mailu producenta **nie znaczy zmiany frontendu** — plik CSV leży pod
  `mirror/frontend/ex-port-files/`. Ta sama pomyłka groziła przy triażu 09.09.
- `9755e5f` (11.09 14:00, `category_test`) — kontrolowany test mapowania kategorii Selly na czterech
  produktach (528, 3430, 961, 1577; PUT + weryfikacja przez API) i aktualizacja lokalnego cache
  `selly_products`. Operacja na danych, zero kodu; dowód działania mapowania z **#74**.
- `5cfb7ab` (17.09 19:00, `selly_search`) — usunięcie jednego martwego mapowania `selly_products`
  (produkt Selly 639, `kod_importu` 668772, MO9_23814) bez rekordu źródłowego w `products`;
  osierocony produkt trzymał w wyszukiwarce Selly stare zastosowanie „harwester" w kategorii
  rolniczej. Operacja na danych. **Sygnał, nie zmiana:** brak sprzątania mapowań po usunięciu
  produktu to kandydat na defekt do opisania przy przepisywaniu 13d.
- Zrzuty `selly_backups/*.json` z `5dedefb`/`65dcbd0`/`5cfb7ab` (`categories_filters_*`,
  `product_3430_pre_featurefix`, `product_639_*`) — kopie bezpieczeństwa sprzed operacji, nie kod.
- `cleanup_selly_filters_20260917.cjs` — skrypt jednorazowy, dodany w `5dedefb` i **usunięty przez
  Anię w `65dcbd0`** po wykonaniu. Nie portujemy; kontekst w **#81**.

*Pominięte — triaż 2026-09-18 (zakres `9d1b09f..86d9090`):*
- `86d9090` (18.09 16:00, `20260918_entry_1539`) — **commit zmienia WYŁĄCZNIE `CHANGELOG.md`** (+11 linii,
  plus własna kopia `.bak`). Zero kodu, zero schematu. Ania uzupełniła brakujący wpis z 15:39, który
  opisuje zmiany przysłane wcześniej commitami `03fe892` i `9d1b09f`. **Nie zakładamy wpisu #87** —
  treść poszła do **#82** i **#83** jako brakujące „dlaczego", i zdjęła z nich blokadę implementacji.
  ⚠ **Wzorzec do zapamiętania:** producent potrafi przysłać najpierw kod, a uzasadnienie dopiero
  osobnym commitem kilka godzin później. Brak wpisu w CHANGELOG znaczy „jeszcze nie opisane",
  nie „nie ma powodu".
  ⚠ Uwaga na pole „Changelog Ani (najnowszy wpis)" w treści tego commita — producent wkleił tam
  wpis z **2026-08-18**, nie nowy. Prawdziwą treść daje dopiero `git diff` na `CHANGELOG.md`.

*Pominięte — triaż 2026-09-22 po południu (zakres `71323ec..7d6cfc9`, ticket 104):*
- `a6dffb1` (22.09 06:00) — wyłącznie regeneracja `sellycsv-*.csv` (dane). Kod z tego zakresu
  (`7d6cfc9`, Staging v2) → wpis **#99**.

*Pominięte — triaż 2026-09-22 (zakres `86d9090..71323ec`, ticket 94):*
- `0c3c9e4` (19.09 06:00), `68d55cf` (20.09 06:00), `71323ec` (21.09 06:00) — trzy commity z etykietą
  `[FRONTEND]`, każdy zmienia **wyłącznie** `mirror/frontend/ex-port-files/sellycsv-*.csv` — codzienna
  regeneracja eksportu Selly o 6:00 (dane, nie kod). Nagłówek pliku identyczny jak w `86d9090`
  (ta sama suma kontrolna pierwszej linii), więc **zestaw kolumn CSV się nie zmienił**. Liczba wierszy
  8089 → 8087. **Zero kodu, zero schematu → brak nowych wpisów backlogu.**
  ⚠ Sygnał dla **13d** (Selly REST): ostatnia zmiana w `mirror/backend/selly/` to `5dedefb` z 17.09 17:00,
  a ostatnia zmiana kodu backendu w ogóle to `86d9090` z 18.09 — **cztery dni ciszy** po serii docierania.
  To pierwszy dłuższy spokój od 08.09; nie przesądza o stabilności (pytanie do Ani nadal otwarte).

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
> i configu NAPRAWIONE w Iteracji 11 (2026-09-03); dla produktów NAPRAWIONE w Iteracji 12,
> sesji 12a (2026-09-05).

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (warstwa danych + trasy mutacji) |
| **Pliki** | `deminified/backend-index.cjs:45043` (`updateSupplier`), `:44975` (`updateMarkup`), `:44998` (`updatePromotion`), `:44824` (`updateStaging`), `:44728` (`updateProduct`), `:45077-45085` (`upsertSpedycja`), `:45083-45089` (`U.setConfig`); trasy `:48230`, `:48699`, `:48722`, `:48415`, `:48736`, `:48745` |
| **Do nowej wersji?** | ❌ **NIE — defektu nie odtwarzamy** (decyzja 2026-09-01, dotyczy dostawców; dla narzutów/promocji NAPRAWIONE 4a, dla spedycji/configu NAPRAWIONE I11, dla produktów patrz „Co z tego wynika") |
| **Status** | ✔ dostawcy naprawieni w rebuild (3f-2) · ✔ narzuty i promocje naprawione w rebuild (4a, 2026-09-02) · ✔ spedycja i config naprawione w rebuild (I11, 2026-09-03) · ✔ produkty naprawione w rebuild (I12a, 2026-09-05) · w produkcji **nadal obecne** |

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
| `PUT /api/products/:id` (`:48415-48449`) i `PATCH /api/products/:id` (`:48452-48487`, osobna funkcja) | `c.body` bez klucza `_reason` | **I12a ✔** |
| `POST /api/spedycja` (`:48736`) | `c.body` — bez zmian | **Iteracja 11 ✔** |

**Sprostowanie faktu o oryginale (I12a, 2026-09-05).** `PUT` i `PATCH /api/products/:id` NIE
są jednym wspólnym handlerem, jak wcześniej twierdził ten wpis — `:48415-48449` obsługuje
wyłącznie `PUT` (`e.put(…, i)`, `:48451`), a `PATCH` ma własną, niemal identyczną funkcję
(`:48452-48487`); jedyna różnica to kolejność audytu względem pętli override/history, stan
końcowy identyczny. Odbudowa świadomie portuje jeden wspólny handler (D2, plan.md).
**Drugi sprostowany fakt: trasa edycji pisze do DWÓCH tabel, nie jednej** — poza
`manual_overrides` (`:48427`) woła też `U.addHistory` (`:48435-48445`) do tabeli `history`.
Ma to znaczenie dla tego wpisu, bo lista pól steruje też liczbą wpisów w dzienniku zmian.

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
  `nazwa, rabatPct, zasieg, warunki, priorytet, start, koniec`) odcinają `id`,
  `zmienilUzytkownikId`, `zmienionoData` (ustawia je SERWER). **`status` wypadł z listy promocji
  w 14f (2026-09-19, `64-FEATURE-i14f-daty-koncza-promocje`, backlog #19)** — po wygaszaczu
  statusu jest polem WYLICZANYM z dat, nie edytowalnym; `dodajPromocje` liczy go sam. Testy:
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
- **Iteracja 12 (produkty + hardening) — NAPRAWIONE (I12a, 2026-09-05).**
  `POLA_EDYTOWALNE_PRODUKTU` w `rebuild/backend/src/repos/products.ts` — **42 pola**,
  filtrowane wspólnym `odsiejPola` z `repos/pola-edytowalne.ts` (ten sam mechanizm co
  dostawcy/narzuty/promocje/spedycja).
  **⭐ Lista NIE jest wymysłem odbudowy** — to dokładnie zbiór pól, które produkcyjny dialog
  edycji produktu potrafi wysłać: `LT()`, `deminified/frontend-index.js:24020-24090`; handler
  zapisu (`:24107-24124`) wysyła wyłącznie klucze dotknięte przez użytkownika. To jeszcze
  mocniejszy argument niż przy dostawcach, gdzie listę trzeba było złożyć z sensu kolumn.
  Odcięte i dlaczego: kolumny **wyliczane** przez import (`marzaPct`, `magazyn`, `magazynRaw`,
  `eanRaw`, `eanIsValid`, `eanSourceStatus`, `eanCandidates`, `kodImportu`,
  `nieobecnoscPodRzad`, `indeksy`, `indeks1`, `indeks2`, `dostepnosc`, `rodzaj`, `sku`,
  `zastosowanie`, `reinforced`, `extraLoad`, `cutResistant`, `heatResistant` oraz cztery
  wymiary paczki liczone przez `applyDims`); **tożsamość i pola serwera** (`id`, `kod`,
  `dataAktualizacji`); **kolumna własna odbudowy** `uwagaCena` (migracja 002); oraz
  `dostawca` — dialog produkcji renderuje to pole, ale jako `disabled` (`:24028`), więc nigdy
  go nie wysyła, a `manual_overrides` kluczuje się po `supplierKod = produkt.dostawca`, więc
  zmiana dostawcy osierociłaby wszystkie własne poprawki produktu.
  **Konsekwencja szersza niż zapis:** trasa zapisuje `manual_overrides` dla KAŻDEGO
  zmienionego pola, a silnik importu te poprawki respektuje — więc lista pól decyduje też
  o tym, czego import przestanie nadpisywać. Pole dopisane bez potrzeby to pole, które da się
  przypadkiem zamrozić przed importem.
  **Audyt jest tu SPÓJNY z zapisem**, inaczej niż przy narzutach/promocjach w 4a: audyt
  `edycja_produktu` loguje `{zmiany: Object.keys(…)}` liczone PO odsianiu listą, więc
  `szczegoly_json` opisuje stan bazy, a nie zamiar (przy narzutach/promocjach audyt loguje
  surowe ciało — różnica wobec 4a, opisana wyżej w tym wpisie).
  **Nowa gałąź, której wzorzec dostawców nie miał:** wprowadzenie listy pól sprawia, że
  `PATCH` z samymi polami spoza listy daje pusty patch, a Drizzle rzuca na `set({})`.
  `aktualizujProdukt` dostało więc gałąź „pusty patch → bez UPDATE, zwróć aktualny wiersz" —
  ten sam ruch co `aktualizujDostawce` w 3f-2. Bez niego trasa oddawałaby 500 tam, gdzie
  produkcja oddaje 200. Testy: `rebuild/backend/test/produkty.mutacje.test.ts`.
  Wszystkie trasy mutacji produktów mają po tej sesji jawną listę pól — nic nie zostaje do
  finalnego audytu.
  **Front dogonił backend w sesji 12c (2026-09-05).** Dialog edycji produktu
  (`rebuild/frontend/src/pages/katalog/DialogEdycjiProduktu.tsx` + `poleEdycji.ts`) wysyła
  dokładnie tę listę 42 pól i nic ponadto — pilnuje tego `rebuild/frontend/test/katalog.poleEdycji.test.ts`,
  który czyta `POLA_EDYTOWALNE_PRODUKTU` wprost ze źródła backendu i porównuje z kluczami
  wysyłanymi przez formularz.
- **Reguła, którą warto przyjąć na stałe:** trasa mutacji dostaje jawną listę pól, a kolumny
  wyliczane i kolumny własne odbudowy (`importWylaczony`, `uwagaCena`) na tę listę **nigdy**
  nie wchodzą. Potwierdzone w I12a: `uwagaCena` odcięta z `POLA_EDYTOWALNE_PRODUKTU` mimo że
  oryginał technicznie pozwalał ją zapisać przez `PATCH`/`PUT`.

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

> **Znalezione przy bloku I4/4a (2026-09-02).** Zdiagnozowane i oba warianty naprawy WYCENIONE
> w 14e (2026-09-18). **NAPRAWIONE W ODBUDOWIE kartą `64-FEATURE-i14f-daty-koncza-promocje`
> (2026-09-19)** — wariant (b), wygaszacz statusu. **⚠ Produkcja jest NIEZMIENIONA** — nadal nie
> przelicza `status` z dat, wygasła promocja tam nadal obniża ceny w nieskończoność (opis „Co
> robi produkcja" niżej pozostaje w 100% prawdziwy dla produkcji, nie dla odbudowy).

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (silnik cen) [+FRONTEND — prezentacja, 4b] |
| **Pliki** | `deminified/backend-index.cjs:44615-44628` (`__bridgePromoMatches`); port: `rebuild/backend/src/repos/ceny.ts` (`promocjaPasuje`, NIETKNIĘTE naprawą — dalej nie czyta dat). Frontend: `frontend-index.js:9309-9314` (`Qd`), `:9508-9514` (`_b`), `:9568` (`queryFn`), `:9183-9193` (`Gr`/`un`, IndexedDB); port: `rebuild/frontend/src/pages/narzuty/status.ts`. Naprawa (14f): **nowy** `rebuild/backend/src/promocje/wygaszacz.ts` |
| **Do nowej wersji?** | ✅ **NAPRAWIONE w odbudowie.** Wariant (b) — wygaszacz przestawia `promotions.status` z dat, w OBIE strony (`aktywna→zakonczona` i `zaplanowana→aktywna`), silnik cen nietknięty. Odpala się przy starcie procesu, na wejściu `przeliczCenyZRegul` oraz cyklicznie co `PROMO_WYGASZACZ_MINUTY` (domyślnie 5 min, `0` wyłącza cykl). `status` odcięty od `POLA_EDYTOWALNE_PROMOCJI`. Wdrożone kartą **`64-FEATURE-i14f-daty-koncza-promocje`**. |
| **Status** | ✅ **ZAMKNIĘTE 2026-09-19, karta `64-FEATURE-i14f-daty-koncza-promocje`.** Droga: odtworzone 1:1 w rebuild (4a backend, 4b frontend) → oba warianty naprawy wycenione w 14e (2026-09-18) → naprawione wariantem (b) w 14f (2026-09-19). Charakteryzacja importu przeszła BEZ WYJĄTKU (31 + 17 scenariuszy) — zmieniły się dane, nie zachowanie `promocjaPasuje`. **Produkcja pozostaje niezmieniona**, poza zakresem odbudowy. |

**⚠ DECYZJA ANI 2026-09-18 — ROZBIEŻNA, naprawa ZATWIERDZONA (zrealizowana w 14f).**
W instrukcji I4 (§3.9) napisała:
„Tak, data końcowa powinna automatycznie wyłączać promocję. (…) Po wygaśnięciu system powinien
przeliczyć ceny bez tej promocji". W odpowiedzi na pytanie kontrolne z 18.09 napisała coś innego:
„to nie było opisane jako błąd — opisałam co się dzieje, bo takie było pytanie. Ma zostać tak jak
jest, reguła znika po końcu obowiązywania". **Jej opis zachowania nie zgadza się z kodem:**
`TabelaPromocji.tsx` nie filtruje niczego po datach (wiersz ZOSTAJE, z odznaką „zakończona"
i naszym pomarańczowym znacznikiem), a silnik dat nie czyta, więc wygasła promocja **dalej obniża
ceny**. Wysłano drugie pytanie kontrolne, tym razem z opisem stanu faktycznego zamiast pytania
otwartego — i **2026-09-18 Ania odpowiedziała jednoznacznie: „data ma naprawdę kończyć
promocje"**. Wpis przechodzi z „do decyzji" na ZATWIERDZONY. Morał na przyszłość: pytanie
„co ma się dziać?" dostało odpowiedź opisującą to, co Ania MYŚLAŁA, że się dzieje; dopiero
pytanie „dziś jest TAK — zostawiamy czy zmieniamy?" dało decyzję.

**⚠ Pytanie otwarte zadane Ani ponownie — karta 14m (2026-09-19).** Jej sformułowanie „reguła
znika po końcu obowiązywania" (cytat wyżej) opisuje inne zachowanie niż to, co dowiozła 14f:
wiersz **zostaje** w tabeli `/narzuty`, tylko z odznaką „zakończona" (zachowanie oryginału,
świadomie niezmienione). `docs/instrukcja-testow-I4-v2.md` §3.1 uprzedza ją o tym wprost i pyta,
czy chce, żeby wygasłe promocje były ukrywane z tabeli. Odpowiedź czeka — brak decyzji dziś.

**Dwa warianty wdrożenia, różnica kosztu jest zasadnicza** (wycena: karta 14e, decyzja:
użytkownik):
- **(a) silnik czyta daty** — warunek na `start`/`koniec` w `promocjaPasuje`. Kilka linii, ale
  funkcja przestaje zachowywać się jak oryginał, więc **charakteryzacja wymaga wyjątku**.
- **(b) wygaszacz statusu** — osobny krok przestawia `status` na `zakonczona`, gdy minęła data
  końca; silnik NIETKNIĘTY, dalej patrzy tylko na `status`, charakteryzacja bez wyjątku, bo
  zmieniają się DANE, a nie zachowanie funkcji. Dodatkowo odtwarza dosłownie to, co Ania
  opisała słowami „reguła znika po końcu obowiązywania".
**DECYZJA UŻYTKOWNIKA 2026-09-18 — wariant (b), w wersji rozszerzonej o cykliczność.**
Trzy rozstrzygnięcia podjęte naraz, po przedstawieniu wyceny z 14e:
1. **(b) wygaszacz przestawia `status`** — silnik nietknięty, zero wyjątków w wyroczni.
2. **Wygaszacz chodzi także CYKLICZNIE**, nie tylko przy starcie i przy mutacji reguł. Bez tego
   zostaje okno, w którym wygasła promocja **nadal obniża cenę przy każdym imporcie** (importy
   co godzinę u pięciu dostawców → okno sięga dni). ⚠ 14f ma najpierw ZMIERZYĆ, że wariant
   cykliczny nie wchodzi w ścieżkę charakteryzacji — nie zakładać.
3. **`status` odcięty od `POLA_EDYTOWALNE_PROMOCJI`** — po (b) jest polem wyliczanym, więc
   edytowalność oznaczałaby ciche nadpisywanie ustawień użytkownika.
⚠ Zakres 14f obejmuje OBIE strony zakresu dat — samo wygaszanie zostawiłoby niedziałające
planowanie (defekt odwrotny, opisany wyżej w tym wpisie).

**Rekomendacja: (b).** ⚠ Skutek uboczny w obu wariantach: znacznik `rozbieznosc` (D5 z 4b; nazwa
pojęciowa w tym wpisie brzmiała „rozbieżność statusu", w kodzie pole nazywało się `rozbieznosc`)
przestaje mieć rację bytu i trzeba go usunąć świadomie, nie zostawić jako martwy kod.
**Zrealizowane w 14f** — pole `rozbieznosc` (typ `PromocjaZeStanem`) i jego wyliczanie w
`status.ts`/`TabelaPromocji.tsx` usunięte.

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

**⭐ KOSZT OBU WARIANTÓW POLICZONY — karta `53-CHORE-i14e-diagnoza-promocji` (2026-09-18).**

**Najpierw ustalenie, które przesądza o koszcie: status promocji jest zapisywany RAZ.**
POST liczy go z dat (`status: statusZDat(start, koniec)`), **PATCH go NIE wysyła** (siedem pól,
1:1 z `Eb()` oryginału — `DialogReguly.tsx:209-224`), a **nic po stronie serwera nigdy go nie
przelicza** — ani w odbudowie (przed 14f), ani w produkcji (w `mirror/backend/index.cjs` napis
`zakonczona` nie występuje ani razu, `zaplanowana` dokładnie raz — oba wyłącznie w literale
danych seeda, sprostowanie liczbowe z 14f). Defekt #19 to więc nie „silnik ignoruje daty"
w oderwaniu od reszty, tylko **brak przeliczania statusu w czasie**.

**Silnik JUŻ honoruje status — zmierzone** (bez rabatu 1303, z rabatem 10% 1173):

| Stan promocji | Cena | |
|---|---|---|
| `aktywna`, daty bieżące | 1173 | rabat działa |
| `aktywna`, koniec w PRZESZŁOŚCI | 1173 | **to jest defekt #19** |
| `aktywna`, start w PRZYSZŁOŚCI | 1173 | rabat działa |
| `zakonczona` | 1303 | **rabat nie działa** |
| `zaplanowana` | 1303 | **rabat nie działa** |

Czyli: **wpisanie właściwego `status` do bazy wyłącza rabat bez tknięcia silnika.**

| Pozycja | (a) silnik czyta daty | (b) wygaszacz przestawia `status` |
|---|---|---|
| Scenariusze charakteryzacji akceptacji | **1 z 31** — 3 pola (`cena_sprzedazy`, `marza_pct`, `status`) w 1 wierszu | **0 z 31** (warunkowo, patrz niżej) |
| Scenariusze charakteryzacji `bulk` | **0 z 17** | **0 z 17** |
| Testy jednostkowe BE | **2** (`ceny.silnik.test.ts:246-252`, `narzuty.patch.test.ts:319-331`) | **1** (`narzuty.patch.test.ts:319-331`) |
| Fixtures w `contract/` | **0** | **0** |
| Realne ceny w produkcji dziś | **0** (`promotions` pusta) | **0** |
| Wyjątek w wyroczni charakteryzacji | **TAK** | **NIE** |

**⚠ (b) jest darmowe tylko dopóki wygaszacz nie wchodzi do ścieżki importu.** Harness porównuje
`acceptStaging`, a ta woła `zastosujRegulyCenowe`, nie `przeliczCenyZRegul` (to drugie jest wołane
wyłącznie z `repos/markups.ts:113` i `repos/promotions.ts:97`). Wygaszacz przy starcie i w
`przeliczCenyZRegul` jest dla harnessu niewidoczny; dołożony do importu **kosztuje tyle co (a)**,
a nawet więcej — rozjechałyby się dwie tabele (`products` i `promotions`). Zostaje wtedy okno:
promocja wygasająca przy działającym procesie, bez mutacji reguł, obniża ceny przy imporcie aż do
najbliższego zamiatania. **To jest wybór do podjęcia w 14f, nie szczegół implementacyjny.**

**Znacznik `rozbieznosc` (D5 z 4b) zachowuje się RÓŻNIE:** w (b) nigdy się nie zapali
(status zrówna się z etykietą) → martwy kod do świadomego usunięcia; w (a) **nadal będzie się
zapalał i będzie KŁAMAŁ** („nadal obniża ceny" o promocji, która już nie obniża) → usunięcie jest
warunkiem poprawności, nie kosmetyką. Nota `nota-daty-promocji` (`DialogReguly.tsx:555-557`)
staje się nieprawdziwa w obu wariantach. **Zrealizowane w 14f (wariant (b) wybrany):** znacznik
usunięty, nota w `DialogReguly.tsx` przepisana na prawdziwą.

**⚠ DWA SPROSTOWANIA DO `docs/instrukcja-testow-I4.md`** (plik poza własnością 14e — do zrobienia
przez 14d): **§4 pkt 6 jest NIEPRAWDZIWY** (promocja z datą startu w przyszłości założona przez
dialog dostaje `status: "zaplanowana"` i NIE obniża cen, nie pokaże też znacznika rozbieżności),
a **istnieje defekt odwrotny, nigdzie nieopisany: promocja „zaplanowana" NIGDY SIĘ NIE WŁĄCZA**,
bo nic nie przelicza statusu po nadejściu daty startu. §3.9 pozostaje poprawny — i teraz wiadomo
dlaczego: PATCH nie rusza statusu.

**Ania poinformowana — karta 14m (2026-09-19), `docs/instrukcja-testow-I4-v2.md` §3.1 i §3.2.**
§3.1 opisuje jej naprawioną datę końca (zaprzeczenie §3.9 starej instrukcji, wprost); §3.2
opisuje naprawę promocji „zaplanowanej" jako „Tego nie zgłaszałaś" (od 4a, 2026-09-02 nigdy nie
działała). Oba sprostowania z akapitu wyżej (§3.9 i §4 pkt 5–6 starej instrukcji) trafiły do
rozdziału 6 v2 jako unieważnione punkty — banner w `docs/instrukcja-testow-I4.md` kieruje do v2.

**Dwa zastrzeżenia do 14f, OBA ROZLICZONE:** (1) wygaszacz musiał działać w OBIE strony
(`zakonczona` po końcu, `aktywna` po nadejściu startu) — **zrealizowane**, inaczej naprawiałby
tylko wygaszanie i zostawiał niedziałające planowanie; (2) `status` był na liście
`POLA_EDYTOWALNE_PROMOCJI`, więc wygaszacz nadpisywałby ręczne ustawienia — **rozstrzygnięte
przez odcięcie `status` od tej listy** (D3), pole jest teraz WYLICZANYM.

**Uzupełnienie 14h (2026-09-18).** Kolumna „Promocja" w `/katalog` (#22) korzysta o tego samego
`wybierzPromocje` z `repos/ceny.ts` co silnik cen — więc zaczęła respektować daty **sama**, bez
żadnej zmiany w karcie 14h, gdy karta 14f dowiozła wygaszacz. Emergentny skutek uboczny (opisany
w raporcie 14f): wygasła promocja po zamieceniu statusu przestaje się też pokazywać jako odznaka
w kolumnie katalogu, nie tylko przestaje obniżać ceny — zachowanie spójne (brak rabatu ⇒ brak
odznaki), nie regresja.

Pełne liczby i metoda: `docs/tickets/53-CHORE-i14e-diagnoza-promocji/raport.md`, sekcja C.

**⭐ ROZLICZENIE — naprawione w 14f (2026-09-19).** Wdrożony wariant (b): nowy
`rebuild/backend/src/promocje/wygaszacz.ts` (`statusZDat`, `zamiecStatusyPromocji`,
`stworzWygaszacz`) przestawia `promotions.status` z dat, w OBIE strony, idempotentnie. Odpala się
w trzech miejscach: start procesu, wejście `przeliczCenyZRegul`, cyklicznie co
`PROMO_WYGASZACZ_MINUTY` (domyślnie 5 min, `0` wyłącza cykl) — **NIE** na ścieżce importu
(`zastosujRegulyCenowe` nietknięte). Zmierzone: cykliczność jest darmowa dla charakteryzacji
(0 z 31 scenariuszy akceptacji, 0 z 17 bulk), bo harness nie przechodzi przez `server.ts`, gdzie
mieszkają timery. `promocjaPasuje` w `repos/ceny.ts` pozostaje **nietknięte** — zmieniły się
dane, nie zachowanie porównywanej funkcji, dlatego charakteryzacja przeszła **bez ani jednego
wyjątku w wyroczni**. `dodajPromocje` liczy `status` z dat po stronie serwera, domykając pułapkę
`DEFAULT 'aktywna'` dla promocji z datą startu w przyszłości. Szczegóły:
`docs/tickets/64-FEATURE-i14f-daty-koncza-promocje/`.

**Uzupełnienie 4b (frontend, 2026-09-02, HISTORYCZNE — znacznik usunięty w 14f).** Widok
`/narzuty` portuje `_b()`/`Qd()` 1:1 (`rebuild/frontend/src/pages/narzuty/status.ts`) — etykieta
statusu promocji liczona z dat przy każdym odczycie, bez zapisu na serwer, dokładnie jak
produkcja (to zostaje bez zmian). Ponad port ówcześnie dołożony **widoczny znacznik rozbieżności**
(`rozbieznosc-statusu-{id}`, `data-testid` w `TabelaPromocji.tsx`): gdy etykieta wyliczona z dat
nie zgadzała się z kolumną `status` z serwera, wiersz pokazywał ostrzeżenie w stylu „wg dat
zakończona, ale nadal obniża ceny". To **nie była naprawa** — dane i mechanika bez zmian, znikała
wyłącznie niewidzialność defektu na liście (plan.md D5, decyzja użytkownika 2026-09-02).
**Naprawa (przeliczanie statusu z dat po stronie serwera) dowieziona w 14f — znacznik stał się
martwym kodem i został usunięty świadomie** (patrz „ROZLICZENIE" wyżej).

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
| **Do nowej wersji?** | ❌ **NIE — decyzja Ani 2026-09-21** |
| **Status** | ✔ port 1:1 zrobiony w rebuild (I5) · rozszerzenie słownika — nie zaczęte |

**DECYZJA ANI 2026-09-21 (pytanie 5.1): NIE.** Cytat: „Nie chcę tego widzieć w historii, bo importy
są co 60 minut i cała historia będzie zawalona importami. Wystarczy działający przycisk
aktywny/nieaktywny w zakładce dostawcy, który obecnie już tam jest". Wpis ZAMKNIĘTY bez zmian
w kodzie; planowana karta 14k SKASOWANA.
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
> (`docs/tickets/16-FEATURE-widok-narzuty-promocje/plan.md`). **Ożywione 2026-09-18,
> karta 14h** (`docs/tickets/61-FEATURE-promocja-kolumna-katalog/`).

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (katalog) |
| **Pliki** | `deminified/frontend-index.js:23162-23182` (render kolumny); port: `rebuild/frontend/src/pages/katalog/kolumny.ts`, `katalog/formatowanie.tsx:118-138`; ożywienie: `rebuild/backend/src/repos/products.ts` (`dolaczReguly`), `rebuild/backend/src/routes/products.ts` |
| **Do nowej wersji?** | ✅ **TAK, OŻYWIENIE — decyzja Ani 2026-09-18** (świadome odstępstwo: to NOWA funkcja, nie przywrócenie) |
| **Iteracja** | odtworzone 1:1 w **4b**; ożywione w **I14, karta 14h** (2026-09-18) |
| **Status** | ✔ **zrobione 2026-09-18, `61-FEATURE-promocja-kolumna-katalog`** · **14e (2026-09-18): niezależnie potwierdzone pomiarem, że pusta kolumna NIE wpływała na ceny** — przy promocji `marka→BKT` ceny 954 produktów spadły poprawnie mimo pustej kolumny, zgodnie z tym, co Ania napisała 19.09 („tylko się nie wyświetlało, cena się oblicza prawidłowo") |

**⚠ SPROSTOWANIE ARCHEOLOGICZNE (2026-09-18).** Ania, prosząc o ożywienie kolumny, dodała: „w starym
Bridge działała, było to sprawdzane, być może któryś backup to zastąpił i już nie działa". **Kod tego
nie potwierdza w ŻADNEJ wersji, którą mamy.** Zmierzone na ŻYWYCH plikach produkcji, nie na
deminifikacie: `mirror/frontend/assets/index-PRICEFMT1783512500.js` ma dokładnie JEDNO wystąpienie
`._reguly` (miejsce odczytu), a `mirror/backend/index.cjs` nie ma go wcale — dwa trafienia
`grep -o "_reguly"` to substring kolumny `dodatkowe_reguly` z tabeli `spedycja_limity`, co łatwo
wziąć za trafienie (wzięliśmy, na jedną minutę). Rozstrzygające: `git log -S'_reguly:' --all` nie
zwraca ANI JEDNEGO commita od baseline'u 13.08 do 18.09 — nikt nigdy nie dopisał zapisu tego pola.
**Wniosek dla karty 14h: to nowa funkcja i świadome odstępstwo, nie przywrócenie regresji.** Trzeba
to Ani powiedzieć wprost, żeby nie liczyła na „powrót do stanu sprzed backupu" i na jego wycenę.
**Dwa fakty zweryfikowane niezależnie w 14h:** odczyt `_reguly` istniał już w baseline'ie
z 2026-08-13 (`deminified/frontend-index.js`, 1 wystąpienie), więc żadna łatka Ani go nie dodała
ani nie usunęła — nie ma czego „przywracać"; `git log -S'_reguly:' --all` zwraca dokładnie **jeden**
commit i jest to nasz własny wpis dokumentacyjny, zero kodu produkcji.

**Ania poinformowana — karta 14m (2026-09-19), `docs/instrukcja-testow-I4-v2.md` §2.1, Ramka A.**
Dokument prostuje jej założenie wprost, cytując jego treść („w starym Bridge działała, było to
sprawdzane, być może któryś backup to zastąpił i już nie działa") i odpowiadając na nie dowodem
z czterech niezależnych źródeł (żywy bundle, deminifikat, backend + wszystkie łatki, `git log -S`):
kolumna **nie działała w żadnej wersji, którą mamy** — to nowa funkcja, nie naprawa regresji.

**Co robi produkcja.** Render czyta `produkt._reguly?.promocja` (`:23162-23182`), a `_reguly`
**nie jest ustawiane nigdzie w bundlu** — jedno wystąpienie w całym pliku, wyłącznie odczyt
(potwierdzone `grep`em). Żadne z 66 pól produktu w `contract/fixtures/GET_products.json`
nie niesie promocji ani rabatu. Kolumna jest mimo to w domyślnym zestawie kolumn katalogu
i od zawsze renderuje `—`.

**Skutek.** Ania widzi w `/katalog` pustą kolumnę, która obiecuje pokazać obowiązującą
promocję, a nigdy nic nie pokaże — bo dane, które by ją zasiliły, nie istnieją nigdzie
w systemie produkcyjnym.

**Decyzja użytkownika (2026-09-02): port 1:1 w 4b** — odbudowa miała wtedy to samo zachowanie
w `rebuild/frontend/src/pages/katalog/formatowanie.tsx`. Ożywienie wymagało danych z backendu
(pole dopasowanej promocji przy produkcie); liczenie po stronie klienta duplikowałoby silnik
dopasowania reguł (`rebuild/backend/src/repos/ceny.ts`) — drugie miejsce, które musiałoby zgadzać
się z pierwszym. **Dokładnie tak to zrobiono w 14h:** backend liczy wspólnym silnikiem, front
zostaje bez zmian w kodzie.

**Co dowiozła karta 14h (2026-09-18).** `GET /api/products` dokłada opcjonalny klucz
`_reguly.promocja` = `{ wartosc, nazwa }` (`wartosc` = kolumna `promotions.rabat_pct`),
wyliczony **istniejącym** `wybierzPromocje` z `rebuild/backend/src/repos/ceny.ts` (silnik
NIETKNIĘTY). Pole trafia do OBU kształtów odpowiedzi `GET /api/products` (goła tablica i
koperta). **Brak dopasowania = BRAK klucza**, więc produkt bez promocji ma nadal dokładnie
72 klucze co nagranie produkcji — odstępstwo jest warunkowe i wąskie. **Dziś w bazie jest
0 promocji** (`db/snapshot.db`: `products` = 7405, `promotions` = 0; produkcyjny fixture
`GET_promotions.json` to pusta tablica) — kolumna zaświeci dopiero po założeniu promocji
w `/narzuty`. Szczegóły: `docs/tickets/61-FEATURE-promocja-kolumna-katalog/plan.md` (D1–D9).

**⚠ Domiar 14m (2026-09-19): kliknięcie nagłówka „Promocja" NIC nie sortuje.**
`rebuild/frontend/src/pages/katalog/filtrowanie.ts:107-123` (`sortuj()`) czyta
`produkt["promocja"]`, a wartość siedzi w `_reguly.promocja` — obie strony porównania to `""`.
Identycznie w oryginale (`frontend-index.js:23307-23311`) — wierne odtworzenie, nie regresja.
**Pytanie otwarte zadane Ani** w `docs/instrukcja-testow-I4-v2.md` §2.1: czy sortowanie po tej
kolumnie byłoby przydatne? Odpowiedź czeka — brak decyzji dziś.

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

**Uzupełnienie 14h (2026-09-18).** Kolumna „Promocja" w `/katalog` (#22) świadomie NIE dokłada
czwartego sposobu dopasowania promocji — reużywa `wybierzPromocje`/`promocjaPasuje` z
`repos/ceny.ts`, ten sam silnik co ceny w katalogu.

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

**Uzupełnienie 14h (2026-09-18).** Kolumna „Promocja" w `/katalog` (#22) świadomie NIE dołożyła
czwartego sposobu — patrz notatka przy #23.

**Uzupełnienie 14f (2026-09-19, D6).** Potwierdzenie usuwania reguły narzutu/promocji (liczba
dotkniętych produktów w dialogu) liczy **wiernym silnikiem cen** (`wybierzNarzut`/`wybierzPromocje`
z `repos/ceny.ts`), świadomie NIE tym matcherem (`dopasujDoOstrzezenia`) — inaczej dialog
pokazałby „0 produktów" dla reguł z warunkami `konstrukcja`/`srednica`/`vfIf`, których ten
matcher nie łapie. Trzy niezależne sposoby liczenia ceny w `/narzuty` zostają trzema — karta nie
dołożyła czwartego, tylko dodała nowego konsumenta jednego z istniejących dwóch.

**Ania poinformowana — karta 14m (2026-09-19), `docs/instrukcja-testow-I4-v2.md` §4.1.** Dokument
uprzedza ją wprost, że liczba w okienku usuwania (silnik cen) i liczba z czerwonego paska „poniżej
kosztu" (`dopasujDoOstrzezenia`, ten wpis) mogą się różnić dla warunków `konstrukcja`/`srednica`/
`vfIf` — i że to NIE jest błąd, tylko dwa różne, świadomie nieujednolicone mechanizmy.

---

### #25 · 2026-09-02 · [FRONTEND] · promocja „globalna" nie obniża żadnych cen, ale ostrzega o całym katalogu

> **Znalezione przy pisaniu instrukcji testów I4 (ticket `17-DOCS-instrukcja-testow-i4`),
> POMIAREM, nie lekturą.** Dotyczy zarówno produkcji, jak i odbudowy — port jest 1:1.

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (widok `/narzuty`, dialog reguły) |
| **Pliki** | `deminified/frontend-index.js:24613` (`zasieg: R ? "globalny" : …`), `:9473-9479` (`Tb`), `:24473-24513` i `:24563-24597` (ostrzeżenie); port: `rebuild/frontend/src/pages/narzuty/DialogReguly.tsx`, `ceny.ts` |
| **Do nowej wersji?** | ❌ **NIE — decyzja Ani 2026-09-18**: „nie, zostawiamy tak jak jest, nie dodajemy nowych reguł" |
| **Status** | zamknięte bez zmian · odtworzone świadomie w 4b · w produkcji **nadal obecne** · pułapka ZOSTAJE, bez blokady w UI · **14e (2026-09-18): zasięg ZMIERZONY — 1 produkt na 7405, identycznie w oryginale i w odbudowie** |

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

**⭐ SPROSTOWANIE MECHANIZMU (14e, 2026-09-18, pomiar).** Dopasowanie jest **ALTERNATYWĄ**, nie
koniunkcją: wystarczy pusta marka **albo** pusta kategoria. Jedyny produkt w katalogu produkcji,
który „globalna” realnie złapała, ma pustą markę przy **WYPEŁNIONEJ** kategorii —
`MO4_LLCR17523575MLLS0`, kategoria „Ciężarowe”, zakup 475,30; cena 619 → 557.

**⭐ ZASIĘG ZMIERZONY NA ŻYWYM KATALOGU (14e).** Promocja „globalna” z rabatem 10%, założona przez
API na kopii `db/snapshot.db`, zmieniła — ponad efekt samego przeliczenia katalogu — cenę
**dokładnie 1 produktu z 7405**. Ten sam pomiar powtórzony na ORYGINALE
(`mirror/backend/index.cjs` w piaskownicy) dał **0 różnic wobec odbudowy na wszystkich 7405
produktach**. Dla kontrastu ta sama promocja założona Z WARUNKIEM `marka→BKT` objęła
**954 produkty**. Hipoteza „praktycznie zero” z tego wpisu ma więc teraz liczbę: **1/7405**.
Zamrożone testem `rebuild/backend/test/promocja-warunek-obniza-cene.test.ts`, który pilnuje OBU
kierunków — żeby promocja warunkowa nie przestała działać po cichu i żeby „globalna” nie zaczęła.

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

**Ania poinformowana — karta 14m (2026-09-19), `docs/instrukcja-testow-I4-v2.md` rozdział 5.1.**
Pułapka ZOSTAJE (jej decyzja 2026-09-18: „nie, zostawiamy tak jak jest, nie dodajemy nowych
reguł"), dokument opisuje ją razem ze zmierzonym zasięgiem **1/7405**.

---

### #26 · 2026-09-03 · [FRONTEND] · widok `/alerty` w oryginale NIE czyta `/api/alerts` — pseudo-alerty katalogowe pominięte

> **Znalezione przy Iteracji 6 (2026-09-03), ticket `18-FEATURE-widok-alerty`.**
> **✅ ZROBIONE 2026-09-21, ticket `77-FEATURE-pseudo-alerty-katalogowe` (P6.2)** — pseudo-alerty
> katalogowe wróciły jako zakładka „Katalog" na `/alerty`, obok „Import". Poniżej zostaje
> historia decyzji; stan dowozu opisuje blok „CO DOWIOZŁA KARTA P6.2" niżej.
>
> **Instrukcja dla Ani:** `docs/instrukcja-testow-I6-v2.md` (P6.3, ticket `85-DOCS-instrukcja-testow-i6-v2`,
> 2026-09-21) — rozdział 1.1 (zakładka „Katalog") i 1.2 (dwa przyciski), plus „przy okazji" 2.1–2.5.

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (widok `/alerty`) |
| **Pliki** | `deminified/frontend-index.js:25177-25340` (`HT()`), `:16631-16705` (`pv()`), `:9165-9193` (IndexedDB `cn`/`un`) |
| **Do nowej wersji?** | ✅ **TAK — ROZSTRZYGNIĘTE 2026-09-21 przez Anię** (pytanie 1a rundy 2): pseudo-alerty katalogowe WRACAJĄ, razem z trzecim statusem `przejrzany` |
| **Status** | ✅ **zrobione 2026-09-21** — trzeci status `przejrzany` + przyciski „Oznacz jako przejrzany”/„Rozwiąż” (i nasze „Otwórz ponownie”) dowiezione dla alertów importu w **P6.1** (`72-FEATURE-alerty-przejrzany-szukajka`). Pseudo-alerty katalogowe (silnik liczony z katalogu) dowiezione w **P6.2** (`77-FEATURE-pseudo-alerty-katalogowe`) jako zakładka „Katalog" na `/alerty`, obok „Import" — szczegóły w bloku niżej „CO DOWIOZŁA KARTA P6.2". |

**DECYZJE WDROŻENIOWE UŻYTKOWNIKA 2026-09-21 (karta P6.2) — wszystkie zgodnie z rekomendacją.**

**Ustalone i NIE będące decyzją — port 1:1, w wersji po łatkach z 4.09** (zmierzone na `origin/main`):
| Reguła | Warunek | Poziom | Identyfikator (po `ackalerts` pkt 1) |
|---|---|---|---|
| Marża ujemna — sprzedaż pod kosztem | `marzaPct < 0` | krytyczny | `${id}-marza-ujemna-${Math.round(marzaPct*10)/10}` |
| Bardzo niska marża | `marzaPct < 5` | ostrzeżenie | `${id}-marza-niska-…` (odcisk marży) |
| Nie-opona w katalogu — błąd parsera | `v2()`: `!isTire && confidence==="wysoka"` | krytyczny | `${id}-nie-opona-${nazwa+'|'+kategoria}` |
| Brak importu cennika | ≥ 30 dni / ≥ 7 dni | krytyczny / ostrzeżenie | `dostawca-${kod}-brak-importu-${dni}` |

Dwie reguły są w oryginale WYŁĄCZONE (`if (false)`: „Brak stanu magazynowego", „Znaki w rozmiarze sklejone
z nazwą") i takie zostają. `tr_fix` (usunięcie `"tr-"` z listy `h2`) wchodzi — bez niego opony BKT z `TR-135`
lądowały jako „nie-opona". Odcisk wartości w identyfikatorze sprawia, że potwierdzenie nie przykleja się do
alertu na zawsze: gdy wartość się zmieni, alert wraca jako `nowy`.

**Pięć decyzji:**
1. **Gdzie:** zakładki na `/alerty` — „Import" (dzisiejsza lista) i „Katalog" (pseudo-alerty). Odrzucone:
   osobna pozycja menu, jedna wspólna lista (mieszałaby błędy dostawców z problemami produktów).
2. **Status: na SERWERZE.** Świadome odstępstwo — oryginał trzyma go w IndexedDB. Powód identyczny jak przy
   decyzji D1 z I6: status w przeglądarce ginie po wyczyszczeniu historii i nie przenosi się między
   komputerami; dwie listy obok siebie, z których jedna pamięta decyzje, a druga nie, byłyby gorsze niż
   każda z opcji z osobna. Koszt: nowa tabela i trasa. Odciski wartości w identyfikatorach sprawiają,
   że stare wpisy statusu by się gromadziły — P6.2 rozwiązała to sprzątaniem przy zapisie
   („wypieranie + sierotki", Q2 niżej): zapis statusu kasuje wpisy tej samej pary
   (produkt/dostawca + reguła) z innym odciskiem, a każdy zapis dodatkowo kasuje wpisy produktów,
   których już nie ma w katalogu. Świadoma różnica z IndexedDB oryginału: powrót marży do
   DOKŁADNIE starej wartości daje status „nowy", nie stary zapamiętany status.
3. **Pulpit: OBA źródła, z podziałem.** Przy statusie na serwerze dwie łatki z 4.09 — „Pulpit respektuje
   potwierdzenia" (`ackalerts` pkt 2) i zdarzenie synchronizujące (pkt 3) — przychodzą bez dodatkowego
   mechanizmu, przez unieważnienie zapytań.
4. **Odwrócenie decyzji D3 z karty 13e:** ukrywanie rozwiązanych (`ackalerts` pkt 4) WCHODZI. D3 zapadła,
   gdy silnika w odbudowie nie było. Zbieżne z domyślnym filtrem „nierozwiązane" z P6.1 — obie listy
   zachowują się tak samo.
5. **Liczenie: w przeglądarce, jak w oryginale** — z warunkiem, że karta NAJPIERW zmierzy koszt na Pulpicie
   (jeśli dziś nie ładuje całego katalogu, przejście na (b) — trasa serwerowa — wraca do użytkownika).
   Zmierzone na `db/snapshot.db` (7405 produktów, Node 20, 30 biegów): port **25,3 ms** mediana
   (35,8 ms max) wobec **284,7 ms** oryginału wyciętego z bundla (oryginał buduje `new RegExp`
   dla 35 słów przy każdym produkcie, port raz) — nieodczuwalne, licznie w przeglądarce zostaje.

**⭐ DECYZJA ANI 2026-09-21 (runda 2, pytania 1a i 1b) — WPIS ZAMKNIĘTY NA TAK.**
Po pokazaniu jej WŁASNEGO zrzutu zamiast opisu mechanizmu pytanie trafiło od razu:
- **1a: „tak, potrzebuję jej w nowym Bridge"** — wariant (a). Lista ostrzeżeń liczonych na żywo
  z katalogu (ujemna marża, bardzo niska marża, „to nie jest opona") ma wrócić. Nie zamiast
  błędów importu — OBOK nich.
- **1b: „używam obu"** — czyli TRZECI STATUS `przejrzany` JEST POTRZEBNY. Oryginał ma trzy stany
  (`nowy` / `przejrzany` / `rozwiazany`) i dwa osobne przyciski („Oznacz jako przejrzany",
  „Rozwiąż"); odbudowa ma dziś dwa stany. To domyka lukę odnotowaną w bloku I13e roadmapy
  („trzeci status `przejrzany` istnieje w oryginale, nie w odbudowie — brak wpisu w backlogu").

**Zakres karty P6.2, wynikający wprost z tych dwóch odpowiedzi:** silnik pseudo-alertów liczony
z katalogu + trzeci status + dwa przyciski akcji. ⚠ To jedna z dwóch rzeczy, które Ania sama
nazwała mogącymi wstrzymać cutover („najpoważniejsza różnica z całego przeglądu"), więc karta
ma wejść PRZED przełączeniem produkcji.

**Trzeci status i przyciski już dowiezione dla alertów importu (P6.1).** Definicja statusów,
etykiety i reguła „jakie akcje przy jakim statusie” leżą we wspólnym module
`rebuild/frontend/src/pages/alerty/statusy.ts`, a komponent przycisków w
`pages/alerty/PrzyciskiStatusu.tsx` — P6.2 ma je zaimportować dla pseudo-alertów katalogowych
zamiast pisać drugą kopię reguły.

⚠ **Historia decyzji, warta zapamiętania jako metoda:** pierwsze pytanie („czy stare ostrzeżenia
marżowe są Ci potrzebne?") dostało odpowiedź „nie rozumiem, co to znaczy". Drugie, z jej własnym
zrzutem ekranu zamiast opisu mechanizmu, dostało jednoznaczne „tak". **Pytaj o to, co widzi,
nie o to, jak to działa.**

**STAN PO PYTANIU 12.2 (2026-09-21) — wpis otwarty, ale materiał dowodowy się poprawił.**
Na pytanie „czy stare ostrzeżenia marżowe są Ci potrzebne?" Ania odpowiedziała: „nie rozumiem,
co to znaczy stare ostrzeżenia marżowe i co tu chcesz zmieniać?". Pytanie było zadane jej
językiem opisu mechanizmu, a nie tym, co widzi na ekranie — i dlatego nie trafiło.

**Ale w odpowiedzi na inne pytanie (6.2) przysłała ZRZUT EKRANU produkcyjnych Alertów**, który
rozstrzyga, o co chodzi, lepiej niż nasz opis. Widać na nim:
- nagłówek: „Alerty · 0 krytycznych · 15 ostrzeżeń · **alerty wyliczane na żywo z katalogu**";
- filtry „Wszystkie poziomy" i „Wszystkie statusy" oraz akcję „Zaakceptuj wszystko";
- pozycje typu **„Bardzo niska marża"** z kodem produktu, dostawcą i `(marża 0.0%)`, odznaką
  `nowy` i akcjami **„Oznacz jako przejrzany"** i **„Rozwiąż"**.

Dwa wnioski: (1) na produkcji jest tych ostrzeżeń **15 i mają status `nowy`**, więc nie są
martwym ekranem; (2) potwierdza się trzeci status `przejrzany`, którego odbudowa nie ma
(odnotowany w bloku I13e roadmapy jako „brak wpisu w backlogu" — teraz ma go tutaj).

**Jak zapytać ponownie:** pokazać jej TEN zrzut i zapytać wprost, czy z tej listy korzysta
w codziennej pracy. Nie pytać o „mechanizm" ani o „pseudo-alerty".

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
katalogowe były wtedy porzucone na DWÓCH ekranach (`/alerty` i `/`) — P6.2 (niżej) wróciła
na oba.

**Doprecyzowanie z 13e (2026-09-09, `47-CHORE-i13e-frontend-bridgeone`).** Gdyby pseudo-alerty
kiedyś weszły, wchodzą OD RAZU w wersji **po łatkach Ani z 2026-09-04** (wpis #61), a nie
w wersji z deminifikatu — ten jest sprzed 04.09. To znaczy: `h2` bez tokenu `"tr-"` (regex
`\btr-\b` łapał `TR-135` w nazwach opon BKT), `id` alertu z odciskiem wartości (potwierdzenie
przestaje kleić się do alertu na zawsze), pulpit czytający zapisane statusy z IndexedDB
i podający je do `pv(produkty, statusy)` oraz ukrycie alertów `rozwiazany` poza filtrem
wybranym wprost. Dokładnie tę wersję (po łatkach `tr_fix`/`ackalerts`) sportowała P6.2.

**✅ CO DOWIOZŁA KARTA P6.2 (2026-09-21, `77-FEATURE-pseudo-alerty-katalogowe`).** Pseudo-alerty
katalogowe wróciły jako zakładka „Katalog" na `/alerty`, obok „Import" (P6.1); silnik to port
1:1 `v2()`/`pv()` z żywego bundla `origin/main` po łatkach `tr_fix`/`ackalerts`, zweryfikowany
jako **bajtowo identyczny** z oryginałem na całym `db/snapshot.db` (7405 produktów).
- **Status na serwerze** (odstępstwo od IndexedDB, decyzja 2): nowa tabela
  `alerty_katalogu_statusy` (migracja `008`; `007` zajęła równoległa karta 76/PR #92 — **PR.3 bierze `009`**) + trasa
  `GET/PUT /api/alerty-katalogu/statusy`.
- **Sprzątanie tabeli (Q2):** „wypieranie + sierotki" przy każdym zapisie — nowy zapis statusu
  kasuje wpisy tej samej pary (produkt/dostawca + reguła) z innym odciskiem wartości, a każdy
  zapis dodatkowo kasuje wpisy produktów, których już nie ma w `products`. Świadoma różnica:
  powrót marży do DOKŁADNIE starej wartości daje status „nowy", nie stary zapamiętany status.
- **Filtr statusu jak P6.1 (Q3):** „Nierozwiązane" domyślnie, „Wszystkie statusy" pokazuje też
  rozwiązane — zgodne z domyślnym widokiem oryginału (rozwiązane ukryte).
  **Odwrócenie D3 z 13e** (ukrywanie rozwiązanych, `ackalerts` pkt 4) — teraz WCHODZI.
- **„Otwórz ponownie" (Q4):** ten sam komponent co w zakładce Import; „nowy" = skasowanie wpisu
  statusu.
- **Pulpit (decyzja 3):** kafel „Aktywne alerty" sumuje `nowy` z OBU źródeł (import + katalog),
  „N krytycznych" liczone łącznie; karta „Najnowsze powiadomienia" ma dwie sekcje, „Import" i
  „Katalog"; synchronizacja przez `invalidateQueries`, bez `window.dispatchEvent`.
- **Pomiar kosztu liczenia w przeglądarce (decyzja 5):** na `db/snapshot.db` port liczy mediana
  **25,3 ms** (max 35,8 ms) wobec **284,7 ms** oryginału wyciętego z bundla — 11× szybciej
  (oryginał buduje `new RegExp` dla 35 słów przy każdym produkcie, port raz). Nieodczuwalne,
  licznie w przeglądarce zostaje bez przejścia na trasę serwerową.
- Szczegóły i dowody: `docs/tickets/77-FEATURE-pseudo-alerty-katalogowe/`.

---

### #27 · 2026-09-03 · [FRONTEND] · lista przewoźników i dzielników żyje wyłącznie w IndexedDB przeglądarki

> **Znalezione przy tickecie `18-FEATURE-waga-gabarytowa` (I9). Port 1:1** — decyzja D3
> (`docs/tickets/18-FEATURE-waga-gabarytowa/plan.md`).

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND+BACKEND (widok `/waga-gabarytowa`, edytor przewoźników) |
| **Pliki** | `deminified/frontend-index.js:9165-9193` (store IndexedDB, historyczny stan); **P9.1**: `rebuild/schema/007_waga_gab_przewoznicy.sql`, `rebuild/backend/src/repos/przewoznicy.ts`, `rebuild/backend/src/waga-gabarytowa/przewoznicy.ts`, `rebuild/backend/src/routes/waga-gabarytowa.ts`, `rebuild/frontend/src/pages/waga-gabarytowa/api.ts`, `pages/waga-gabarytowa/przewoznicy.ts` (bez `KLUCZ_PRZEWOZNICY`), `pages/waga-gabarytowa/TabelaPrzewoznikow.tsx`; nieczytany dalej: `rebuild/frontend/src/lib/magazynKV.ts` |
| **Do nowej wersji?** | ✅ **TAK — odstępstwo** (decyzja Ani 2026-09-18/21, pytanie 9.1 w `docs/pytania-do-ani-2026-09-18.md`, runda 2 — „każdy zalogowany") |
| **Status** | ✔ zrobione w rebuild, **P9.1**, ticket `76-FEATURE-przewoznicy-serwer-paletowy`, 2026-09-21 |

**POTWIERDZENIE ANI 2026-09-21 (runda 2, pytanie 3): wszystkie sześć dzielników bez poprawek.**
GEIS Polska 10 000 · DPD 6 000 · GLS 4 000 · InPost Kurier 5 000 · UPS 5 000 · DHL Parcel 5 000 —
przy każdym wpisała „zgadza się". Oba wiersze na dodatkowych przewoźników zostawiła puste, czyli
lista jest kompletna. Karta **P9.1** startuje z tymi wartościami jako seedem serwerowym.

**Co robi produkcja.** Edytor przewoźników i dzielników (dodawanie własnego, zmiana nazwy/
dzielnika per wiersz, usuwanie z blokadą „min. 1 przewoźnik", „Przywróć domyślne") trzyma
cały stan wyłącznie w IndexedDB przeglądarki (baza `bridge-store-v2`). Zmiany Ani nie
przenoszą się między urządzeniami i giną przy czyszczeniu danych witryny.

**Decyzja użytkownika (2026-09-03): port 1:1** — *zastąpiona* decyzją poniżej. Pierwotnie
odbudowa miała mieć to samo zachowanie (`magazynKV`, lokalny stan widoku); przeniesienie na
backend czekało jako „do rozważenia osobno".

**Decyzja Ani (2026-09-18/21, pytanie 9.1) — lista idzie na serwer, edytuje każdy zalogowany.**
**Co zrobiono w odbudowie (P9.1, ticket 76, 2026-09-21).** Tabela `waga_gab_przewoznicy`
(migracja `007`, seed sześciu przewoźników Ani, GEIS domyślny) + `GET`/`PUT
/api/waga-gabarytowa/przewoznicy` za `requireAuth`, z walidacją (`400`, m.in. niepusta lista,
unikalne `id`, dodatni `dzielnik`, najwyżej jeden `domyslny`) i audytem `edycja_przewoznikow`
(`przed`/`po` w `audit_log`). Widok czyta listę z API; usunięcie i „Przywróć domyślne" pytają
o potwierdzenie (`DialogPotwierdzenia`); zmiana nazwy/dzielnika zapisuje się po opuszczeniu
pola. Stary klucz `waga-gabarytowa-przewoznicy` w IndexedDB zostaje **nieczytany i niepisany** —
lokalne zmiany Ani z przeglądarki nie są importowane ani usuwane, po prostu przestają mieć
znaczenie. Szczegóły: `docs/tickets/76-FEATURE-przewoznicy-serwer-paletowy/`.
**Uzupełnienie (P9.1b, ticket 84, 2026-09-21) — domknięcie §3.11 Ani** („szczególnie gdy jest
aktualnie wybrany”). Usunięcie przewoźnika wybranego w tej przeglądarce pokazuje drugi, mocniejszy
wariant okna: tytuł „Usunąć wybranego przewoźnika?”, informację, że jest wybrany w kalkulatorze,
i bursztynową ramkę z nazwą następcy (pierwszy z pozostałych, jak dotąd). Zwykłe okno dla
niewybranych bez zmian. Pliki: `TabelaPrzewoznikow.tsx` (już na liście). Szczegóły:
`docs/tickets/84-FEATURE-usun-wybranego-przewoznika/`.

---

### #28 · 2026-09-03 · [BACKEND] · `POST /api/waga-gabarytowa/oblicz` nie ma konsumenta

> **Znalezione przy tickecie `18-FEATURE-waga-gabarytowa` (I9). Port 1:1** — decyzja D1
> (`docs/tickets/18-FEATURE-waga-gabarytowa/plan.md`).

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND+FRONTEND (endpoint kalkulatora paletowego + ekran) |
| **Pliki** | `deminified/backend-index.cjs:48749-48769`; port I9: `rebuild/backend/src/waga-gabarytowa/formula.ts`, `routes/waga-gabarytowa.ts` (bez zmian w P9.1); **P9.1**: `rebuild/frontend/src/pages/waga-gabarytowa/api.ts` (`obliczPaletowo`), `rebuild/frontend/src/pages/waga-gabarytowa/KalkulatorPaletowy.tsx` |
| **Do nowej wersji?** | ✅ **TAK — odstępstwo** (decyzja Ani 2026-09-21, pytanie 9.2 w `docs/pytania-do-ani-2026-09-18.md`, runda 2 — „Tak, przyda się") |
| **Status** | ✔ zrobione w rebuild, **P9.1**, ticket `76-FEATURE-przewoznicy-serwer-paletowy`, 2026-09-21 |

**DECYZJA ANI 2026-09-21 (pytanie 9.2): TAK.** Cytat: „Tak, przyda się". Kalkulator paletowy dostaje
ekran w panelu — świadome odstępstwo, bo w produkcji formuła istnieje, ale nie jest podpięta
pod żaden widok.
**Co robi produkcja.** Endpoint liczy wagę gabarytową wg formuły **paletowej/oponowej**
(progi półpalety/palety, sterowana configiem `waga_gab.*`), ale żaden fragment frontendu go
nie woła — widok `/waga-gabarytowa` liczy **innym, wolumetrycznym** wzorem, lokalnie,
z dzielnikiem per przewoźnik (patrz #27). Dwa merytorycznie różne kalkulatory pod tą samą
nazwą, oba odtworzone 1:1 w I9 (D1).

**Decyzja użytkownika (2026-09-03): dowieźć oba, bez podłączania FE do endpointu.** *Zastąpiona*
decyzją Ani poniżej — endpoint dostał konsumenta.

**Co zrobiono w odbudowie (P9.1, ticket 76, 2026-09-21).** Kalkulator paletowy doszedł jako
**druga sekcja** na `/waga-gabarytowa`, obok — nie zamiast — kalkulatora wolumetrycznego
(patrz #27). Formularz (szerokość/długość/wysokość w cm) woła `POST
/api/waga-gabarytowa/oblicz` bez zmian w handlerze i pokazuje pełny wynik (waga gabarytowa,
efektywna szerokość, wysokość z paletą, współczynnik, opis); nic z tego nie trafia do
IndexedDB. Trasa `/oblicz` i jej kontrakt zostały bez zmian.

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

> **✅ WDROŻONE 2026-09-22, ticket `90-FEATURE-ozywienie-kart-dostepnosci` (karta P10.1).** Poniżej
> zostaje historia decyzji; stan po wdrożeniu — patrz „Status" i „Co zrobiła odbudowa" niżej.
>
> **⭐ DECYZJA UŻYTKOWNIKA 2026-09-21: NAPRAWIĆ, bez indeksu unikalnego.** `bootstrap-current` nie dokłada
> migawki produktowi, który ma już migawkę z bieżącego dnia (`WHERE NOT EXISTS` per produkt/dzień).
> **Bez** unikalnego indeksu na `historia_cen` — zablokowałby on legalne zdublowane kody z jednego importu
> (źródło duplikatów z #33). Uzasadnienie: dopóki karty „Dostępności" były martwe (#32), dublowanie
> nie miało skutku; po ich ożywieniu jedno przypadkowe podwójne wywołanie zafałszuje historię, a naprawa
> jest tania. Test charakteryzacyjny „rośnie przy drugim wywołaniu" zmienia się świadomie.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (trasa analityki, tabela `historia_cen`) |
| **Pliki** | `mirror/backend/analytics_module.cjs:81-91` (handler, `INSERT … SELECT` bez `ON CONFLICT`); port: `rebuild/backend/src/repos/analityka.ts` (`zbudujSnapshotBiezacy`), `rebuild/backend/src/routes/analytics.ts` |
| **Do nowej wersji?** | ✅ **NAPRAWA — decyzja użytkownika 2026-09-21** (świadome odstępstwo, karta **P10.1**) |
| **Iteracja** | odtworzone 1:1 w **10a**; naprawione w **P10.1** (`90-FEATURE-ozywienie-kart-dostepnosci`); trasa świadomie bez przycisku w UI (decyzja D4, `docs/tickets/19-FEATURE-analityka-fundament/plan.md`) |
| **Status** | ✔ **naprawione w rebuild 2026-09-22**, ticket `90-FEATURE-ozywienie-kart-dostepnosci` (karta P10.1) · w produkcji **nadal obecne** |

**Co robi produkcja.** Handler robi `INSERT INTO historia_cen (…) SELECT … FROM products
WHERE status='aktywny'` bez żadnego `ON CONFLICT`/`WHERE NOT EXISTS`. Każde wywołanie dokłada
po jednym wierszu `historia_cen` na każdy aktywny produkt, niezależnie od tego, czy migawka
z tego dnia już istnieje — dwa wywołania pod rząd dublują całą partię.

**Skutek.** Statystyki liczone z `historia_cen` (snapshoty, zakres dat) rosną liniowo z liczbą
wywołań, nie z liczbą realnych zdarzeń cenowych. Oryginalny frontend nigdy nie woła tej trasy
(grep `bootstrap` po `frontend-index.js` — zero trafień), więc w produkcji ryzyko jest dziś
teoretyczne — uruchamia się ją tylko ręcznie/skryptem.

**Co zrobiła odbudowa (do 10a).** Port 1:1, nieidempotentność udokumentowana w nagłówku funkcji
i pokryta testem charakteryzacyjnym (`bootstrap-current` zwraca `inserted` równe liczbie
aktywnych produktów i rośnie przy drugim wywołaniu). Trasa przechodzi GATE (openapi + 401 +
test jednostkowy), ale świadomie nie dostała przycisku w UI, żeby nikt nie kliknął jej dwa razy.

**Naprawa wdrożona w P10.1 (2026-09-22).** `zbudujSnapshotBiezacy`: `INSERT … SELECT … WHERE
status='aktywny' AND id NOT IN (SELECT produkt_id FROM historia_cen WHERE produkt_id IS NOT NULL
AND substr(zarejestrowano_at, 1, 10) = <dzień UTC>)`. „Ten sam dzień" = dzień kalendarzowy **UTC**
z prefiksu `YYYY-MM-DD` znacznika (100% danych snapshotu to ISO-UTC; ten sam `substr` tnie daty
gdzie indziej w analityce). Konsekwencja: dzień kończy się o 01:00 (zima) / 02:00 (lato) czasu
polskiego. Obejmuje migawki obu pisarzy (bootstrap i auto-zatwierdzanie importu). `NOT IN` +
`IS NOT NULL`, bo `NOT IN` z `NULL` w liście daje pusty wynik. Bez indeksu unikalnego, bez
migracji, kształt `{ok, inserted, at}` bez zmian. Pomiar na `db/snapshot.db`: pierwsze wywołanie
`inserted = 6898`, drugie tego samego dnia `inserted = 0`. Szczegóły:
`docs/tickets/90-FEATURE-ozywienie-kart-dostepnosci/raport.md`.

**Powiązanie z #32/#33.** Inny błąd tej samej tabeli `historia_cen`, niezależny od tego wpisu:
`INSERT` powyżej nie odwołuje się do kolumny `nazwa` (jej też nie ma w `historia_cen`), więc
naprawa #32 na ten insert nie wpływa. Trzy wpisy dotyczą tej samej tabeli, ale trzech osobnych
usterek — nie scalać.

---

### #32 · 2026-09-04 · [BACKEND] · `historia_cen` NIE MA kolumny `nazwa` — obie karty „Dostępności" są trwale puste

> **✅ WDROŻONE 2026-09-22, ticket `90-FEATURE-ozywienie-kart-dostepnosci` (karta P10.1).** Poniżej
> zostaje historia decyzji; stan po wdrożeniu — patrz „Status" i „Co zrobiła odbudowa" niżej.
>
> **⭐ WARIANT NAPRAWY — decyzja użytkownika 2026-09-21: (a), z doprecyzowaniem.** Nazwa dociągana
> z katalogu (`LEFT JOIN products`), łączenie po parze **`dostawca` + `kod`**, nie po samym kodzie — ten sam
> kod może występować u dwóch dostawców. Dla pozycji usuniętej z katalogu nazwa pusta (w widoku kreska).
> Odrzucone: (b) — kolumna „Nazwa" pusta dla wszystkich; (c) — migracja, a 15 597 historycznych migawek
> i tak zostałoby bez nazwy. Dotyczy dashboardu (`repos/analityka.ts`) ORAZ dwóch widoków eksportu
> (`repos/analityka-eksport.ts`). Karta **P10.1**, razem z #33 (naprawa #32 go odsłania).

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (dwie trasy analityki, tabela `historia_cen`) |
| **Pliki** | `mirror/backend/analytics_module.cjs:161` (`availability/products`), `:176` (`availability/sell-through`), `:316-317` (te same dwa widoki eksportu); schemat: `db/schema.sql`, `rebuild/schema/001_schema.sql`, `analytics_module.cjs:24-49` (`ensureSchema`); port: `rebuild/backend/src/repos/analityka.ts` (dashboard), `rebuild/backend/src/repos/analityka-eksport.ts` (eksport CSV) |
| **Do nowej wersji?** | ✅ **NAPRAWA ZATWIERDZONA — decyzja Ani 2026-09-21** (świadome odstępstwo) |
| **Iteracja** | odtworzone 1:1 w **10e** (dashboard, `docs/tickets/25-FEATURE-analityka-dostepnosc-rotacja/`) i **10f** (eksport CSV, `docs/tickets/26-FEATURE-analityka-export-pulpit/`); naprawione w **P10.1** (`90-FEATURE-ozywienie-kart-dostepnosci`) |
| **Status** | ✔ **naprawione w rebuild 2026-09-22**, ticket `90-FEATURE-ozywienie-kart-dostepnosci` (karta P10.1) · w produkcji **nadal obecne** |

**DECYZJA ANI 2026-09-21 (pytanie 10.1): TAK.** Cytat: „tak chcę, żeby zaczęły działać". Naprawa ożywia
naraz dwie karty zakładki „Dostępność", dwa eksporty CSV (dziś sam BOM) i ODSŁANIA #33, dziś
zamaskowane. Kolejność: #32 przed #33.
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

**Co zrobiła odbudowa (do 10e/10f).** Port 1:1, łącznie z portem `safeAll` (`bezpiecznieWiersze`
w `repos/analityka.ts`), żeby zachowanie było identyczne z produkcją zamiast dawać 500.
Zamrożone dwoma testami charakteryzacyjnymi backendu i jednym testem widoku — gdyby te trasy
kiedyś zaczęły zwracać wiersze, testy o tym powiedzą. **Blok 10f odtworzył tę samą wadę**
w dwóch widokach eksportu CSV (`export/availability-products`, `export/sell-through`, port
w `repos/analityka-eksport.ts`) — oba oddają sam znacznik BOM mimo danych w `historia_cen`,
zamrożone `test/analityka.eksport.agregaty.test.ts` (poziom repo) i
`test/analityka.eksport.gate.test.ts` (przez HTTP).

**Naprawa wdrożona w P10.1 (2026-09-22).** Wariant (a): `LEFT JOIN products p ON p.dostawca =
h.dostawca AND p.kod = h.kod` (łączenie po PARZE, nie po samym kodzie — ten sam kod może
występować u dwóch dostawców), `MAX(p.nazwa)` w dashboardzie i eksporcie `sell-through`,
`p.nazwa` w `GROUP BY` eksportu `availability-products` (zachowuje grupowanie oryginału po
`ean`). Pozycja usunięta z katalogu → `nazwa: null` (JSON) / pusta komórka (CSV), w widoku „—"
(istniejące `formatuj()`). Pomiar na `db/snapshot.db` (kopia produkcji 2026-08-13; `historia_cen`
14 513 wierszy w chwili pomiaru): karta 4.1 500/500 wierszy (bez limitu 5 184, 254 z `nazwa: null`,
22,7 ms), karta 4.2 500/500 (bez limitu 5 184, 119 z `nazwa: null`, 54,7 ms), eksport
`availability-products` 5000/5000 (bez limitu 5 193, 36,1 ms), eksport `sell-through` 5000/5000
(bez limitu 5 184, 56,6 ms). 1 897 par `(dostawca, kod)` z historii nie ma już w katalogu → pusta
nazwa. Fixtures (`GET_analytics_availability_*`, nagrania z `rows: []`) świadomie NIETKNIĘTE —
rozjazd w treści to zatwierdzone odstępstwo, `gate/ksztalt.ts` nie zagląda do elementów tablicy
pustej we wzorcu. Szczegóły: `docs/tickets/90-FEATURE-ozywienie-kart-dostepnosci/raport.md`.

---

### #33 · 2026-09-04 · [BACKEND] · `sell-through`: funkcja okna liczona PO niepełnym `GROUP BY` — wynik niedeterministyczny przy duplikacie

> **✅ WDROŻONE 2026-09-22, ticket `90-FEATURE-ozywienie-kart-dostepnosci` (karta P10.1).** Poniżej
> zostaje historia decyzji; stan po wdrożeniu — patrz „Status" i „Co zrobiła odbudowa" niżej.
>
> **⭐ DECYZJA UŻYTKOWNIKA 2026-09-21: NAPRAWIĆ razem z #32.** Najpierw CTE zwijające duplikaty klucza
> `(dostawca, kod, zarejestrowano_at)`, dopiero na nim `LAG`. **Z duplikatów bierzemy wiersz OSTATNI
> WPISANY** (`MAX(id)`) — ten, który po imporcie zostaje w katalogu, więc karta mówi to samo co katalog.
> ⚠ Warunek: karta P10.1 MIERZY przed kodem, co import zostawia w `products` przy zdublowanym kodzie
> w jednym cenniku; jeśli wygrywa pierwszy wiersz, a nie ostatni — wraca z pytaniem. Uzasadnienie:
> Ania prosiła, żeby karty działały; bez tej poprawki ożywiona karta pokazywałaby czasem przypadkowe liczby.
> Dotyczy dashboardu i widoku eksportu `sell-through`.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (trasa analityki, poprawność SQL) |
| **Pliki** | `mirror/backend/analytics_module.cjs:175-179` (dashboard), `:317` (widok eksportu `sell-through`); port: `rebuild/backend/src/repos/analityka.ts` (`tempoSchodzenia`), `rebuild/backend/src/repos/analityka-eksport.ts` (eksport); źródło duplikatu: `rebuild/backend/src/import/tk.ts:171,548-564` |
| **Do nowej wersji?** | ✅ **NAPRAWA — decyzja użytkownika 2026-09-21** (świadome odstępstwo, karta **P10.1**, razem z #32) |
| **Iteracja** | odtworzone 1:1 w **10e** (`docs/tickets/25-FEATURE-analityka-dostepnosc-rotacja/`); naprawione w **P10.1** (`90-FEATURE-ozywienie-kart-dostepnosci`) |
| **Status** | ✔ **naprawione w rebuild 2026-09-22**, ticket `90-FEATURE-ozywienie-kart-dostepnosci` (karta P10.1) · w produkcji **nadal obecne** |

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

**Dlaczego to do 10e/10f nie bolało.** Zapytanie i tak nigdy nie dobiegało do końca — wywracało się
wcześniej na `MAX(nazwa)` (wpis **#32**). Naprawa #32 w P10.1 to **odsłoniła** — obie sprawy były
rozstrzygane i wdrożone razem, w tej kolejności (#32 przed #33).

**Co zrobiła odbudowa (do 10e/10f).** Port 1:1 z komentarzem opisującym pułapkę i testem
charakteryzacyjnym, który zamraża realny efekt (pusta lista mimo danych do policzenia).
To samo dotyczy widoku eksportu `export/sell-through` (port w `repos/analityka-eksport.ts`,
blok **10f**) — tam też dziś zamaskowane przez #32.

**Naprawa wdrożona w P10.1 (2026-09-22).** Wspólne CTE `zwiniete`
(`HISTORIA_BEZ_DUPLIKATOW_KLUCZA` w `repos/analityka.ts`): z każdej grupy `(dostawca, kod,
zarejestrowano_at)` bierze wiersz o `MAX(id)`, dopiero na nim liczy się `LAG`. Jeden fragment
SQL, używany przez dashboard (`tempoSchodzenia`) i eksport `sell-through` — karta 4.1 i eksport
`availability-products` liczą dalej `COUNT(*)` po surowej historii (decyzja #33 ich nie obejmuje,
odnotowane jako follow-up w raporcie karty).
Na snapshocie `db/snapshot.db` (kopia produkcji 2026-08-13): **30 grup duplikatów klucza,
67 wierszy** (na 14 513 wierszy `historia_cen`); zwinięcie nie zmienia żadnej z 5 184 sum
`sell-through` na tym snapshocie (duplikaty mają tam równe stany), ale bez niego wynik zależałby
od implementacji SQLite.
**Który wiersz zostaje w `products` przy duplikacie z prawdziwego importu (pomiar przed kodem,
warunek z decyzji 2026-09-21):** silnik importu (`import/tk.ts`) wczytuje katalog raz i nie
mutuje go — każda linia cennika liczy `autoPatch` względem stanu SPRZED importu. Test na
prawdziwym silniku (dwie linie tego samego kodu w jednym cenniku, obie różne od katalogu):
w `products` zostaje linia **OSTATNIA**, `historia_cen` dostaje dwa wiersze o tym samym kluczu,
`MAX(id)` daje stan linii ostatniej — zgodne z decyzją, warunek stopu nie zaszedł. Niuans
przypadku mieszanego (ostatnia linia ma `stan` równy stanowi sprzed importu, ale inną cenę):
`stan` nie wchodzi do jej `autoPatch`, więc katalog zachowuje `stan` linii WCZEŚNIEJSZEJ, a
`MAX(id)` daje stan linii ostatniej — w tym jednym przypadku karta i katalog się rozjeżdżają na
polu `stan`. Poza zakresem P10.1 (import tylko czytany) — follow-up dla karty importu. Szczegóły:
`docs/tickets/90-FEATURE-ozywienie-kart-dostepnosci/raport.md`.

---

### #34 · 2026-09-04 · [FRONTEND] · kafel „Ostatni eksport CSV" na Pulpicie jest TRWALE MARTWY — naprawiony w P10.2

> **✅ WDROŻONE 2026-09-22, ticket `96-FEATURE-kafel-ostatni-eksport` (karta P10.2).** Poniżej
> zostaje historia decyzji; stan po wdrożeniu — patrz „Status" i „Naprawa wdrożona w P10.2" niżej.

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (widok `/`, Pulpit) |
| **Pliki** | `deminified/frontend-index.js:16852` (`N2`); `contract/fixtures/GET_history.json`; nagłówek `rebuild/backend/src/routes/history.ts`; port: `rebuild/frontend/src/pages/pulpit/kpi.ts` (`opisKafelkaEksportu`, dawniej `ostatniEksport`/`ostatniImport`) |
| **Do nowej wersji?** | ✅ **NAPRAWA ZATWIERDZONA — decyzja Ani 2026-09-21** (świadome odstępstwo, karta **P10.2**) |
| **Iteracja** | odtworzone 1:1 w **10f** (`docs/tickets/26-FEATURE-analityka-export-pulpit/`, decyzja D3); naprawione w **P10.2** (`96-FEATURE-kafel-ostatni-eksport`) |
| **Status** | ✔ **naprawione w rebuild 2026-09-22**, ticket `96-FEATURE-kafel-ostatni-eksport` (karta P10.2) · w produkcji **nadal obecne** |

**DECYZJA ANI 2026-09-21 (pytanie 10.2): wariant (a).** Cytat: „niech zacznie pokazywać datę".
Odrzucone: usunięcie kafla z Pulpitu i zostawienie go martwym.
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

**Naprawa wdrożona w P10.2 (2026-09-22).** Kafel czyta dwa zapytania
`GET /api/history/paged?typ=eksport|import&page=1&limit=1` (`useOstatniWpisHistorii(typ)` w
`pages/pulpit/api.ts`, adres przez `adresStrony()` — DRY z widokiem Historii), z
`refetchOnMount: "always"` (obchodzi `staleTime: Infinity`). Pulpit przestał wołać
`GET /api/history`. Kafel pokazuje datę względną i „<dostawca|wszyscy> — N produktów"; bez
eksportu — „—" + „Ostatni import: <data>"; bez obu — „Brak eksportów ani importów"; błąd
zapytania — „Nie udało się pobrać historii". Liczy się to, co Historia (`SLOWNIK_AKCJI`,
nie poszerzany) — CSV dla Selly nie liczy się, `import_pliku`/`import_z_url` też nie (#21 ❌).
Backend i `contract/` nietknięte. Szczegóły:
`docs/tickets/96-FEATURE-kafel-ostatni-eksport/raport.md`.

---

### #35 · 2026-09-04 · [BACKEND] · `Content-Disposition` w eksporcie CSV bierze `{view}` bez sanityzacji

> **✅ WDROŻONE 2026-09-22, ticket `90-FEATURE-ozywienie-kart-dostepnosci` (karta P10.1).** Poniżej
> zostaje historia decyzji; stan po wdrożeniu — patrz „Status" i „Co zrobiła odbudowa" niżej.
>
> **⭐ DECYZJA UŻYTKOWNIKA 2026-09-21: lista znanych widoków, reszta 404.** `{view}` spoza listy widoków
> eksportu dostaje 404 zamiast dzisiejszego `200` z samym BOM. Świadomie zmienia port `return sendRows([])`
> (`:321`). Uzasadnienie: frontend nigdy nie woła nieznanych widoków, więc nikt tego nie odczuje, a „200 i pusty
> plik" to dokładnie ta pułapka, przez którą #32 przeleżało niezauważone. Zmiana kodu odpowiedzi →
> aktualizacja `contract/openapi.yaml`. Karta **P10.1**.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (trasa `GET /api/analytics/export/:view`) |
| **Pliki** | `mirror/backend/analytics_module.cjs:308` (nagłówek), `:321` (nieznany widok → `sendRows([])`); port: `rebuild/backend/src/routes/analytics.ts:324-335` |
| **Do nowej wersji?** | ✅ **NAPRAWA — decyzja użytkownika 2026-09-21** (świadome odstępstwo, karta **P10.1**) |
| **Iteracja** | odtworzone 1:1 w **10f** (`docs/tickets/26-FEATURE-analityka-export-pulpit/`); naprawione w **P10.1** (`90-FEATURE-ozywienie-kart-dostepnosci`) |
| **Status** | ✔ **naprawione w rebuild 2026-09-22**, ticket `90-FEATURE-ozywienie-kart-dostepnosci` (karta P10.1) · w produkcji **nadal obecne** |

**Co robi produkcja.** `analytics_module.cjs:308`:
``res.setHeader('Content-Disposition', `attachment; filename=${view}.csv`)`` — `view` pochodzi
wprost z `req.params`, bez cudzysłowów i bez `filename*`.

**Skutek.** Node odrzuca wartość nagłówka ze znakiem sterującym, więc `{view}` z `\n` kończy
w `catch` jako 500 (nie jako wstrzyknięcie nagłówka) — ale nazwa pliku nadal przyjmuje dowolny
„legalny" napis.

**Co zrobiła odbudowa (do 10f).** Port 1:1 w `routes/analytics.ts`, bez sanityzacji, z komentarzem
w kodzie.

**Naprawa wdrożona w P10.1 (2026-09-22).** `widokEksportu(nazwa)` w `repos/analityka-eksport.ts`
(`Object.hasOwn` na `WIDOKI_EKSPORTU` — jedno źródło prawdy, zamiast osobnej listy dozwolonych
nazw); nieznany widok → `404 {error}` zamiast `200` z samym BOM; `filename` składany wyłącznie
z nazwy już zwalidowanej jako klucz mapy (bez sanityzacji nagłówka — poza zakresem, `{view}` nie
trafia tam już nieznany). `openapi.yaml` ma `404` dla `/api/analytics/export/{view}`, oznaczony
jako odstępstwo P10.1; generator `--sprawdz` czysty. Uboczny efekt: jako klucz zwykłego literału
obiektu, `WIDOKI_EKSPORTU` przyjmowałoby też `toString`/`constructor` z prototypu —
`Object.hasOwn` odcina i ten przypadek. Szczegóły:
`docs/tickets/90-FEATURE-ozywienie-kart-dostepnosci/raport.md`.

---

### #36 · 2026-09-04 · [FRONTEND] · niejednolite renderowanie `AppShell` w widokach odbudowy

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (regresja wierności wobec oryginału, nie tylko architektura odbudowy) |
| **Pliki** | renderują `AppShell`: `rebuild/frontend/src/pages/{Pulpit,Konfiguracja,Atrybuty,Selly,MojeKonto}.tsx` (`MojeKonto.tsx` od I12/12b); NIE renderują: `Katalog.tsx`, `Staging.tsx`, `Historia.tsx`, `Narzuty.tsx`, `Alerty.tsx`, `WagaGabarytowa.tsx`, `Analityka.tsx`; `App.tsx` (routing bez wspólnego layoutu wokół `<Switch>`); `WidokWPrzygotowaniu.tsx` USUNIĘTY w 12b (ostatni placeholder zniknął); oryginał: `deminified/frontend-index.js:16329` (`mn()`, sidebar+topbar) |
| **Do nowej wersji?** | ✅ TAK — **NAPRAWIONE** (39-CHORE…, D1) |
| **Status** | ✔ zrobione w rebuild (12e) |

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

**Rozstrzygnięcie 12e (2026-09-08).** `AppShell` przeniesiony z widoków do routera
(`App.tsx`, tabela `TRASY_Z_RAMA`) — sidebar renderuje się na wszystkich 12 trasach
zalogowanego, `/login` i 404 zostają bez niego, jak w oryginale. Zdjęto `<AppShell>` z pięciu
widoków, siedem dostało ramę z routera; `test/shell.test.tsx` sprawdza obecność sidebara na
każdej z 12 tras i jego brak na `/login` i 404. **Nie była to wyłącznie regresja wizualna:**
`useWirtualizacja` (`pages/katalog/wirtualizacja.ts`) wychodzi z `useEffect`, gdy nie znajdzie
`#$vMainScroll` — element, który mieszka w `AppShell`. Brak ramy na `/katalog` oznaczał więc,
że wirtualizacja katalogu była martwa także w przeglądarce (widoczne dopiero przy rozmiarze
strony „Wszystkie", powyżej progu 150 wierszy — dlatego niezauważone wcześniej). Naprawa ramy
to odblokowała. Szczegóły: `docs/tickets/39-CHORE-audyt-bezpieczenstwa-domkniecie/raport.md`.

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
| **Do nowej wersji?** | ✅ **NAPRAWA ZATWIERDZONA — decyzja Ani 2026-09-21** (świadome odstępstwo) |
| **Iteracja** | odtworzone 1:1 w **7a** (`docs/tickets/29-FEATURE-atrybuty-backend/`, decyzja D4); naprawione w **74** (`docs/tickets/74-FEATURE-slad-kolejki-atrybutow/`) |
| **Status** | ✔ **zrealizowane w rebuild (ticket 74, 2026-09-21)** · w produkcji **nadal obecne** · skutek widoczny dla Ani opisany w `docs/instrukcja-testow-I7.md` §4 pkt 7 (sprostowanie zaplanowane, karta P7.4) |

**DECYZJA ANI 2026-09-21 (pytanie 7.1): TAK.** Cytat: „tak, ma zostawiać ślad w historii". Akcje kolejki
atrybutów („Edytuj" i alias), które przepisują pole w setkach produktów naraz, mają zostawiać wpis
w Historii. Zgodne z rekomendacją: operacja jest nieodwracalna i szeroka.
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

**Co zrobiła odbudowa (7a, stan sprzed ticketu 74).** Port 1:1 (D4): `routes/atrybuty.ts` wołał
`audytuj()` wyłącznie przy sześciu trasach CRUD słownika, kolejka pending nie logowała nic.

**Co zrobiła odbudowa (ticket 74, 2026-09-21).** Sześć tras kolejki (`akceptuj`,
`akceptuj-z-edycja`, `akceptuj-jako-alias`, `odrzuc`, `DELETE /api/atrybuty/pending`,
`POST /api/atrybuty/scan-pending`) woła `audytuj()` po udanej operacji, poza transakcją repo —
akcje `atrybut_pending_zaakceptowano`, `_zaakceptowano_z_edycja`, `_zaakceptowano_jako_alias`,
`_odrzucono`, `_wyczyszczono`, `_skanowano`. W widoku Historii (`GET /api/history/paged`) są
widoczne TYLKO dwie z nich — akceptacja z edycją i alias, czyli te, które przepisują produkty —
zmapowane na istniejący typ `edycja`: `liczbaPozycji` = realna liczba przepisanych produktów
(`produktow_zaktualizowano`), `kodProduktu` = `kolumna: „stara" → „nowa"`, `zmienionePola` =
`["kolumna (alias|edycja z kolejki)"]`, a `uwagi` (nierysowane we froncie, ale łapane przez
wyszukiwarkę) opisuje operację pełnym zdaniem. Pozostałe cztery akcje są tylko w `audit_log`
(`GET /api/audit-log`). Dopisanie tych dwóch akcji do `SLOWNIK_AKCJI` jest wprost odstępstwem
z decyzji Ani (7.1) — przy porcie widoku Historii (ticket 15, D2) świadomie tego nie robiono;
**#21** dotyczy innych akcji (importów z URL, ręcznej synchronizacji), nie kolejki atrybutów.
Druga decyzja użytkownika (2026-09-21, „mapowanie dla 2 akcji"): zmiana `naWpisHistorii()` jest
konieczna właśnie dla tych dwóch akcji — bez niej wiersz Historii pokazywałby „Pozycji: 1"
zamiast realnej liczby przepisanych produktów. Szczegóły: `docs/tickets/74-FEATURE-slad-kolejki-atrybutow/plan.md` (D1, D2).

**Rozstrzygnięte (decyzja Ani 2026-09-21, wdrożone w tickecie 74).** Audyt akcji kolejki
(`atrybut_pending_*`, z liczbą przepisanych produktów w szczegółach) dołożony, jak opisano wyżej.

**Uzupełnienie 7b.** Sesja frontendowa nie naprawiła luki (poza zakresem), ale UI ostrzega
przed masowym `UPDATE products`: dialogi „Akceptuj z edycją" i „jako alias" pokazują liczbę
produktów, których dotknie zmiana (`GET /api/atrybuty/uzycie` → `count`), a toast po sukcesie
podaje `produktow_zaktualizowano`. To nie zastępuje wpisu w dzienniku.
**Tekst ostrzeżenia w UI zgadza się już ze śladem w Historii (ticket 81, 2026-09-21):** zamiast
„…akcje kolejki nie trafiają do audytu” oba okienka mówią „Operacji nie da się cofnąć. Zostanie po
niej wpis w Historii (typ „edycja”).”

---

### #40 · 2026-09-04 · [BACKEND] · seed słownika `bieznik` bierze wartości z `products.model`, nie z `products.bieznik`

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (seed słownika atrybutów, uruchamiany przy każdym starcie procesu) |
| **Pliki** | `mirror/backend/atrybuty_module.cjs:79-83` (`SELECT DISTINCT model` → `insWartosc('bieznik', …)`), `:75-78` (analogiczny, poprawny seed marki), `:99` (`seed(db)` przy rejestracji modułu); `rebuild/schema/001_schema.sql:53` (`products.bieznik TEXT` istnieje); dowód skutku: `contract/fixtures/GET_atrybuty_pending.json`; port: `rebuild/backend/src/repos/atrybuty.ts:355` (`zasiejSlownikAtrybutow`) |
| **Do nowej wersji?** | ✅ **NAPRAWA ZATWIERDZONA — decyzja Ani 2026-09-21** (świadome odstępstwo) |
| **Iteracja** | odtworzone 1:1 w **7a** (`docs/tickets/29-FEATURE-atrybuty-backend/`, decyzja D1); naprawione w **78** (`docs/tickets/78-FEATURE-seed-bieznikow-podobienstwo/`) |
| **Status** | ✔ **zrealizowane w rebuild (ticket 78, 2026-09-21)** — sprzątanie kolejki (D1) + seed `bieznik` z `products.bieznik` (D5) · w produkcji **nadal obecne** · skutek widoczny dla Ani opisany w `docs/instrukcja-testow-I7.md` §4 pkt 1 (sprostowanie instrukcji: P7.4, follow-up) |

**DECYZJA ANI 2026-09-21 (pytanie 7.2): TAK.** Cytat: „tak, przeszkadza mi to". Pozycje kolejki
podpowiadające same siebie ze 100% mają zniknąć — seed słownika `bieznik` idzie dziś z
`products.model` zamiast z `products.bieznik`.
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

**Co zrobiła odbudowa (7a, stan sprzed ticketu 78).** Port 1:1, z komentarzem w `repos/atrybuty.ts`
opisującym quirk i jego ślad w fixture.

**Do decyzji (stan sprzed ticketu 78).** Czy przestawić seed na `products.bieznik`. Ryzyko: zawartość słownika `bieznik`
rozjedzie się z produkcją (wypadną z niego nazwy modeli, dojdą realne bieżniki), a to zmienia
wyniki `scan-pending`, listę sugerowanych aliasów i zamrożony `GET_atrybuty_pending.json` —
czyli wymaga przenagrania fixture'a. Sprzątanie samego objawu (usuwanie z kolejki pozycji
obecnych już w słowniku) to osobna, mniejsza zmiana.

**Uzupełnienie 7b.** Skutek jest teraz widoczny NA EKRANIE, nie tylko w fixture: w kolejce
pending pozycja „AGRI STAR II" dostaje self-match z `podobienstwo: 100` (widać w
`contract/fixtures/GET_atrybuty_pending.json` i w widoku `/atrybuty` → panel „Do akceptacji"),
bo wartość zasiana z `model` trafia do słownika `bieznik`.

**Uzupełnienie P7.3 (ticket 75, 2026-09-21) — zasięg objawu zmierzony.** Na kopii snapshotu
437 z 500 pozycji kolejki podpowiada samą siebie jako pierwszą sugestię: `bieznik` 242, `rozmiar` 99,
`marka` 68, `indeks_nosnosci` 27, `konstrukcja` 1. Przestawienie seedu na `products.bieznik`
obejmuje co najwyżej 72 z nich (`bieznik` z `origin = 'catalog'`). Reszta to `origin = 'user'`
(236 — wartość domyślna kolumny, nie dowód ręcznego dodania) albo rodzaje spoza seedu z `model`.
Objaw zniknie dopiero po „sprzątaniu samego objawu” z akapitu „Do decyzji”. Skutek uboczny: alias
na samą siebie pokazuje w ostrzeżeniu i w toaście N produktów, choć nic się nie zmienia. Szczegóły:
`docs/tickets/75-CHORE-niezmiennik-atrybutow/raport.md`. **Korekta (ticket 78):** „437 z 500” to
snapshot po skanie; kopia `db/snapshot.db` ma 498 pozycji przed skanem, 500 dopiero po nim
(skan dokłada 2 pozycje `konstrukcja`).

**Rozstrzygnięte (decyzja Ani 2026-09-21, wdrożone w tickecie 78).** Sprzątanie kolejki (D1):
pozycja obecna dosłownie w słowniku tego samego rodzaju jest usuwana na końcu każdego skanu
i przy starcie procesu zaraz po seedzie; reguła sugestii nigdy nie proponuje napisu identycznego
z pozycją. Seed `bieznik` (D5) bierze `SELECT DISTINCT bieznik FROM products` zamiast `model`.
Pomiar zanieczyszczenia słownika `bieznik` (D3, `docs/tickets/78-FEATURE-seed-bieznikow-podobienstwo/raport.md`):
1665 wartości, 1660 w obu kolumnach (`model` i `bieznik`), 3 tylko w `bieznik`, 0 tylko w `model`,
2 w żadnej, 13 wartości obecnych tylko w `model` nieobecnych w słowniku, 17 z 7405 produktów mają
`model ≠ bieznik`, 0 wpisów `atrybut_wartosc_dodano` w `audit_log` — decyzja: istniejących
wartości słownika nie usuwać, bez migracji (zmiana seedu działa tylko na przyszłość). Fixture
`GET_atrybuty_pending.json` (D2) zostaje bez zmian — nagranie produkcji, nienagrywalne lokalnie
(moduły `atrybuty`/`pending` mają zahardkodowane ścieżki produkcyjne), gate go sprawdza tylko
kształtem.
**Skutek na snapshocie:** kolejka 498 → 61 po starcie procesu (bieznik 296→54, rozmiar 99→0,
marka 68→0, indeks_nosnosci 27→0, kategoria 7→7, konstrukcja 1→0); po pierwszym skanie 63
(skan dokłada 2 nowe pozycje `konstrukcja`, niezwiązane ze sprzątaniem).
**Świadoma konsekwencja:** marki i bieżniki z katalogu wychodzą z kolejki po najbliższym
restarcie procesu (seed „akceptuje” wszystko, co już jest w `products`) — to semantyka seedu
z produkcji, dotąd ukryta pod self-matchem. Szczegóły:
`docs/tickets/78-FEATURE-seed-bieznikow-podobienstwo/`.

---

### #41 · 2026-09-04 · [BACKEND] · dwie rozjeżdżone mapy rodzaj→kolumna (15 vs 13) — pozycji pending rodzaju `model`/`zastosowanie` nie dałoby się zaakceptować

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (mapowanie atrybut → kolumna `products`) |
| **Pliki** | `mirror/backend/atrybuty_module.cjs:251-267` (`RODZAJ_KOLUMNA`, 15 pozycji — `liczniki` i `uzycie`), `mirror/backend/pending_module.cjs:22-36` (`RODZAJE_KOLUMNY`, 13 pozycji — skan i akceptacje), `:283-284` i `:326-327` (400 „Nieznany rodzaj"); port: `rebuild/backend/src/repos/atrybuty.ts:49` i `rebuild/backend/src/repos/atrybuty-pending.ts:25` |
| **Do nowej wersji?** | ✅ **NAPRAWA ZATWIERDZONA — decyzja Ani 2026-09-21** (świadome odstępstwo) |
| **Iteracja** | odtworzone 1:1 w **7a** (`docs/tickets/29-FEATURE-atrybuty-backend/`, decyzja D6); naprawione w **74** (`docs/tickets/74-FEATURE-slad-kolejki-atrybutow/`) |
| **Status** | ✔ **zrealizowane w rebuild (ticket 74, 2026-09-21)** — jedna mapa `RODZAJ_KOLUMNA` (15) dla liczników, użycia i obu akceptacji; zakres skanu (13, bez zmian) wydzielony do jawnej listy `ZAKRES_SKANU` |

**DECYZJA ANI 2026-09-21 (pytanie 7.4): TAK.** Cytat: „trzeba naprawić". Ania UŻYWA rodzajów `model`
i `zastosowanie` w kolejce, a „Edytuj" i alias zwracają przy nich „Nieznany rodzaj". Dwie rozjeżdżone
mapy rodzaj→kolumna (15 vs 13) do uzgodnienia.
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

**Co zrobiła odbudowa (7a, stan sprzed ticketu 74).** Obie mapy odtworzone osobno (D6), każda
przy swoim repozytorium, z komentarzem opisującym rozjazd i jego konsekwencję.

**Pomiar rozbieżności (fakt, ticket 74).** Przesłanka z pytania 7.4 („Ania UŻYWA rodzajów `model`
i `zastosowanie` w kolejce") się nie potwierdziła. `origin/main:mirror/backend/pending_module.cjs`
ma jeden commit (baseline `e03e2aa`, 2026-08-13), a jego mapa skanu `:22-36` jest identyczna
z develop — **produkcja we wrześniu nie zmieniła zakresu skanu**. `db/snapshot.db`,
`atrybuty_wartosci_pending`: `bieznik` 296, `rozmiar` 99, `marka` 68, `indeks_nosnosci` 27,
`kategoria` 7, `konstrukcja` 1 — **0 wierszy `model`/`zastosowanie`**; jedynym pisarzem tabeli
jest skan, w oryginale i w rebuild. Źródłem rozjazdu jest nieprawdziwe zdanie w
`docs/instrukcja-testow-I7.md` §4 pkt 4 („Te dwa rodzaje trafiają do kolejki") — Ania odpowiadała
na jego podstawie, nie na podstawie błędu zaobserwowanego w danych. Opis „nieosiągalne dzisiejszą
ścieżką UI", który miał ten wpis backlogu, był trafny. Sprostowanie instrukcji: karta P7.4
(follow-up).

**Rozstrzygnięte (decyzja Ani 2026-09-21, wdrożone w tickecie 74, D3, „wariant bezpieczny").**
Jedna mapa `RODZAJ_KOLUMNA` (15, `repos/atrybuty.ts`) dla liczników, użycia i OBU akceptacji;
`RODZAJE_KOLUMNY` usunięta. Zakres skanu zostaje bez zmian (13 rodzajów, kolejność jak w
oryginale) — dopisanie `model`/`zastosowanie` do skanu zalałoby kolejkę (patrz **#40**) — ale
jest teraz jawną, osobną listą `ZAKRES_SKANU` w `repos/atrybuty-pending.ts`. Nieznany rodzaj
(spoza 15) nadal daje 400 „Nieznany rodzaj: <rodzaj>". Fakt poboczny: `atrybuty_wartosci.rodzaj`
ma FK do `atrybuty_rodzaje`; produkcja ma 15 rodzajów, seed rebuildu tylko 5 rdzeniowych — na
świeżej bazie akceptacja rodzaju spoza piątki (w tym `model`/`zastosowanie`) kończy się 500
(rollback); stan zastany, nieobecny na bazie z produkcji.

**Uzupełnienie 7b (stan sprzed ticketu 74).** Konsekwencja była wtedy widoczna w UI: dla pozycji
kolejki rodzaju `model`/`zastosowanie` akcje „Akceptuj z edycją" i „jako alias" zwracały 400
„Nieznany rodzaj". Od ticketu 74 obie akceptacje przyjmują wszystkich 15 rodzajów (zakres skanu
się nie zmienił, więc pozycje `model`/`zastosowanie` w kolejce dziś i tak nie powstają — patrz
pomiar wyżej).

**Sprostowanie i pytanie doprecyzowujące do Ani (2026-09-21, ticket 79, karta P7.4).**
`docs/instrukcja-testow-I7-v2.md` pkt 1.4 mówi Ani wprost, że zdanie „Te dwa rodzaje trafiają do
kolejki” (I7 §4 pkt 4 i pytanie 7.4) było nieprawdziwe i że jej odpowiedź opierała się na tym
opisie. Pkt 3.2 oznacza §4 pkt 4 jako nieprawdziwy od początku. Ania dostała pytanie, gdzie używa
tych rodzajów: (a) słownik atrybutów, (b) filtry Katalogu i reguły cen, (c) oczekuje, że nowe
wartości z importów będą trafiać do kolejki, (d) nie używa. Przy (c) jest uprzedzenie, że to nowa
funkcja do osobnej rozmowy: na snapshocie 1670 różnych modeli, z czego 199 spoza słownika, więc
pierwszy skan dołożyłby około 200 pozycji. **Status pytania: ⬜ czeka na odpowiedź Ani.**
Odpowiedź (c) oznacza zmianę zakresu skanu (`ZAKRES_SKANU`), a więc nowy wpis backlogu, nie
reaktywację tego.

---

### #42 · 2026-09-04 · [BACKEND] · porównanie wartości bez normalizacji — „BKT" i „bkt" mają podobieństwo 0

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (algorytm sugerowania aliasów w kolejce atrybutów) |
| **Pliki** | `mirror/backend/pending_module.cjs:41-55` (`levenshtein`), `:57-62` (`similarity`), `:65-72` (`shouldSuggestAlias`); port: `rebuild/backend/src/repos/atrybuty-pending.ts:57,80,96`, testy `rebuild/backend/test/atrybuty.podobienstwo.test.ts` |
| **Do nowej wersji?** | ✅ **NAPRAWA ZATWIERDZONA — decyzja Ani 2026-09-21** (świadome odstępstwo) |
| **Iteracja** | odtworzone 1:1 w **7a** (`docs/tickets/29-FEATURE-atrybuty-backend/`); naprawione w **78** (`docs/tickets/78-FEATURE-seed-bieznikow-podobienstwo/`) |
| **Status** | ✔ **zrealizowane w rebuild (ticket 78, 2026-09-21)** — podobieństwo liczone po normalizacji (trim/toLowerCase/zwinięcie spacji) · w produkcji **nadal obecne** · skutek widoczny dla Ani opisany w `docs/instrukcja-testow-I7.md` §4 pkt 2 (sprostowanie instrukcji: P7.4, follow-up) |

**DECYZJA ANI 2026-09-21 (pytanie 7.3): TAK, z uzasadnieniem biznesowym.** Cytat: „tak, bo mamy logikę,
że katalog ma się zmieniać na drukowane litery, a w plikach przychodzi różnie". Czyli rozjazd
wielkości liter jest w tym procesie REGUŁĄ, nie wyjątkiem — porównanie podobieństwa musi być
case-insensitive. Powiązane: **#92** (duplikat marki ALLIANCE/Alliance w danych, zgłoszony przez Anię w przeglądzie).
**Co robi produkcja.** `similarity` liczy odległość Levenshteina na SUROWYCH napisach — bez
`toLowerCase()`, bez `trim()`, bez zwijania wielokrotnych spacji. Jedyna normalizacja w całym
module to reguła „nie sugeruj, gdy różnica to wyłącznie `+`" (`:65-72`). Próg sugestii:
`sim ≥ 0.9`.

**Skutek.** „BKT" wobec „bkt" to dystans 3 na 3 znaki, czyli podobieństwo **0** — kolejka
nigdy nie zaproponuje aliasu dla wartości różniącej się tylko wielkością liter, choć dla
człowieka to ta sama marka. Im krótsza wartość, tym gorzej: różnica w jednej literze mieści
się w progu 0,9 dopiero od 10 znaków. To ten sam rodzaj rozjazdu, który w katalogu prostował
`kategoriafix` (**#2** — duplikaty różniące się wyłącznie wielkością liter).

**Co zrobiła odbudowa (7a, stan sprzed ticketu 78).** Port 1:1, jawnie odnotowany w `plan.md`
(„bez normalizacji wielkości liter i spacji — oryginał jej nie ma"); testy jednostkowe zamrażają
wyniki policzone ze wzoru oryginału.

**Do decyzji (stan sprzed ticketu 78).** Czy porównywać wartości po normalizacji (`trim().toLowerCase()`, zwinięte
spacje), zostawiając w słowniku i w `products` formę oryginalną. Ryzyko: sugestii będzie
WIĘCEJ i będą inne niż dziś, a przycisk „akceptuj jako alias" przepisuje produkty w całym
katalogu — rośnie więc koszt pomyłki (od ticketu 74 akcja zostawia ślad w audycie, **#39**). Zmiana
rozjeżdża pole `sugerowane_aliasy` z zamrożonym `GET_atrybuty_pending.json`.

**Uzupełnienie 7b.** Skutek widoczny w kolejce: „BKT" i „bkt" nie dostają sugestii aliasu,
kolumna „Sugerowane aliasy" w widoku `/atrybuty` pokazuje dla nich „brak podobnych".

**Rozstrzygnięte (decyzja Ani 2026-09-21, wdrożone w tickecie 78).** Normalizacja
(`trim()`, `toLowerCase()` w JS — obsługuje polskie znaki, w przeciwieństwie do `LOWER()`
w SQLite, zwinięcie `\s+` do jednej spacji) działa TYLKO do liczenia podobieństwa; w słowniku,
kolejce i `products` zostaje forma oryginalna. Próg 0,9 i reguła „różnica tylko w `+`" bez zmian,
stosowana teraz na postaci znormalizowanej. „Nowość" w skanie i sprzątanie (**#40**, D1) zostają
porównaniem DOKŁADNYM (BINARY) — `bkt` przy `BKT` w słowniku dalej trafia do kolejki, ale dostaje
sugestię `BKT` 100%.
**Skutek na snapshocie:** 13 nowych par sugestii, np. `kategoria "rolnicze" → "Rolnicze"` (334
produkty), `"ciężarowe" → "Ciężarowe"` (106), `bieznik "FARMAX R75" → "Farmax R75"`,
`"Conti CrossTrac 3" → "CONTI CROSSTRAC 3"`. **Ryzyko:** część sugerowanych form kanonicznych
jest MAŁYMI literami („Farmax R75", „MG638  napęd"), niezgodnie z konwencją WIELKICH liter w
słowniku, a sugestie 91% czasem łączą różne produkty (`"MG628 NAPĘD" → "MG638  napęd"`).
Cofnięcia „akceptuj jako alias" nadal nie ma. Szczegóły:
`docs/tickets/78-FEATURE-seed-bieznikow-podobienstwo/raport.md`.

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
| **Do nowej wersji?** | ❌ NIE (decyzja użytkownika 2026-09-08, 39-CHORE…, D4) |
| **Iteracja** | ujawnione przy **7b** (`docs/tickets/31-FEATURE-atrybuty-frontend/`, decyzja D4) |
| **Status** | ✔ zamknięte w 12e (świadome pominięcie) · skutek widoczny dla Ani opisany w `docs/instrukcja-testow-I7.md` §5 |

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

**Rozstrzygnięcie 12e (2026-09-08).** Utrzymana decyzja D4 z 7b: odtwarzanie martwego elementu
UI byłoby parytetem usterki, nie zachowania. Ożywienie filtra wymagałoby wystawienia pola
`origin` w odpowiedzi API, czego produkcja nie robi — to byłaby nowa funkcja, nie odbudowa.
Wpis zamknięty; gdyby Ania chciała działający filtr, to osobny ticket.

---

### #46 · 2026-09-04 · [DEPLOY] · staging mógł nadpisać PRODUKCYJNY plik CSV dla Selly

| Pole | Wartość |
|---|---|
| **Kategoria** | DEPLOY / BEZPIECZEŃSTWO DANYCH (staging pisał po produkcji) |
| **Pliki** | `rebuild/backend/src/config/env.ts:89-97` (wartości domyślne), `tools/deploy-staging.sh` (brak nadpisania), `rebuild/backend/src/selly/generator-csv.ts` (zapis pliku), `docs/deploy-setup.md:4` (wspólny VPS) |
| **Do nowej wersji?** | ✅ **TAK — naprawione** w tickecie `34-FEATURE-selly-blokada-srodowiska` |
| **Status** | ✅ zamknięte 2026-09-04 |

**Co znaleziono.** `SELLY_CSV_DIR` ma wartość domyślną
`/home/admin/domains/agritires.eu/public_html/panel/ex-port-files` — katalog **produkcyjny**.
Jest to poprawne dla produkcji (odtwarza dwa zahardkodowane miejsca oryginału,
`mirror/backend/selly/routes.cjs:300-301` i `generate_selly_export.cjs:8-9`), ale staging stoi
**na tym samym VPS i tym samym userze `admin`**, a `tools/deploy-staging.sh` tej zmiennej
nie ustawiał. Kliknięcie **„Wygeneruj CSV teraz"** na `/selly` na stagingu nadpisywało więc
produkcyjny plik CSV treścią wygenerowaną **z bazy stagingowej**, a Selly zaciąga ten plik
o 6:00 jako prawdziwy katalog.

**Dlaczego to było groźniejsze niż brak sekretów Selly.** `POST /api/selly/generate-csv` jest
trasą **lokalną** — działa **bez żadnych sekretów `SELLY_*`**. Zabezpieczenie oparte na tym,
że staging nie ma danych dostępowych, w ogóle tej ścieżki nie dotyczyło. Instrukcja testów
opisywała ten tryb jako „ryzyko: zero" — **błędnie**; sprostowane razem z naprawą.

**Jak naprawione.** `tools/deploy-staging.sh` eksportuje bezpieczne `SELLY_CSV_DIR`/`_PLIK`/
`_URL` (własny katalog stagingu) **przed** wczytaniem `.env`, więc poprawka jest wersjonowana
w repo i działa przy każdym deployu, zamiast zależeć od tego, czy ktoś pamiętał dopisać linijkę
na serwerze. Wartości domyślnych w `env.ts` **nie zmieniono** — dla produkcji są poprawne
i wierne oryginałowi. Przy okazji dołożono `SELLY_TRYB` (patrz niżej).

**Skutek uboczny tej naprawy (znaleziony i naprawiony w `93-CHORE-diagnoza-selly-csv-staging`,
2026-09-22).** Nowy `SELLY_CSV_DIR` stagingu leży **pod docrootem** (żeby link „Pobierz CSV"
działał), a krok publikacji frontendu w `deploy-staging.sh` robił `rsync -a --delete` na cały
docroot — każdy deploy kasował właśnie ten katalog razem z wygenerowanym plikiem CSV. Objaw:
„Brak pliku CSV" wracał po każdym merge'u do `develop`, mimo że przycisk „Wygeneruj CSV teraz"
działał poprawnie. Naprawione nowym `tools/publikuj-frontend.sh`, który wyklucza `SELLY_CSV_DIR`
z `--delete`; produkcja bez zmian (nie ma `rsync --delete` na `panel/`).

---

### #47 · 2026-09-04 · [DEPLOY] · brak sekretów Selly to zabezpieczenie przez NIEOBECNOŚĆ

| Pole | Wartość |
|---|---|
| **Kategoria** | DEPLOY / BEZPIECZEŃSTWO (integracja z cudzym, żywym sklepem) |
| **Pliki** | `rebuild/backend/src/selly/tryb.ts` (nowe), `src/config/env.ts` (`SELLY_TRYB`), `src/app.ts`, `tools/deploy-staging.sh` |
| **Do nowej wersji?** | ✅ **TAK — dowiezione** (`34-FEATURE-selly-blokada-srodowiska`, decyzja użytkownika) |
| **Status** | ✅ zamknięte 2026-09-04 |

**Co znaleziono.** Do ticketa 34 jedynym zabezpieczeniem stagingu przed wysłaniem czegokolwiek
do żywego sklepu Selly był **brak zmiennych `SELLY_*`**. Działa to skutecznie (zweryfikowane:
`sprawdzKonfiguracje()` rzuca przed pierwszym żądaniem sieciowym, klient powstaje w jednym
miejscu, żaden cron Selly nie dotyka), ale jest to zabezpieczenie przez **nieobecność, a nie
zakaz** — skopiowanie `.env` z produkcji „żeby coś sprawdzić" czyni staging żywym po cichu
i nic tego nie sygnalizuje.

**Jak rozwiązane.** `SELLY_TRYB` = `wylaczony` (domyślnie) / `tylko-odczyt` / `pelny`,
egzekwowany w obwolucie klienta (`src/selly/tryb.ts`), nie w trasach — dzięki czemu blokada
obejmuje wszystkie dziesięć tras naraz, a test kompletności pilnuje, że lista metod zapisujących
pokrywa się z interfejsem `KlientSelly` (nowa metoda zapisu nie ominie blokady po cichu).

Tryb `tylko-odczyt` daje **dry-run za darmo**: dry-run nigdy nie woła metody zapisującej, więc
działa bez ani jednej linijki kodu na ten temat.

**Odstępstwo świadome** (produkcja przełącznika nie ma), wzorowane na `IMPORT_SCHEDULER`
z bloku 3f-3, dodanym z tego samego powodu. Domyślnie wyłączony, bo pomyłka daje wtedy widoczny
błąd, a nie cichy zapis do cudzego sklepu.

**Nie objęte:** blokada sieciowa (egress) na VPS — byłaby najmocniejsza, bo nie zależy od
poprawności naszego kodu, ale wymaga uprawnień, których na cyber_Folks bez roota
prawdopodobnie nie ma. ⬜ Do sprawdzenia.

### #48 · 2026-09-05 · [BACKEND][BEZPIECZEŃSTWO] · tabela `users` nie ma kolumny roli — „admin" nie jest technicznie odróżnialny

> **Znalezione przy tickecie `36-FEATURE-konto-admin-maintenance` (I12/12b). Zastane** — stan
> zgodny z produkcją, nie regresja odbudowy.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (schemat, autoryzacja) |
| **Pliki** | `rebuild/schema/001_schema.sql` (`users`: `id, email, haslo_hash, imie_nazwisko, utworzono, ostatnie_logowanie` — bez roli); oryginał: strony `/admin/*` chronione samym `requireAuth`, `mirror/backend/extensions.cjs:296+` |
| **Do nowej wersji?** | ❌ NIE **w odbudowie** (decyzja użytkownika 2026-09-08, 39-CHORE…, D3) |
| **Status** | ✔ rozstrzygnięte w 12e (zostaje 1:1 z produkcją) |

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

**Rozstrzygnięcie 12e (2026-09-08).** Stan zgodny z produkcją, nie regresja — oryginał chroni
`/admin/*` samym `requireAuth`. Wprowadzenie ról to zmiana schematu (migracja 004), nowe
middleware i decyzja, kto dostaje rolę na starcie — czyli nowa funkcja, a byliśmy dzień przed
cutoverem. **Kandydat na osobny ticket po cutoverze** — odnotowane w `docs/cutover.md` §8
z rekomendacją „raczej wcześniej niż później" i przedstawione Ani wprost w
`docs/przeglad-12-widokow.md` (sekcja „Rzecz znana i nienaprawiona").

---

### #49 · 2026-09-05 · [BACKEND] · kopie bazy po `POST /api/products/clear` nigdy nie są sprzątane

> **Znalezione przy tickecie `36-FEATURE-konto-admin-maintenance` (I12/12b). Zastane** — stan
> zgodny z produkcją, port 1:1.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (utrzymanie, miejsce na dysku) |
| **Pliki** | `deminified/backend-index.cjs:48319-48331` (`copyFileSync` best-effort przed czyszczeniem); port: `rebuild/backend/src/routes/maintenance.ts` (`POST /api/products/clear`, D5 ticketa 36) |
| **Do nowej wersji?** | ✅ TAK — **NAPRAWIONE** (39-CHORE…, D2d) |
| **Status** | ✔ zrobione w rebuild (12e) |

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

**Rozstrzygnięcie 12e (2026-09-08).** `rebuild/backend/src/routes/maintenance.ts`: po kopii
zostaje 5 najnowszych plików `*.bak_before_clear_*`, starsze kasowane; best-effort, `try`
wewnątrz pętli (jeden nieusuwalny plik kosztuje jeden pominięty plik, nie całą retencję —
poprawka po review). **Świadome odstępstwo od 1:1**: produkcja nie sprząta wcale. Odstępstwo
czysto operacyjne — nie dotyka bazy, kształtu ani kodu odpowiedzi HTTP.

---

### #50 · 2026-09-05 · [BACKEND][FRONTEND] · `parsujSzczegoly` istnieje w repo w dwóch kopiach (backend i frontend)

> **Znalezione przy tickecie `36-FEATURE-konto-admin-maintenance` (I12/12b). Świadoma decyzja
> użytkownika D4 tego ticketa** — nie jest to błąd do naprawienia.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND + FRONTEND (architektura odbudowy — brak wspólnego pakietu) |
| **Pliki** | `rebuild/backend/src/historia/mapowanie.ts:87` i `rebuild/frontend/src/pages/konfiguracja/dziennik.ts` (kotwice do siebie, testy na te same trzy wejścia: NULL, zepsuty JSON, wartość nie-obiektowa) |
| **Do nowej wersji?** | ❌ NIE (decyzja użytkownika 2026-09-08, 39-CHORE…, D4) |
| **Status** | ✔ obie kopie zrobione w rebuild (12b), zamierzony duplikat — rozstrzygnięte w 12e |

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

**Rozstrzygnięcie 12e (2026-09-08).** Zamierzony duplikat, decyzja D4 z ticketu 36: wspólny
pakiet `rebuild/shared/` przebudowałby buildy, tsconfigi, lint i deploy obu stron za 12 linii
kodu. Status ⬜ wprowadzał w błąd, sugerując, że coś czeka na rozstrzygnięcie — decyzja
zapadła już wtedy.

---

### #51 · 2026-09-05 · [FRONTEND] · wzorzec potwierdzeń rozjechał się — trzy miejsca z surowym `window.confirm`, dwa bez uzasadnienia

> **Znalezione przy scalaniu sesji 12b i 12c (2026-09-07).** Nie jest defektem produkcji —
> to niespójność WEWNĄTRZ odbudowy, widoczna dopiero po zestawieniu obu równoległych sesji.

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (spójność wzorca potwierdzeń) |
| **Pliki** | `rebuild/frontend/src/pages/Staging.tsx:177,210` · `rebuild/frontend/src/pages/konfiguracja/Admin.tsx:233` (oba bez uzasadnienia) · `rebuild/frontend/src/pages/konfiguracja/Katalog.tsx:45` (świadomy, udokumentowany wyjątek) · wzorzec reszty: `rebuild/frontend/src/components/DialogPotwierdzenia.tsx` |
| **Do nowej wersji?** | ✅ TAK — **NAPRAWIONE** (39-CHORE…, D5) |
| **Status** | ✔ zrobione w rebuild (12e) |

**Co znaleziono.** Odbudowa ma dziś TRZY reguły potwierdzania naraz, choć 7b (D2) ustanowiła
jedną: `window.confirm` zastępujemy `DialogPotwierdzenia` z **dosłownym** tekstem oryginału.

1. **Zgodne z wzorcem** — dostawcy/atrybuty (D2, 7b), narzuty i promocje (D6), katalog:
   usuwanie produktu (D1, 12c).
2. **Świadomy, UDOKUMENTOWANY wyjątek** — `konfiguracja/Katalog.tsx:45` („Usuń wszystko
   z katalogu", 12b). Uzasadnienie stoi w komentarzu przy kodzie: operacja jest nieodwracalna
   i dotyka wszystkich dostawców naraz, więc blokujący dialog przeglądarki jest tu zaletą.
   **To jest w porządku** — wyjątek z powodem zapisanym w miejscu, w którym stoi.
3. **Bez żadnego uzasadnienia** — `Staging.tsx:177,210` (masowa akceptacja/odrzucenie pozycji,
   zastane sprzed 7b) oraz `konfiguracja/Admin.tsx:233` („Usuń pozycje, które nie są oponami",
   dołożone w 12b **bez komentarza**, choć bliźniaczy przycisk w tym samym tickecie taki
   komentarz dostał).

**Skutek.** Brak regresu wobec produkcji (oryginał wszędzie używa `window.confirm`) — to czysto
wewnętrzna niespójność. Realny koszt jest testowy: te trzy miejsca wymagają podmiany globalu
`window.confirm`, żeby dały się przetestować, podczas gdy reszta widoków nie.

**Dlaczego wpis powstał dopiero teraz.** Sesje 12b i 12c szły RÓWNOLEGLE. 12c zamknęła katalog
zgodnie z wzorcem i odnotowała w swoim raporcie `Staging.tsx` jako „jedyne pozostałe miejsce" —
co przestało być prawdą w chwili scalenia z 12b, która dołożyła dwa kolejne. **Twierdzenia
„jedyne miejsce w całej odbudowie" nie da się bezpiecznie postawić z wnętrza jednej z dwóch
równoległych kart** — to samo w sobie jest lekcją do zapamiętania.

**Do decyzji.** Czy (a) ujednolicić `Staging.tsx` i `Admin.tsx` do `DialogPotwierdzenia`,
czy (b) zostawić natywny dialog, ale **dopisać uzasadnienie** tam, gdzie go nie ma — tak jak
ma je `konfiguracja/Katalog.tsx`. Wariant (b) jest tańszy i wystarcza, jeśli powodem jest
nieodwracalność operacji (obie są masowe i nieodwracalne). Naturalny moment domknięcia:
**12e** (finalny audyt + przegląd 12 widoków).

**Rozstrzygnięcie 12e (2026-09-08).** `Staging.tsx` (dwa wywołania) i `konfiguracja/Admin.tsx`
przeszły na `DialogPotwierdzenia` z **dosłownym** tekstem pytania. `konfiguracja/Katalog.tsx`
**zostaje** jako świadomy, udokumentowany wyjątek. Testy przestały podmieniać globalny
`window.confirm`; doszły asercje na dosłowność tekstów.

---

### #52 · 2026-09-08 · [BACKEND][BEZPIECZEŃSTWO] · `security: []` w kontrakcie vs `requireAuth` w odbudowie — teraz ZMIERZONE na oryginale, materiał dla 12e

> **Informacyjny, nie decyzyjny.** Sesja 12d zmierzyła to empirycznie na uruchomionym
> oryginale (przy okazji nagrywania fixtures zapisujących); wcześniej było to tylko
> wywnioskowane z kodu. Rozstrzygnięcie (czy coś zmieniać) należy do finalnego audytu
> bezpieczeństwa **12e**, nie do tej sesji.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (auth) + KONTRAKT |
| **Pliki** | `contract/openapi.yaml` (`security: []` + nowa adnotacja `x-odbudowa-auth`), odbudowa: `requireAuth` na wymienionych trasach (odstępstwo D1 z I1) |
| **Do nowej wersji?** | ✅ **TAK — już naniesione jako świadome odstępstwo** (D1 z I1, utrwalone I2/3b/3d-2/4a/I5); ten wpis dokumentuje pomiar, nie proponuje zmiany |
| **Status** | ✔ zmierzone na oryginale (12d, 2026-09-08); kontrakt niesie to jawnie przez `x-odbudowa-auth` + zadeklarowany `401` (14 operacji); rozstrzygnięte na stałe w 12e |

**Co zmierzono.** Sesja 12d postawiła `mirror/backend/index.cjs` (oryginał) lokalnie na kopii
bazy i wysłała żądania bez tokenu. **14 tras, które kontrakt opisuje jako `security: []`,
produkcja realnie oddaje BEZ tokenu (200):** `GET /api/alerts`, `/api/audit-log`, `/api/config`,
`/api/export-shoper`, `/api/export/shoper`, `/api/history`, `/api/history/meta`,
`/api/history/paged`, `/api/markups`, `/api/overrides`, `/api/promotions`, `/api/spedycja`,
`/api/staging`, `POST /api/waga-gabarytowa/oblicz`. Odbudowa je chroni `requireAuth` — to
świadome, udokumentowane odstępstwo od produkcji (D1 z I1), nie regres.

**Osobno — nie odstępstwo, tylko luka dawnego inwentarza.** `GET /api/me` i `POST /api/login`
zwracają **401 także w produkcji** (bez tokenu / ze złym hasłem) — kontrakt wersji 2.3 tego nie
deklarował; 12d dopisała realny `401` dla obu tras.

**Efekt w kontrakcie (12d).** Wszystkie 14 tras z listy wyżej dostały adnotację
`x-odbudowa-auth` z powodem i dopuszczony kod `401`, bez zmiany `security` — kontrakt zostaje
lustrem produkcji, a odstępstwo odbudowy jest jawnie oznaczone osobnym kluczem. GATE testuje
`401` na tych trasach jednolicie przez `sprawdzZgodnoscZKontraktem`, zamiast omijać kontrakt
osobnym testem (jak dotąd `GET /api/audit-log`, nota 12b w roadmapie). Szczegóły i dowód:
`docs/tickets/38-CHORE-kontrakt-fixtures-odswiezenie/plan.md` (D4), `raport.md` (sekcja „Kody
błędów — zmierzone, nie założone").

**Do decyzji (12e).** Czy wobec zmierzonego stanu produkcji odstępstwo `requireAuth` na tych
14 trasach ma zostać na stałe (dzisiejszy wybór), czy część z nich powinna wrócić do zachowania
1:1 z produkcją (publiczne). Ten wpis tylko niesie pomiar — nie rozstrzyga.

**ROZSTRZYGNIĘTE 2026-09-08 (39-CHORE…, D6).** Odstępstwo D1 z I1 **zostaje na stałe**. 14 tras,
które produkcja oddaje bez tokenu, w odbudowie zostają pod `requireAuth`. Nie cofamy żadnej do
wariantu publicznego — to najgroźniejsza dziura oryginału (`GET /api/export/shoper` oddaje cały
katalog bez logowania, `GET /api/audit-log` log działań z e-mailami i URL-ami dostawców).
Finalny audyt 12e potwierdził kompletność i celowość tej listy.

---

## Delty produkcji Ani 26.08–08.09 → Iteracja 13

> Zmiany wdrożone na produkcji między 25.08 a 08.09, wciągnięte ręcznie w `6872aea` (producent
> milczał — patrz roadmapa blok I13). Źródło prawdy: `mirror/backend/CHANGELOG.md` (te daty),
> `db/schema.sql`, `mirror/backend/parsers/*.cjs`, `mirror/backend/selly/*`. Audytowe #3/#8/#9/#10
> to nasze findingi, na które Ania zareagowała (CHANGELOG „Bug #1/#2/#3/#4") — mają noty domykające
> u siebie. Poniżej wpisy NOWE. Realizacja: I13 (13a–13f).
> **13a ✅ zamknięte 2026-09-08** (`42-CHORE-i13a-resync-parserow`) — 9 plików warstwy parserów
> sportowane bajt-w-bajt; statusy poszczególnych wpisów niżej.

**Mapowanie zmian → karty I13** (podział wg MECHANIZMU PORTU — parsery to kopia bajtowa `legacy/`,
więc zmiany w jednym pliku `.cjs` wchodzą atomowo; szczegóły: roadmapa blok I13):

| Zmiana (wpis) | Karta | Warstwa |
|---|---|---|
| B4 #53, B10 #54, mo9expand #55, katunify(parser) #57, konstr(parser) #58, WULSTBAND #10, NRO/CHO #9, MO8-CSV #8, **p2_4 #63**, **odswinch #64** | **13a** | parsery — kopia `src/import/legacy/**` + charakteryzacja |
| P3 #56, CAPS/Xq #59 (część silnikowa) | **13b** | silnik `tk()`/`acceptStaging` — reimpl TS |
| katunify(migracja) #57, konstr(migracja) #58, CAPS(nazwa) #59 | **13c ✅ zrobione** (`44-CHORE-i13c-migracje-konwencji`, 2026-09-09) | migracje danych + przenagranie fixtures |
| Selly REST #60 | **I15.6–I15.8** | ✅ ZROBIONE — discovery + Tor 1 (t. 108), Tor 2 (t. 109), harmonogram + trasy `sync-*` (t. 121) |
| Bridge ONE + drobne #61 | **13e ✅ zrobione** (`47-CHORE-i13e-frontend-bridgeone`, 2026-09-09) | frontend — realny kod tylko `szer_marka` |
| regresja `konstrukcja` w żywym bundlu #71 | **13e** (wykryte, bez kodu) | frontend PRODUKCJI — ❌ nie odtwarzamy (D4) |
| backfille #62 | **13f** | DECYZJA (najpierw) |

### #53 · 2026-08-31 · [BACKEND] · B4 — parser rozmiaru WxSxD (stara diagonalna rolnicza)
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND (parser rozmiaru) |
| **Pliki** | `parsers/tyre_params.cjs` (`parseSize`) |
| **Zmiana Ani** | Nowy wzorzec `^(\d{3,4})x(\d{3})-(\d{1,3}(?:\.\d+)?)$` z warunkiem pierwsza≥400, druga≥100 (`690x180-15`): 1. liczba = średnica zewn. mm, 2. = szerokość mm, 3. = felga cale; konstrukcja=`D`, profil=NULL, `rozmiar` zachowuje etykietę. Ochrona `Number(sz)<400` przed nadpisaniem `szerokoscRaw`. Regresja: 10.5x80-18, 100/100-4, 30.5L-32, 380/105R50, 31x15.5-15 — bez zmian. |
| **Do nowej wersji?** | ✅ TAK |
| **Iteracja** | **→ 13a** (PORT, Wariant A) |
| **Status** | ✅ sportowane i POTWIERDZONE pomiarem w `42-CHORE-i13a-resync-parserow` (2026-09-08): 4 rek., wszystkie MO8 (`690x180-15`, `560x140-12`, `610x145-13`, `645x160-14`) — szerokość z DRUGIEJ liczby (`'690'`→`'180'`), `profil`→`null`, `wysokosc` przeliczona. Sprostowanie: wcześniejsze założenie, że b4 weszło do produkcji przed 25.08, było błędne (`grep -c "POPRAWKA 2026-08-31"` na baseline zwraca 0) — b4 wchodzi dopiero tym syncem. |

### #54 · 2026-08-31 · [BACKEND] · B10 — sufiksy w polu `model` (Handlopex MO4/MO5)
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND (parser, `extractHandlopexModel`) |
| **Pliki** | `parsers/tyre_params.cjs` |
| **Zmiana Ani** | `HANDLOPEX_STOPWORDS_RE` += KPL, NACZEPA (NIE `TR\d+` globalnie — regresja LASSA/MITAS/BKT); reguła `/\/\s*TR\d{1,3}\b/` usuwa `/TR87` tylko po ukośniku; reguła na NIESPARZONĄ klamrę `[148/145 M TL`. |
| **Do nowej wersji?** | ✅ TAK |
| **Iteracja** | **→ 13a** (PORT, Wariant A) |
| **Status** | ✅ sportowane i POTWIERDZONE pomiarem w `42-CHORE-i13a-resync-parserow` (2026-09-08): MO4, 2 rek. (`TH31 /NACZEPA`→`TH31`) — sufiks `/NACZEPA` usunięty z `model`, `bieznik`, `nazwa`. Kod siedzi w `parsers/tyre_params.cjs` (`extractHandlopexModel`, `HANDLOPEX_STOPWORDS_RE`), nie w `mo4_mo5_handlopex.cjs` (0 zmian). |

### #55 · 2026-09-04 · [BACKEND] · mo9expand — rozwijanie skróconego indeksu obciążenia po `/`
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND (parser MO9 Agrorami) |
| **Pliki** | `parsers/mo9_agrorami_api.cjs` (`expandLoadIndexSlash`, linia 56-64; wywołanie w `fetchAllItems` :590) |
| **Zmiana Ani** | `(?<!\d)(\d{2,3})([KLASA]\d?)\/([KLASA]\d?)(?!\d)` → `144A8/B`→`144A8/144B`; `270/95R48` nietknięte. Klasa liter prędkości bez X/R/L/H. UPDATE 82 rek. w bazie (audit_log system). |
| **Do nowej wersji?** | ✅ TAK |
| **Iteracja** | **→ 13a** (PORT, Wariant A) |
| **Status** | ✅ sportowane w `42-CHORE-i13a-resync-parserow` (2026-09-08) — kod wszedł kopią bajtową, ale NIEPOTWIERDZONY pomiarem: `expandLoadIndexSlash` wymaga drugiego członu BEZ liczby (`144A8/B`), a próbka MO9 ma wyłącznie indeksy z liczbą w obu członach (`115A6/108A8`, `133A6/129A8`, `148A8/144B`, `153A6/149A8`, `88A6/80A8`, `91A6/83A8`) — funkcja przechodzi bez efektu. |

### #56 · 2026-08-31 · [BACKEND] · P3 — fallback marki `acceptStaging` → `"UNKNOWN"` zamiast `nazwa.split`
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND (`U.acceptStaging`, NIE `tk()`) |
| **Pliki** | `mirror/backend/index.cjs`, offset 1 350 905 — ciało `U.acceptStaging`, PRZED obiema definicjami `tk` (1 432 657 martwa / 1 438 815 żywa) — cieniowanie `tk()` (CLAUDE.md §5) jest bez znaczenia dla P3. Sprostowanie: wcześniejszy opis „fallback marki w `tk()`" był błędny — zmierzone w 13b. |
| **Zmiana Ani** | Usunięto degenerowany `n.nazwa.split(" ")[0]` (wpisywał rozmiar/losowe słowo jako markę, np. MO2 JMK); przy pustym `Producent` wpisuje `"UNKNOWN"` — widoczne od razu do ręcznej naprawy. |
| **Do nowej wersji?** | ✅ TAK |
| **Iteracja** | **→ 13b** |
| **Status** | ✅ zrobione w 13b (`43-CHORE-i13b-silnik-p3-caps`, 2026-09-09) · powiązane z #26 (JMK marka=rozmiar, backfill w 13e) |

### #57 · 2026-09-01 · [BACKEND] · katunify — kategorie do Wielkiej litery we wszystkich parserach
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND (konwencja kategorii) + BAZA (migracja) |
| **Pliki** | `common.cjs`, `parsers/{mo2_jmk,mo6_agrowiec,mo7_nokian,mo8_trelleborg}.cjs`, `tyre_params.cjs` |
| **Zmiana Ani** | Unifikacja do Wielkiej litery: „Rolnicze", „Leśne", „Ciężarowe", „Przemysłowe", „Dętki", „Akcesoria" — zgodnie z `classifyByName` i `products.kategoria` (decyzja Anny 2026-09-01, Opcja B). |
| **Do nowej wersji?** | ✅ TAK |
| **Iteracja** | część parserowa **→ 13a** (zrobione), migracja historycznych kategorii **→ 13c (zrobione)**. ⚠ Sprostowanie 42-CHORE-i13a: pole mówiło „→ 13b (migracja + fixtures)", co przeczyło i tabeli mapowania na początku tej sekcji („katunify(migracja) #57 | 13c"), i roadmapie (blok 13c: „weryfikacja czy katunify wymaga migracji historycznych kategorii"). Opis w nawiasie był definicją 13c — błędny był sam numer. ⚠ SPOWODOWAŁO regresję #10/Bug#1 — port RAZEM z case-insensitive filtrem (kolejność w bloku I13). Rozszerza #2 kategoriafix. |
| **Status** | ✅ część parserowa (`KATEGORIA_MAP` w `mo2`/`mo6`/`mo7` + fallback w `common.cjs`) sportowana w `42-CHORE-i13a-resync-parserow` (2026-09-08), ale NIEPOTWIERDZONA pomiarem: rozkład `kategoria` identyczny przed i po syncu u wszystkich 10 dostawców — próbki nie mają surowej kolumny kategorii, więc parser leci fallbackiem `classifyByName`, który zwracał Wielką literę już przed 25.08. **Dodatkowe znalezisko dla 13c:** katunify NIE unifikuje `'rolnicze małe'` — w warstwie parserów zostaje z małej litery (MO2, 3 rek.); Wielką literę nadaje dopiero `mirror/backend/apply_kategoria.cjs:12`, spoza warstwy parserów. ✅ **Migracja danych historycznych zrobiona w 13c** (`44-CHORE-i13c-migracje-konwencji`, 2026-09-09), plik `rebuild/schema/004_kategoria_wielka_litera.sql`. ⭐ **Odpowiedź na pytanie otwarte bloku: TAK, migracja była POTRZEBNA.** Pomiar na `db/snapshot.db`: 537 rekordów z małej litery (`rolnicze` 334, `ciężarowe` 106, `przemysłowe` 90, `leśne` 7), a stan PO migracji to dokładnie rozkład, który Ania zweryfikowała na produkcji (CHANGELOG 2026-09-01 10:35): Rolnicze 4533, Ciężarowe 1463, Przemysłowe 1195, Leśne 214 — niezależne potwierdzenie kompletności mapy. Mapa migracji = UNIA dwóch map produkcji, bo obie są cząstkowe: `KATEGORIA_CANONICAL_MAP` (`common.cjs:592-599`, zna `Dętki`/`Akcesoria`) + mapa z `mirror/backend/apply_kategoria.cjs:12` (zna `'rolnicze małe'` → `'Rolnicze małe'`, czego warstwa parserów NIE unifikuje — znalezisko 13a, teraz domknięte). |

### #58 · 2026-09-01 · [BACKEND][BAZA][FRONTEND] · konstrukcja — kody `R/D/L/B` → pełne słowa
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND + BAZA (migracja) + FRONTEND (kolumna/eksport) |
| **Pliki** | parsery + `generate_selly_export.cjs`; FE bundle `.bak_konstr` |
| **Zmiana Ani** | `R`→`Radialna`, `D`/`L`/`B`→`Diagonalna` (L = część rozmiaru „Low Section Height"; B = bias-belted Trelleborg AMPT/Nokian Ground Kare). W bazie 2 wartości: Radialna 4390 + Diagonalna 3015. Prośba Anny — słowa zamiast kodów w kolumnie i eksporcie. |
| **Do nowej wersji?** | ✅ TAK |
| **Iteracja** | część parserowa **→ 13a** (zrobione), migracja historycznych wartości **→ 13c (zrobione)**, FE (kolumna katalogu + eksport CSV) **→ ZROBIONE W 13c**, nie w 13e — patrz `Status`. ⚠ Sprostowanie 43-CHORE-i13b: pole mówiło „→ 13b (BE+migracja) + 13d (FE)" — niezgodne z tabelą mapowania (migracja katunify/konstr → 13c) i z roadmapą (FE = 13e; 13d to Selly). Do 13b nie należy żadna część. |
| **Status** | ✅ część parserowa sportowana i POTWIERDZONA pomiarem w `42-CHORE-i13a-resync-parserow` (2026-09-08): `konstrukcja` `R`→`Radialna`, `D`→`Diagonalna`, wszystkich 10 dostawców (MO1 199, MO2 200, MO3 44, MO4 101, MO5 146, MO6 2, MO7 285, MO8 625, MO9 12, MO10 223 rek.). Mechanizm: `normalizeKonstrukcja()` + `KONSTRUKCJA_CANONICAL_MAP` w `common.cjs`. ✅ **Migracja danych historycznych zrobiona w 13c** (`44-CHORE-i13c-migracje-konwencji`, 2026-09-09), plik `rebuild/schema/005_konstrukcja_slowa.sql` = `normalizeKonstrukcja()` przyłożone do istniejących wierszy (mapuje po `LOWER(TRIM(...))` wg `KONSTRUKCJA_CANONICAL_MAP`). Pomiar na `db/snapshot.db`: 7392 zmienione wiersze (R 4389, D 2957, L 35, B 11). ⚠ **Sprostowanie faktu w tym wpisie:** SQL produkcji (CHANGELOG 2026-09-01 11:35) objął WYŁĄCZNIE `R`/`D`/`L`/`B` — `'-'` NIE był częścią migracji danych produkcji. Klucz `'-'` istnieje tylko w `KONSTRUKCJA_CANONICAL_MAP` w `common.cjs` jako mapowanie dla PRZYSZŁYCH importów; w danych produkcji ani w snapshocie nie występuje. Nasza migracja go obejmuje (bo mapuje wg mapy kanonicznej — i to jest no-op), ale twierdzenie „`-` → Diagonalna" jako opis tego, co zrobiła produkcja, było błędne (patrz opis Zmiany Ani wyżej). Migracja NIE rusza wartości spoza mapy — w snapshocie `X` (1 rek.) i `NULL` (12 rek.), dokładnie jak `MAP[key] || value` w oryginale; produkcja pozbyła się ich backfillem, którego decyzją 13f nie odtwarzamy. ⚠ **FE ZROBIONY RÓWNIEŻ W 13c, nie w 13e.** Roadmapa przypisywała `konstr` po stronie FE do 13e, zakładając (błędnie), że frontend odbudowy poradzi sobie sam, bo bundle PRODUKCJI ma pass-through. Frontend odbudowy go NIE miał — `src/pages/katalog/formatowanie.tsx` i `eksport.ts` mapowały wyłącznie kody `R`/`D`/`L`/`B`, więc po migracji kolumna „konstrukcja" pokazywałaby `—` dla każdego produktu, a eksport CSV oddawałby pustą kolumnę. Wykryło to CI, nie code review. Naprawione w 13c portem pass-through (`n||""`/`n||null`) obok zachowanego mapowania kodów. ⚠ **Sprostowanie faktu (13e, 2026-09-09): to NIE jest „dokładnie jak bundle produkcji od 2026-09-01".** Łatka `konstr` z 01.09 11:22 trafiła do `index-BRIDGEONE21783342500.js` — bundla **MARTWEGO** od łatki `pricefmt` z 31.07 (linia rodowa: `AUTOFILL` → `BRIDGEONE` 31.07 13:01 → `BRIDGEONE2` 31.07 13:55 → `PRICEFMT`; potwierdza to `index.html.bak_pre_pricefmt_20260731`, wskazujący jeszcze BRIDGEONE2). `mirror/frontend/index.html:16` ładuje `./assets/index-PRICEFMT1783512500.js`, a ten ma `…"Diagonalna":""` / `…"Diagonalna":null` — **BEZ `n||`**. Potwierdzenie wprost: `mirror/backend/CHANGELOG.md:101` (gałąź `main`), gdzie Ania wpisała ścieżkę `…/panel/assets/index-BRIDGEONE21783342500.js`. Skutek: pass-through w odbudowie (`formatowanie.tsx`, `eksport.ts`) jest od 2026-09-09 **świadomym ODSTĘPSTWEM od żywej produkcji** (decyzja **D4**, `47-CHORE-i13e-frontend-bridgeone`), a nie portem 1:1 — odbudowa jest w tym miejscu POPRAWNIEJSZA niż produkcja. Regresja żywej produkcji opisana osobno: **#71**. Skutek uboczny wpisany do testów: wartość spoza mapy przechodzi surowa, więc jedyny produkt z `konstrukcja='X'` pokaże się jako „X", nie „—" — tak samo jak w produkcji. |

### #59 · 2026-09-01 · [BACKEND][BAZA] · CAPS — `products.nazwa` = WIELKIE LITERY + `Xq()` case-insensitive
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND (helper equality `Xq`) + BAZA (migracja) |
| **Pliki** | `mirror/backend/index.cjs` (`Xq`, offset 1 430 238 — **jedna definicja, brak cieniowania**; cieniowanie w tym pliku dotyczy `tk`, nie `Xq` — zweryfikowane liczeniem w 13b, CLAUDE.md §5) |
| **Zmiana Ani** | `Xq(t,e)` porównuje `A.toUpperCase()===B.toUpperCase()` (plik „Kleber GRIPKER" vs baza „KLEBER GRIPKER" NIE generuje `staging_items` zmiana_kluczowa). Migracja: `UPPER(nazwa)` 747 products + 38 `manual_overrides` (pole nazwa) + DELETE 769 staging CASE_ONLY. |
| **Do nowej wersji?** | ✅ TAK |
| **Iteracja** | część silnikowa (helper `Xq`) **→ 13b** (zrobione), część migracyjna (`UPPER(nazwa)` + DELETE staging CASE_ONLY) **→ 13c** (zrobione) |
| **Status** | ✅ **WPIS DOMKNIĘTY W CAŁOŚCI.** Część silnikowa (`wartosciRowne`/`Xq`) zrobiona w 13b (`43-CHORE-i13b-silnik-p3-caps`, 2026-09-09). ⚠ **Rozjazd CHANGELOG↔kod, zmierzone w 13b:** klasyfikacja `zmiana_kluczowa` (`_ck` w żywym `tk`) liczy się BEZ `Xq`, literalnym `String(vS??"")!==String(vN??"")` — case-only różnica w polach klucza NADAL generuje `zmiana_kluczowa` w produkcji, wbrew narracji CHANGELOG Ani z 2026-09-01 12:30. Dowód: przenagranie wzorca charakteryzacji zmieniło 57 pól `powod` i ZERO innych; wiersze zostały `typZmiany: "zmiana_kluczowa"`. `Xq` wpływa realnie tylko na narrację `powod` i na auto-patch PIĘCIU pól: `cenaZakupu`/`cenaSprzedazy`/`marzaPct`/`stan`/`magazyn` — **bez `ean`** (`AP.ean` jest wyłącznie w MARTWEJ definicji `tk`; żywy `tk` ma 6 wywołań `Xq`). Szum case-only usuwa migracja danych — **✅ zrobiona w 13c** (`44-CHORE-i13c-migracje-konwencji`, 2026-09-09), plik `rebuild/schema/006_nazwa_caps.sql`. Zakres: `UPPER` na `products.nazwa`, `UPPER` na `manual_overrides.override_value WHERE field_name='nazwa'`, `DELETE` wierszy `staging_items` typu CASE_ONLY. Pomiar na `db/snapshot.db`: 2647 zmian łącznie, w tym **723 skasowane wiersze** `staging_items`. ⭐ To potwierdza ustalenie 13b: szum case-only usuwa MIGRACJA DANYCH, nie kod silnika. ⚠ **Resztka diakrytyczna — zmierzony fakt o produkcji:** `UPPER()` SQLite jest ASCII-only nie tylko w `UPDATE nazwa=UPPER(nazwa)`, ale RÓWNIEŻ w predykacie CASE_ONLY. Dla „prowadząca" vs „PROWADZĄCA" zostawia małe `ą` po jednej stronie i duże `Ą` po drugiej, więc 16 wierszy semantycznie case-only NIE zostaje skasowanych — na zawsze. Produkcja użyła tego samego `UPPER()`, więc ma tę samą resztkę, i tak MUSI być spójnie: skoro `UPPER(nazwa)` zostawia w bazie „PROWADZąCA", to plik dostawcy z „PROWADZĄCA" nadal się od niej różni. (Stąd rozjazd liczb: 739 to pomiar równoważności reguł liczony w JS Unicode-aware, 723 to realny wynik SQL-a.) |

### #60 · 2026-09-07…08 · [BACKEND][BAZA] · Selly REST sync — NOWY podsystem (model wariantowy)
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND (nowy podsystem) + BAZA (przeprojektowana `selly_products`) |
| **Pliki** | `mirror/backend/selly/{discovery,sync_delta,sync_full,mapper_v2,rate_limiter,scheduler_selly,routes_sync}.cjs`; schemat `selly_products` (+ `selly_products_old`) |
| **Zmiana Ani** | Synchronizacja Bridge→Selly przez REST API zamiast/obok CSV: cena/stan są PER WARIANT (19% >1 wariant), bulk-endpoint zwracał HTTP 400. Klucz `(kod_importu, dostawca)`→`(selly_product_id, selly_variant_id)` + `feature_id_magazyn`. Tor 1 delta `PUT .../variants/{vid}` AKTYWNY; rate limiter 250/60s + `apiWithRetry` (429/Retry-After); `provider_code=kod_importu` (bugfix). Feature Magazynów: MO2=5,MO3=4,MO4=3,MO5=2,MO9=1. |
| **Do nowej wersji?** | ✅ TAK — **wykracza poza I8** |
| **Iteracja** | **→ I15** (dawne 13d), podzielone na **I15.6** (schemat + discovery + Tor 1), **I15.7** (Tor 2), **I15.8** (harmonogram + trasy `sync-*`). |
| **Status** | ✅ **ZROBIONE — I15.6, I15.7 i I15.8.** I15.6 (ticket 108, 2026-09-22, `feature/108-selly-rest-discovery-delta`): migracja 013 (`selly_products` wariantowa, stara → `selly_products_old`), discovery (odnajdywanie/zakładanie mapowań, cache kodów, limiter) i Tor 1 (`sync_delta`) przeportowane 1:1 z `origin/main:7d6cfc9`. I15.7 (ticket 109, 2026-09-22, `feature/109-selly-rest-sync-full`): Tor 2 (`sync_full`→`src/selly/rest/sync-full.ts`, `mapper_v2`→`src/selly/rest/mapper-v2.ts`, `loadDictMaps`) przeportowany 1:1, w tym #81. I15.8 (ticket 121, 2026-09-23, `feature/121-selly-harmonogram-sync`): harmonogram (`scheduler_selly`→`src/selly/rest/scheduler.ts`, Tor 1 HH:55 + HH:10/25/40, Tor 2 04:30 z rotacją) i sześć tras `sync-*` (`routes_sync`→`src/routes/selly-sync.ts`) przeportowane z `88fa31c`, zamontowane w `server.ts`/`app.ts` z JEDNĄ instancją `discovery` na proces, za flagą `SELLY_SCHEDULER` (domyślnie wyłączoną). Naprawione trzy zastane defekty produkcji jako świadome odstępstwa: importy `syncDeltaForDostawca` i `runFullTodays` (obie nazwy nie istnieją → 500) oraz zgubiona lista dostawców w `sync-full-force` (`forceSuppliers` vs `opts.suppliers`). (Wcześniejszy port `13d-1`, PR #57, został **COFNIĘTY** `46-CHORE-revert-13d1-selly`, 2026-09-09 — I15.6/I15.7 to świeży, niezależny port z finalnego stanu produkcji, nie wznowienie tamtej gałęzi.) |

### #61 · 2026-09-01…04 · [FRONTEND] · Bridge ONE (rebrand) + tr_fix/ackalerts/szer_marka/PRICEFMT
| pole | wartość |
|---|---|
| **Kategoria** | FRONTEND (bundle zminifikowany) |
| **Pliki** | `mirror/frontend/assets/index-BRIDGEONE….js`, `index-PRICEFMT….js` (+ kopie `.bak_{tr_fix,ackalerts,szer_marka,konstr}`) |
| **Zmiana Ani** | Pięć etykiet, **rozkład diffu bundli zrobiony w 13e** (nazwa `.bak` dawała tylko etykietę): **rebrand** — `<title>` → „Bridge ONE — konsolidacja cenników opon" + 3× `children:"Bridge"`→`"BridgeOne"` (**bez spacji**: nagłówek mobilny, sidebar, `<h1>` logowania) + usunięcie podtytułu „dla Agrowca" w sidebarze i na logowaniu; `aria-label="Bridge"` na SVG oraz teksty pomocnicze **bez zmian**. ⚠ Rebrand jest z **2026-07-31**, nie z 09-01…04 — data w nagłówku tego wpisu opisuje nazwę PLIKU bundla, nie samą zmianę. **PRICEFMT** — w `DT` `cenaSprzedazy` odchodzi od wspólnej gałęzi z `cenaZakupu`: `toFixed(2)` → `` `${Math.floor(n)},-` `` (`1234,-`); eksport `OT` nietknięty. **tr_fix** — usunięcie tokenu `"tr-"` z listy `h2` („to nie opona"); regex `\btr-\b` łapał `TR-135` w nazwach opon BKT → fałszywy alert „Nie-opona w katalogu — błąd parsera". **ackalerts** — CZTERY zmiany: (1) odcisk wartości w `id` alertu (`-marza-ujemna-{marża}`, `-marza-niska-{marża}`, `-nie-opona-{nazwa\|kategoria}`, `-brak-importu-{dni}` w obu gałęziach ≥7 i ≥30 dni), (2) pulpit czyta `alerty-statusy` z IndexedDB i podaje do `pv(produkty, statusy)`, (3) `window.dispatchEvent(new Event("alerty-statusy-updated"))` po zapisie statusów, (4) `.filter(e => e.status!=="rozwiazany" \|\| filtrStatusu==="rozwiazany")`. **szer_marka** — **NIE kolumna**, dwie poprawki: (a) `Wfmt` traci gałąź „cała notacja `AxB`", (b) filtr „marka bez cyfr" dołożony na gałęzi SŁOWNIKOWEJ listy marek. |
| **Do nowej wersji?** | ✅ **TAK — i już było** (decyzja **D1**, 2026-09-09). Odbudowa ma rebrand 1:1 od ticketa 2 (`751a8e2`), bo deminifikat robiono z bundla PO rebrandzie. Rozjazd zapisu „Bridge ONE" (`<title>`) vs „BridgeOne" (UI) **jest w produkcji** i odtwarzamy go świadomie — nie ujednolicamy. `tr_fix` i `ackalerts` (1–3) → ✅ **sportowane w P6.2** (2026-09-21, `77-FEATURE-pseudo-alerty-katalogowe`, patrz #26) razem z silnikiem pseudo-alertów, który wcześniej był ich brakującym nośnikiem (D2 niżej — historyczne). |
| **Iteracja** | **→ 13e ✅ zamknięte 2026-09-09** (FE; `konstr` łączy się z #58 — FE zrobiony w 13c, a łatka produkcji okazała się regresją, patrz #71). ⚠ Sprostowanie 43-CHORE-i13b: pole mówiło „→ 13d" — niezgodne z tabelą mapowania i roadmapą (FE = 13e; 13d to Selly). |
| **Status** | ✅ **zrobione w 13e** (`47-CHORE-i13e-frontend-bridgeone`, 2026-09-09). Sportowane: **tylko `szer_marka`** (oba punkty) — `formatujSzerokosc` bez gałęzi `AxB` + filtr „bez cyfr" także na gałęzi słownikowej `listaMarek`; `listaKategorii` bez zmian. **rebrand i PRICEFMT odbudowa miała już 1:1** — deminifikat to bundle `index-PRICEFMT…` w stanie SPRZED 04.09, więc port z I0–I12 wciągnął je automatycznie, a trzech łatek z 04.09 nie. Pomiar na `db/snapshot.db`: **587 z 7395** pozycji zmienia zapis szerokości; eksport CSV zmienia się razem z tabelą, bo `OT` i `DT` dzielą `Wfmt` (potwierdzone grafem wywołań w żywym bundlu; w odbudowie `eksport.ts` woła to samo `formatujSzerokosc`). ⚠ **Zniesiona gałąź oddawała DWA PIERWSZE CZŁONY, nie cały `rozmiar`** — czytać jako `rozmiar` → dziś (dawniej): `8.00x20` → `8.00` (dawniej `8.00x20`), `300x15` → `300` (dawniej `300x15`), `14.9x28` → `14.9` (dawniej `14.9x28`), ale `16x6-8` → `16` (dawniej `16x6`) i `23x10.50-12` → `23` (dawniej `23x10.50`). **D2 — `tr_fix` i `ackalerts` (1–3), historyczne (do 2026-09-21):** silnika pseudo-alertów (`pv`/`v2`/`h2` + IndexedDB `alerty-statusy`) świadomie nie było (D1 z I6), więc obie łatki pozostawały zależne od decyzji przy #26; punkt (2) był wtedy spełniony konstrukcyjnie, bo pulpit odbudowy filtrował po `status==="nowy"` z REALNEJ odpowiedzi `GET /api/alerts`. **D3 — punktu (4), historyczne:** odbudowa miała wtedy DWA statusy (`nowy`/`rozwiazany`) i domyślny filtr ustawiony na `nowy`, więc reguła zdegenerowałaby opcję „Wszystkie statusy" do duplikatu „nowy" — cel łatki realizował już domyślny filtr. *(Aktualizacja P6.1, 2026-09-21, ticket 72: od tej karty odbudowa ma TRZY statusy, a domyślny filtr to „Nierozwiązane" (`status ≠ rozwiazany`), nie sam `nowy` — to realizuje cel punktu (4) łatki `ackalerts` [ukrycie `rozwiazany`] wprost, jeszcze dokładniej niż opisany tu degenerat. Samą D3 odwróciła decyzja 4 dla P6.2 [2026-09-21, patrz #26]: ukrywanie rozwiązanych wchodzi w pseudo-alertach, zbieżnie z tym filtrem.)* **P6.2 (2026-09-21, ticket 77) domyka D2 do końca:** silnik pseudo-alertów dostał nośnika (zakładka „Katalog" na `/alerty`), więc `tr_fix` i `ackalerts` pkt 1–3 są sportowane wprost, a nie tylko konstrukcyjnie — status na serwerze zamiast IndexedDB (świadome odstępstwo, patrz #26). `konstr` po stronie FE → patrz #58 (zrobione w 13c) i #71 (regresja żywej produkcji). |

### #62 · 2026-08-26…09-04 · [BAZA] · Backfille danych (tl_tt / szerokości ułamkowe / JMK) — DECYZJA
| pole | wartość |
|---|---|
| **Kategoria** | BAZA (jednorazowe UPDATE) — częściowo LOGIKA |
| **Pliki** | `data.db` (bez zmian kodu, poza regułami tl_tt) |
| **Zmiana Ani** | **tl_tt** 628 rek. (A: jawne TL; B: Ciężarowe+Radialna+śr≥17.5→TL; C: BKT MAGLIFT+Diagonalna+śr≤12→TT). **Szerokości ułamkowe** 10 rek. (parser już poprawny — #3). **JMK** 14 rek. marka/model + 27 `manual_overrides` (feed bez `Producent`). |
| **Do nowej wersji?** | ❌ **NIE — świadomie pominięte (decyzja 2026-09-08, `41-CHORE-i13f`)**. Cutover big-bang idzie na TEJ SAMEJ `data.db` (`docs/cutover.md`), którą Ania już zbackfillowała → wartości już są w bazie startowej odbudowy; odtwarzanie jako kod/migracja jest zbędne. Reguły tl_tt B/C NIE wchodzą do parsera (jednorazowe czyszczenie NULL-i, nie logika parsera; dodanie = odstępstwo od 1:1). Na przyszłe importy: parserowy default TL dla Ciężarowych (z 13a) + overrides JMK (w bazie). |
| **Iteracja** | **→ 13f ✅ ZAMKNIĘTE 2026-09-08** (bez kodu) |
| **Status** | ✅ rozstrzygnięte — bez implementacji. ⚠ Skutek uboczny (jak w produkcji): `products/clear`+reimport nie odtworzy B/C. |

### #63 · 2026-08-25 · [BACKEND] · p2_4 — rozszerzenie `parseSize` o L-series z profilem i ułamki
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND (parser rozmiaru) |
| **Pliki** | `parsers/tyre_params.cjs` (`normalizeSizeText`, `parseSize`; bak `.bak_p2_4_20260825_1601`) |
| **Zmiana Ani** | (A) `normalizeSizeText`: separator L-series rozszerzony z `[-R]` na `[-Rx]` — obsługa `28LX26`, `7,5Lx15`. (B) `parseSize`: wzorzec `W/PLxD`/`W/PL-D` dla L-series z profilem (`400/45Lx17` BKT TERRA TRAX, konstrukcja=L). (C) regex `W/P[RBD-]D` z `(\d{2,4})` na `(\d{1,4})` — łapie ułamkowe `6.5/75-14` (MITAS TS-02). Test node: 19/19 (12 anomalii + 7 regresja). UPDATE 12 rek. |
| **Do nowej wersji?** | ✅ TAK |
| **Iteracja** | **→ 13a** (kopia `tyre_params.cjs` wnosi to atomowo z b4/b10/odswinch) |
| **Status** | ✅ sportowane i POTWIERDZONE pomiarem w `42-CHORE-i13a-resync-parserow` (2026-09-08): 7 rek. (MO2 1, MO8 6) — ułamkowe szerokości z profilem (`6.5/80-12`, `9.0/75-16`, `4.00/4.50-21`). |

### #64 · 2026-09-04 · [BACKEND] · odswinch — zmiana w `tyre_params.cjs` NIEZALOGOWANA w CHANGELOG
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND (parser) — do charakteryzacji |
| **Pliki** | `parsers/tyre_params.cjs` (bak `.bak_odswinch_20260904_1403`) |
| **Zmiana Ani** | ⚠ Brak wpisu w `CHANGELOG.md` — istnieje tylko kopia `.bak_odswinch_20260904_1403`. Etykieta sugeruje „odśwież/inch" (obsługa cali/felgi?). **DO ROZŁOŻENIA:** `git diff` między `tyre_params.cjs.bak_odswinch_20260904_1403` a wersją po niej w `mirror/`, żeby ustalić realny zakres. |
| **Do nowej wersji?** | ✅ TAK (jest w produkcji 08.09) |
| **Iteracja** | **→ 13a** (kopia `tyre_params.cjs` wnosi to atomowo; charakteryzacja wychwyci behawior) |
| **Status** | ✅ sportowane i domknięte opisem realnego zakresu w `42-CHORE-i13a-resync-parserow` (2026-09-08): **+26/−1, dwa hunki, oba w `parseSize()`** — nowy wariant calowej notacji **OD×SW−Rim** (`16x6-8`, `23x10-12`, `18x7.50-8`; musi stać PRZED wzorcem `WxP-D`) + rozszerzenie strażnika `isWxSxD` o wariant calowy (`isWxSxDcale`). POTWIERDZONE pomiarem: 98 rek. (MO1 1, MO2 22, MO3 1, MO4 4, MO8 68, MO10 2). Pełny rozkład: `docs/tickets/42-CHORE-i13a-resync-parserow/raport.md`, sekcja „Rozłożenie `odswinch` (#64)". |

### #65 · 2026-09-09 · [BAZA] · `manual_overrides` nieprzemigrowane — override cofa konwencję przy imporcie
| pole | wartość |
|---|---|
| **Kategoria** | BAZA (dane, `manual_overrides`) |
| **Pliki** | tabela `manual_overrides` (`field_name='konstrukcja'`, `field_name='kategoria'`) |
| **Zmiana Ani** | Brak — to luka, nie zmiana. Zmierzone na `db/snapshot.db`: `field_name='konstrukcja'` → 3 rekordy z wartością `'D'`; `field_name='kategoria'` → 6944 rekordy ogółem, z tego 14 małą literą (9× `przemysłowe`, 5× `rolnicze`). Ania NIE migrowała ich ani 2026-08-18 (`apply_kategoria.cjs` dotyka wyłącznie `products`), ani 2026-09-01 (CHANGELOG 12:30 rusza `manual_overrides` tylko dla `field_name='nazwa'`). Skutek: przy kolejnym imporcie override wstrzykuje surową wartość z powrotem, więc te konkretne produkty wracają do kodu `D` / małej litery, mimo poprawnej kolumny w `products`. |
| **Do nowej wersji?** | ⬜ **do decyzji** — naprawa byłaby świadomym odstępstwem od 1:1 (13c odtworzyła zachowanie 1:1, plan D7; to luka PRODUKCJI, nie regresja odbudowy) |
| **Iteracja** | — (follow-up, nieprzypisany) |
| **Status** | ⬜ nierozstrzygnięte, ale **ZAWĘŻONE (triaż 2026-09-18)** — Ania rozwiązała u siebie połowę kategoryjną: `ca8a694` (17.09) przemigrował 14 wpisów `field_name='kategoria'` i dołożył triggery `manual_overrides_kategoria_ai/_au` normalizujące `override_value` przy każdym zapisie. **Zostają 3 wpisy `field_name='konstrukcja'` z wartością `'D'`** — ich Ania nie ruszyła, więc opisany tu mechanizm cofania konwencji dotyczy dziś już tylko `konstrukcja`. Kontekst: **#79**. Znalezione w `44-CHORE-i13c-migracje-konwencji`. |

> ⚠ **AKTUALIZACJA 2026-09-09 (po revercie #58) — dotyczy #66–#70.** Te pięć wpisów to defekty Selly
> znalezione podczas portu **13d-1**, który został **COFNIĘTY** (`git revert -m 1`, PR #58). Analiza
> produkcji w każdym z nich jest AKTUALNA i cenna (to realne defekty u Ani — zachowujemy jako wiedzę na
> przepisanie 13d). ALE odniesienia w polach „Iteracja"/„Status" typu „przeportowane 1:1 w 13d-1" są
> **NIEAKTUALNE** — kod portu usunięty. Przy ŚWIEŻYM przepisaniu 13d (z finalnego `mirror/selly/`, na
> NOWEJ gałęzi) trzeba te defekty odtworzyć/rozstrzygnąć na nowo. #71 (regresja `konstrukcja`) NIE jest
> tym dotknięte — to defekt produkcji FE, ważny bez zmian.
>
> **Domknięcie (2026-09-22, ticket 108, I15.6):** świeży port z `origin/main:7d6cfc9` zrobiony —
> #66/#69/#70 odtworzone 1:1 (patrz ich pola niżej), #67 tym razem naprawione świadomie (D4), #68 okazał
> się faktem obalonym (mapper istnieje, tylko nieosiągalny w Torze 1). Ten akapit zostaje jako historia.

### #66 · 2026-09-08 · [BACKEND] · Selly retry na HTTP 429 jest martwym kodem — gasi go throttle, nie retry
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND (Selly, `discovery.cjs`/`client.cjs`) |
| **Pliki** | `mirror/backend/selly/client.cjs:56-60` (`request()`), `discovery.cjs:27-36` (`apiWithRetry`); port: `rebuild/backend/src/selly/discovery.ts` (`wykonajZPonowieniem`) |
| **Zmiana Ani** | Brak — to defekt zastanego kodu, znaleziony przy porcie `45-FEATURE-selly-rest-sync-tor1` (13d-1). `client.cjs:request()` odrzuca (rzuca) każdą odpowiedź spoza 2xx, więc `apiWithRetry` nigdy nie ogląda `r.status !== 429` — gałąź backoff z `Retry-After` jest nieosiągalna. Burzę 429 z cyklu 07.09 20:10 ugasił `globalLimiter.acquire()` (throttle przed każdym requestem), nie retry. |
| **Do nowej wersji?** | ✅ TAK — **odtworzone 1:1** (decyzja D2, `45-FEATURE-selly-rest-sync-tor1`): naprawa zmieniłaby obserwowalne zachowanie (mniej wpisów `error`, inne czasy) względem produkcji. Gałąź zostaje w kodzie jako nieosiągalna, z komentarzem. |
| **Iteracja** | zamknięte w **13d-1** (port odtwarza defekt 1:1) |
| **Status** | ✅ udokumentowane i przeportowane 1:1; nie wymaga dalszej akcji, chyba że Ania naprawi u siebie — wtedy do rewizji przy 13d-2. Tor 2 (ticket 109, I15.7) odtwarza ten sam charakter defektu: gałęzie „PUT zwrócił status spoza 2xx” po zapisie są martwe (klient rzuca na non-2xx). |

### #67 · 2026-09-08 · [BACKEND][BAZA] · stary `POST /api/selly/sync-supplier` (I8) zepsuty przez nowy schemat `selly_products`
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND + BAZA (Selly, panel I8) |
| **Pliki** | `mirror/backend/selly/routes.cjs:417` (INSERT gałęzi CREATE); port: `rebuild/backend/src/repos/selly.ts:215` |
| **Zmiana Ani** | Migracja modelu wariantowego (07.09, patrz #60) dodała `NOT NULL` na `kod_importu`/`dostawca` w `selly_products`, ale stary INSERT z I8 (`routes.cjs:417`) tych kolumn nie podaje. Gałąź CREATE pada na `NOT NULL constraint failed`. Produkt **POWSTAJE w Selly** (wywołanie HTTP poszło), ale mapowanie lokalne nie zapisuje się → kolejny przebieg tworzy go **ponownie**. |
| **Do nowej wersji?** | ⚠ **ZMIANA DECYZJI — ŚWIADOME ODSTĘPSTWO (decyzja użytkownika 2026-09-22, D4 ticketu 108).** Poprzednia decyzja (D3, `45-FEATURE-selly-rest-sync-tor1`, port cofnięty) mówiła „odtworzone 1:1". Teraz naprawione świadomie: gałąź CREATE starego `sync-supplier`/`sync-product` (I8) zapisuje `kod_importu`/`dostawca` do mapowania; produkt bez nich (0 z 7405 w snapshocie) kończy się czytelnym błędem „brak kod_importu lub dostawca" PRZED wywołaniem Selly, żeby nie zakładać produktu, którego mapowania nie da się zapisać. Gałąź UPDATE bez zmian (1:1). **Produkcja nadal ma ten defekt** — opis wyżej („Zmiana Ani") opisuje stan produkcji, nie odbudowy. |
| **Iteracja** | naprawione w **I15.6** (ticket 108, 2026-09-22) |
| **Status** | ✅ **naprawione (świadome odstępstwo od 1:1)** — panel I8 zapisuje mapowanie poprawnie zamiast padać na `NOT NULL`. Skutek uboczny: produkt założony tym przyciskiem ma mapowanie bez `selly_variant_id` — Tor 1 odnajdzie go po EAN, ale ponieważ domyślny wariant nie ma cechy „Magazyny", discovery dołoży DRUGI wariant (stan lepszy niż produkcja, gdzie powstaje kolejny produkt; do rozważenia z Anią po cutoverze). |

### #68 · 2026-09-08 (fakt obalony 2026-09-22, ticket 108) · [BACKEND] · `discovery.createProduct` — mapper istnieje, ale w Torze 1 nieosiągalny (nie brakujący, jak sądzono)
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND (Selly, Tor 2) |
| **Pliki** | `mirror/backend/selly/discovery.cjs:147` (`createProduct`); `mapper_v2.cjs:159-187` (`buildProductPayload`, eksport w linii 227) — **funkcja ISTNIEJE**; port: `rebuild/backend/src/selly/rest/discovery.ts` |
| **Zmiana Ani** | ⚠ **Fakt obalony (weryfikacja w ticket 108, 2026-09-22).** Pierwotny wpis mylił się: `mapper_v2.buildProductPayload` istnieje od 2026-09-08 15:12 (`origin/main:mirror/backend/selly/mapper_v2.cjs:159-187`, eksport :227) i działa. `createProduct` jest kompletny i używany z **Toru 2** (`sync_full.cjs:226` podaje `dictMaps`); w **Torze 1** (`sync_delta.cjs:137`) `ensureMapping` woła się BEZ `dictMaps`, więc ścieżka `createProduct` jest tam nieosiągalna z definicji — nie dlatego, że mappera brakuje. Brak w CHANGELOG dowodu udanego prawdziwego POST-a nowego produktu na produkcji. |
| **Do nowej wersji?** | — pytanie bezprzedmiotowe, patrz Status. |
| **Iteracja** | port `createProduct` 1:1 z wstrzykiwanym `budujPayloadProduktu` (decyzja D1) → **I15.6** (ticket 108); wpięcie prawdziwego `mapper_v2.buildProductPayload` jako `budujPayloadProduktu` → **I15.7** |
| **Status** | ✅ **zamknięte jako fakt obalony** — nie ma tu defektu do naprawy. `createProduct` przeportowany 1:1 z wstrzykiwanym builderem payloadu (Tor 1 go i tak nie osiąga); I15.7 wpina prawdziwy mapper dla Toru 2. |

### #69 · 2026-09-09 · [BACKEND][BAZA] · `pending_create` nie ma jak trafić do `selly_products` — błąd liczy się w statystykach, nie zostawia śladu w bazie
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND + BAZA (Selly, discovery + sync_delta) |
| **Pliki** | `mirror/backend/selly/discovery.cjs:213-218` (krok „rodzeństwo"), `sync_delta.cjs:96-103` (`markError`); port: `rebuild/backend/src/selly/rest/discovery.ts`, `rebuild/backend/src/selly/rest/sync-delta.ts` |
| **Zmiana Ani** | Brak — zastany defekt, wyszedł przy pisaniu testów w `45-FEATURE-selly-rest-sync-tor1` (13d-1, port cofnięty), niezależnie zweryfikowany w code review na oryginale. Krok „rodzeństwo" szuka `selly_product_id` po samym `kod_importu`, a ta kolumna jest `NOT NULL` — więc **jeśli wiersz istnieje, rodzeństwo zawsze poda `product_id`** (wiersz podaje go sam sobie) i sterowanie nigdy nie dochodzi do gałęzi „brak dictMaps"; **jeśli wiersza nie ma**, komunikat `'produkt nie istnieje w Selly ale brak dictMaps do createProduct'` owszem powstaje, ale `markError` robi `UPDATE ... WHERE kod_importu=? AND dostawca=?` bez `INSERT` i nie trafia w żaden wiersz. Błąd jest policzony w `stats.err`/`errors[]`, ale w bazie nie zostaje ślad — zgodne z komentarzem DDL, który zna tylko `pending \| ok \| error \| not_found` (nie `pending_create`). |
| **Do nowej wersji?** | ✅ TAK — **odtworzone 1:1** w porcie. Kosmetyczny defekt operacyjny: Tor 1 i tak ustawia `ok` po udanym PUT-cie, więc synchronizacja się nie psuje, ale diagnostyka w panelu jest myląca (produkt nieznany w Selly nie zostawia śladu). |
| **Iteracja** | port defektu zamknięty w **I15.6** (ticket 108, 2026-09-22, świeży port z `origin/main:7d6cfc9`; poprzedni port `13d-1` był cofnięty rewertem #58); naprawa → **do decyzji Ani po cutoverze** |
| **Status** | ⬜ kandydat do decyzji Ani po cutoverze — nie blokuje synchronizacji, tylko zaciemnia diagnostykę. Tor 2 (ticket 109, I15.7) odtwarza ten sam charakter defektu: `markError` robi `UPDATE` bez `INSERT` (własna klasyfikacja `missing_dict`/`error`, inna niż Tor 1). |

### #70 · 2026-09-09 · [BACKEND][BAZA] · `ON CONFLICT DO UPDATE` w discovery nie odświeża `ostatni_status` — stary `pending_create` przeżywa udane odnalezienie wariantu
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND + BAZA (Selly, discovery) |
| **Pliki** | `mirror/backend/selly/discovery.cjs:229-234` (`ON CONFLICT(kod_importu, dostawca) DO UPDATE`); port: `rebuild/backend/src/selly/rest/discovery.ts` |
| **Zmiana Ani** | Brak — zastany defekt, zweryfikowany w `45-FEATURE-selly-rest-sync-tor1` (13d-1, port cofnięty). UPSERT po odnalezieniu/utworzeniu wariantu nie nadpisuje kolumny `ostatni_status`, więc wiersz, który wcześniej dostał `pending_create`, po udanym `found_variant`/`created_variant` nadal pokazuje `pending_create` w panelu, mimo że mapowanie jest już poprawne. |
| **Do nowej wersji?** | ✅ TAK — **odtworzone 1:1** w porcie. Kosmetyczny defekt operacyjny, ten sam charakter co #69 (nie psuje synchronizacji, tylko diagnostykę). |
| **Iteracja** | port defektu zamknięty w **I15.6** (ticket 108, 2026-09-22, świeży port z `origin/main:7d6cfc9`; poprzedni port `13d-1` był cofnięty rewertem #58); naprawa → **do decyzji Ani po cutoverze** |
| **Status** | ⬜ kandydat do decyzji Ani po cutoverze — nie blokuje synchronizacji, tylko zaciemnia diagnostykę. Ścieżki B/C Toru 2 (ticket 109, I15.7) wołają ten sam `discovery.ensureMapping`, więc odziedziczają ten defekt bez zmian. |

### #71 · 2026-09-09 · [FRONTEND] · regresja `konstrukcja` w ŻYWEJ produkcji — łatka pass-through poszła w martwy bundle
| pole | wartość |
|---|---|
| **Kategoria** | FRONTEND (bundle produkcji) — defekt PRODUKCJI, nie odbudowy |
| **Pliki** | `mirror/frontend/index.html:16` (ładuje `assets/index-PRICEFMT1783512500.js`), `mirror/frontend/assets/index-BRIDGEONE21783342500.js` (+ `.bak_konstr_20260901_1122`), `mirror/backend/CHANGELOG.md:101` — kopie `.bak` i ta linia CHANGELOG-a są na gałęzi `main` |
| **Zmiana Ani** | Łatka `konstr` z 2026-09-01 11:22 (pass-through `"Diagonalna":n\|\|""` w `OT` / `:n\|\|null` w `DT`, obok mapowania kodów `R/D/L/B`) została przyłożona **wyłącznie do `index-BRIDGEONE21783342500.js`** — do bundla, którego `index.html` nie ładuje, martwego od łatki `pricefmt` z 31.07. Ania sama wpisała tę ścieżkę do CHANGELOG-a (`…/panel/assets/index-BRIDGEONE21783342500.js`). Żywy `index-PRICEFMT1783512500.js` ma `…"Diagonalna":""` / `…"Diagonalna":null`, bez `n\|\|`. Wykryte przy rozkładaniu diffu bundla w 13e. |
| **Skutek w produkcji** | Po migracji `konstrukcja` na pełne słowa (SQL produkcji z 2026-09-01 11:35, **7392 wiersze** — patrz #58) frontend zna już tylko kody, a w bazie są słowa: **produkcja pokazuje dziś „—" w kolumnie „Konstrukcja opony" i pustą kolumnę w eksporcie CSV** dla wszystkich zmigrowanych wierszy. |
| **Do nowej wersji?** | ❌ **NIE — świadomie NIE odtwarzamy** (decyzja **D4**, 2026-09-09, `47-CHORE-i13e-frontend-bridgeone`). Odbudowa ma pass-through od 13c i działa poprawnie; wdrożenie regresji oznaczałoby cofnięcie 13c. To świadome odstępstwo od żywej produkcji — odbudowa jest tu POPRAWNIEJSZA. Wpis #58 sprostowany. |
| **Iteracja** | wykryte w **13e** (bez kodu w odbudowie); naprawa dotyczy **PRODUKCJI**, nie `rebuild/` |
| **Status** | ✅ **ZAMKNIĘTE — Ania naprawiła to u siebie 2026-09-09** (commit `28541ca`, etykieta `konstrukcja_full`), ustalone w triażu 2026-09-18. Łatka trafiła tym razem w ŻYWY `index-PRICEFMT1783512500.js`; zamiast pass-through Ania rozpoznaje pełne nazwy obok kodów i przestawiła listy wyboru na „Radialna"/„Diagonalna". Szczegóły i jedyna pozostała różnica wobec odbudowy (wartość spoza zbioru → u Ani „—", u nas dosłownie): **#72**. Zgłaszanie Ani nieaktualne. |

### #72 · 2026-09-09 · [FRONTEND] · `konstrukcja` naprawiona w ŻYWYM bundlu — #71 zamknięty przez Anię
| pole | wartość |
|---|---|
| **Kategoria** | FRONTEND (bundle produkcji) |
| **Pliki** | `mirror/frontend/assets/index-PRICEFMT1783512500.js` (bak `.bak_pre_konstrukcja_full_20260909154703`), `deminified/frontend-index.js`, `mirror/backend/CHANGELOG.md` |
| **Commit** | `28541ca` (2026-09-09 16:00) |
| **Do nowej wersji?** | ❌ **NIE — świadomie pomijamy.** Decyzja użytkownika 2026-09-18: odbudowa ma pass-through od 13c i działa poprawnie, więc **zostawiamy nasze rozwiązanie jako lepsze**. Przenosimy tylko wniosek: wpis **#71** zamknięty. Jedyna pozostała różnica (wartość spoza zbioru → u Ani „—”, u nas dosłownie) jest świadomie przyjęta. |
| **Status** | ✅ **zamknięte, bez pracy w `rebuild/`** — kodu nie przenosimy (decyzja ❌). Jedyny skutek: wpis **#71** przestawiony na rozwiązany. |

**Opis biznesowy.** Zgłoszenie Ani: mimo poprawnych danych w bazie kolumna „Konstrukcja opony"
w katalogu nie pokazywała żadnej wartości. Ania poprawiła renderer i eksport tak, żeby przyjmowały
pełne nazwy `Radialna`/`Diagonalna` obok starych skrótów, a formularz edycji oferuje teraz dwie
pełne nazwy zamiast listy `R`/`D`/`B`/`-`.

**Szczegół techniczny (dla rebuildu).** Cztery miejsca w bundlu: `PRODUCT_FIELD_CONFIG` (opcje
selecta `konstrukcja`: `["R","D","B","-"]` → `["Radialna","Diagonalna"]`), `OT()` (ścieżka eksportu)
i `DT()` (renderer komórki) — oba dostały `"Radialna"===n||"R"===n ? "Radialna" : "Diagonalna"===n||"D"===n||"L"===n||"B"===n ? "Diagonalna" : ""`,
oraz formularz `LT()` (`h("Konstrukcja","konstrukcja",["Radialna","Diagonalna"])`). **Tym razem
łatka trafiła w ŻYWY bundle** — `mirror/frontend/index.html` ładuje `index-PRICEFMT1783512500.js`
(zweryfikowane `grep`em), a to właśnie ten plik Ania zmieniła.

**Rekomendacja (moja).** ❌ **nie przenosić kodu** — odbudowa ma pass-through od 13c i działa
poprawnie. Wartość tego wpisu jest inna: **to zamyka wpis #71** („łatka pass-through poszła
w martwy bundle"). Status #71 zmieniam na rozwiązany po stronie produkcji.
⚠ **Jedna różnica do świadomego przyjęcia:** u Ani wartość SPOZA zbioru (`Radialna`/`Diagonalna`/
`R`/`D`/`L`/`B`) renderuje się jako pusta („—"), a odbudowa (pass-through z 13c) pokaże ją
dosłownie. Zbiór `konstrukcja` w bazie po migracji z 01.09 ma tylko dwie wartości, więc dziś to
różnica teoretyczna — ale gdyby 14b/14c dotykały tej kolumny, warto o niej pamiętać.

### #73 · 2026-09-10 · [BAZA][BACKEND][FRONTEND] · `blokowane_formy_platnosci` — nowa kolumna, moduł, triggery i 60. kolumna CSV
| pole | wartość |
|---|---|
| **Kategoria** | BAZA + BACKEND + FRONTEND (nowa funkcja) |
| **Pliki** | `mirror/backend/payment_blocks.cjs` (**nowy**, 84 l.), `extensions.cjs` (bak `.bak_pre_payment_blocks_20260910_145354`), `parsers/adapter.cjs` (bak j.w.), `generate_selly_export.cjs` (bak j.w.), `db/schema.sql` (kolumna + 2 triggery), `mirror/frontend/assets/payment-blocks-injection.js` (**nowy**, 74 l., bak `.bak_routefix_20260910_150140`), `mirror/frontend/index.html` |
| **Commit** | `7fe02fd` (2026-09-10 15:00) + `0c4d2f2` (routefix + publikacja CSV, 16:00) |
| **Do nowej wersji?** | ✅ **TAK** — decyzja użytkownika 2026-09-18 (`52-CHORE-triaz-produkcja-i14`) |
| **Status** | ✅ **zrobione w trzech krokach.** Schemat: **I15.1** (ticket 107, migracja 011) — kolumna `blokowane_formy_platnosci` + backfill + triggery `products_blokowane_formy_ai/_au` bajt w bajt z `7d6cfc9`. Parser: **I15.2** (ticket 120, 2026-09-23) — `payment_blocks.cjs` w `legacy/` bajt w bajt, adapter nadaje `blokowaneFormyPlatnosci` wszystkim rekordom (potwierdzone na 4 843 rekordach pełnych cenników i na 1 838 rekordach wzorca charakteryzacji). Katalog i CSV: **I15.3** (ticket 122, 2026-09-23) — 60. kolumna CSV `Blokowane-formy-platnosci` (z fallbackiem po `dostawca`) i kolumna „Blokowane formy płatności” w `/katalog`, liczona w froncie z kodu dostawcy. Pole pozostaje ukryte w `GET /api/products` — patrz „Szczegół techniczny” niżej; to **nie jest dług, tylko odtworzenie produkcji**. ⚠ Ania 22.09 zgłaszała puste pole przy nowych produktach → **#101 zamknięte 23.09**: pomiar i potwierdzenie Ani — problemu nie ma. |

**Opis biznesowy.** Prośba Ani po korespondencji z Selly: sklep chce blokować formy płatności
i dostawy niedostępne dla danego magazynu. Każdy dostawca MO1–MO5 i MO7–MO10 dostał własną listę
identyfikatorów form płatności do zablokowania; MO6 (Uniglory) zostaje pusty, bo „nie będzie na
razie w sprzedaży", nieznani dostawcy również. Wartość widać w katalogu panelu jako kolumnę
„Blokowane formy płatności" i na końcu pełnego eksportu CSV dla Selly (kolumna
`Blokowane-formy-platnosci`, identyfikatory rozdzielone przecinkiem ze spacją). Drugi commit
(`0c4d2f2`) to poprawka: kolumna nie pokazywała się w panelu, bo skrypt rozpoznawał widok
katalogu po `location.pathname`, a żywy frontend używa routera haszowego — dołożono obsługę
`#/katalog` i `hashchange` oraz wersję w parametrze skryptu, żeby ominąć cache przeglądarki.

**Szczegół techniczny (dla rebuildu).** `payment_blocks.cjs` eksportuje zamrożoną mapę
`BLOCKED_PAYMENT_FORMS` (kod dostawcy → string z listą ID 201–219), `getBlockedPaymentForms(kod)`,
`sqlCase(kolumna)` (generator wyrażenia `CASE UPPER(TRIM(...)) WHEN 'MO1' THEN ... END`) oraz
`ensurePaymentBlocks(dbPath)`, który idempotentnie robi `ALTER TABLE products ADD COLUMN
blokowane_formy_platnosci TEXT`, uzupełnia istniejące wiersze i zakłada triggery
`products_blokowane_formy_ai` (AFTER INSERT) i `products_blokowane_formy_au`
(AFTER UPDATE OF dostawca). `extensions.cjs:register()` woła `ensurePaymentBlocks()` przy starcie,
w `try/catch` z logiem. `adapter.recordToSuroweDostawca()` dokłada `s.blokowaneFormyPlatnosci`.
`generate_selly_export.cjs` dostaje 60. kolumnę i fallback `getBlockedPaymentForms(row.dostawca)`,
gdy pole w bazie puste.

**Pomiar rozstrzygający (ticket 122, 23.09).** Oryginał `88fa31c` postawiony na kopii
`db/snapshot.db` z kolumną wypełnioną dla 7405 produktów i obydwoma triggerami (via
`payment_blocks.ensurePaymentBlocks()`) oddaje na `GET /api/products?limit=5` **72 klucze, bez
`blokowaneFormyPlatnosci`** — `grep -c blokowane_formy_platnosci mirror/backend/index.cjs` = **0**,
bundle nie zna kolumny dokładanej runtime'owym `ALTER TABLE`, a produkty czyta Drizzle bez jawnej
listy pól (ten sam mechanizm co `uwagaCena`). Dlatego wartość w katalogu produkcja liczy w
przeglądarce (`payment-blocks-injection.js`), a nie z API — i odbudowa robi identycznie
(`rebuild/frontend/src/pages/katalog/formatowanie.tsx`). Pole zostaje w `KOLUMNY_POZA_KONTRAKTEM`,
fixture'y i `openapi.yaml` bez zmian.

**Rekomendacja (moja).** ✅ **nanieść** — to nowa funkcja produktowa, nie defekt, i dotyka trzech
warstw naraz. Trzy uwagi:
1. **To dokładnie ten wzorzec, na który uczula CLAUDE.md**: kolumna dokładana runtime'owym
   `ALTER TABLE` z modułu startowego, nie migracją — czyli dla Drizzle **niewidoczna**, tak samo
   jak `products.uwaga_cena`. W odbudowie musi wejść jako **migracja + pole w modelu**, inaczej
   nie wyjdzie przez `GET /api/products` mimo obecności w tabeli.
2. Mapa MO→ID to **dane konfiguracyjne, nie logika** — w odbudowie warto ją trzymać tak,
   żeby dało się ją zmienić bez deployu (Ania będzie ją ruszać przy każdym nowym magazynie).
3. `rebuild/backend/src/selly/generator-csv.ts` ma dziś **59 kolumn** i nie zna
   `Blokowane-formy-platnosci` — dopisanie 60. kolumny rusza fixture CSV, więc idzie razem z #76/#77.

### #74 · 2026-09-11 · [BACKEND][BAZA] · kategorie Selly przebudowane — stare ID 137/259/377 dają 404, żywe to 1/2/3/4
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND + BAZA (Selly, mapowanie kategorii) |
| **Pliki** | `mirror/backend/kategoria_norm_map_pplx.sql` (bak `.bak_pre_category_fix_20260911_101000`), `zastosowanie_selly_map_pplx.sql` (bak j.w.), `zastosowanie_selly_map_v2_pplx.sql` (bak j.w.), `selly/sync_full.cjs` (bak j.w.) |
| **Commit** | `2a2a1da` (2026-09-11 11:00) |
| **Do nowej wersji?** | ✅ **TAK** — decyzja użytkownika 2026-09-18 (`52-CHORE-triaz-produkcja-i14`) — **wykonanie razem z przepisywanym 13d** (dziś I15.6/I15.7), nie osobno. |
| **Status** | ✅ **domknięte po stronie Toru 2 (ticket 109, I15.7, 2026-09-22).** Ticket 108 (I15.6): kod discovery nie ma żadnych zahardkodowanych ID kategorii — `selly_category_id` bierze się wyłącznie z `dictMaps.catMap` (wstrzykiwane z zewnątrz). Ticket 109: `loadDictMaps()` (`src/selly/rest/sync-full.ts`) czyta `catMap` z `selly_kategoria_norm_map` (klucz `lower(kategoria_raw)`) — zero ID kategorii zaszytych w kodzie, sprawdzone testem. |

**Opis biznesowy.** Audyt synchronizacji wykazał dwie rzeczy naraz. Po pierwsze, w lokalnym cache
`selly_products` brakowało 95 wpisów dla produktów i wariantów, które w Selly już istniały
(MO2 = 1, MO3 = 88, MO4 = 6) — Ania je odtworzyła bez tworzenia nowych produktów. Po drugie, Selly
przebudowało u siebie drzewo kategorii: identyfikatory, na które Bridge kierował produkty, są dziś
niewidoczne albo zwracają 404. Bridge mapuje teraz kategorię główną na żywe ID sklepu, a martwe ID
podkategorii zastosowań wycofano — podkategoria dziedziczy kategorię główną produktu.

**Szczegół techniczny (dla rebuildu).** `kategoria_norm_map_pplx.sql` (ładowany do
`selly_kategoria_norm_map`): `przemysłowe` 137 → **3**, `ciężarowe` 259 → **4**, `leśne` 377 → **2**;
`rolnicze` i `rolnicze małe` zostają na **1**. Komentarz w `sync_full.cjs:loadDictMaps()` opisujący
starą hierarchię został przepisany („1=rolnicze, 2=lesne, 3=przemyslowe, 4=ciezarowe. Stare ID
137/259/377 zostaly usuniete w Selly i zwracaja 404"). Zmiana `sync_full.cjs` jest **wyłącznie
komentarzowa** — ID siedzą w danych, nie w kodzie. Pliki `zastosowanie_selly_map_pplx.sql`
i `zastosowanie_selly_map_v2_pplx.sql` wycofują martwe ID podkategorii.

**Rekomendacja (moja).** ✅ **nanieść**, ale **razem z przepisywanym 13d**, nie osobno — to zmiana
w danych inicjalizujących podsystemu, którego port został cofnięty (revert #58). Ważny fakt
przy okazji: **ID kategorii Selly są zmienne w czasie**, więc odbudowa nie powinna ich hardkodować
w kodzie; miejscem prawdy zostaje tabela `selly_kategoria_norm_map` ładowana z pliku SQL. Wpis
wiąże się z #76 (nazwy kategorii w CSV) — tam ten sam problem rozwiązany po stronie eksportu
plikowego, a tu po stronie API.

### #75 · 2026-09-13 · [BACKEND][BAZA] · `application_rules.cjs` — zamknięta lista zastosowań per kategoria, wspólna dla parsera, adaptera i triggerów
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND + BAZA (nowy moduł reguł) |
| **Pliki** | `mirror/backend/application_rules.cjs` (**nowy**, 238 l.), `parsers/tyre_params.cjs` (bak `.bak_pre_zastosowania_20260913_192923`), `parsers/adapter.cjs` (bak j.w.), `extensions.cjs` (bak j.w.), `db/schema.sql` (2 triggery), `zastosowanie_niezmapowane.json` (raport) |
| **Commit** | `74b7442` (2026-09-13 20:00) |
| **Do nowej wersji?** | ✅ **TAK** — decyzja użytkownika 2026-09-18 (`52-CHORE-triaz-produkcja-i14`) — nanieść jako jeden stan końcowy z #79/#80/#82. |
| **Status** | ✅ schemat: triggery `products_zastosowanie_ai/_au` — **107 / migracja 011**, w stanie końcowym uwzględniającym #79/#80/#82, bajt w bajt z `7d6cfc9`. ✅ **parser: DOWIEZIONY w I15.2** (ticket 120, 2026-09-23) — `application_rules.cjs` w `legacy/` bajt w bajt, `tyre_params.cjs` deleguje do niego; `zastosowanie` i kanonizacja `kategoria` pojawiły się w 1 838 rekordach wzorca charakteryzacji. |

**Opis biznesowy.** Audyt wykazał produkty z zastosowaniem z zupełnie innej kategorii — np. opony
Rolnicze z zastosowaniem „Harwester"/„Forwarder". Ania wprowadziła zamkniętą listę dopuszczalnych
zastosowań dla każdej z czterech kategorii; wartość spoza listy przechodzi na
`Uniwersalne/pozostałe`. Jednorazowy backfill poprawił **678 rekordów** (Przemysłowe 373,
Rolnicze 151, Leśne 106, Ciężarowe 48). Reguły działają też jako triggery bazy, więc nie cofnie ich
ani kolejny import, ani odtwarzanie zastosowań z pliku.

**Szczegół techniczny (dla rebuildu).** Nowy moduł eksportuje `CATEGORY_VALUES` (Rolnicze: Ciągnik,
Kombajn, Opryskiwacz, Przyczepa, Ładowarka, Kosiarka/ogród, Wózek widłowy, Uniwersalne/pozostałe;
Przemysłowe: Ładowarka, Koparka, Kompaktor, Suwnica/dźwig, Maszyny górnicze, Wózek widłowy, Uniw.;
Ciężarowe: All position, Oś kierowana, Oś napędowa, Naczepa/przyczepa, Uniw.; Leśne: Ciągnik leśny,
Harwester, Forwarder, Skidder, Uniw.), `CATEGORY_ALIASES`, `canonicalCategory()`,
`normalizeApplication()`, `normalizeCategoryApplication()` i `ensureApplicationRules()`.
Pipeline: `adapter.recordToSurowe()` liczy `categoryApplication` **raz** i zapisuje z niego oba pola
(`kategoria` i `zastosowanie`) — dotąd `kategoria` szła przez `common.capitalizeKategoria()`,
a `zastosowanie` nie było normalizowane wcale. `tyre_params.normalizeCategoryApplication()` to cienki
re-export modułu. `extensions.cjs:register()` woła `ensureApplicationRules()` przy starcie (obok
`ensurePaymentBlocks()` z #73). Triggery `products_zastosowanie_ai`/`_au` mają w tej wersji jeszcze
warunek `WHEN NEW.zastosowanie IS NOT NULL AND TRIM(...) <> ''` (zmieniony w #79).

**Rekomendacja (moja).** ✅ **nanieść** — to zmiana w rdzeniu importu (wzorzec normalizacji
w `adapter.recordToSurowe()`, ten sam punkt, który odbudowa portowała w 13a/13b), więc dotyczy
`rebuild/backend/src/import/`, a nie Selly. **Uwaga na kolejność:** #75, #79, #80 i #82 to cztery
kolejne warstwy na TYM SAMYM module — nanosić jako jeden spójny stan końcowy (`03fe892`), nie
cztery osobne kroki, inaczej odtworzysz po drodze błąd kolejności trigger/backfill z #80.
Wprost: **`ensureApplicationRules()` jest w odbudowie nowym bytem** (dziś `grep` nie znajduje ani
`application_rules`, ani nic równoważnego).

### #76 · 2026-09-14 · [BACKEND] · eksport Selly: nazwy kategorii sklepu, mapowanie `ł`→`l` i POWRÓT nagłówka `R/D`
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND (generator CSV dla Selly) |
| **Pliki** | `mirror/backend/generate_selly_export.cjs` (baki `.bak_pre_selly_category_names_20260914_130000`, `.bak_fix_polish_l_20260914_131800`, `.bak_pre_restore_rd_header_20260914_140000`) |
| **Commit** | `b580628` (2026-09-14 14:00 — trzy wpisy CHANGELOG w jednym commicie) |
| **Do nowej wersji?** | ✅ **TAK** — decyzja użytkownika 2026-09-18 (`52-CHORE-triaz-produkcja-i14`) — do naniesienia `toSellyCategoryName` (pkt 1–2); pkt 3 (nagłówek `R/D`) odbudowa już ma. |
| **Status** | ✅ **zrobione ticketem 122 (I15.3, 2026-09-23).** Pkt 1–2: `toSellyCategoryName` → `nazwaKategoriiSklepu`, z jawnym `ł`→`l`, naniesione i pokryte testem (`Przemysłowe`→`Opony przemysłowe`). Pkt 3: potwierdzone testem, nie tylko założone — nagłówek `R/D` na pozycji 30 z wartościami „Radialna”/„Diagonalna”. |

**Opis biznesowy.** Trzy poprawki tego samego pliku w ciągu godziny, wszystkie wokół importera CSV
Selly. (1) Automatyczny integrator o 12:00 wciąż przypisywał produkty do starych, ukrytych kategorii
7–10, bo CSV niósł wewnętrzne nazwy Bridge — generator mapuje je teraz na nazwy żywych kategorii
sklepu („Opony rolnicze", „Opony leśne", „Opony przemysłowe", „Opony ciężarowe"; „Rolnicze małe"
idzie do „Opony rolnicze"). (2) Kontrola pierwszego eksportu wykazała, że jedna z czterech kategorii
zachowała starą nazwę — standardowa normalizacja Unicode nie rozkłada litery `ł`, więc
„Przemysłowe" nie trafiało w mapę; dołożono jawne mapowanie `ł`→`l`. (3) Selly przestało
aktualizować cechę konstrukcji po zmianie nagłówka CSV z `R/D` na `Konstrukcja` (zmiana z 01.09) —
nagłówek **wrócił na `R/D`**, a wartości w kolumnie zostają pełne („Radialna"/„Diagonalna").

**Szczegół techniczny (dla rebuildu).** Nowa `toSellyCategoryName(value)`: `trim` →
`toLocaleLowerCase('pl-PL')` → `normalize('NFD')` → usunięcie `\p{Diacritic}` → **`.replace(/ł/g,'l')`**
→ zbicie spacji, potem `Map` (`rolnicze`, `rolnicze male`, `lesne`, `przemyslowe`, `ciezarowe`)
z fallbackiem na wartość surową. Wołana dla nagłówka `Kategoria`. Nagłówek kolumny `konstrukcja`
wrócił z `'Konstrukcja'` na `'R/D'`; komentarz o 59 kolumnach poprawiony na 60 (po #73).

**Rekomendacja (moja).** ✅ **nanieść** — z jednym miłym skutkiem ubocznym: **odbudowa nigdy nie
przejęła zmiany nagłówka z 01.09**, `rebuild/backend/src/selly/generator-csv.ts:79` ma do dziś
`["R/D", "konstrukcja"]`. Punkt (3) to więc **powrót produkcji do stanu, który odbudowa już ma** —
nie ma tu nic do przenoszenia, jest za to potwierdzenie, że nasz kształt jest poprawny.
Do naniesienia zostają (1) i (2), czyli `toSellyCategoryName`.
⚠ Punkt (2) to **dokładnie pułapka z CLAUDE.md o polskich znakach**, tylko w wersji JS: `NFD` +
usunięcie diakrytyków **nie rozkłada `ł`**, bo to osobny znak, nie litera z diakrytykiem. Ten sam
błąd co ASCII-only `UPPER()` w SQLite z 13c. Jeżeli w odbudowie jest gdziekolwiek slug kategorii
budowany przez `normalize('NFD')`, ma ten sam defekt.

### #77 · 2026-09-14 · [BACKEND][BAZA] · produkty `wstrzymany` trafiają do eksportu i do delty — zawsze ze stanem 0
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND + BAZA (eksport CSV + Tor 1 Selly) |
| **Pliki** | `mirror/backend/generate_selly_export.cjs` (bak `.bak_pre_wstrzymane_zero_20260914_153400`), `selly/sync_delta.cjs` (bak j.w.) |
| **Commit** | `94492d1` (2026-09-14 16:00) |
| **Do nowej wersji?** | ✅ **TAK** — decyzja użytkownika 2026-09-18 (`52-CHORE-triaz-produkcja-i14`) — część CSV teraz (jeden ticket z #73/#76), część delta razem z 13d. |
| **Status** | ❌ **część CSV NIE naniesiona — obalona przez #104.** Zmiana `WHERE status='aktywny'` → `IN ('aktywny','wstrzymany')` ze stanem 0 została na produkcji **cofnięta** przez #104 (22.09, commit `abe5f14`): stan na `88fa31c` to znów tylko `aktywny`, plus zapis atomowy. Odbudowa filtru `IN(...)` z #77 nigdy nie przejęła, więc ticket 122 (I15.3, 23.09) nie miał tu czego cofać — naniósł tylko zapis atomowy (część #104). Zostaje delta → ✅ **zrobione w I15.6** (ticket 108, 2026-09-22): `findDeltaProducts` obejmuje `wstrzymany` z istniejącym wariantem, stan zerowany na 0 (test `selly.sync-delta.test.ts`) — ta część #77 wciąż aktualna, bez zmian. |

**Opis biznesowy.** Produkt wstrzymany w Bridge, ale z dodatnim stanem, mógł zostawić w Selly
nieaktualny dodatni stan — nie trafiał ani do CSV (filtr `status='aktywny'`), ani do delty API.
Sklep sprzedawał więc coś, czego Bridge już nie oferował. Teraz eksport obejmuje produkty aktywne
**i wstrzymane**, a dla wstrzymanych zawsze zapisuje stan 0; delta API zeruje wstrzymane pozycje,
które mają już wariant w Selly, ale **nie tworzy** nowych produktów wstrzymanych. Przy okazji Ania
odtworzyła mapowania produktu 191462 (MO5 → Selly 1164/wariant 1164, MO4 → 1164/wariant 2632)
i poprawiła główną cenę produktu Selly 1164 z 3305 zł na 368 zł — błędny mapping historyczny sklejał
produkt OZKA z ceną CULTOR-a.

**Szczegół techniczny (dla rebuildu).** `generate_selly_export.cjs`: `WHERE status = 'aktywny'`
→ `WHERE status IN ('aktywny','wstrzymany')`, plus nadpisanie `v = 0` dla nagłówka
`Stan-magazynowy`, gdy `row.status === 'wstrzymany'`; zmienił się też tekst na stdout
(„Liczba produktow (aktywnych i wstrzymanych)"). `sync_delta.findDeltaProducts()`: warunek
`p.status='aktywny'` → `(p.status='aktywny' OR (p.status='wstrzymany' AND sp.selly_variant_id IS NOT NULL))`,
`p.stan` w SELECT i w porównaniu z `sp.stan_wyslany` owinięte w
`CASE WHEN p.status='wstrzymany' THEN 0 ELSE p.stan END`.

**Rekomendacja (moja).** ⚠ **CSV: NIE nanosić — historia produkcji poszła dalej.** Pierwotnie
rozkładała się na dwie części:
- **eksport CSV** — plan „`WHERE status='aktywny'` → `IN(...)` ze stanem 0” jest **nieaktualny**:
  produkcja sama to cofnęła w #104 (22.09), więc naniesienie dziś oznaczałoby cofnięcie się do
  stanu pośredniego produkcji z 14–22.09, a nie dogonienie jej. Tekst stdout przeszedł tę samą
  ewolucję: `(aktywnych)` → `(aktywnych i wstrzymanych)` (#77) → `aktywnych` (#104, naniesione
  ticketem 122 jako D7);
- **delta Toru 1** → ✅ zrobione w **I15.6** (ticket 108, 2026-09-22), bez zmian.

### #78 · 2026-09-17 · [BACKEND] · MO9: odrzucanie po stabilnym ID kategorii Magento 163 (quady/kosiarki)
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND (parser MO9 Agrorami API) |
| **Pliki** | `mirror/backend/parsers/mo9_agrorami_api.cjs` (bak `.bak_pre_bkt_category_163_20260917_145511`) |
| **Commit** | `cba212d` (2026-09-17 15:00) |
| **Do nowej wersji?** | ✅ **TAK** — decyzja użytkownika 2026-09-18 (`52-CHORE-triaz-produkcja-i14`) |
| **Status** | ✅ **DOWIEZIONE w I15.2** (ticket 120, 2026-09-23) — `mo9_agrorami_api.cjs` resyncowany bajt w bajt; `ODRZUCONE_CATEGORY_IDS = new Set(['163'])` + `powodOdrzucenia()` potwierdzone w porcie. Nie było widać jako osobny wpis w diffie ticketu — odnaleziony przy przeglądzie pliku. |

**Opis biznesowy.** Prośba Ani: opony BKT do quadów, kosiarek, gokartów i podobnych małych pojazdów
nie mają być ani importowane z API, ani publikowane w Selly. Agrorami grupuje je w kategorii Magento
o ID 163 „Opony do quadów i kosiarek". Filtr importu odrzuca je teraz po ID (stabilniejsze niż
odmiana słowa „quad" w nazwie), zachowując stary filtr tekstowy jako zapasowy. Pomiar na żywym API:
1114 pozycji, 991 dopuszczonych, 123 odrzucone, 0 błędów. Jednorazowo usunięto z katalogu Bridge
83 istniejące odpowiedniki (40 ze 123 pozycji źródłowych w ogóle nie było zapisanych) oraz 76
odpowiadających mapowań `selly_products` po poprawnym usunięciu produktów w Selly.

**Szczegół techniczny (dla rebuildu).** Nowe `ODRZUCONE_CATEGORY_IDS = new Set(['163'])`
i `powodOdrzucenia(it)`, które zwraca `'kategoria_163_quady_kosiarki'` (gdy któraś z `it.categories`
ma to ID) albo `'quad'` (stary regex `/\bquad\b/` po `it.name` i po sklejonych nazwach kategorii)
albo `null`. W `fetchAll()` inline'owy warunek zastąpiony wywołaniem — **powód odrzucenia trafia
do tablicy `odrzucone`**, więc raport importu rozróżnia teraz dwa powody zamiast jednego.

**Rekomendacja (moja).** ✅ **nanieść** — reguła biznesowa („czego nie sprzedajemy"), nie defekt.
Tanie: jeden plik, jedna funkcja, żadnych zmian kontraktu. Odbudowa ma ten parser jako
`rebuild/backend/src/import/legacy/parsers/mo9_agrorami_api.cjs`. ⚠ Nowa etykieta powodu odrzucenia
może wychodzić w podsumowaniu importu — sprawdź fixture raportu MO9 przed zmianą.
Idzie w parze z #79 (drugi hunk tego samego pliku).

### #79 · 2026-09-17 · [BACKEND][BAZA] · kanonizacja wielkości liter kategorii (283 produkty + 14 nadpisań) i koniec reguły „inne → Rolnicze" w MO9
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND + BAZA (parsery, `common.cjs`, triggery) |
| **Pliki** | `mirror/backend/common.cjs` (bak `.bak_pre_category_case_20260917_1545`), `parsers/tyre_params.cjs` (bak j.w.), `application_rules.cjs` (bak j.w.), `parsers/mo9_agrorami_api.cjs` (bak `.bak_pre_bkt_recategory_20260917_1523`), `db/schema.sql` (4 triggery) |
| **Commit** | `ca8a694` (2026-09-17 16:00 — dwa wpisy CHANGELOG) |
| **Do nowej wersji?** | ✅ **TAK** — decyzja użytkownika 2026-09-18 (`52-CHORE-triaz-produkcja-i14`) — nanieść jako jeden stan końcowy z #75/#80/#82. |
| **Status** | ✅ schemat: triggery `products_zastosowanie_ai/_au` bez `WHEN`, `manual_overrides_kategoria_ai/_au` — **107 / migracja 011**, bajt w bajt z `7d6cfc9`. ✅ **Moduł `common.cjs`/`tyre_params.cjs`/`mo9_agrorami_api.cjs` (kanonizacja w JS parserów) — DOWIEZIONY w I15.2** (ticket 120, patrz #75). Jednorazowy backfill (283 produkty + 14 nadpisań, 58 MO9) poza migracjami (D2). |

**Opis biznesowy.** Dwie prośby Ani w jednym commicie. (1) Filtr katalogu pokazywał zdublowane
kategorie — tę samą raz małą, raz wielką literą; ujednolicono 283 produkty i 14 ręcznych nadpisań
(`rolnicze`→`Rolnicze` itd.) i zabezpieczono przed nawrotem przy kolejnych importach. (2) Kategoria
„inne" ma zniknąć z katalogu: usunięto ogólną regułę MO9 „inne → Rolnicze" (bo grupa zawiera również
opony przemysłowe) i zastąpiono ją klasyfikacją po rodzinach bieżników BKT. Przeklasyfikowano 58
historycznych produktów MO9 z „inne": 28 na Rolnicze, 30 na Przemysłowe. Jedną przeoczoną pozycję
z wykluczonej kategorii 163 (BKT LG 306 20X10.00-10) usunięto z Selly i z Bridge.

**Szczegół techniczny (dla rebuildu).** `common.normalizeRecord()`:
`kategoria: rec.kategoria || 'Rolnicze'` → `capitalizeKategoria(rec.kategoria || 'Rolnicze')` —
kanonizacja **na wyjściu każdego parsera**, także dla ścieżek omijających adapter.
`tyre_params.cjs`: cztery miejsca zwracające małe litery przeszły na
`applicationRules.canonicalCategory(...)` — `normalizeJmk` (`record.rodzaj`), `normalizeAgrowiec`
(`record.kategoria`), `normalizeTrelleborg` (`record.rodzaj`), `normalizeAgrorami` (gałąź `else`).
`application_rules.cjs`: nowe `sqlCanonicalCategoryExpression()`, triggery `products_zastosowanie_ai/_au`
**straciły warunek `WHEN`** (odpalają się zawsze) i normalizują teraz również `NEW.kategoria`,
a doszły dwa nowe triggery `manual_overrides_kategoria_ai/_au` normalizujące `override_value`
dla `field_name='kategoria'`. `mo9_agrorami_api.cjs`: z `KATEGORIA_MAP` wypadł wpis
`'inne': 'Rolnicze'`, doszła `classifyBktFallback(fullName)` — regexy rodzin bieżników
(`FRS` → Leśne; `AT 621|BK-LOADER|EARTHMAX|EM 936|FS 216|GR 288|LG 306/408|LIFTMAX|MAGLIFT|MULTIMAX|
JUMBOTRAX|SURETRAX|PAC MASTER|PL 801|PT-HD|ROCK GRIP|SKID POWER|TR 387` → Przemysłowe;
`AGRIMAX|AS 504|AW 702|AW 909|FARM 2000|FARM HIGHWAY|FL 630|FL 693|FLOT 648|TF 9090|TR 128|TR 135|
TR 171|TR 678` → Rolnicze), z `c.classifyByName()` jako ostatecznym fallbackiem.

**Rekomendacja (moja).** ✅ **nanieść** — był to **najważniejszy wpis tej partii dla odbudowy**,
bo trafiał w kod, który odbudowa miała 1:1 i który się rozjeżdżał z produkcją (`tyre_params.cjs`
wciąż `cleanText(...).toLowerCase()`, `mo9_agrorami_api.cjs` wciąż `'inne': 'Rolnicze'`).
✅ **Rozjazd zamknięty w I15.2** (ticket 120, 2026-09-23): oba pliki resyncowane bajt w bajt
z `88fa31c`, kanonizacja w porcie działa dziś tak samo jak w produkcji.
⭐ **Trigger na `manual_overrides` częściowo domyka wpis #65** („`manual_overrides` nieprzemigrowane
— override cofa konwencję przy imporcie"): Ania rozwiązała **połowę kategorii** (14 wpisów
`field_name='kategoria'` przemigrowane + trigger na przyszłość). **Nie ruszyła** drugiej połowy —
3 wpisów `field_name='konstrukcja'` z wartością `'D'`. #65 zostaje otwarty, ale w węższym zakresie.

### #80 · 2026-09-17 · [BACKEND][BAZA] · `Forwarder/Harwester` jako JEDNA wartość + naprawa kolejności trigger→backfill
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND + BAZA (reguły zastosowań) |
| **Pliki** | `mirror/backend/application_rules.cjs` (bak `.bak_pre_forwarder_harwester_20260917_1608`), `db/schema.sql`, `application_rules_v2_test.cjs` (**nowy**, 294 l. — test) |
| **Commit** | `5dedefb` (2026-09-17 17:00, pierwszy z dwóch tematów commita) |
| **Do nowej wersji?** | ✅ **TAK** — decyzja użytkownika 2026-09-18 (`52-CHORE-triaz-produkcja-i14`) — nanieść jako jeden stan końcowy z #75/#79/#82. |
| **Status** | ✅ schemat: `sqlNormalizeExpression()` w triggerach `products_zastosowanie_ai/_au`, kolejność trigger→backfill — **107 / migracja 011**, bajt w bajt z `7d6cfc9`. ✅ **Moduł JS `application_rules.cjs` (`splitApplications()`, `normalizeApplication()`) — DOWIEZIONY w I15.2** (ticket 120, patrz #75). Jednorazowe scalenie 100 produktów poza migracjami (D2). |

**Opis biznesowy.** Zgłoszenie Ani: w kategorii Leśne pole „zastosowanie" miało „Forwarder"
i „Harwester" zapisywane osobno albo jako „Harwester ; Forwarder", a miała być jedna wartość
„Forwarder/Harwester", z wielkiej litery po ukośniku. Po zmianie dowolna kombinacja (jeden z nich,
oba, w dowolnej kolejności, z dowolnym separatorem) zapisuje się jako jedna wartość. Jednorazowo
scalono 100 produktów: 29 × „Forwarder", 2 × „Harwester", 69 × „Harwester ; Forwarder". Kategoria
bez zmian, 17 ręcznych nadpisań zastosowania nie miało tych wariantów. Test z rollbackiem
potwierdził scalanie przy przyszłych zapisach.

**Szczegół techniczny (dla rebuildu).** `splitApplications()`: zamiast jednego
`replace(/forwarder\s*,\s*harwester/gi,'Forwarder ; Harwester')` są dwa `replace` łapiące oba
porządki i separatory `[,;/]`, oba dające `'Forwarder/Harwester'`. Stałe `FORWARDER_HARWESTER`
i `FORWARDER_HARWESTER_MEMBERS`. `normalizeApplication()` przepuszcza `Forwarder/Harwester` obok
listy dozwolonych i dokleja go **na końcu** listy (`[...ordered, FORWARDER_HARWESTER]`), z osobną
gałęzią, gdy to jedyna wartość. `sqlNormalizeExpression()` dostał komplet ośmiu wariantów wejściowych.
⭐ **Drugi, ważniejszy hunk:** blok `if (backfill) {...}` **przeniesiony sprzed podmiany triggerów
na PO niej**. Komentarz Ani nazywa incydent wprost: każdy `UPDATE` w backfillu odpala
`products_zastosowanie_au`, więc przy starej kolejności **stary trigger nadpisywał wynik backfillu**
(`Forwarder/Harwester` wracało na `Uniwersalne/pozostałe`).

**Rekomendacja (moja).** ✅ **nanieść razem z #75/#79/#82** jako jeden stan końcowy modułu.
⚠ **Kolejność trigger→backfill to nie kosmetyka, to warunek poprawności** — jeśli odbudowa
odtworzy `ensureApplicationRules()` ze starą kolejnością, dostanie dokładnie ten sam cichy błąd
(dane wyglądają na zbackfillowane, a nie są). To ten sam gatunek pułapki co `safeAll()` z CLAUDE.md:
operacja „się udaje", tylko wynik jest inny niż sądzisz.
`application_rules_v2_test.cjs` (294 l.) to gotowy zestaw przypadków — **warto go przeczytać przed
pisaniem własnych testów**, bo niesie oczekiwania Ani co do wartości granicznych.

### #81 · 2026-09-17 · [BACKEND] · Selly: właściciel metadanych produktu + `PUT features` JEDNAK DZIAŁA (obala ustalenie z 08.09)
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND (Selly, Tor 2 / `sync_full`) |
| **Pliki** | `mirror/backend/selly/sync_full.cjs` (bak `.bak_pre_filtermirror_20260917_1654`), `selly/mapper_v2.cjs` (bak j.w.), `cleanup_selly_filters_20260917.cjs` (jednorazowy, dodany w `5dedefb`, **usunięty** w `65dcbd0`), zrzuty `selly_backups/categories_filters_*.json` |
| **Commit** | `5dedefb` (2026-09-17 17:00, drugi temat) + `65dcbd0` (18:00, scopefix + publikacja CSV) |
| **Do nowej wersji?** | ✅ **TAK — zrobione ticketem 109 (I15.7, 2026-09-22).** Decyzja użytkownika 2026-09-18 (odłożenie do 13d/I15.7) zrealizowana: `isMetadataOwner`/`metadataScore` weszły jako świadoma logika biznesowa, nie 1:1 defekt. |
| **Status** | ✅ **zrobione w I15.7** (`109-FEATURE-selly-rest-sync-full`, `src/selly/rest/sync-full.ts` + `mapper-v2.ts`): ścieżka A robi `GET /api/products/{pid}` → payload `includeFeatures:true` → `PUT` z cechami i `category_id`; cechy i kategorię pisze wyłącznie kanoniczny rekord (najwięcej wypełnionych metadanych, remis → niższe `products.id`), grupa o różnych kategoriach pomijana; cecha zarządzana przez Bridge i teraz pusta NIE dziedziczy starej wartości z Selly; martwa `fetchVariantFeatures` nie istnieje w porcie. |

**Opis biznesowy.** Zgłoszenie Ani: dane synchronizowane z Bridge nie mają tworzyć sklejonych
wartości filtra „Rozmiar" w sklepie ani pozwalać, żeby warianty różnych dostawców nadpisywały sobie
wzajemnie kategorię i cechy tego samego produktu. Poprawiono trzy historyczne rekordy MO9 ze
sklejonym rozmiarem głównym i alternatywnym (po poprawce 0 wartości z nawiasem w `products.rozmiar`)
i przegenerowano CSV (8088 produktów, 60 kolumn). Jeden produkt Selly może mieć warianty od kilku
dostawców, ale cechy i kategoria są wspólne dla produktu — zapisuje je więc tylko jeden wybrany
rekord Bridge. Grupy, w których aktywne rekordy mają **różne** kategorie, są celowo pomijane:
wymagają rozdzielenia na osobne produkty w sklepie.

**Szczegół techniczny (dla rebuildu).** `collectFullSyncItems()` dokłada do SELECT-a
`p.id AS bridge_product_id`. Nowe `metadataScore(row)` (liczy niepuste pola z 21-elementowej listy)
i `isMetadataOwner(db,row)`: bierze wszystkie rekordy Bridge zmapowane na ten sam
`selly_product_id`, preferuje aktywne, **odrzuca grupę, gdy ma więcej niż jedną kategorię**
(`categories.size !== 1` → `false`), sortuje po `metadataScore` malejąco z `id` rosnąco jako
rozstrzygnięciem i zwraca `true` tylko dla zwycięzcy. `updateExistingVariant()` dostał
`dictMaps` jako argument; dla właściciela metadanych (i poza `dryRun`) robi `GET /api/products/{pid}`,
buduje payload z `includeFeatures:true` + `existingSellyFeatures` i dokłada `category_id` z
`dictMaps.catMap`. **Usunięto martwą `fetchVariantFeatures()`.** `mapper_v2.buildFeaturesMirror()`:
nowy `managedNames` (nazwy z `FEATURE_MAP`) — cecha zarządzana przez Bridge, dziś pusta, **nie
dziedziczy już starej wartości z Selly**; cechy spoza mapy zostają nietknięte. Odpowiedź `dry_A`
niesie teraz dodatkowe pole `metadata_owner`.

**Rekomendacja (moja).** 🕒 **później — ale z jednym faktem do natychmiastowego zapisania.**
⭐ **Komentarz w `sync_full.cjs` odwraca ustalenie z 08.09.** Poprzednia wersja głosiła: „ODKRYCIE
2026-09-08: Selly PUT /api/products/{pid} NIE akceptuje pola `features` (HTTP 400 Malformed JSON
input)" — i to właśnie na jego podstawie 13d-1 wyciął `PUT features`. Nowy komentarz: „Test
produkcyjny 2026-09-17 potwierdzil, ze PUT /api/products/{pid} przyjmuje pelna tablice `features`
mimo braku tego pola w fields_edit". **Roadmapa I14 wymienia „aktualizacja CECH istniejących
produktów w Selly (u Ani PUT features usunięty po HTTP 400)" wśród priorytetów Ani do triażu —
ta przesłanka jest już nieaktualna.** Przenoszę to ustalenie do bloku 13d w roadmapie.
✅ **Domknięte w I15.7** (ticket 109, 2026-09-22): `isMetadataOwner` to **nowa
logika biznesowa**, nie defekt do odtworzenia 1:1, i weszła świadomie, nie automatem.
`cleanup_selly_filters_20260917.cjs` był narzędziem jednorazowym i Ania go po użyciu usunęła —
**nie portować**.

### #82 · 2026-09-18 · [BACKEND][BAZA] · `Ładowarka` wypada z zastosowań Rolniczych → remapowana na `Ciągnik`
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND + BAZA (reguły zastosowań) |
| **Pliki** | `mirror/backend/application_rules.cjs`, `db/schema.sql` (regeneracja 2 triggerów) |
| **Commit** | `03fe892` (2026-09-18 14:00) |
| **Do nowej wersji?** | ✅ **TAK** — decyzja użytkownika 2026-09-18 (`52-CHORE-triaz-produkcja-i14`) — ✅ **blokada ZDJĘTA 2026-09-18**: Ania dosłała uzasadnienie (`86d9090`), gotowe do implementacji. |
| **Status** | ✅ schemat: `CATEGORY_APPLICATION_REMAP` w triggerach `products_zastosowanie_ai/_au` — **107 / migracja 011**, bajt w bajt z `7d6cfc9`. ✅ **Moduł JS `application_rules.cjs` (`CATEGORY_VALUES`, remap przed testem dozwolonych wartości) — DOWIEZIONY w I15.2** (ticket 120, patrz #75). Jednorazowy backfill 265 rekordów Rolniczych poza migracjami (D2). |

**Opis biznesowy.** ✅ **UZUPEŁNIONE 2026-09-18 z wpisu CHANGELOG Ani** (dopisany przez nią
o 15:39, przyszedł commitem `86d9090`; wcześniej ten commit nie miał uzasadnienia).
**Powód:** zgłoszenie Anny — *filtr Rolniczych nie powinien pokazywać zastosowania „Ładowarka"*.
W kategorii Rolnicze wartości `Ładowarka`, `ładowarka kołowa` i `ładowarka rolnicza` zapisują się
teraz jako `Ciągnik`; **w Przemysłowych `Ładowarka` zostaje bez zmian**. Backfill zaktualizował
**265 rekordów** Rolniczych, po korekcie zostało 0 Rolniczych z zastosowaniem „Ładowarka".
To ten sam gatunek porządków co #79 (zdublowane kategorie w filtrze) — **czyszczenie listy
wartości w filtrach katalogu**, nie zmiana semantyki opony. „Ładowarka" przestaje być dopuszczalnym zastosowaniem
w kategorii Rolnicze (zostaje w Przemysłowych) i jest tam automatycznie zamieniana na „Ciągnik" —
czyli produkty rolnicze opisane jako ładowarki trafiają pod ciągniki zamiast, jak dotąd
(reguła z #75), lądować w „Uniwersalne/pozostałe".

**Szczegół techniczny (dla rebuildu).** Z `CATEGORY_VALUES.Rolnicze` usunięty element `'Ładowarka'`
(lista schodzi do 7 pozycji; w `Przemysłowe` zostaje). Nowa zamrożona mapa
`CATEGORY_APPLICATION_REMAP = { Rolnicze: { 'Ładowarka': 'Ciągnik' } }` i dodatkowy `.map()`
w `normalizeApplication()`, wstawiony **między** rozwinięcie aliasów a `filter(Boolean)` — czyli
remap działa po normalizacji aliasu, przed testem dozwolonych wartości. **Zweryfikowane w kodzie:**
mapa ma tylko wpis `'Ładowarka': 'Ciągnik'`, a trzy warianty z opisu Ani zbiegają się do niego
wcześniej, przez istniejące `APPLICATION_ALIASES` (`ładowarka`, `ładowarka kołowa`,
`ładowarka rolnicza` → `Ładowarka`, `application_rules.cjs:69-71`) — kolejność `.map()`-ów jest
więc istotna dla poprawności, nie kosmetyczna. Bez tego remapu „Ładowarka"
w Rolniczych wpadłaby teraz na `Uniwersalne/pozostałe`. `db/schema.sql` to wyłącznie regeneracja
wyrażenia w dwóch triggerach.

**Rekomendacja (moja).** ✅ **nanieść razem z #75/#79/#80** (czwarta i ostatnia warstwa tego samego
modułu — to jest stan końcowy `application_rules.cjs` na dziś).
✅ **Blokada zdjęta 2026-09-18** — Ania dosłała uzasadnienie (`86d9090`), pytanie „dlaczego akurat
Ciągnik?" jest odpowiedziane: chodzi o **zawartość filtra w katalogu**, nie o klasyfikację opony.
Nic nie stoi na przeszkodzie implementacji.
⚠ Zostaje morał proceduralny: przez dobę ta zmiana istniała w produkcji **bez wpisu w CHANGELOG
i bez kopii `.bak`** — ten sam gatunek co #64 (`odswinch`). Wniosek na przyszłość: brak wpisu
znaczy „jeszcze nie opisane", nie „nie ma powodu" — **poczekać na kolejny `sync(vps)`, zanim
uzna się powód za NIEZNANY na stałe**.

### #83 · 2026-09-18 · [BACKEND] · normalizacja `products.szerokosc` — ODWRÓCENIE decyzji „zachowaj zera końcowe" z 19.08
| pole | wartość |
|---|---|
| **Kategoria** | BACKEND (parser rozmiaru — rdzeń importu) |
| **Pliki** | `mirror/backend/parsers/tyre_params.cjs`, `parsers/adapter.cjs`, `parsers/mo9_agrorami_api.cjs`, `normalize_widths_selly_20260918.cjs` (**nowy**, 146 l., jednorazowy) |
| **Commit** | `9d1b09f` (2026-09-18 15:00, etykieta `20260918_1500_width_norm`) |
| **Do nowej wersji?** | ✅ **TAK** — decyzja użytkownika 2026-09-18 (`52-CHORE-triaz-produkcja-i14`) — ✅ **blokada ZDJĘTA 2026-09-18**: Ania dosłała uzasadnienie (`86d9090`) — świadome odwrócenie decyzji z 19.08, powód to filtr „Szerokość opony”. |
| **Status** | ✅ **DOWIEZIONE w I15.2** (ticket 120, 2026-09-23) — resync `tyre_params.cjs`/`adapter.cjs`/`mo9_agrorami_api.cjs` bajt w bajt; zmierzone na próbkach charakteryzacji **172 zmiany szerokości u 9 dostawców** (`"10.0"`→`"10"`). Efekt uboczny NA PLUS: mniej fałszywych „zmian kluczowych” w stagingu (MO8 `zmienione` 30→27, MO10 `zmienione` 2→0 i `autoZatwierdzone` 15→17). ⚠ Łamie obietnicę z `docs/instrukcja-testow-I3.md` §11 pkt 10 („10.00 zostaje”) — wejście dla karty I15.9 już zapisane: `docs/karty/I15.9/wejscie-120.md`. Oczekiwania produkcji (referencyjnie): **1297 ujednoliconych wartości** szerokości, 0 niekanonicznych po zmianie; rekord kontrolny dla `$` w MO9: `products.id=105986` (`$7-14` → `7-14`, nazwa bez zmian). |

**Opis biznesowy.** ✅ **UZUPEŁNIONE 2026-09-18 z wpisu CHANGELOG Ani** (`86d9090`).
**Powód:** zgłoszenie Anny — *filtr „Szerokość opony" nie powinien rozdzielać tej samej liczby
na warianty `5`, `5.0` i `5.00"*. Czyli **to NIE jest cofnięcie decyzji z 19.08 „dla samej zasady",
tylko rozwiązanie konkretnego problemu w filtrach katalogu** — dokładnie ta sama motywacja co
w #79 (zdublowane kategorie) i #82 (Ładowarka). Jednorazowo ujednolicono **1297 wartości**;
kontrola końcowa: 0 niekanonicznych szerokości, `integrity_check=ok`. Kolumna szerokości dostaje jeden kanoniczny zapis liczbowy: bez nieznaczących
zer końcowych (`5.00`→`5`, `12.50`→`12.5`, `340.0`→`340`). Zmiana dotyczy **wyłącznie kolumny
szerokości i odpowiadającej jej cechy w Selly** — pełna nazwa produktu i pole rozmiaru zachowują
zapis źródłowy. Osobno: znak `$` stojący bezpośrednio przed wymiarem w danych MO9 przestaje być
traktowany jako część rozmiaru. Dołożony skrypt jednorazowy przepisuje już wysłane wartości
szerokości w Selly.

**Szczegół techniczny (dla rebuildu).** Nowa `tyre_params.normalizeWidthValue(value)` (trim,
`,`→`.`, wartości niepasujące do `^\d+(?:\.\d+)?$` przechodzą bez zmian, reszta przez `Number()`
→ `String()`), wyeksportowana z modułu. `adapter.recordToSurowe()`: `szerokosc: enriched.szerokosc ?? null`
→ `szerokosc: tyre.normalizeWidthValue(enriched.szerokosc)`. `mo9_agrorami_api.itemToRecord()`:
`rozmiar = parsedName.rozmiar || ''` → `.replace(/^\$\s*/,'')`. Ania podaje też **konkretny rekord,
na którym to widać: `products.id=105986`, rozmiar poprawiony z `$7-14` na `7-14`, przy czym
nazwa „BKT TR 144 $7-14" **zostaje bez zmian** — `$` znika wyłącznie z pola `rozmiar`.
⭐ **Najcięższy hunk: w `parseSize()` skasowany CAŁY blok `szerokoscRaw` (−37 linii)** i zastąpiony
trzema liniami: `result.szerokoscRaw = normalizeWidthValue(result.szerokosc); result.szerokosc = result.szerokoscRaw;`.
Padły obie gałęzie tego bloku naraz: nadpisanie `result.szerokosc` **surowym stringiem pierwszej
liczby z `size`** (to ono trzymało zera końcowe) i strażnik `isWxSxD`/`isWxSxDcale`, który przed tym
nadpisaniem chronił notacje, gdzie pierwsza liczba to średnica zewnętrzna, nie szerokość.
**Usunięcie obu jest spójne** — skoro nie ma naiwnego nadpisania, nie ma przed czym chronić:
`result.szerokosc` zostaje wartością policzoną przez parser, a więc dla `WxSxD` dalej SW.
⚠ **Zweryfikowane osobno: własne parsowanie notacji `OD×SW−Rim` ŻYJE** (`:283`, `:299` w wersji po
zmianie) — z pary hunków wpisu #64 („odswinch") zniknął tylko strażnik, a nie rozpoznanie notacji.
Jednostki też nie ruszono: przeliczanie na mm było już cofnięte 2026-08-19 i ten komentarz stoi
nietknięty, więc **`szerokosc` zostaje w jednostce oryginalnej z rozmiaru**.
`normalize_widths_selly_20260918.cjs` to skrypt operacyjny (własna kopia `normalizeWidth`,
`better-sqlite3` + klient Selly, `retry` z narastającym backoffem).

**Rekomendacja (moja).** ✅ **nanieść — i to pilnie, bo dziś odbudowa rozjeżdża się z produkcją
w rdzeniu importu.** `rebuild/backend/src/import/legacy/parsers/tyre_params.cjs:336-366` zawiera
**dokładnie ten blok, który Ania właśnie usunęła** (`isWxSxDcale`, `isWxSxD`, `rawMatch`), wniesiony
tam świadomie w 13a. Skutek rozjazdu jest **formatowy, nie jednostkowy**: produkcja zapisuje dziś
`10`, odbudowa `10.0`; dla notacji `WxSxD` obie strony dają tę samą liczbę (SW), tylko inaczej
zapisaną. Trzy rzeczy przed implementacją:
1. ✅ **Rozstrzygnięte 2026-09-18.** To **świadome odwrócenie decyzji Anny z 2026-08-19**
   („zachować oryginalny zapis z zerami końcowymi", POPRAWKA v2/v3 w kodzie) — **nie** skutek
   uboczny porządków w Selly, jak podejrzewałem. Nowe wymaganie jest silniejsze od starego:
   zera końcowe rozbijały filtr „Szerokość opony" na `5`/`5.0`/`5.00`. Dla **14d** to materiał
   do instrukcji testów — zmienia to, co Ania zobaczy w kolumnie i w filtrze.
2. **Etykieta jest węższa niż zmiana** — `width_norm` brzmi jak samo obcięcie zer, a razem z nim
   wypadł strażnik `isWxSxD` z #64. Tu akurat usunięcie jest spójne (patrz wyżej), ale morał
   z CLAUDE.md zostaje: **etykieta daje nazwę, nie treść** — rozkładaj diff, nie ufaj `.bak`.
3. **Liczba oczekiwana jest już znana: 1297 wartości** (pomiar Ani na produkcji, `86d9090`).
   Pomiar na `db/snapshot.db` zrobić mimo to — jako kontrolę, czy nasza baza startowa zgadza się
   z jej stanem; rozjazd byłby sygnałem, nie powodem do zmiany liczby.

### #84 · 2026-09-18 · [FRONTEND] · toast po uploadzie z karty dostawcy w produkcji czyta pola, których backend nigdy nie zwracał — „undefined nowych, undefined zmian”

| pole | wartość |
|---|---|
| **Kategoria** | FRONTEND (karta dostawcy, toast po `POST /api/dostawcy/{kod}/upload`) — defekt PRODUKCJI |
| **Pliki** | `deminified/frontend-index.js:25778-25781` (potwierdzone bajt w bajt w żywym `mirror/frontend/assets/index-PRICEFMT1783512500.js`); `mirror/backend/index.cjs`, trasa `POST /api/dostawcy/:kod/upload`, wynik `tk()` |
| **Zmiana w oryginale** | Toast składa opis z pól `o.nowych` i `o.zmian`, których odpowiedź trasy **nigdy nie miała** — realnie zwraca `nowe`, `zmienione`, `wycofane`, `bezZmian`, `doStagingu`, `autoZatwierdzone` (`grep -o 'nowych:'` i `grep -o 'zmian:'` po całym `mirror/backend/index.cjs` → zero trafień obu). `tk()` ma w żywym bundlu jedną definicję — to zwykła literówka w nazwach pól, nie cieniowanie duplikatem (`CLAUDE.md` §5). |
| **Skutek w produkcji** | Od zawsze wyświetla „N produktów, **undefined** nowych, **undefined** zmian” po każdym ręcznym uploadzie z karty dostawcy. |
| **Do nowej wersji?** | ✅ **TAK — naprawiamy, nie odtwarzamy buga** (decyzja **D1**, 2026-09-18, `50-FEATURE-i14c-karta-dostawcy-upload`). Wierne przepisanie dałoby ten sam „undefined” w odbudowie, co i tak zostałoby zgłoszone jako usterka. |
| **Status** | ✔ zrobione w rebuild (14c) — toast czyta realne `nowe`/`zmienione` (`rebuild/backend/src/routes/suppliers.ts:215-222`), test asertuje `not.toHaveTextContent("undefined")`. W żywej produkcji **nadal obecne** — do ewentualnego zgłoszenia Ani, nie blokuje cutoveru. |

### #85 · 2026-09-18 · [FRONTEND] · pole „liczba minut” na karcie dostawcy — wartość startowa dla dostawcy bez harmonogramu

| pole | wartość |
|---|---|
| **Kategoria** | FRONTEND (karta dostawcy, edycja częstotliwości) |
| **Pliki** | `mirror/frontend/assets/freq-injection.js:124-147` (oryginał — osobny popover, patchuje wyłącznie `czestotliwoscMinuty`); `rebuild/frontend/src/pages/konfiguracja/Dostawcy.tsx` (odbudowa — jeden formularz zapisujący cztery pola naraz: url, częstotliwość, sposób dostarczania, status) |
| **Do nowej wersji?** | ✅ **TAK — świadome odstępstwo** (decyzja **D5**, 2026-09-18, `50-FEATURE-i14c-karta-dostawcy-upload`) |
| **Status** | ✔ zrobione w rebuild (14c) |

**Opis.** Reguła WIDOCZNOŚCI pola minut jest 1:1 z oryginałem — widoczne dokładnie wtedy, gdy
select stoi na „Inna wartość (minuty)…” (`freq-injection.js:138-147`). Odstępstwem jest tylko
wartość STARTOWA dla `czestotliwoscMinuty` null/0: w oryginale żadna gałąź nie ustawia
`select.value` w tym przypadku (`:129`, `:141`), więc select zostaje na pierwszej opcji presetów,
czyli „5 min”. Odbudowa scaliła edycję częstotliwości z zapisem pozostałych pól karty w jeden
formularz — odtworzenie „5 min” 1:1 znaczyłoby, że zapis samego statusu **po cichu włącza
dostawcy odpytywanie co 5 minut**. Dlatego dostawca bez harmonogramu startuje na „Inna wartość
(minuty)…” z pustym polem; zachowuje to też możliwość wyczyszczenia harmonogramu (`null`), której
oryginał w ogóle nie miał (puste pole custom wpadało w `if (!val || val < 1) return`, `:167-171`).

### #86 · 2026-09-18 · [FRONTEND] · `<input type="file">` na karcie dostawcy czyszczony po wysyłce — oryginał tego nie robi

| pole | wartość |
|---|---|
| **Kategoria** | FRONTEND (karta dostawcy, przycisk „Wgraj plik”) |
| **Pliki** | `mirror/frontend/assets/index-PRICEFMT1783512500.js:25690-25802` (oryginał — brak `.value = ""` po wysyłce uploadu); `rebuild/frontend/src/pages/konfiguracja/Dostawcy.tsx` |
| **Do nowej wersji?** | ✅ **TAK — świadome odstępstwo** (decyzja **D6**, 2026-09-18, `50-FEATURE-i14c-karta-dostawcy-upload`) |
| **Status** | ✔ zrobione w rebuild (14c) |

**Opis.** Oryginał nie czyści `<input type="file">` po wysyłce, więc wgranie tego samego pliku
(ta sama nazwa/ścieżka) drugi raz z rzędu nie wywołuje `onChange` przeglądarki i przycisk wygląda
na zepsuty. Odbudowa czyści pole (`e.target.value = ""`) — powód praktyczny: Ania poprawia plik
u dostawcy i wgrywa go ponownie pod tą samą nazwą.

### #87 · 2026-09-18 · [BACKEND] · widok „Historia" czyta tylko 5000 najświeższych zdarzeń — najstarsze stają się nieosiągalne, a licznik przestaje być liczbą wszystkich zdarzeń

| pole | wartość |
|---|---|
| **Kategoria** | BACKEND (historia / mapowanie audytu) — dziwactwo PRODUKCJI odtworzone świadomie |
| **Pliki** | `deminified/backend-index.cjs:48336` i `:48358` (`U.listAudit(5e3)` w obu handlerach); `listAudit()` — `:45068-45070`; port: `rebuild/backend/src/historia/mapowanie.ts` (`SLOWNIK_AKCJI`, `akcjeHistorii()` — `LIMIT_AUDYTU` USUNIĘTY), `rebuild/backend/src/repos/audit-historia.ts` (`audytDlaHistorii()`, nowy), `rebuild/backend/src/routes/history.ts` |
| **Do nowej wersji?** | ✅ **TAK — WARIANT (c), hybryda, wybrany przez użytkownika 2026-09-21**: odsiew akcji i sortowanie w SQL bez limitu; mapowanie, `dostawca`, fraza, `total`, paginacja zostają w pamięci |
| **Status** | ✔ wdrożone 2026-09-21 w `69-FEATURE-historia-bez-limitu` (P5.1) — hybryda: SQL odsiewa akcje ze słownika (i `typ`) bez limitu, reszta (mapowanie, `dostawca`, fraza, `total`, paginacja) w pamięci. Szczegóły niżej, sekcja „Realizacja" |

**⭐ DECYZJA UŻYTKOWNIKA 2026-09-21: WARIANT (c).** Uzasadnienie wprost: „żeby problem nie
wracał". Odrzucone: (a) zostawić 1:1 — problem wraca sam; (b) podnieść limit — odsuwa próg,
nie usuwa go, i każe mapować całość w pamięci przy każdym żądaniu.

**Liczba, która przesądziła.** `audit_log` ma 3873 wiersze, ale widok pokazuje z nich **270**
(178 `edycja_produktu` + 92 `upload_pliku`). Pozostałe 3603 to akcje spoza słownika pięciu
typów, z czego sam `auto_pull` to 2869. Limit tnie **surowy** `audit_log` PRZED odsiewem, więc
93% budżetu zjadają wiersze, których użytkownik nigdy nie zobaczy — i to one wypchną te, które
widzi. Rozstrzygnięcie **#21 na NIE** (2026-09-21) to pogłębia: `auto_pull` nigdy nie stanie się
widoczny, a mimo to będzie wypierał użyteczne wpisy z okna 5000.

**⚠ WARUNEK WDROŻENIA — POMIAR PRZED KODEM, nie po.** Bramka `historia.wyrocznia.test.ts`
(karta `59-CHORE-i14j`, 0 różnic na 49 813 wpisach) porównuje te trasy z żywym oryginałem.
Hipoteza: rozjazd między filtrowaniem w SQL a w pamięci ujawnia się **dopiero powyżej 5000
wierszy**, a wyrocznia chodzi na snapshocie z 3873 — więc (c) powinno przejść **bez wyjątku
w wyroczni**. To hipoteza, nie ustalenie: karta ma ją zweryfikować PRZED implementacją i wrócić
z pytaniem, jeśli bramka się zapali. Fallback: wariant (b).

**⚠ PUŁAPKA ZAKRESU, ZMIERZONA 2026-09-21 — `search` NIE DA SIĘ PRZENIEŚĆ DO SQL bez zmiany
semantyki.** `stronaHistorii()` (`historia/mapowanie.ts:237-246`) filtruje frazę przez
`JSON.stringify(wpis).toLowerCase().includes(fraza)` na **zmapowanym** wpisie — więc trafia też
w pola WYLICZANE: `typ` (`import`/`eksport`/`edycja`), `format`, napis `„Plik: …"` i nazwy
zmienionych pól. Wpisanie `import` znajduje wpisy **po nazwie typu**, a nie po żadnej kolumnie
`audit_log` (opisane Ani w §11 pkt 4 instrukcji I5 jako zamierzone).

Z tego wynika, że `typ`, `dostawca` i paginacja przenoszą się do SQL bez przeszkód, ale `search`
wymaga osobnego rozstrzygnięcia — np. hybrydy (filtr i limit w SQL, fraza nadal w pamięci, ale
na znacznie szerszym zbiorze kandydatów) albo przetłumaczenia frazy na listę wartości `akcja`.
**Wybór ma być opisany w raporcie karty jako decyzja, a nie przemilczany.**

**Co robi produkcja.** `GET /api/history/meta` i `GET /api/history/paged` wołają
`listAudit(5000)`, czyli `SELECT … FROM audit_log ORDER BY kiedy DESC LIMIT 5000`. Limit stoi
**PRZED** mapowaniem, odsiewem akcji spoza słownika, filtrowaniem i paginacją — do widoku
wchodzi więc 5000 najświeższych wierszy `audit_log`, a dopiero z nich powstaje to, co widać.
Obie trasy mają ten limit zahardkodowany, bez parametru i bez możliwości sięgnięcia głębiej.

**Jaki jest skutek.** Dwa, oba narastające z czasem:
1. **Najstarsze wpisy stają się nieosiągalne.** Nie da się do nich dojść ani stronicowaniem, ani
   filtrem, ani wyszukiwarką — wypadły, zanim filtr zdążył zadziałać. Ekran nie sygnalizuje tego
   w żaden sposób: wygląda identycznie jak historia, która po prostu tyle ma.
2. **Licznik `N wpisów` przestaje być liczbą wszystkich zdarzeń.** `total` liczy się na już
   przyciętym zbiorze, więc po przekroczeniu progu pokazuje „ile z ostatnich 5000 pasuje do
   filtra", a nie „ile było". Tak samo zawęża się lista dostawców w filtrze (`/meta` liczy się
   na tym samym materiale).

**Kiedy to wypłynie — zmierzone 2026-09-18** (`59-CHORE-i14j`, na `db/snapshot.db`):
`audit_log` ma dziś **3873 wiersze**, czyli **77% progu**. Limit jest więc **dziś niewidoczny**
i dlatego nie wyszedł w żadnym teście — ale przy obecnym tempie zapisu do `audit_log` (import
z URL, staging, overrides, narzuty — w sumie kilkanaście akcji, z czego sam `auto_pull` to już
2869 wierszy) próg zostanie przekroczony i wtedy ekran zacznie po cichu gubić najstarsze
zdarzenia. Odsiew akcji jest tu bez znaczenia: limit tnie **surowy** `audit_log`, więc zjadają
go także akcje, których widok i tak nie pokazuje (backlog **#21**).

**Tak robi ORYGINAŁ — odbudowa od P5.1 już nie.** Do karty `69-FEATURE-historia-bez-limitu`
(P5.1) zachowanie było odtworzone 1:1 i opisane Ani w `docs/instrukcja-testow-I5.md` §11 pkt 9
jako dziwactwo do NIEzgłaszania. Od P5.1 limit w odbudowie zniknął (patrz „Realizacja" niżej);
sprostowanie samej instrukcji I5 należy do karty P5.3 (follow-up, nieukończony).

**Powiązanie z #21.** Oba wpisy dotyczą tego samego widoku i idą w przeciwnych kierunkach:
#21 pyta, czy **rozszerzyć** słownik akcji (więcej zdarzeń w widoku), a ten wpis — czy podnieść
albo zdjąć limit. Rozstrzygnięcie #21 na „tak" **przyspiesza** problem opisany tutaj, bo przez
odsiew przechodziłoby wielokrotnie więcej wierszy. Warto je rozstrzygać razem.

**Możliwe kierunki — do decyzji użytkownika, NIE rozstrzygam:**
- **(a) zostawić 1:1** — zero kosztu, problem wraca sam przy ~5000 zdarzeń;
- **(b) podnieść limit** — najtańsze, odsuwa próg, ale go nie usuwa i obciąża odpowiedź
  (mapowanie całości w pamięci przy każdym żądaniu);
- **(c) filtrować i paginować w SQL** zamiast w pamięci — usuwa problem u źródła i naprawia
  licznik, ale jest **świadomym odstępstwem** od oryginału w trasie, którą dziś porównujemy
  z produkcją 1:1. Zakładano tu, że wymaga przenagrania fixtures historii — **pomiar w
  69-FEATURE-historia-bez-limitu to obala**: kształt odpowiedzi się nie zmienił, fixtures
  zostały nietknięte.

**⭐ Realizacja (69-FEATURE-historia-bez-limitu, P5.1, 2026-09-21).** Wybrana wersja to
**hybryda**, nie litera (c): w SQL tylko odsiew do akcji ze słownika (przy konkretnym `typ` —
tylko akcje tego typu) plus `ORDER BY kiedy DESC, id DESC`, bez limitu; mapowanie, `dostawca`,
fraza, `total` i paginacja zostają w pamięci jak dotąd.
- **Wynik warunku wdrożenia** (hipoteza z sekcji wyżej, zweryfikowana PRZED kodem): potwierdzona.
  `historia.wyrocznia.test.ts` przeszła 13/13 bez wyjątku. Zastrzeżenie: wyrocznia zasiewa
  wyłącznie 270 wierszy ze słownika, więc z konstrukcji nie widzi, czy odsiew dzieje się w SQL
  czy w pamięci — mocnym dowodem jest pomiar danych (`db/snapshot.db`): jeden format `kiedy`
  (3873/3873, ISO z `Z`), 0 remisów, 0 inwersji między porządkiem tekstowym SQL a porządkiem
  `Date` z JS.
- **Decyzja o frazie (i o `dostawca`)** — użytkownik, 2026-09-21: obie zostają w pamięci, bo
  trafiają w pola WYLICZANE na zmapowanym wpisie (`typ`, `format`, „Plik: …", `zmienionePola`
  dla frazy; `encja_id`/`szczegoly.dostawca` po parsowaniu JSON dla `dostawca`). Wersja SQL
  dla `dostawca` (`json_extract`) byłaby drugą kopią mapowania akcja→typ, czyli mechanizmem
  z backlogu **#41**. Koszt: każde żądanie mapuje w pamięci wszystkie WIDOCZNE zdarzenia (dziś
  ok. 270, przybywa ok. 130/miesiąc), nie całość `audit_log` — dlatego paginacja też została
  w pamięci, co jest odejściem od litery wariantu (c) przy zachowaniu jego skutku (oba objawy
  usunięte).
- **Jedno źródło prawdy słownika**: `SLOWNIK_AKCJI` (`ReadonlyMap`) w `historia/mapowanie.ts`;
  z niego wyliczają się i `typWpisu()`, i lista akcji do klauzuli SQL `IN` (`akcjeHistorii()`).
- **Remisy `kiedy`**: rozstrzygane `id DESC` (deterministycznie); w danych produkcji remisów
  jest 0, więc bez wpływu na dziś widoczny wynik.
- **Fixtures**: NIE wymagały przenagrania — kształt odpowiedzi (`GET_history_meta.json`,
  `GET_history_paged.json`) bez zmian, kontrakt bez zmian.
- Szczegóły: `docs/tickets/69-FEATURE-historia-bez-limitu/plan.md`, `raport.md`.
---

### #88 · 2026-09-18 · [BACKEND] · `promocjaPasuje` — pusty `marka`/`kategoria` łapie KAŻDĄ promocję o niepustym zasięgu

> **Znalezione przy karcie 14h (`61-FEATURE-promocja-kolumna-katalog`), 2026-09-18** —
> uwidocznione dopiero teraz, bo dotąd kolumna „Promocja" w `/katalog` była martwa (#22) i nie
> było jak zobaczyć skutku, choć na cenę wpływał tak samo, po cichu.

| Pole | Wartość |
|---|---|
| **Kategoria** | BACKEND (silnik cen) |
| **Pliki** | `rebuild/backend/src/repos/ceny.ts` (`promocjaPasuje`); test utrwalający: `rebuild/backend/test/katalog.promocja.test.ts` |
| **Do nowej wersji?** | ⬜ **do decyzji** — naprawa byłaby odstępstwem od oryginału |
| **Status** | — nie zaczęte (świadomie odłożone do 14f) |

**Opis.** `promocjaPasuje` dopasowuje przez `zasieg.includes(tekst(produkt.marka))` (analogicznie
dla `kategoria`), a **każdy napis zawiera pusty napis** — więc produkt z pustą `marka` ORAZ pustą
`kategoria` łapie **KAŻDĄ** promocję o niepustym zasięgu. `marka` i `kategoria` są `NOT NULL`
w schemacie (`rebuild/backend/src/db/schema.ts:24-25`), więc osiągalny jest wariant z pustym
napisem, nie z NULL-em.

**Skutek.** Defekt jest **odziedziczony po oryginale**, nie wprowadzony w odbudowie. Karta 14h
go wyłącznie **UWIDACZNIA** przez ożywienie kolumny „Promocja" (#22) — dotąd nie było go jak
zobaczyć, bo kolumna renderowała „—" bez względu na wynik dopasowania, choć na `cenaSprzedazy`
wpływał identycznie, po cichu.

**Skala — ZMIERZONA, nie oszacowana (14h, 2026-09-18): ZERO.** Na snapshocie produkcji
(`db/snapshot.db`, 7405 produktów) **ani jeden** produkt nie ma jednocześnie pustej `marka`
i pustej `kategoria`:

```sql
SELECT COUNT(*) FROM products
WHERE TRIM(COALESCE(marka,'')) = '' AND TRIM(COALESCE(kategoria,'')) = '';  -- 0
```

Defekt jest więc **realny, ale dziś nikogo nie dotyczy** — to pułapka czekająca na dane (np. na
import od dostawcy bez marki), a nie usterka do gaszenia. Zapisany, żeby nie trzeba go było
odkrywać drugi raz od zera; **priorytetu nie podnosimy**.

**Decyzja.** Naprawa to zakres silnika cen — karta **14f**, nie 14h (14h reużywa silnika,
nie modyfikuje go). Wymaga decyzji Ani, bo zmiana dopasowania jest odstępstwem od oryginału.
Przy zerowym zasięgu rozsądne jest odłożenie tego do czasu, aż dane się zmienią — pod warunkiem,
że wpis zostaje.

**Świadomie NIE opisane Ani — karta 14m (2026-09-19).** `docs/instrukcja-testow-I4-v2.md` tego
wpisu nie porusza: skala jest zmierzona na 0 produktów z 7405 i dziś nie ma jak tego zobaczyć na
ekranie. To decyzja karty 14m, nie przeoczenie — kolejna sesja niech tego nie dopisuje do v2 bez
nowego powodu (np. zmiany danych podnoszącej skalę powyżej zera).

---

### #89 · 2026-09-02 (wisi bez decyzji do 2026-09-19) · [FRONTEND] · edycja priorytetu reguły z formularza — pole niedostępne dla użytkownika

> **Pozycja §5 starej instrukcji testów I4 (2026-09-02), jedyna z czterech bez czyjejkolwiek
> decyzji.** Pytanie zadane Ani wprost dopiero kartą **14m** (`65-DOCS-instrukcja-testow-i4-v2`,
> 2026-09-19), `docs/instrukcja-testow-I4-v2.md` §6.3.

| Pole | Wartość |
|---|---|
| **Kategoria** | FRONTEND (formularz reguły narzutu/promocji) |
| **Pliki** | oryginał: pole „priorytet" pod `display:none` (`:24468-24472`); port: `rebuild/frontend/src/pages/narzuty/DialogReguly.tsx:141-143` (stan trzymany WYŁĄCZNIE po to, żeby przy edycji odesłać istniejącą wartość, domyślnie 50, i nie zbić jej po cichu); backend: `rebuild/backend/src/repos/ceny.ts:161-165` (`wybierzPromocje` sortuje po `priorytet` malejąco i bierze pierwszą pasującą) |
| **Do nowej wersji?** | ⬜ **do decyzji — czeka na odpowiedź Ani (pytanie zadane 2026-09-19)** |
| **Status** | ⬜ do decyzji — czeka na odpowiedź Ani (pytanie zadane 2026-09-19) |

**Opis.** Priorytet reguły ma znaczenie **tylko przy remisie szczegółowości** (dwie reguły
pasujące jednocześnie do tego samego produktu) — o wygranej decyduje wtedy wyłącznie kolejność
po `priorytet` malejąco. Formularz go nie pokazuje ani w oryginale, ani w porcie — port 1:1
odtwarza ukryte pole, więc użytkownik nie ma jak dziś ustawić priorytetu inaczej niż wartością
domyślną (50) odziedziczoną przy tworzeniu reguły.

**Skutek.** Przy dwóch pasujących regułach/promocjach na ten sam produkt wygrywa ta, która ma
wyższy `priorytet` w bazie — a nie da się tego zmienić z UI. Zaobserwowane przy okazji reviewu
14m: dwie promocje na tę samą markę w scenariuszu testowym maskowały nawzajem swój efekt.

**Decyzja.** Brak. Karta 14m zadała Ani pytanie wprost (kratka „Czy brak pola «priorytet»
w formularzu reguły Ci przeszkadza?") w `docs/instrukcja-testow-I4-v2.md` §6.3. Do czasu
odpowiedzi: **port 1:1 zostaje bez zmian** (pole niedostępne z formularza, jak w oryginale).
Gdyby odpowiedziała „tak" — osobna karta na dodanie pola do formularza (i decyzja, czy dotyczy
tylko promocji, czy też narzutów).
---

### #90 · 2026-09-21 · [FRONTEND] · wyszukiwarka po treści alertu — ŻYCZENIE ANI

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-21 (odpowiedź na pytanie 6.4 z `docs/pytania-do-ani-2026-09-18.md`) |
| **Kategoria** | FRONTEND (widok `/alerty`) |
| **Pliki** | `rebuild/frontend/src/pages/alerty/TabelaAlertow.tsx`, `pages/alerty/grupowanie.ts` |
| **Do nowej wersji?** | ✅ **TAK — decyzja Ani 2026-09-21** (nowa funkcja, oryginał jej nie ma) |
| **Iteracja** | P6.1 |
| **Status** | ✅ **zrobione 2026-09-21** (`72-FEATURE-alerty-przejrzany-szukajka`) · instrukcja dla Ani: `docs/instrukcja-testow-I6-v2.md` §1.3 (P6.3, ticket `85`) |

**Po co.** Typ „Błąd pobierania" obejmuje JEDNYM workiem awarię sieci i błąd parsera (backlog #16),
więc żeby je rozróżnić, trzeba dziś rozwinąć grupę i przeczytać wpisy. Wyszukiwarka po treści
pozwoli znaleźć je od razu. Ania: „ta przydałaby się".

**Uwaga do wdrożenia.** Filtry w tym widoku są wyliczane z danych, nie zaszyte — nowa wyszukiwarka
ma działać na tej samej zasadzie i łączyć się z istniejącymi filtrami operatorem AND, tak jak
robią to filtry dostawcy i typu (`test/alerty.grupowanie.test.ts`, „filtry łączą się operatorem AND").

**Dowiezione w P6.1.** Wyszukiwanie obejmuje sam `opis` (nie dostawcę ani typ — mają własne
filtry), frazę dzieli na słowa łączone AND, porównanie bez rozróżniania wielkości liter. Filtr
działa PRZED grupowaniem: grupa zostaje, gdy pasuje choć jeden jej wpis, licznik „N×” i akcja
grupy obejmują wyłącznie trafienia. Szczegóły: `docs/tickets/72-FEATURE-alerty-przejrzany-szukajka/plan.md`
(D3, D4). ⚠ To świadome odwrócenie decyzji D8 z `18-FEATURE-widok-alerty` (I6), która tę samą
wyszukiwarkę odrzuciła jako follow-up. Wraca, bo Ania wprost jej chciała — nie jest to przeoczenie D8.

---

### #91 · 2026-09-21 · [FRONTEND][BACKEND] · eksport CSV analityki ma respektować filtry — ŻYCZENIE ANI

> **⭐ ZAKRES — decyzje użytkownika 2026-09-21, wszystkie zgodnie z rekomendacją. Karta P10.3.**
> 1. **Sposób: plik CSV powstaje w PRZEGLĄDARCE** z dokładnie tych wierszy, które tabela karty ma po
>    zastosowaniu filtrów (globalnych i lokalnych, np. „Bez ruchu dni" w Rotacji). Odrzucone: filtry
>    doklejane do `export/:view` i filtrowane w SQL — 10 zapytań × 6 wymiarów do przerobienia, a kolumny
>    i tak zostałyby inne niż w tabeli. Trasa `GET /api/analytics/export/:view` ZOSTAJE bez zmian (kontrakt,
>    naprawiona w P10.1) — przestaje być wołana przez przyciski CSV.
> 2. **Marża: plik ma przekrój tabeli** (grupy dostawca/kategoria/marka), nie dzisiejszą listę per produkt.
>    Bez drugiego przycisku „wszystkie produkty" — Ania prosiła o „to, co widzę"; jeśli potrzebuje danych
>    per produkt, zapyta o to delta I10 (P10.4).
> 3. **Limit 300 wierszy tabeli NIE dotyczy pliku** — CSV ma WSZYSTKIE wiersze po filtrach. Limit to
>    ograniczenie rysowania (`TabelaAnalityki.tsx`, `slice(0, 300)` z oryginału), nie zamiar.
> Kontekst, który przesądził: **pasek filtrów analityki to NASZE odstępstwo** (O-10a-2, 10a) — produkcja
> go nie ma. Brak filtrów w eksporcie to luka, którą stworzyła odbudowa, nie defekt produkcji.
> Trzy rozjazdy z pierwotnego opisu (filtry, kolumny Marży, „Bez ruchu dni") zamyka punkt 1.

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-21 (odpowiedź na pytanie 10.3), ✅ zrobione 2026-09-22 |
| **Kategoria** | FRONTEND (analityka, eksport CSV) |
| **Pliki** | `rebuild/frontend/src/pages/analityka/csv.ts` (nowy generator), `eksport.tsx`, dziesięć `Sekcja*.tsx`; backend nieruszony — `routes/analytics.ts` i trasa `export/:view` zostają bez zmian, tylko przestają mieć konsumenta we froncie |
| **Do nowej wersji?** | ✅ **TAK — decyzja Ani 2026-09-21** (ŚWIADOME ODSTĘPSTWO) |
| **Iteracja** | 10 / **P10.3** |
| **Status** | ✅ **zrobione 2026-09-22** — ticket `98-FEATURE-eksport-csv-z-tabeli`, karta `docs/karty/P10.3/` |

**Co robi produkcja.** Każdy przycisk CSV pobiera dane WŁASNYM zapytaniem, innym niż karta nad nim,
i **nie zna zaznaczonych filtrów** — zaznaczasz jednego dostawcę, a w pliku są wszyscy. Do tego
CSV z karty „Marża" ma inne kolumny niż tabela, a CSV z „Rotacji" ignoruje pole „Bez ruchu dni".
Opisane Ani w `instrukcja-testow-I10.md` §6.4 jako zachowanie zamierzone.

**Decyzja Ani:** „można dorobić filtry". Czyli eksport ma oddawać to, co użytkownik widzi.

**Zakres rozstrzygnięty (2026-09-22, karta P10.3):** „zapisz to, co widzę" obejmuje wszystkie trzy
rozjazdy — plik powstaje w przeglądarce z wierszy tabeli karty po filtrach globalnych i lokalnych
(np. „Bez ruchu dni" w Rotacji), Marża idzie w przekroju grup jak tabela (bez drugiego przycisku),
a limit 300 wierszy dotyczy tylko rysowania — plik ma wszystkie wiersze. Format: nagłówek z etykiet
kolumn tabeli (nie kluczy pól), liczby z przecinkiem dziesiętnym, do komórki idzie surowa wartość
pola `key` (nie tekst z ekranu — dostępność `87,5` bez `%`), brak wartości = pusta komórka; EAN-y
i kody zostają zwykłym tekstem jak na serwerze. Backend i `GET /api/analytics/export/{view}`
zostają nietknięte i martwe dla frontu. Szczegóły: `docs/tickets/98-FEATURE-eksport-csv-z-tabeli/`.

---

### #92 · 2026-09-21 · [BAZA][FRONTEND] · duplikaty marek różniące się wielkością liter — `ALLIANCE` vs `Alliance`

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-21 (zgłoszenie Ani, pytanie 12.4 — doprecyzowanie uwagi z przeglądu 12 widoków) |
| **Kategoria** | BAZA (dane) + FRONTEND (filtr marek w katalogu) |
| **Pliki** | dane `products.marka` + słownik `atrybuty_wartosci` (rodzaj `marka`); `rebuild/schema/010_marka_caps.sql` |
| **Do nowej wersji?** | ✅ **TAK — DANE (migracja), decyzja użytkownika 2026-09-22** (świadome odstępstwo; odrzucone: scalanie w filtrze) |
| **Iteracja** | karta PR.5 — `docs/tickets/101-CHORE-migracja-marka-caps/` |
| **Status** | ✔ **zrealizowane w rebuild (ticket 101, 2026-09-22)** — migracja `rebuild/schema/010_marka_caps.sql` · w produkcji **nadal obecne** do cutoveru |

**Zgłoszenie.** Ania: „to jest wynik kopii bazy ze starego Bridge'a — np. w filtrach marki
w katalogu jest ALLIANCE i alliance, duplikaty małą i dużą literą".

**Pomiar (2026-09-21, `db/snapshot.db`, 7405 produktów).** Duplikatów różniących się WYŁĄCZNIE
wielkością liter jest **dokładnie jedna para: `ALLIANCE` i `Alliance`**. Żadna inna marka nie ma
wariantów. Zapytanie kontrolne:

```sql
SELECT LOWER(marka), COUNT(DISTINCT marka), GROUP_CONCAT(DISTINCT marka)
FROM products WHERE marka IS NOT NULL AND marka <> ''
GROUP BY LOWER(marka) HAVING COUNT(DISTINCT marka) > 1;
```

**Dwie drogi, różne konsekwencje:**
- **dane** — migracja normalizująca `marka` (jak 004–006 dla kategorii, konstrukcji i nazwy).
  Rozwiązuje problem u źródła, ale zmienia dane produkcji; przy jednej parze koszt jest minimalny.
- **prezentacja** — filtr marek w katalogu scala warianty case-insensitive. Nie rusza danych,
  ale duplikat zostaje wszędzie indziej (eksporty, reguły cenowe, kolejka atrybutów).

**Powiązania.** To ten sam problem, co #42 („BKT" i „bkt" nie podpowiadają się nawzajem) i ta sama
przyczyna, którą Ania nazwała w pytaniu 7.3: **katalog ma konwencję WIELKICH liter, a pliki
dostawców przychodzą różnie**. Rozstrzygać łącznie z #42, nie osobno.

**Fakt z P7.2 (ticket 78, 2026-09-21).** Słownik `marka` ma obie formy, `ALLIANCE` i `Alliance`.
Po ticketcie 78 kolejka atrybutów **nie zaproponuje** tej pary jako sugestii aliasu: pozycja
`ALLIANCE` jest dosłownie obecna w słowniku i znika przy sprzątaniu kolejki (**#40**, D1) zamiast
dostać sugestię. Duplikat w `products.marka` i w słowniku zostaje nietknięty — to nadal wymaga
osobnej decyzji (dane vs prezentacja, wyżej).

**Rozstrzygnięte (decyzja użytkownika 2026-09-22, wdrożone w tickecie 101).** Droga **dane**.
Migracja `010_marka_caps.sql` z predykatem ogólnym (nie „Alliance” na sztywno): marka, która
ma w `products` drugą formę różniącą się wyłącznie wielkością liter, przechodzi na formę
WIELKIMI. Klucz zna polskie litery mimo ASCII-only `UPPER()`. Ze słownika `marka` znika forma
niekanoniczna, jeśli kanoniczna w nim jest.
Na snapshocie: `MO1_71970103` `Alliance` → `ALLIANCE` (849 łącznie) + 1 wpis słownika. Poprawka
nie wraca przy imporcie, bo adapter od 2026-09-01 zamienia markę na wielkie litery. Oczekujący
wiersz stagingu tego produktu kasuje już `006`. `historia_cen.marka` zostaje nietknięta (dziennik).
Frontend (filtr) bez zmian.

---

### #93 · 2026-09-18 · [BACKEND] · eksport ZIP `GET /api/export-shoper` bez `?dostawca=` — w produkcji trwale HTTP 500

> **Wpis zakładany 2026-09-21 jako NAPRAWA LUKI W EWIDENCJI.** Decyzja użytkownika zapadła już
> 2026-09-18 (karta `62-DOCS-decyzje-po-i14j`, D1), ale wpis backlogu, który miał ją nieść,
> **przepadł w kolizji numerów** — numer `#88` zajęła równolegle inna karta, a PR #75 zmergował
> się do gałęzi już wmergowanej do `develop`. Decyzja żyła więc wyłącznie w opisie pull requesta,
> czyli poza bazą wiedzy. To drugi taki przypadek w tym tygodniu; morał na końcu wpisu.

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-18 (znalezisko uboczne karty `59-CHORE-i14j-oracle-diff-historii`) |
| **Kategoria** | BACKEND (eksport Shoper) |
| **Pliki** | oryginał: `deminified/backend-index.cjs:48139` (`rV()`); port: `rebuild/backend/src/routes/export-shoper.ts` |
| **Do nowej wersji?** | ✅ **TAK — decyzja użytkownika 2026-09-18: NIE odtwarzamy defektu produkcji** |
| **Iteracja** | karta `70-CHORE-eksport-zip-odstepstwo` (P5.2) |
| **Status** | ✅ zrealizowane 2026-09-21, karta `70-CHORE-eksport-zip-odstepstwo` (P5.2) |

**Na czym polega — przyczyna ZMIERZONA, nie wydedukowana.** `GET /api/export-shoper` bez
parametru `?dostawca=` (eksport wszystkich dostawców do ZIP-a) oddaje w produkcji **zawsze
HTTP 500**. Powód: `rV()` czyta `ZipArchive` z pakietu `archiver`, a lockfile produkcji przypina
**`archiver@5.3.2`**, który tego eksportu nie ma (udostępnia `create`, `registerFormat`,
`isRegisteredFormat`). Log procesu produkcyjnego: `zip pipeline failed TypeError: oh is not
a constructor`, przy potwierdzonym „archiver w piaskownicy: JEST".

**⚠ To rzadki przypadek: wierne przepisanie kodu dało zachowanie INNE niż produkcja.** Odbudowa
ma `archiver@^8.0.0`, gdzie `ZipArchive` istnieje — więc u nas ta trasa **działa**. Różnica nie
siedzi w kodzie, tylko w wersji zależności, i żadna bramka wierności nie mogła jej złapać,
bo porównujemy kod, nie `package-lock.json`.

**Skutek uboczny dla Historii:** w produkcji nie powstaje ani jeden wpis `eksport_csv` z tej
gałęzi, więc ta ścieżka mapowania jest na żywych danych nieosiągalna (potwierdzone: `audit_log`
w `db/snapshot.db` nie ma ani jednego wiersza `eksport_csv`/`eksport_shoper`/`import_cennika`).

**Decyzja (użytkownik, 2026-09-18): zostajemy przy wersji działającej.** Nie odtwarzamy defektu
produkcji przez cofnięcie `archiver` — to jedno z nielicznych miejsc, gdzie odbudowa jest
POPRAWNIEJSZA od oryginału i ma taka zostać.

**Realizacja (P5.2).** Bramka (`test/eksport-shoper.gate.test.ts`) ma jawny komentarz
odstępstwa przy obu przypadkach ZIP, cytujący ten wpis. Bramka i test formatu
(`test/eksport-shoper.format.test.ts`) sprawdzają teraz ZAWARTOŚĆ archiwum, nie tylko nagłówki —
własny czytnik ZIP `test/gate/czytnik-zip.ts` (EOCD, katalog centralny, CRC-32), każdy wpis
sprawdzony bajt w bajt jako równy odpowiedzi pojedynczego eksportu tego dostawcy. Nowy strażnik
zależności `test/zaleznosci.archiver.test.ts` pada, gdy zainstalowany `archiver` nie eksportuje
`ZipArchive`. Zakres w `package.json` zostaje `^8.0.0` bez przypinania (decyzja użytkownika
2026-09-21, D3) — lockfile i tak trzyma `npm ci` na 8.0.0, strażnik łapie regresję przy
regeneracji locka. Przy okazji znalezisko: błąd rzucony PO wysłaniu nagłówków ZIP-a wieszał
klienta bez końca (`on("error")`/`pipe()` po `headersSent` nic nie kończyły); teraz trasa zrywa
połączenie (`abort()` + `res.destroy()`, decyzja użytkownika 2026-09-21, D2) — ścieżka
nieosiągalna w produkcji, bo tam trasa pada wcześniej, na `new ZipArchive`. Szczegóły:
`docs/tickets/70-CHORE-eksport-zip-odstepstwo/`.

**⚠ Morał do procesu, bo to już drugi raz.** Numer wpisu backlogu rezerwuj tak samo jak numer
ticketa — sprawdzając `develop`, nie własną gałąź. Stacked PR, którego bazą jest gałąź mergowana
równolegle, potrafi zmergować się 25 sekund po swojej bazie i wylądować poza `develop`
(tu: PR #75 o 18:04:39 wobec PR #74 o 18:04:14). **Decyzja zapisana wyłącznie w opisie pull
requesta nie istnieje** — baza wiedzy to `docs/`, nie GitHub.

---

### #94 · 2026-09-22 · [BACKEND] · karta 4.1 „Historia dostępności”: EAN wybierany przypadkowo i zdublowane migawki liczone podwójnie

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-22 (znalezisko review karty P10.1, `90-FEATURE-ozywienie-kart-dostepnosci`) |
| **Kategoria** | BACKEND (analityka, `historia_cen`) — defekt PRODUKCJI odtworzony 1:1 |
| **Pliki** | `rebuild/backend/src/repos/analityka.ts` (`dostepnoscProduktow`), `repos/analityka-eksport.ts` (`export/availability-products`); oryginał `mirror/backend/analytics_module.cjs:161-165` |
| **Do nowej wersji?** | ⬜ **do decyzji użytkownika** |
| **Status** | — |

**Na czym polega.** Dwie rzeczy, obie w karcie 4.1 i jej eksporcie CSV, obie tego samego rodzaju co
naprawione #33:
1. `h.ean` wybierane GOŁE obok `GROUP BY h.dostawca, h.kod` — gdy para `(dostawca, kod)` ma w historii
   dwa różne EAN-y, SQLite bierze jeden z nich zależnie od implementacji. Na `db/snapshot.db`: **9 par**.
2. `COUNT(*)` i procent liczone po SUROWEJ historii — zdublowane migawki o tym samym kluczu
   `(dostawca, kod, zarejestrowano_at)` (30 grup / 67 wierszy na snapshocie) liczą się podwójnie.
   Decyzja #33 objęła wyłącznie `sell-through`.

**Dlaczego dopiero teraz.** Do P10.1 karta 4.1 była trwale pusta (#32), więc obie usterki były
nieosiągalne. Ożywienie kart je odsłoniło.

**Rekomendacja koordynatora:** ✅ naprawić wzorem #33 — zwinąć duplikaty klucza (`MAX(id)`, wspólne CTE
`HISTORIA_BEZ_DUPLIKATOW_KLUCZA` już istnieje) przed agregacją i brać EAN z tego samego, ostatniego wiersza.
Mała zmiana w jednym pliku repozytorium + eksport.

---

### #95 · 2026-09-22 · [BACKEND] · import: przy zdublowanym kodzie w jednym cenniku katalog i historia cen mogą mieć różny stan („przypadek mieszany”)

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-22 (pomiar karty P10.1 przy decyzji #33) |
| **Kategoria** | BACKEND (import, `import/tk.ts`) — zachowanie PRODUKCJI, odtworzone 1:1 |
| **Pliki** | `rebuild/backend/src/import/tk.ts` (klasyfikacja zmian, zapis `historia_cen`) |
| **Do nowej wersji?** | ⬜ **do decyzji użytkownika** |
| **Status** | — |

**Na czym polega.** Gdy ten sam kod występuje w cenniku dwa razy, import zostawia w `products`
linię OSTATNIĄ — z jednym wyjątkiem: jeśli ostatnia linia ma `stan` równy stanowi sprzed importu,
ale inną cenę, pole `stan` w katalogu zostaje ze wcześniejszej linii. Karta „Tempo schodzenia”
(po #33 bierze `MAX(id)`) pokaże wtedy stan ostatniej linii, a katalog — wcześniejszej.

**Skala.** Przypadek rzadki: wymaga zdublowanego kodu w jednym pliku ORAZ różnych danych w obu
liniach. MO7 Nokian ma 14 zdublowanych kodów, ale to identyczne wiersze (pomiar parserów 21.09).

**Rekomendacja koordynatora:** 🕒 później — zapisać, zająć się przy najbliższej karcie dotykającej
`import/tk.ts`. Nie blokuje cutoveru.

---

### #96 · 2026-09-22 · [FRONTEND] · plik CSV z kart analityki ma sufit tras dashboardu (1000 / 500 wierszy) — mniej niż dawny eksport serwerowy

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-22 (znalezisko karty P10.4, `100-DOCS-instrukcja-testow-i10-v2`, po P10.3) |
| **Kategoria** | FRONTEND (analityka, eksport CSV) — skutek uboczny świadomego odstępstwa #91 |
| **Pliki** | `rebuild/frontend/src/pages/analityka/eksport.tsx` i generator CSV (P10.3); trasy dashboardu z limitami SQL (`repos/analityka.ts`) |
| **Do nowej wersji?** | ✅ **TAK — decyzja Ani 2026-09-23: „chcę pełne pliki"** (świadome odstępstwo; karta **P10.5**) |
| **Status** | ✅ **ZAMKNIĘTE 2026-09-23, ticket `126-FEATURE-pelne-pliki-csv-analityki`.** Osiem widoków dostało opcjonalny `?limit=0` (brak klauzuli `LIMIT`, wyłącznie dla pliku CSV); trasa bez parametru 1:1 jak przed ticketem, tabela nadal 300 wierszy, kafel „Pozycje unikalne" nadal 1000. Szczegóły niżej i w `docs/tickets/126-FEATURE-pelne-pliki-csv-analityki/raport.md`. |

**Na czym polega.** Od P10.3 plik CSV powstaje w przeglądarce z wierszy tabeli (#91). Plan P10.3 zakładał,
że karty pobierają pełne listy — nieprawda: trasy dashboardu mają limity SQL z oryginału. Zmierzone na
`db/snapshot.db` (liczba wierszy PRZED `LIMIT`) — **sufit uciął SZEŚĆ widoków, nie trzy**: Pozycje
unikalne 5109 → plik 1000; karty 4.1 / 4.2 (~5184 każda) → plik 500; `suppliers-lifecycle` 1716 → 500;
`prices-last` 1644 → 500; `rotation-inactive` 1100 (przy `days=60`) → 1000. `ean-comparison` (769) i
`margins` (335) mieściły się w suficie 1000, ale z zapasem, który mógł się skończyć. Dawny eksport
serwerowy: `unique` bez limitu, `availability-products` / `sell-through` do 5000.

Ten sam sufit robi kafel KPI „Pozycje unikalne” = 1000 (port 1:1 oryginału, PR.2) — **to zostaje bez zmian**,
sufit zdjęty wyłącznie dla pliku CSV.

**Powiązane:** `GET /api/analytics/export/{view}` nie ma już konsumenta we froncie (P10.3) — działa dalej
jako API. Przywrócenie tej trasy jako drogi rozwiązania zostało odrzucone (karta P10.5): odebrałoby
plikowi filtry kliencie, czyli cofnęłoby sens #91. Wybrany mechanizm zamiast tego: opcjonalny `?limit=0`
na trasach dashboardu, zdejmujący `LIMIT` tylko na żądanie eksportu.

**⭐ DECYZJA ANI 2026-09-23: pełne pliki.** Cytat: „chce pełne pliki". Zakres: **sufit zdejmujemy TYLKO dla pliku CSV**
(osobne, leniwe zapytanie bez limitu, dopiero po kliknięciu CSV, przez `?limit=0`); tabela na ekranie
zostaje przy 300 wierszach (limit rysowania z oryginału), a kafel „Pozycje unikalne" nadal liczy 1000
(port 1:1). Karta **P10.5** (`docs/karty/P10.5/`) objęła docelowo **osiem** widoków z sufitem (D1), nie
trzy — pomiar pokazał, że sufit dotyka więcej kart niż wymieniał backlog i karta w chwili otwarcia.
Semantyka `limit=0` i testy broniące stałych `LIMIT_*` (dotąd niebronionych żadnym testem): `docs/spec-backend/wpis-126.md`.

---

### #97 · 2026-09-22 · [FRONTEND][BACKEND] · kafel „Ostatni eksport CSV” ożył, ale z panelu nie da się wytworzyć eksportu, który by go zasilił

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-22 (znalezisko karty P10.4, po P10.2) |
| **Kategoria** | FRONTEND + BACKEND (Pulpit, audyt eksportów) |
| **Pliki** | `rebuild/frontend/src/pages/pulpit/kpi.ts` (P10.2); eksport z Katalogu (bez audytu — decyzja D3 bloku 10f); trasy `eksport_csv`/`eksport_shoper` bez konsumenta w UI |
| **Do nowej wersji?** | ❌ **NIE — decyzja Ani 2026-09-23: „zostawcie tak jak jest"** |
| **Status** | — |

**Na czym polega.** P10.2 (#34) podpięła kafel pod Historię (`audit_log`, typ „eksport”). Ale żaden przycisk
w panelu nie tworzy dziś wpisu `eksport_*`: eksport CSV z Katalogu nie zapisuje audytu (10f, D3), a trasy,
które audyt piszą, nie mają przycisku. Generowanie CSV dla Selly też się nie liczy. Kafel pokaże więc
„—” + „Ostatni import: …”, dopóki ktoś nie wywoła eksportu z API.

**⭐ DECYZJA ANI 2026-09-23: ZOSTAWIAMY.** Cytat: „zostawcie tak jak jest". Kafel czyta prawdziwą historię, ale skoro
żaden przycisk w panelu nie tworzy wpisu eksportu, w praktyce pokaże „—" i datę ostatniego importu. Wpis ZAMKNIĘTY
bez pracy w kodzie. Gdyby kiedyś doszedł audyt eksportu z Katalogu, kafel ożyje sam.

---

### #98 · 2026-09-22 · [BAZA] · resztki w danych po PR.5: śmieci w polu marki, pary bieżników różniące się wielkością liter, mieszane marki w historii cen

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-22 (karta PR.5, `101-CHORE-migracja-marka-caps`) |
| **Kategoria** | BAZA (dane) — stan produkcji |
| **Pliki** | dane: `products.marka`, słownik `atrybuty_wartosci` (rodzaj `bieznik`), `historia_cen.marka` |
| **Do nowej wersji?** | ⬜ **do decyzji użytkownika** |
| **Status** | — |

**Co zostało poza zakresem #92** (migracja `010` objęła wyłącznie marki w `products` i słowniku marek):
- **śmieci w polu marki** — `21x7.00-15`, `18x8.50-8` (rozmiar zamiast marki), po 1 produkcie;
- **4 pary case-only w słowniku `bieznik`** — `FLOTATION T422`, `LOGGER KING TRS-2`, `MAGLIFT LIP`,
  `MG121 PROWADZĄCA` (ostatnia z polskim znakiem — patrz CLAUDE.md o ASCII-only `UPPER()`);
- **`historia_cen.marka`: 953 × `Alliance`** — ma znaczenie dopiero, gdy grupowanie po marce
  w historii cen dostanie UI.

**Rekomendacja koordynatora:** 🕒 po cutoverze. Żadna z tych rzeczy nie jest widoczna w filtrach katalogu
ani nie blokuje testu. Śmieci w polu marki Ania może poprawić ręcznie (edycja produktu).

---

### #99 · 2026-09-22 · [BAZA][BACKEND][FRONTEND] · Staging v2 — nowy importer, akceptacja z kontrolą aktualności, ścisły EAN, „Rozstrzygnij”

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-22 13:03 (wdrożenie), commit `7d6cfc9` (sync 14:00) |
| **Kategoria** | BAZA + BACKEND + FRONTEND — przebudowa rdzenia importu i stagingu |
| **Pliki** | `mirror/backend/staging_policy.cjs` (**nowy**, 298 l.), `mirror/backend/index.cjs` (dwa wywołania: `staging_policy.install({U,db,normalize,classify,badName,ext})` i `registerRoutes`), `mirror/backend/common.cjs` (`ean_raw`), `mirror/backend/parsers/adapter.cjs` (EAN przez `validateEan`, `eanRaw`, kod zastępczy bez samego EAN), `mirror/frontend/assets/staging-policy-injection.js` (**nowy**), `mirror/frontend/index.html`, `db/schema.sql` (tabela `staging_matches`, indeks unikalny `staging_one_current_product ON staging_items(dostawca,kod)`), `mirror/backend/staging_reconcile_20260922.cjs` (skrypt jednorazowy); kopie `.bak_20260922T110248Z_staging_v2` |
| **Commit** | `7d6cfc9` |
| **Do nowej wersji?** | ✅ **TAK — decyzja użytkownika 2026-09-22** (D3 planu I15) |
| **Status** | zatwierdzone; **I15.2 (część parserowa) — ✅ DOWIEZIONA** (ticket 120, 2026-09-23): `staging_policy.cjs` w `legacy/` skopiowany bajt w bajt, adapter/common używają `validateEan`, `rawEan`, `syntheticCode`. **I15.4a (schemat) — ✅ DOWIEZIONA** (ticket 124): tabela `staging_matches` i indeks `staging_one_current_product` migracją `012`. **I15.4c (akceptacja i trasy) — ✅ DOWIEZIONA** (ticket 129, 2026-09-23): `checkAcceptance` z SIEDMIOMA blokadami 409 (nie czterema — zmierzone w `:188-200`), nadpisania `addStaging`/`updateStaging`, `resolveStaging`, trasy `review` i `resolve` w `contract/openapi.yaml`; dowód wierności = GATE różnicowy na uruchomionym `staging_policy.cjs`. **I15.4b (silnik) — ✅ DOWIEZIONA** (ticket 130, 2026-09-23): `importer()` zastępuje port martwego `tk()`, nadpisanie `assignKodImportu` z pierwszą gałęzią DOSŁOWNIE („zachowaj istniejący sześciocyfrowy `kod_importu`"), `addStaging` zastępujące poprzednie zgłoszenie dla pary dostawca+kod, `_policyVersion: 2` i `_catalogVersion` wymagane przez blokady akceptacji z I15.4c. Otwarte: **I15.5**/**I15.11** (frontend) — `docs/karty/I15.*` |

**Opis biznesowy (CHANGELOG Ani, 2026-09-22 13:03).** „Staging v2: jedno najnowsze zgłoszenie na produkt/dostawcę;
świeże ceny i stany; ścisła kontrola surowego EAN w parserze/adapterze; dopasowanie po EAN wyłącznie do jednej
zgodnej opony, z ochroną DOT; niejednoznaczności do ręcznej decyzji; poprawki ręczne chronione bez osobnego błędu;
kontrola aktualności i atomowa akceptacja; przycisk Rozstrzygnij; przebudowa stagingu z archiwów bez zmiany katalogu;
indeks unikalny i tabela świadomych dopasowań.” Powód: „Prośba Anny z 2026-09-22; nieaktualne zgłoszenia, błędne EAN
i łączenie różnych partii opon.”

**Szczegół techniczny (dla rebuildu).**
- `install()` podmienia w `U` dodawanie (`addStaging` — najpierw kasuje stare zgłoszenie tej samej pary
  dostawca+kod), edycję (`updateStaging` — przelicza status EAN przy zmianie numeru) i akceptację
  (`checkAcceptance`: zgłoszenie zastąpione → 409; zgłoszenie ze starego importu bez `_policyVersion` → 409
  „Odśwież cennik”; nierozstrzygnięte dopasowanie → 409; błędny EAN → 409), oraz dostarcza nowy `importer()`
  (odpowiednik naszego `import/tk.ts`). Nadpisuje też `ext.assignKodImportu` (grupa produktów tylko przy
  zgodności marka/model/rozmiar + indeksy/DOT).
- `validateEan()`: puste → `empty`; zapis naukowy lub utracone cyfry → błąd; znaki nie-cyfry, zła długość
  (8/12/13/14), same zera, zła cyfra kontrolna → błąd. **Nigdy nie obcina, nie zaokrągla, nie „naprawia”.**
- `syntheticCode()`: kod zastępczy `<dostawca>_AUTO_<sha>` z tożsamości opony, **nigdy z samego EAN**.
- Trasy — **CZTERY**, nie dwie (zmierzone w `staging_policy.cjs:620-664`, ticket 129):
  `GET /api/staging/:id/review`, `POST /api/staging/:id/resolve` (`action`, `targetCode`),
  `POST /api/staging/:id/choose-absence-card` (`selectedCode`, `candidateVersion`),
  `POST /api/staging/:id/close-absence-review`. Dwie ostatnie wystawiają decyzje
  o nieobecnych kartach (#106).
- Frontend: wstrzykiwany skrypt z przyciskiem i oknem „Rozstrzygnij”.

**⚠ Kolizja ze świadomym odstępstwem 14i** (ticket 58, EAN w zapisie naukowym → puste pole): produkcja od
22.09 traktuje taki EAN jako BŁĄD blokujący akceptację do ręcznej poprawki. **Decyzja użytkownika
2026-09-22 (D4): przyjmujemy wersję Ani** — zastępuje 14i. Dotyczy też wpisu #11.

**Zmierzone w I15.2 (ticket 120, 2026-09-23).** Stan przejściowy — port ma już `eanRaw`/`_eanLossy`
z parserów, ale import (`import/tk.ts`) jeszcze nie blokuje akceptacji (blokada to zakres **I15.4**) —
nie psuje importu: na pełnych cennikach nowa ekspozycja `ean: null` to **+6 rekordów z 4 843 (0,12 %)**,
wyłącznie MO5, i są to pozycje, które wcześniej niosły bezsensowny EAN `…W2` (patrz #105). Liczba
rekordów identyczna po obu stronach, nic nie ginie. Szczegóły: `docs/karty/I15.4/wejscie-120.md`.

**Skrypt `staging_reconcile_20260922.cjs`** — jednorazowa przebudowa stagingu z archiwów importu (dedup
`MAX(id)` per dostawca+kod, potem ponowny import najnowszego pliku każdego dostawcy w `SAVEPOINT`, z kontrolą, że
`products` się nie zmienił). **Decyzja użytkownika 2026-09-22 (D5): nie przenosimy** — na produkcji wykonany;
u nas wystarczy sprzątanie duplikatów w migracji przed założeniem indeksu unikalnego (karta I15.4a, zrobione migracją `012`, ticket 124).

**Zamrożenie.** To ostatnia zmiana produkcji przed cutoverem — od 2026-09-22 stary Bridge jest zamrożony
(uzgodnienie Pawła z Anią). Staging v2 jest więc w wersji ostatecznej.

---

### #100 · 2026-09-22 · [BACKEND] · usunięcie produktu z katalogu nie usuwa go z Selly — ŻYCZENIE ANI (nowa funkcja)

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-22 (odpowiedź Ani na pytanie 1.4 rundy 3) |
| **Kategoria** | BACKEND (Selly REST) — nowa funkcja, produkcja jej nie ma |
| **Pliki** | produkcja: brak ścieżki; ślad ręcznego usunięcia przez API 17.09: `mirror/backend/…/product_639_pre_delete_20260917T164000Z.json`, `product_639_delete_result_20260917T164000Z.json` (`origin/main`); powiązane: osierocone mapowania `selly_products` (blok 13d w roadmapie, `5cfb7ab`) |
| **Do nowej wersji?** | 🕒 **PÓŹNIEJ — decyzja użytkownika 2026-09-22 (D7): po cutoverze**, pierwsza nowa funkcja w nowym stosie |
| **Status** | odłożone — w I15 port 1:1 |

**Odpowiedź Ani:** „Nawet nie wiem czy jest możliwe żeby usuwać stary rekord z selly jeśli jest to trzeba taką ścieżke
zrobić bo obecnie tego nie ma”. **Technicznie jest możliwe** — 17.09 produkt 639 został usunięty z Selly przez API
(zachowane pliki `pre_delete`/`delete_result`).

**Rekomendacja koordynatora:** 🕒 **po cutoverze**, jako pierwsza nowa funkcja w nowym stosie. Kasowanie w sklepie jest
nieodwracalne i wymaga decyzji produktowych (usuwać produkt czy wariant, co przy produkcie wspólnym dla kilku dostawców,
potwierdzenie), a celem nr 1 jest domknięcie odbudowy 1:1. W I15 port 1:1 (osierocone mapowania zostają jak w produkcji).

---

### #101 · 2026-09-22 · [BAZA][BACKEND] · nowe produkty mają puste „blokowane formy płatności” — ŻYCZENIE ANI

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-22 (odpowiedź Ani na pytanie 2.2 rundy 3) |
| **Kategoria** | BAZA + BACKEND — zgłoszony defekt produkcji |
| **Pliki** | `mirror/backend/payment_blocks.cjs` (lista per dostawca MO1–MO10 bez MO6, `sqlCase()`), triggery `products_blokowane_formy_ai/_au` (`origin/main:db/schema.sql`), `extensions.cjs` (`ensurePaymentBlocks()` przy starcie); powiązane #73 |
| **Do nowej wersji?** | ❌ **NIE — temat zamknięty 2026-09-23 przez Anię** (patrz niżej). Nie ma czego naprawiać ani w Bridge, ani w Selly. |
| **Status** | ✅ **zamknięte 2026-09-23 — zgłoszenie było nieporozumieniem.** Ania: „Nie widzę pustych pól tylko myślałam że nie mamy zrobionej tej logiki. Jest zrobiona to super zamknij temat." Logika istnieje w produkcji (triggery `products_blokowane_formy_ai/_au` + `ensurePaymentBlocks()` przy starcie) i jest już przeniesiona do odbudowy (ticket 107, migracja 011). Pomiar ticketu 109 (I15.7): payload REST Toru 2 tego pola nie niesie — wysyłał je tylko stary eksport CSV (`generate_selly_export.cjs:75,142-143`); zostaje jako FAKT o różnicy CSV ↔ REST, nie jako defekt do naprawy. **⭐ Ticket 119 (I15.10, 2026-09-23) zmierzył też Tor 1:** `budujPayloadProduktuV2` (`src/selly/rest/mapper-v2.ts`) nie ma pola `blokowane_formy_platnosci` ani żadnego `payment_form*`, tak samo oryginał `mirror/backend/selly/mapper_v2.cjs` na `88fa31c` — zero trafień grepem w obu. Potwierdza to wcześniejszy wniosek: REST (Tor 1 i Tor 2) nigdy tego pola nie wysyłał, więc nie mógł być źródłem żadnej regresji; pole istnieje wyłącznie w kolumnie bazy i w CSV. |

**Odpowiedź Ani:** „trzeba dorobić jeszcze logikę przypisywania numerów blokad płatności do nowych produktów bo obecnie
tego nie ma - każdy nowy produkt ma to pole puste a to ono wyznacza opcje metody dostawy i cenę dla danego dostawcy”.

**Co wiemy z kodu (koordynator, 2026-09-22):** trigger `AFTER INSERT ON products` ustawia pole z `dostawca` (`CASE
UPPER(TRIM(dostawca)) WHEN 'MO1' …`), a `products.dostawca` w snapshocie ma dokładnie te kody (MO1…MO10) — w teorii nowe
produkty powinny dostawać wartość. Hipotezy do sprawdzenia: (a) dostawca spoza listy (MO6 nie ma w `BLOCKED_PAYMENT_FORMS`);
(b) pole puste nie w Bridge, tylko w **Selly** (nowe produkty zakładane w sklepie bez tej cechy — ścieżka auto-create,
#68); (c) produkty wstawiane ścieżką, która omija trigger. **Nie wiadomo, gdzie Ania widzi puste pole** — pytanie do niej.
Pomiar: kopia bazy produkcji z 23.09 — produkty utworzone po 10.09 z pustym polem.

**Ustalenie 107 (2026-09-22, `CHANGELOG` produkcji 2026-09-10 14:53):** hipoteza (a) dla MO6 jest **zamierzonym
zachowaniem, nie błędem** — wpis CHANGELOG wprost: „MO6 Uniglory pozostaje bez mapowania, ponieważ nie będzie na
razie w sprzedaży”. `NULL` dla MO6 więc się zgadza (w katalogu i tak nie ma ani jednego produktu MO6).

**⭐ POMIAR NA ŻYWEJ PRODUKCJI 2026-09-23 (ticket 113, odczyt `sqlite3 -readonly`):** produktów z pustym
`blokowane_formy_platnosci` — **0**, w żadnej grupie dostawcy (także MO6); triggerów w bazie produkcji **6**.
**Hipotezy (a) i (c) odpadają — w bazie Bridge pole jest wypełnione dla wszystkich 8329 produktów.**
Zostaje hipoteza (b): Ania widzi puste pole **w Selly**, na kartach produktów zakładanych przez synchronizację
(payload `mapper_v2` / auto-create). To sprawdzają karty I15.6 i I15.7.

**⭐ ODPOWIEDŹ ANI 2026-09-23 (zamyka wpis):** „Nie widzę pustych pól tylko myślałam że nie mamy zrobionej tej
logiki. Jest zrobiona to super zamknij temat." Hipoteza (b) też odpada — Ania nigdzie nie widzi pustego pola, także
w Selly. Karty I15.6 i I15.7 nie mają tu nic do zrobienia.

**Luka na przyszłość (nie defekt):** `BLOCKED_PAYMENT_FORMS` nie ma wpisu dla **MO6**. Dziś MO6 nie ma ani jednego
produktu, więc nic się nie psuje; gdyby ten dostawca ruszył, jego produkty zostaną z pustym polem. Numery dla MO6
trzeba wtedy wziąć od Ani.

**Fakt z ticketu 122 (I15.3, 2026-09-23):** generator CSV odbudowy odtwarza ten sam fallback co
produkcja (mapa po `dostawca`, gdy kolumna w bazie pusta) — MO6 i nieznany dostawca dają puste pole
w 60. kolumnie, zamierzenie pokryte testem, nie defekt.

**Rekomendacja koordynatora:** ❌ zamknięte — nic do zrobienia (potwierdzenie Ani, patrz wyżej).

---

### #102 · 2026-09-22 · [DEPLOY][BACKEND] · plik CSV dla Selly o 6:00 generuje systemowy cron starego stosu — nowy stos nie ma odpowiednika

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-22 (koordynator, po odpowiedzi Ani na pytanie 1.2) |
| **Kategoria** | DEPLOY / BACKEND (eksport CSV Selly) — luka cutoveru |
| **Pliki** | produkcja: cron serwera uruchamia `mirror/backend/generate_selly_export.cjs` (`selly/routes.cjs:297` „Plik generowany cronem ~6:00”); odbudowa: `rebuild/backend/src/selly/generator-csv.ts` (tylko trasa ręczna `POST /api/selly/generate-csv`) |
| **Do nowej wersji?** | ✅ **TAK — decyzja użytkownika 2026-09-22 (D8)**, wymagane do cutoveru (Ania używa: „o 6 rano katalog wypycha nowy CSV na serwer”, Selly zaciąga go o 12:00) |
| **Status** | ✅ **zrobione ticketem 122 (I15.3, 2026-09-23).** `npm run selly:csv` (= `node dist/selly/csv-cli.js`, `rebuild/backend/src/selly/csv-cli.ts`) woła tę samą `wygenerujCsvSelly()` co trasa `POST /api/selly/generate-csv`; test porównuje plik z CLI i plik z trasy **bajt w bajt**. W środowisku wymaga tylko `DB_PATH` (⚠ pełny `wczytajEnv()` wymaga też `JWT_SECRET`, niezwiązanego z zadaniem crona — patrz `review.md` SHOULD-FIX); nie rusza `.htaccess`. Przepięcie crona zostaje w `docs/cutover.md`. |

**Na czym polega.** Odbudowa ma generator (8a), ale nie ma nic, co uruchamia go codziennie — w produkcji robi to cron
systemowy spoza aplikacji. Po cutoverze stary cron dalej uruchamiałby STARY skrypt na tej samej bazie (dałby plik, ale
z logiką starego stosu), a bez niego plik przestałby się odświeżać i Selly o 12:00 zaciągałby wczorajszy katalog.
**Rekomendacja:** I15.3 dokłada polecenie CLI generatora (np. `npm run selly:csv`), cutover przepina cron na nie.

---

### #103 · 2026-09-22 · [BACKEND] · `routes_sync.cjs` importuje nieistniejące `runFullTodays` ze `scheduler_selly.cjs` — trasy `sync-full-today`/`sync-full-force` na produkcji zawsze dają 500

⚠ **Numer zduplikowany w tym pliku** (znalezisko ticketu 120) — niżej jest DRUGI, niepowiązany wpis
oznaczony też jako `#103` („Braki w cenniku", ok. linii 4584). Ta karta to Selly/`sync-*` (I15.8), tamta
to `feed_safety`/staging (I15.2/I15.4/I15.5/I15.11). Przenumerowanie zostawione koordynatorowi — nie
przenumerowano samodzielnie.

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-22 (znalezione przy porcie ticketu 109, I15.7) |
| **Kategoria** | BACKEND (Selly REST, trasy `sync-*`) — defekt produkcji |
| **Pliki** | `mirror/backend/selly/routes_sync.cjs:14` (import `runFullTodays` z `./scheduler_selly.cjs`), `scheduler_selly.cjs` (eksportuje `runFullBatch`, nie `runFullTodays`) |
| **Do nowej wersji?** | ⬜ **do decyzji — zakres karty I15.8: naprawić import czy odtworzyć awarię 1:1** |
| **Status** | ⬜ do decyzji — zmierzone, nienaprawione (poza zakresem I15.6/I15.7, montaż tras jest w I15.8) |

**Na czym polega.** `routes_sync.cjs` importuje z `scheduler_selly.cjs` funkcję `runFullTodays`, której moduł nie
eksportuje (eksportuje `runFullBatch`). Import `undefined` wywołany jako funkcja rzuca `TypeError`, więc na
produkcji `POST /api/selly/sync-full-today` i `POST /api/selly/sync-full-force` zawsze kończą się HTTP 500 —
niezależnie od stanu danych czy Selly. `syncFullForDostawca` (`sync_full.cjs`, przeportowane w I15.7 jako
`src/selly/rest/sync-full.ts`) samo w sobie działa poprawnie; awaria jest wyłącznie w montażu trasy.
**Rekomendacja:** rozstrzygnąć w I15.8 (harmonogram + trasy `sync-*`) — naprawić import (odstępstwo świadome)
albo odtworzyć 500 1:1, zgodnie z regułą projektu o defektach zastanych.

---

### #103 · 2026-09-22 17:30 · [BACKEND][BAZA][FRONTEND] · „Braki w cenniku” — bezpieczeństwo źródła, koniec fałszywych wycofań, staging v3

⚠ **Numer zduplikowany w tym pliku** (znalezisko ticketu 120) — wyżej jest INNY wpis oznaczony też
`#103` (`routes_sync.cjs`/`runFullTodays`, Selly, I15.8, ok. linii 4564). Ten wpis to `feed_safety`/staging.
Przenumerowanie zostawione koordynatorowi — nie przenumerowano samodzielnie.

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-22 17:30 (etykieta `20260922T153004Z_withdrawals`) |
| **Kategoria** | BACKEND + BAZA + FRONTEND — rdzeń importu, staging, panel |
| **Pliki** | `mirror/backend/feed_safety.cjs` (**nowy**), `staging_policy.cjs` (+131 l. → 407), `extensions.cjs` (jeden scheduler — drugi wyłączony), `index.cjs`, `parsers/dispatcher.cjs` (usunięty cichy fallback do starych parserów), `parsers/mo2_jmk.cjs`, `parsers/mo9_agrorami.cjs`, `parsers/mo9_agrorami_api.cjs`, `parsers/_agrorami_fetch_helper.cjs`, `parsers/adapter.cjs`; FE: `assets/index-PRICEFMT1783512500.js` (ŻYWY bundel), `assets/staging-policy-injection.js`, `index.html`; `db/schema.sql`: `supplier_feed_state`, `supplier_feed_versions`, `product_absence_checks`; jednorazowe: `withdrawals_reconcile_20260922.cjs` + raport JSON |
| **Commit** | `3f00533` |
| **Do nowej wersji?** | ✅ **TAK — część parserowa DOWIEZIONA w I15.2** (ticket 120, 2026-09-23); reszta do decyzji w I15.4b/I15.5/I15.11. |
| **Status** | ✅ **parser: I15.2** (ticket 120) — `feed_safety.cjs` w `legacy/`, wpięty w `dispatcher.cjs:47` i `adapter.cjs:733`; usunięty cichy fallback do starych parserów; JMK nie łączy już wierszy po EAN. ✅ **schemat: I15.4a** (ticket 124) — tabele `supplier_feed_state`, `supplier_feed_versions`, `product_absence_checks` migracją `012`. ✅ **akceptacja: I15.4c** (ticket 129, 2026-09-23) — próg „trzech wiarygodnych potwierdzeń nieobecności” egzekwowany w `checkAcceptance` (`staging_policy.cjs:193`) i pokryty GATE-em. ✅ **silnik: I15.4b** (ticket 130, 2026-09-23) — konsumpcja `_bridgeFeedMeta`, cztery blokady źródła (puste / błędy odczytu / cennik mniejszy o ponad 20% od historycznego maksimum / masowo nierozpoznany), odcisk oferty w `supplier_feed_versions`, stan w `supplier_feed_state`, dowody w `product_absence_checks` ze `slice(-3)`, reguła „trzy różne kompletne oferty + minimum 24 h”, bezpieczne dopasowanie po kodzie dostawcy i wielkości liter, ochrona DEMO i wariantów, dopasowanie po EAN wyłącznie do JEDNEJ zgodnej opony. ⚠ Ścieżka dowodowa wycofań chodzi WYŁĄCZNIE w przebiegu weryfikacyjnym (`reconcileOnly`+`verifyAbsence`) — w zwykłym imporcie produkt jest wstrzymywany natychmiast i pętla wychodzi wcześniej (`staging_policy.cjs:596`), więc wiersz `wycofana` w zwykłym imporcie nie powstaje. **Otwarte:** panel „Braki w cenniku” — **I15.5/I15.11**. |

**Opis biznesowy (CHANGELOG Ani).** „Naprawa nieobecności w stagingu. Usunięto cichy fallback do starych parserów
w imporcie URL i ręcznym. Agrorami: pełny zapis JSON przed zamknięciem procesu, kontrola liczby/unikalności produktów
i postępu pobierania, import rdzenia bez pobierania nieużywanego starego CSV. Jeden scheduler (rdzeń), wyłączony drugi
w extensions. Przenoszenie informacji o kompletności i wierszach odfiltrowanych dispatcher→adapter→silnik. Blokada
pustego, błędnego, mniejszego o ponad 20% lub masowo nierozpoznanego źródła. Trzy różne kompletne oferty, minimum 24h
pomiędzy potwierdzeniami; trwałe dowody i ochrona przed ponownym liczeniem tego samego pliku. Wstrzymane/0 nie wracają.
Stare karty bez stabilnego oznaczenia i możliwe zmiany kodów mają osobne zablokowane zgłoszenia do sprawdzenia.
Bezpieczne dopasowanie wielkości liter oraz jednoznacznego kodu dostawcy, ochrona DEMO i wariantów; podobne cechy
z innym EAN do decyzji. JMK: nie łączy i nie sumuje wierszy po samym EAN. Panel: Braki w cenniku, podgląd starej karty.
Przebudowano kolejkę z sześciu świeżo sprawdzonych źródeł… bez zmian cen/stanów/statusów/nazw katalogu. Testy 39
przypadków, dwa pełne importy sześciu dostawców oraz trzy pełne odczyty Agrorami na izolowanej kopii.”
Powód: „Anna 22.09.2026 poleciła zweryfikować rzeczywiste braki i naprawić wszystkie wykazane przyczyny fałszywych wycofań.”

**Szczegół techniczny.** `feed_safety.attach(supplier, result)` rzuca wyjątek przy pustym cenniku i przy błędach parsera
(koniec cichego przełączania na stary format), dokleja do tablicy rekordów niewyliczalne `_bridgeFeedMeta`
(`complete`, `parserErrors`, `source`, `rawCount`, `excludedCodes`) i niesie je przez `converted()` do adaptera i silnika.
Wycofanie pozycji wymaga **trzech różnych kompletnych ofert** (odcisk pliku w `supplier_feed_versions`, stan dostawcy
w `supplier_feed_state`, dowody per produkt w `product_absence_checks`) i minimum 24 h między potwierdzeniami.
`staging_policy.cjs` rośnie o reguły wycofań, zablokowane zgłoszenia „do sprawdzenia”, bezpieczne dopasowanie po
kodzie dostawcy i wielkości liter, ochronę DEMO i wariantów. FE: **zmiana w ŻYWYM bundlu** (nie w łatce wstrzykiwanej) —
nowy widok/filtr „Braki w cenniku” i podgląd starej karty.

**Rekomendacja (moja):** ✅ **nanieść — to rdzeń importu i wprost naprawa problemu, który Ania nazwała „fałszywymi
wycofaniami”.** Zakres wchodzi do istniejących kart I15 (parsery → I15.2, staging BE → I15.4b, panel → I15.5), bo rusza
te same pliki; osobnej karty nie zakładać. Skrypt `withdrawals_reconcile_20260922.cjs` to operacja jednorazowa —
nie przenosić (jak D5 dla reconcile Staging v2).

---

### #104 · 2026-09-22 18:09 i 18:13 · [BACKEND][BAZA] · dostępność: brak w ofercie = wstrzymany/0, CSV tylko aktywne, delta reaguje natychmiast + usunięcie 179 starych kart MO9

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-22 18:09 (`20260922T160912Z_availability`) i 18:13 (`20260922T161344Z_old_agrorami_delete`) |
| **Kategoria** | BACKEND + BAZA (staging, eksport CSV, Selly delta/full) + operacja na danych |
| **Pliki** | `mirror/backend/availability_sync.cjs` (**nowy**), `staging_policy.cjs` (+87 l. → 488), `generate_selly_export.cjs` (+19), `selly/sync_delta.cjs` (+18), `selly/sync_full.cjs` (+3); `db/schema.sql`: `product_auto_suspensions`; jednorazowe: `apply_availability_20260922.cjs`, `zero_and_delete_agrorami_20260922.cjs` + archiwa JSON |
| **Commit** | `abe5f14` |
| **Do nowej wersji?** | ✅ **TAK — Tor 1 i Tor 2 zrealizowane** (ticket 119); staging/auto-wstrzymania zostają do I15.4b |
| **Status** | 🔨 **częściowo.** ✅ **CSV → ticket 122 (I15.3, 2026-09-23)** — zapis atomowy naniesiony (`generator-csv.ts`, tmp+`renameSync` w tym samym katalogu); filtr „tylko aktywne” odbudowa miała już od I8a, więc nie było tu czego zmieniać. ✅ **schemat → ticket 124 (I15.4a, 2026-09-23)** — tabela `product_auto_suspensions` założona migracją `012`. ✅ **Tor 1 i Tor 2 + `availability_sync` → ticket `119-FEATURE-selly-dostepnosc-zawor` (karta I15.10, 2026-09-23)** — żywy odczyt statusu/stanu/ceny przed wysyłką, warunek wyboru z `abe5f14`, moduł `dostepnosc.ts` (port `availability_sync.cjs`); patrz „Zrealizowane" niżej. ✅ **auto-wstrzymania w IMPORCIE → ticket 130 (I15.4b, 2026-09-23)** — brak w poprawnej pełnej ofercie ustawia `wstrzymany`+stan 0 NATYCHMIAST (nie po trzech przebiegach, jak stary `tk()`), „pewny powrót” przywraca TYLKO automatycznie wstrzymane. ✅ **Nadpisanie `U.updateProduct` (`:112-119`) ZNALAZŁO GOSPODARZA** — ticket 130 naniósł je w `src/routes/products.ts` (decyzja użytkownika D-130.3): jawna zmiana `status` kasuje znacznik automatu, bez czego ochrona ręcznych wstrzymań nie działa end-to-end. Punkt wpięcia dostępności w imporcie wystawiony jako szew `odswiezDostepnosc`, wołany z `import/polityka/fabryka.ts:988`. ✅ **Montaż → ticket 139 (I15.10b, 2026-09-23)** — `server.ts` rejestruje instancję za bramką `SELLY_TRYB !== "wylaczony"`; od tej chwili `odswiezDostepnosc` przestaje być cichym no-opem (na `SELLY_TRYB=wylaczony`, w tym staging, zostaje no-opem — świadoma bramka, nie ścieżka bazy jak w oryginale). Szczegóły: `docs/rebuild-backlog/wpis-139.md`. |

**Opis biznesowy (CHANGELOG Ani).** „Brak produktu w poprawnej pełnej ofercie natychmiast ustawia wstrzymany/0. Tabela
`product_auto_suspensions` odróżnia automatyczny brak od ręcznego wstrzymania. Pewny powrót przywraca aktywność i bieżący
stan; błędy/zmiany wymagają decyzji, ręczne wstrzymania chronione. Eksport CSV zawiera tylko aktywne produkty, zapis
atomowy. Zmiana dostępności uruchamia odświeżenie CSV i Selly delta; delta zeruje również mapowane produkty bez EAN,
sprawdza aktualny status tuż przed wysyłką i nie zeruje współdzielonego wariantu mającego inną aktywną ofertę. Tor pełny
pomija produkty wstrzymane po rozpoczęciu cyklu. Migracja: 395 brakujących i 2 niepewne karty wstrzymane/0; 179 starych
MO9 tymczasowo wstrzymanych do wyzerowania sklepu i zatwierdzonego usunięcia w kolejnym kroku.” Drugi wpis (18:13):
„usunięto dokładnie 179 dawnych kart MO9 Agrorami z katalogu oraz ich stare zgłoszenia i ręczne powiązania
`staging_matches`. Zachowano historię i wyzerowane mapowania Selly… Powrót opony nie odtwarza usuniętej karty.”

**Szczegół techniczny.** `availability_sync.request(db, dostawca)` kolejkuje odświeżenie: uruchamia generator CSV
w osobnym procesie i po nim `syncDelta` dla dotkniętych dostawców (okresowa synchronizacja zostaje mechanizmem
ponawiania). `sync_delta`: warunek `WHERE` obejmuje teraz wstrzymane z wariantem, ale **wyklucza** te, które mają inną
aktywną ofertę w tej samej grupie; mapowany wariant bez EAN też się zeruje; tuż przed wysyłką czytany jest **żywy**
status/stan/cena produktu (`SELECT … FROM products WHERE id=?`), żeby nie wysłać stanu sprzed wstrzymania.
`sync_full` pomija produkty wstrzymane po rozpoczęciu cyklu. Eksport CSV: tylko `aktywny`, zapis atomowy.

**Rekomendacja (moja):** ✅ **nanieść** — bez tego nowy Bridge wysyłałby do sklepu stany produktów, których dostawca już
nie ma. Podział na istniejące karty: staging i auto-wstrzymania → **I15.4b** (otwarte), CSV tylko aktywne + zapis atomowy → **I15.3 — ✅ zapis atomowy zrobiony ticketem 122 (23.09); filtr „tylko aktywne” odbudowa miała już wcześniej, nic do naniesienia**, zmiany w delcie i torze pełnym Selly → **nowa karta I15.12** (I15.6 już zmergowana, I15.7 dotyczy `sync_full`).
⚠ Operacje na danych (395 wstrzymań, 179 usuniętych kart MO9) — **nie odtwarzamy** (decyzja D2: świeża kopia produkcji
na staging), ale **trzeba je uwzględnić przy pomiarach**: liczba produktów w katalogu spadła o 179.

**⭐ Zrealizowane (ticket 119, karta I15.10, 2026-09-23) — TYLKO część Selly delta/full.** Tor 1
(`sync-delta.ts`): WHERE wyklucza wstrzymane mające inną aktywną ofertę w grupie `(dostawca, kod_importu)`,
EAN wymagany tylko bez gotowego mapowania wariantu, żywy odczyt `status`/`stan`/`cena_sprzedazy` tuż przed
wysyłką (wstrzymany → stan 0, wstrzymany przy innej aktywnej ofercie → `skip`). Tor 2 (`sync-full.ts`): żywy
`status`/`stan` na starcie pętli, wstrzymany/usunięty po rozpoczęciu cyklu → `skip`. Dołożony też
`rebuild/backend/src/selly/dostepnosc.ts` (port `availability_sync.cjs`) — **zamontowany w `server.ts`
ticketem 139** (karta I15.10b, 2026-09-23), za bramką `SELLY_TRYB` (`docs/rebuild-backlog/wpis-139.md`).
⚠ `row.stan = live.stan` w Torze 2 jest **martwe** — payload Toru 2 nie niesie
stanu, ani u nas, ani w oryginale (`sync_full.cjs:291`); realny skutek poprawki Toru 2 to wyłącznie `skip`.
**CSV tylko aktywne + zapis atomowy (I15.3) oraz staging i auto-wstrzymania (I15.4) NIE były w zakresie
ticketa 119** — ten wpis zostaje częściowo otwarty dla nich. Szczegóły: `docs/tickets/119-FEATURE-selly-dostepnosc-zawor/`.

---

### #105 · 2026-09-23 09:54–12:57 · [BACKEND][BAZA] · DOT jako osobny produkt: końcówka `W2` w EAN Handlopeksa, DOT w modelu Agrorami

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-23, etykiety `20260923T075453Z_handlopex_ean_dot`, `20260923T075630Z_handlopex_catalog_ean`, `20260923_modeldot` |
| **Kategoria** | BACKEND (adapter, parser MO9) + operacje na danych |
| **Pliki** | `mirror/backend/parsers/adapter.cjs`, `mirror/backend/parsers/mo9_agrorami_api.cjs`, `staging_policy.cjs` (edycja modelu w stagingu), `data.db` (poprawki 13 kart MO4/MO5 i 5 kart MO9) |
| **Commit** | `06a8aa3`, `88fa31c` |
| **Do nowej wersji?** | ✅ **TAK — DOWIEZIONE W CAŁOŚCI**: część parserowa w I15.2 (ticket 120), edycja zgłoszenia w I15.4c (ticket 129), oba 2026-09-23. |
| **Status** | ✅ **parser: I15.2** — `adapter.cjs`/`mo9_agrorami_api.cjs` resyncowane bajt w bajt; W2 Handlopeksa zadziałało **15×** na pełnych cennikach (MO4 1, MO5 14 — próbki 200-wierszowe pokazywały tylko 2), `_supplierEanOriginal` niesie oryginał dostawcy. ✅ **edycja zgłoszenia: I15.4c** (ticket 129, 2026-09-23) — drugi wątek CHANGELOGU Ani („Edycja modelu w stagingu aktualizuje także bieżnik, jeśli wcześniej był jego automatyczną kopią") sportowany w `zaktualizujZgloszenie` (`rebuild/backend/src/import/polityka/zgloszenia.ts:81-83`, port `staging_policy.cjs:172-176`) i pokryty testem. Warunek jest wąski i taki ma być: bieżnik nadąża za modelem **tylko** wtedy, gdy był jego automatyczną kopią — ręcznie ustawionego bieżnika edycja nie rusza. Wpis zamknięty. ✅ **dopasowanie po DOT: I15.4b** (ticket 130, 2026-09-23) — `separateDotBatch` i ochrona partii w łańcuchu dopasowania; różnica `dot` zrywa dopasowanie po kodzie (`staging_policy.cjs:374`). ⚠ **Ustalenie:** parser MO1 (Bohnenkamp) stempluje KAŻDY rekord wartością `dot = "nie starsza niz 3 lata"` — to stała gwarancja z nagłówka cennika, nie numer partii. Karta katalogowa bez tej wartości nie dopasuje się więc do ŻADNEGO rekordu MO1; w produkcji nie występuje, bo karty zakłada ten sam importer. |

**Opis biznesowy (CHANGELOG Ani).** „W ofertach Handlopex MO4/MO5 końcówka `W2` po prawidłowym 13-cyfrowym EAN jest
rozpoznawana jako oznaczenie wariantu rocznikowego, jeżeli rok zgadza się z polem DOT i końcówką kodu producenta.
Do EAN trafia sam numer, pełny zapis dostawcy zostaje zachowany w szczegółach. Inny DOT nadal tworzy osobny produkt.”
Powód: „dopisek W2 nie jest błędem EAN; identyczna opona może mieć inny rok produkcji i musi pozostać osobną pozycją”.
Efekt zmierzony przez Anię: zgłoszenia błędnego EAN z końcówką W2 spadły z 14 do 0.
Drugi wątek (12:57): „parser Agrorami usuwa samotny dopisek DOT przed PR/TL/TT z modelu, pozostawiając oznaczenia
z rokiem. Edycja modelu w stagingu aktualizuje także bieżnik, jeśli wcześniej był jego automatyczną kopią.”

**Szczegół techniczny.** `adapter.cjs`: dla MO4/MO5 wzorzec `^(\d{13})W2$` + zgodność roku z `kod producenta`
(`W20xx`) i polem `dot` → do `ean`/`eanRaw` trafia sam 13-cyfrowy numer, oryginał dostawcy ląduje
w `_supplierEanOriginal`. Dodatkowo dla MO2 rekord niesie `_jmkRowId` (identyfikator wiersza JMK).
`mo9_agrorami_api.cjs`: usunięcie samotnego `DOT` przed `PR`/`TL`/`TT` z modelu.

**Rekomendacja (moja):** ✅ nanieść — to warstwa parserów, więc zakres karty **I15.2** (adapter, MO9), a edycja modelu
w stagingu → **I15.4b**. Operacje na danych (13 kart MO4/MO5, 5 kart MO9) nie do odtworzenia (D2 — świeża kopia produkcji).

---

### #106 · 2026-09-23 10:53–12:31 · [BACKEND][BAZA][FRONTEND] · decyzje o nieobecnych kartach: okno „Sprawdź kartę”, wybór jednej karty przy zgodnym DOT, ponowne otwarcie sprawy

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-23, etykiety `…review_explanations`, `…review_reopen`, `20260923_dotchoice` |
| **Kategoria** | BACKEND + BAZA + FRONTEND (staging) |
| **Pliki** | `mirror/backend/staging_policy.cjs` (488 → 665 l.), `db/schema.sql`: `staging_absence_decisions` + unikalny indeks `staging_absence_one_choice`, FE: `assets/staging-policy-injection.js`, `index.html` |
| **Commit** | `58d9d1d`, `88fa31c` |
| **Do nowej wersji?** | ✅ **TAK — decyzja użytkownika 2026-09-23** (D129.3: `88fa31c` = decyzja już podjęta, D3 „Staging v2 przenosimy” obejmuje całość zamrożonej produkcji) |
| **Status** | ✅ **DOWIEZIONE — ticket 129 (I15.4c, 2026-09-23).** Tabela `staging_absence_decisions` + indeks `staging_absence_one_choice` założone migracją `012` (ticket 124). Logika: `closeAbsenceReview` (`:251-266`) i `chooseAbsenceCard` (`:267-330`) — obie gałęzie wyboru, trójstronna zgodność DOT, `candidates_hash` liczony z `[kod, ean, dot]` (zmiana ceny/stanu NIE otwiera sprawy ponownie). Trasy `POST .../choose-absence-card` i `POST .../close-absence-review` wdrożone i opisane w `contract/openapi.yaml` — **karta wymieniała dwie trasy, oryginał ma cztery**. Otwarte: panel — **I15.11** (`docs/karty/I15.11/wejscie-129.md`). |

**Opis biznesowy (CHANGELOG Ani).** Okno sprawdzania pokazuje **osobno starą kartę i możliwy odpowiednik**, wskazuje
zgodność lub różnicę EAN i DOT oraz stan obu kart; doszedł bezpieczny przycisk „Pozostaw starą wstrzymaną i zamknij
sprawę” (nie scala, nie akceptuje, nie zmienia produktów). Zamknięcie sprawy zapisuje decyzję w
`staging_absence_decisions`, więc **sprawa nie wraca po kolejnym imporcie**; zmiana kodu, EAN lub DOT otwiera ją
ponownie. Porównanie starej karty z bieżącą ofertą **sprawdza też DOT** — różne DOT nie tworzą już zgłoszenia
o możliwym scaleniu (trzy błędne zgłoszenia 732903–732905 usunięte). Dla naprawdę zgodnych kart ekran pozwala wskazać
jedną kartę: niewybrana zostaje wstrzymana, wybrana zostaje w katalogu, a baza zapamiętuje przypisany kod źródłowy.
Powód: „użytkowniczka chce odrębnych produktów dla różnych DOT oraz jednoetapowego zapisu wyboru”.

**Rekomendacja (moja):** ✅ nanieść — backend do karty **I15.4c** (tabela `staging_absence_decisions` + indeks
`staging_absence_one_choice` — szósta i ostatnia z sześciu tabel migracji `012` — już założone kartą I15.4a, ticket 124),
panel do **I15.11** (ten sam obszar co „Braki w cenniku”). ⚠ To już trzecia warstwa dokładana do `staging_policy.cjs`
w ciągu doby (298 → 407 → 488 → 665 linii) — patrz nota o zamrożeniu niżej.

---

### #107 · 2026-09-23 11:27 · [BACKEND] · zatwierdzanie zbiorcze stagingu blokowało panel na 5 s na pozycję

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-23, etykieta `20260923_performance` |
| **Kategoria** | BACKEND (staging, `uwaga_cena`) |
| **Pliki** | `mirror/backend/staging_policy.cjs`, `mirror/backend/uwaga_cena_patch.cjs` |
| **Commit** | `a2c979b` |
| **Do nowej wersji?** | ❌ **NIE — zmierzone, nie dotyczy odbudowy** (ticket 129, 2026-09-23) |
| **Status** | ✅ **ROZSTRZYGNIĘTE POMIAREM — ticket 129 (I15.4c, 2026-09-23).** Pięć sekund na pozycję brało się z OSOBNEGO połączenia do bazy w `uwaga_cena_patch.cjs`, czekającego na blokadę zapisu. Odbudowa ma jedno połączenie i `uwagaCena` jako kolumnę modelu — zmierzone na kopii `db/snapshot.db` (7405 produktów, 200 pozycji): najwolniejsza pozycja **0,86 s**, czyli ~6× poniżej progu 5 s. **Łatki nie portujemy.** ⚠ Pomiar odsłonił natomiast INNY, niezależny koszt — grupowanie `kod_importu` przez `compatibility()` (386 ms/pozycja wobec 6,7 ms przed Staging v2) — opisany jako **`#129.1`** w `docs/rebuild-backlog/wpis-129.md`. Narzędzie: `rebuild/backend/scripts/pomiar-107.ts`. ⚠ **Ticket 130 (I15.4b) potwierdza `#129.1` po stronie IMPORTU:** `compatibility()` w pętli nieobecnych porównuje KAŻDĄ kartę katalogu z KAŻDYM rekordem cennika (MO2 1729×200, MO5 1989×146), przez co przypadki cennikowe w charakteryzacji wymagały podniesienia limitu czasu z 20 s na 90 s. Sam `importer()` NIE woła `assignKodImportu`, więc koszty się nie sumują. |

**Opis biznesowy (CHANGELOG Ani).** „Zapis uwagi o cenie przy zatwierdzaniu stagingu i zbiorczym dodawaniu produktów
korzysta z tego samego połączenia do bazy co operacja główna; nie czeka na własną blokadę przy zatwierdzaniu wielu
pozycji.” Powód: „po każdej pozycji zatwierdzania zbiorczego następował pięciosekundowy błąd blokady, przez co panel
przestawał odpowiadać także na zwykłe odczyty”.

**Rekomendacja (moja):** ⬜ **sprawdzić, czy nas dotyczy, zanim cokolwiek naniesiemy.** To naprawa skutku architektury
produkcji: `uwaga_cena_patch.cjs` otwiera WŁASNE połączenie do `data.db` (ten sam wzorzec co `payment_blocks.cjs`).
Odbudowa ma jedno połączenie i `uwaga_cena` jako normalną kolumnę modelu, więc problem prawdopodobnie u nas nie istnieje.
Karta **I15.4c** ma to zmierzyć (zatwierdzanie zbiorcze na kopii produkcji) i zapisać wynik zamiast portować mechanicznie —
zadanie przekazane tam plikiem `docs/karty/I15.4c/wejscie-124.md` (decyzja D-124.4, ticket 124, 2026-09-23).

*Pominięte — triaż 2026-09-23 (zakres `abe5f14..88fa31c`, ticket 112):*
- **16 commitów `[FRONTEND]`** (22.09 21:00 – 23.09 08:00, co godzinę) — wyłącznie regeneracja
  `mirror/frontend/ex-port-files/sellycsv-*.csv`. ⚠ **Częstotliwość wzrosła z dobowej na GODZINOWĄ** — to skutek #104
  (zmiana dostępności uruchamia odświeżenie CSV), nie osobna zmiana.
- `85e8322` (23.09 09:00, `backup_cleanup`) — **usunięcie 118 plików `.bak`** z katalogu produkcji (−95 087 linii)
  plus raport JSON. Porządki, zero kodu. ⚠ Skutek dla nas: część kopii `.bak`, do których odwołują się starsze wpisy
  backlogu, **nie istnieje już na `origin/main`** — przy analizie łatek trzeba sięgać do historii gitowej
  (`git show <starszy-commit>:<ścieżka>`), nie do stanu bieżącego.

---

### #108 · 2026-09-23 · [BACKEND][BAZA] · kolizje `kod_importu` — delty do Selly mogą wracać w pętli co 15 minut

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-23 (specyfikacja Selly od Ani, stan opisu na 22.09) |
| **Kategoria** | BACKEND (grupowanie produktów) + BAZA |
| **Pliki** | `assignKodImportu` — w produkcji `bridge_ext.cjs`, od Staging v2 **nadpisany** w `staging_policy.cjs` (`origin/main`); mapowanie `selly_products` `(kod_importu, dostawca)`; port: `rebuild/backend/src/**` (I15.4 przejmuje nadpisanie) |
| **Do nowej wersji?** | ✅ **częściowo TAK — wykrywanie i raportowanie zrealizowane (ticket 119, 2026-09-23); pomijanie/zawór WYCOFANY decyzją Ani.** Rozstrzygnięcie semantyczne („ten sam dostawca, ten sam `kod_importu`”) ⬜ **DO DECYZJI Ani** — poprosiła 23.09 o listę przypadków, lista wysłana, czeka na jej przegląd |
| **Status** | 🔨 **potwierdzony, częściowo zaadresowany, NADAL OTWARTY** — patrz „⭐ Rewizja" niżej. Żywy na produkcji: 80 grup / 174 produkty, 76 grup z różnymi cenami lub stanami, wszystkie 80 z mapowaniem w `selly_products`; **przyczyna USTALONA (niżej)** · **gałąź „zachowaj istniejący sześciocyfrowy `kod_importu`” przeniesiona DOSŁOWNIE w I15.4b (ticket 130, 2026-09-23)**, zgodnie z `docs/karty/I15.4b/wejscie-116.md` — to ona jest przyczyną kolizji i NIE jest błędem do naprawy; rozstrzygnięcie należy do Ani |

**Opis (specyfikacja Ani).** „121 zduplikowanych kluczy `(dostawca, kod_importu)` = 259 aktywnych wierszy;
114 grup/245 z różnymi cenami/stanami. Współdzielony `selly_products` → snapshot nadpisywany → delty wracają
co 15 min. **Naprawa `assignKodImportu` to warunek przed dalszym syncem.**"

**Dlaczego to boli.** Tor 1 zapisuje ostatnio wysłaną cenę i stan w `selly_products` per `(kod_importu, dostawca)`.
Gdy dwa RÓŻNE produkty tego samego dostawcy dostaną ten sam `kod_importu`, dzielą jeden wiersz mapowania:
snapshot jednego nadpisuje snapshot drugiego, więc oba wyglądają na „zmienione" przy każdym cyklu i są wysyłane
w kółko — co 15 minut, bez końca.

**Co się zmieniło od czasu opisu.** Staging v2 (22.09, backlog #99) **nadpisał `ext.assignKodImportu`**: grupa
powstaje tylko przy zgodności marka/model/rozmiar oraz indeksów i DOT, a numer sześciocyfrowy jest losowany, gdy
zgodnej grupy nie ma. To mogło problem usunąć — **wymaga pomiaru, nie założenia.**

**Pomiar do wykonania** (kopia produkcji jest od 23.09 na stagingu):

```sql
SELECT count(*) FROM (
  SELECT dostawca, kod_importu FROM products
  WHERE status='aktywny' AND kod_importu IS NOT NULL AND kod_importu<>''
  GROUP BY dostawca, kod_importu HAVING count(*) > 1);
```

**⭐ POMIAR 2026-09-23 (ticket 116, świeża kopia produkcji na stagingu, 8329 produktów):**

| Miara | Wynik |
|---|---|
| grup kolizji `(dostawca, kod_importu)` wśród aktywnych | **80** |
| produktów w kolizjach | **174** |
| grup z RÓŻNYMI cenami lub stanami (realna pętla) | **76** |
| grup, które mają już mapowanie w `selly_products` | **80 z 80** |
| rozkład per dostawca | MO2 42 · MO8 19 · MO5 12 · MO1 4 · MO4 2 · MO7 1 |

Przykład (MO1, `kod_importu` 326606): `MO1_15126983` (EAN 8906117626572, 12 016 zł, stan 5) i `MO1_15126981`
(EAN 8906117624387, 10 676 zł, stan 2) — ta sama marka, model i rozmiar, ale **różne EAN-y**, czyli dwa realnie
różne produkty pod jednym kluczem.

**Dlaczego Staging v2 tego nie naprawił.** Nadpisane `ext.assignKodImportu` (#99) **zachowuje istniejący
sześciocyfrowy `kod_importu`** (`if (retained && /^\d{6}$/.test(retained))`), więc nowa reguła grupowania dotyczy
wyłącznie pozycji bez klucza. Stare kolizje zostają w danych i przejdą przez cutover razem z bazą.

**Trzy drogi rozważane przed I15.10 (decyzja użytkownika + Ani) — (c) NIEAKTUALNE, patrz „⭐ Rewizja" niżej:**
- **(a) naprawa danych przed cutoverem** — rozdzielić kolidujące grupy (nowy `kod_importu` dla wierszy poza
  kanonicznym). ⚠ Skutek w sklepie: discovery utworzy dla nich osobne produkty/warianty w Selly — zmiana
  widoczna dla klientów, wymaga zgody Ani;
- **(b) zostawić 1:1** — odbudowa odtworzy dzisiejszy stan produkcji, czyli pętlę delty co 15 minut;
- ~~(c) zawór bezpieczeństwa w Torze 1 — wykryć kolizję przed wysyłką, pominąć grupę i zaraportować w
  `selly_sync_log`.~~ **Wycofane 23.09** — Ania wyjaśniła, że współdzielony `kod_importu` bywa ZAMIERZONą
  wielomagazynowością (ta sama opona u kilku dostawców = jedna karta w Selly), więc pomijanie zatrzymałoby
  też produkty o poprawnych danych. Zamiast (c) wszedł sam mechanizm raportowania (bez pomijania) — patrz niżej.

**⭐ PRZYCZYNA — USTALONA 2026-09-23 (kod + pomiar).** Stara reguła `assignKodImportu`
(`origin/main:mirror/backend/bridge_ext.cjs:156-178`) działa czterostopniowo: (1) produkt, który ma już
sześciocyfrowy numer, **zachowuje go na zawsze**; (2) przy POPRAWNYM EAN szuka innego produktu z tym samym EAN-em;
(3) **gdy EAN-u brak albo jest niepoprawny — dopasowuje po `marka` + `rozmiar` + `bieznik` + `nazwa`**;
(4) dopiero na końcu losuje nowy numer.

Sklejenia powstają w punkcie (3): w chwili importu opona nie miała jeszcze EAN-u (albo został odrzucony), więc
dostała numer pierwszej pozycji o tej samej nazwie i rozmiarze. Gdy EAN-y później doszły, punkt (1) nie pozwolił
już zmienić numeru.

**Pomiar potwierdzający (23.09, kopia produkcji):** grup o identycznej nazwie, marce, rozmiarze i bieżniku —
**74 z 80**; grup z różnymi EAN-ami — **75 z 80**; grup z różnym DOT — **9**. Czyli to prawie zawsze dwie fizycznie
różne opony (inny EAN, czasem inny rocznik) pod jedną nazwą.

**Rekomendacja koordynatora (22.09) — CZĘŚCIOWO NIEAKTUALNA: (c) teraz + (a) po uzgodnieniu z Anią.**
⚠ (c) wycofane decyzją Ani z 23.09 (wyżej); w jego miejsce wszedł sam mechanizm raportowania (ticket 119,
niżej). (a) nadal do uzgodnienia z Anią. (c) jest tanie i odwracalne, mieści się
w karcie **I15.10**; (a) to zmiana asortymentu w sklepie — dziś te opony są w Selly sklejone w jeden produkt.

**⭐ Rewizja zakresu (ticket 119, karta I15.10, 2026-09-23) — zawór wycofany, zostaje wykrywanie i
raportowanie.** Rozstrzygnięcie: **wysyłka zostaje 1:1 z produkcją** (pętla delty co 15 minut trwa, jak
dziś), dołożona jest wyłącznie widoczność — `grupyKolizyjne()` w `sync-delta.ts`, licznik
`stats.kolizje_kod_importu`, lista `kolizje` w wyniku `syncDelta` i w `selly_sync_log.szczegoly_json`
(+ pole diagnostyczne `rozne_ceny_lub_stany`, poza planem). **Rozróżnienie, którego wcześniejszy opis wpisu
nie miał:** problem dotyczy WYŁĄCZNIE przypadku „ten sam dostawca, ten sam `kod_importu`" (grupowanie
`grupyKolizyjne()` jest po PARZE `(dostawca, kod_importu)`, zgodnie z tabelą SQL wyżej) — bo snapshot
`selly_products` jest kluczowany tą samą parą i dwa aktywne wiersze grupy nadpisują się nawzajem. Przypadek
„różni dostawcy, ten sam `kod_importu`" to właśnie wielomagazynowość Ani i NIE jest kolizją; odbudowa go
respektuje w `isMetadataOwner()` (`sync-full.ts`) i `grupyKolizyjne()` go nie dotyka.
**Pomiar ticketu 119** (migawka `db/snapshot.db`, 13.08, 6898 aktywnych produktów — inna data niż pomiar
23.09 wyżej, więc liczby się różnią): ten sam dostawca — **121 grup / 259 produktów**, z czego **116 grup
ma różne ceny lub stany**; różni dostawcy (nie-kolizja) — **793 grupy / 1734 produkty**. Przykład (MO1,
`kod_importu` 326606): `MO1_15126983`/`MO1_15126981` — identyczna nazwa/model/rozmiar, różne EAN-y, stany
5 vs 2, ceny 12016 vs 10676 — zgodnie z regułą Ani te dane są POPRAWNE, nie anomalią do pominięcia.
**Co zostaje otwarte:** rozstrzygnięcie semantyczne przypadku „ten sam dostawca" (deduplikacja, agregacja
stanu czy rozdzielenie grup) to decyzja handlowa Ani, poza zakresem odbudowy — danych nie ruszano. Wpis
zostaje 🔨 **częściowo zaadresowany, nie zamknięty**: pętla delty co 15 minut nadal istnieje, tylko jest
teraz widoczna w logach. Szczegóły: `docs/tickets/119-FEATURE-selly-dostepnosc-zawor/`.



---

**Koniec historycznej listy wpisów (`#1`–`#108`).** Nowe wpisy: `docs/rebuild-backlog/wpis-<N>.md`
(jeden plik na ticket, identyfikatory `#<ticket>.<kolejny>`) — zob. `docs/rebuild-backlog/README.md`.
Zestawienie wszystkiego razem: `tools/stan-backlogu.sh`.
