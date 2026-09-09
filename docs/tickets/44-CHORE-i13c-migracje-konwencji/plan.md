# 44-CHORE-i13c-migracje-konwencji — Iteracja 13, karta 13c: migracje konwencji + fixtures

> Status: Draft → **Approved** (użytkownik: „zaznaczaj domyślnie wszystko, co rekomendujesz, i nie pytaj o go")
> Branch: `chore/44-i13c-migracje-konwencji`
> Worktree: `.worktrees/44-CHORE-i13c-migracje-konwencji`

## Opis ticketa

Trzecia karta I13, po zmergowanych 13a (parsery) i 13b (silnik). Warstwa DANYCH: migracje
istniejących rekordów w bazie odbudowy (`rebuild/schema/00X_*.sql`, runner `npm run migrate`)
odtwarzające trzy konwencje wprowadzone przez Anię na produkcji, plus przenagranie fixtures,
które te pola pokazują.

1. **konstrukcja** [#58]: kody `R`/`D`/`L`/`B` → pełne słowa (`Radialna`/`Diagonalna`).
2. **nazwa → CAPS** [#59, część migracyjna]: `products.nazwa` → `UPPER`,
   `manual_overrides.override_value` → `UPPER` dla `field_name='nazwa'`,
   DELETE wierszy `staging_items` `zmiana_kluczowa` typu CASE_ONLY.
3. **katunify** [#57, część migracyjna]: historyczne `products.kategoria` → Wielka litera.

NIE ruszamy: parserów (13a), silnika (13b), frontendu (13e), backfilli tl_tt/szerokości/JMK
(13f — decyzja: nie odtwarzamy).

## Kontekst — co ustalono na źródłach

### Warunek startu spełniony
`chore/42-i13a-resync-parserow` i `chore/43-i13b-silnik-p3-caps` są przodkami `origin/develop`
(zweryfikowane `git merge-base --is-ancestor`). Worktree stoi na `origin/develop` (`f38c4c0`).

### Dokładny SQL produkcji — `mirror/backend/CHANGELOG.md` (na `main`)

**2026-09-01 11:35 — konstrukcja** (CHANGELOG:93-113):
```
UPDATE products SET konstrukcja='Radialna' WHERE 'R'   (4390 rek.)
UPDATE products SET konstrukcja='Diagonalna' WHERE 'D'/'L'/'B'   (2958+46+11 = 3015 rek.)
Suma 7405 → w bazie zostają DOKŁADNIE 2 wartości: Radialna 4390 + Diagonalna 3015.
```
Mapa kanoniczna w kodzie: `rebuild/backend/src/import/legacy/common.cjs:614-624`
(`KONSTRUKCJA_CANONICAL_MAP` + `normalizeKonstrukcja`) — zawiera także klucz `'-'` → `Diagonalna`
oraz pełne słowa (idempotencja). Roadmapa bloku 13c wprost każe migrować „wg
`KONSTRUKCJA_CANONICAL_MAP`", więc migracja = `normalizeKonstrukcja` przyłożone do istniejących
wierszy, a nie węższa lista z CHANGELOG-a.

**2026-09-01 12:30 — CAPS** (CHANGELOG:73-92):
```
UPDATE products SET nazwa=UPPER(nazwa)                                        747 rek.
UPDATE manual_overrides SET override_value=UPPER(override_value)
  WHERE field_name='nazwa'                                                     38 rek.
DELETE FROM staging_items ... typ_zmiany='zmiana_kluczowa'
  AND powod LIKE 'nazwa:%' AND UPPER(A)=UPPER(B)                              769 rek.
```
⚠ `UPPER` to SQLite-owy `UPPER`, czyli **ASCII-only** — `ę` zostaje `ę`. Odtwarzamy to 1:1
(produkcja tak zrobiła); locale-owy `toLocaleUpperCase('pl-PL')` byłby odstępstwem. Pomiar:
69 z 7405 nazw w snapshocie ma polskie znaki.

**2026-09-01 10:35 — katunify** (CHANGELOG:114-149) to zmiana PARSERÓW (weszła w 13a).
Migracji danych dla kategorii Ania NIE robiła 09-01 — zrobiła ją wcześniej,
`mirror/backend/apply_kategoria.cjs` (2026-08-18, backlog #2 `kategoriafix`, 537 rek.).
Weryfikacja w CHANGELOG 09-01 potwierdza: „products.kategoria w bazie 100% Wielkie
(Rolnicze 4533, Ciężarowe 1463, Przemysłowe 1195, Leśne 214)".

⚠ **Sprostowanie treści promptu:** prompt mówi „Wzór migracji: #2 kategoriafix, #3 szertxt —
konwencje w tej odbudowie DOSTAJĄ migrację, tak jak tamte". W rzeczywistości **#2 NIE dostało
migracji** — backlog #2 („Status: ✔ zrobione w rebuild, wniesione **portem**, I3/3a") zamknięto
portem `capitalizeKategoria()` do `adapter.recordToSurowe()`. Jedynym wzorcem migracji jest #3
(`003_szerokosc_text.sql`). Nie zmienia to zakresu 13c — kategoria migrację dostaje **teraz**,
bo pomiar (niżej) pokazuje, że w bazie odbudowy jest co migrować.

### Pomiary na jedynej dostępnej bazie — `db/snapshot.db` (2026-08-13, 7405 produktów)

Snapshot jest STARSZY niż wszystkie trzy migracje Ani, więc pokazuje stan „przed":

| Pomiar | Wynik |
|---|---|
| `konstrukcja` | `R` 4389 · `D` 2957 · `L` 35 · `B` 11 · `NULL` 12 · **`X` 1** |
| `kategoria` | Rolnicze 4199 · Ciężarowe 1357 · Przemysłowe 1105 · **rolnicze 334** · Leśne 207 · **ciężarowe 106** · **przemysłowe 90** · **leśne 7** |
| `products.nazwa <> UPPER(nazwa)` | **1886** |
| `manual_overrides` `field_name='nazwa'` nie-UPPER | **38** (dokładnie tyle, co w produkcji) |
| `staging_items` `zmiana_kluczowa` | 1457, z tego `powod LIKE 'nazwa:%'` — 1441 |
| wiersze CASE_ONLY | **739** |
| polskie znaki w `products.nazwa` | 69 |

Wnioski wiążące dla zakresu:
- **kategoria WYMAGA migracji** — 537 rekordów z małej litery (dokładnie liczba z backlogu #2).
- `X` (1 rek.) i `NULL` (12 rek.) w `konstrukcja` **zostają nietknięte** — nie ma ich
  w `KONSTRUKCJA_CANONICAL_MAP`, a `normalizeKonstrukcja` przepuszcza nieznane wartości
  (`MAP[key] || value`). Produkcja tych rekordów też nie miała po 09-01 (7405 = 4390+3015).
- `manual_overrides` ma też `field_name='konstrukcja'` (3 rek., wartość `D`) — **produkcja ich
  NIE ruszyła**, więc my też nie. Odnotowane jako follow-up, nie odstępstwo.

### Kształt `powod` w `staging_items` — jak rozpoznać CASE_ONLY

`rebuild/backend/src/import/tk.ts:429` buduje segment jako ``​`${label}: ${stara} → ${nowa}`​``,
a `tk.ts:515` skleja segmenty przez `" • "` i **dokleja `ostrzezenie`** jako segment bez strzałki.
Pomiar: 193 z 1441 wierszy `nazwa:%` ma więcej niż jedną strzałkę — naiwne „wszystko po
pierwszej strzałce = wartość nowa" jest więc BŁĘDNE i musi odpaść.

Zmierzone trzy warianty reguły na snapshocie:

| Reguła | Wynik |
|---|---|
| R1 naiwna (`substr` po pierwszej strzałce do końca) | 738 — **błędna**, gubi wiersze wielosegmentowe |
| R2 „segment `nazwa` jest case-only" (jak skrócony SQL z CHANGELOG-a) | **739** |
| R3 „**KAŻDY** segment jest case-only" | **739** |

R2 ≡ R3 na realnych danych (rozjazd = 0). Wybieramy **R3**, bo to dosłownie treść ticketa
(„różnica dotyczy WYŁĄCZNIE wielkości liter") i bo R3 nigdy nie skasuje wiersza niosącego
realną zmianę w drugim polu albo `ostrzezenie` — R2 mogłaby.

### Fixtures — czy i jak da się je przenagrać

TAK, procedurą, którą repo już ma i już stosuje do dokładnie tego problemu.
`tools/record-write-fixtures.cjs` stawia ORYGINAŁ (`mirror/backend/index.cjs`) na kopii
`db/snapshot.db`, a jego `przygotujBaze()` (`:158-185`) **już dziś uruchamia na kopii własny
skrypt migracyjny Ani `migrate_szer_to_text.cjs`** — właśnie dlatego, że snapshot jest
z 2026-08-13, starszy niż migracja `szertxt` z 19/20.08 (`contract/README.md:57-70`).

13c dokłada do tego kroku te same trzy migracje 09-01. Oracle pozostaje oryginałem: kodem jest
`mirror/backend/index.cjs` @08.09, a stanem wejściowym — baza doprowadzona do stanu produkcji
po 09-01. SQL w nagrywarce piszemy **z CHANGELOG-a produkcji**, nie z naszych plików
`rebuild/schema/`, żeby nagranie nie było dowodem na samo siebie.

⚠ `mirror/backend/apply_kategoria.cjs` jest na `develop` obecny — użyjemy skryptu Ani
(z podmienioną wyłącznie ścieżką, tak jak repo robi to dla `migrate_szer_to_text.cjs`),
nie własnego SQL-a.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Ticket **nie zmienia kodu żadnej trasy** — zmienia WARTOŚCI danych. Wszystkie trasy zostają
w zakresie jako regresja (bramki muszą zostać zielone), a przenagrane zostaną te fixtures,
których nagrana treść pokazuje migrowane pola:

| Fixture | Ścieżka `openapi.yaml` | Co się w nim zmieni |
|---|---|---|
| `GET_products.json` | `GET /api/products` | `konstrukcja` `R`/`D` → słowa, `nazwa` → CAPS, `kategoria` → Wielka |
| `GET_products_bez-parametrow.json` | `GET /api/products` | jw. (goła tablica) |
| `GET_suppliers.json`, `GET_dostawcy.json` | `GET /api/suppliers`, `GET /api/dostawcy` | agregaty po `kategoria` |
| `PUT_products_id.json`, `PATCH_products_id.json`, `DELETE_products_id.json` | mutacje produktu | `nazwa`/`kategoria` w echu rekordu |
| `GET_analytics_*` (te, które niosą `nazwa`/`kategoria`) | `GET /api/analytics/*` | wartości pól |
| `GET_staging*.json` | `GET /api/staging` | mniej wierszy po DELETE CASE_ONLY |
| `GET_overrides.json` | `GET /api/overrides` | `override_value` CAPS dla `nazwa` |

⚠ **Znany fakt o mechanice gate'u, zapisany żeby nie wprowadził nikogo w błąd:**
`sprawdzZgodnoscZFixture` → `porownajKsztalt` (`test/gate/ksztalt.ts`) porównuje **KSZTAŁT**
(klucze, typy, zagnieżdżenie), a nie wartości. Przenagranie fixtures **nie jest** więc
warunkiem zieloności bramek — jest warunkiem tego, żeby `contract/fixtures/` dalej były
wiernym zapisem tego, co produkcja realnie zwraca (a to jest ich jedyna funkcja).
Zieloność bramek po przenagraniu jest osobnym, wymaganym wynikiem.

## Decisions

Wszystkie podjęte przeze mnie z rekomendacją, zgodnie z poleceniem użytkownika.

- **D1 — trzy osobne pliki migracji, w kolejności chronologicznej produkcji.**
  `004_kategoria_wielka_litera.sql` (18.08 + 01.09 10:35), `005_konstrukcja_slowa.sql`
  (01.09 11:35), `006_nazwa_caps.sql` (01.09 12:30). Runner stosuje alfabetycznie, więc
  kolejność plików = kolejność produkcji. Alternatywa (jeden plik `004_konwencje.sql`) była
  odrzucona: trzy zmiany mają trzy różne daty, trzy różne uzasadnienia i trzy różne wpisy
  w backlogu — jeden plik zlepiłby je w nierozróżnialną całość i utrudnił rollback.
- **D2 — `UPPER()` SQLite (ASCII-only), nie locale PL.** Produkcja użyła dosłownie
  `UPPER(nazwa)` w SQLite. `toLocaleUpperCase('pl-PL')` dałby `Ę` tam, gdzie produkcja ma `ę`,
  czyli natychmiastowy rozjazd 1:1 na 69 rekordach. Odtwarzamy wadę, bo odtwarzamy zachowanie.
- **D3 — `konstrukcja` migrowana przez `LOWER(TRIM(...))` po kluczach
  `KONSTRUKCJA_CANONICAL_MAP`**, czyli `r/radialna/radial` → `Radialna`,
  `d/diagonalna/diagonal/l/b/-` → `Diagonalna`. To jest dosłownie `normalizeKonstrukcja`
  przyłożone do istniejących wierszy i tak każe roadmapa bloku 13c. Wartości spoza mapy
  (`X`, `NULL`, `''`) **nietknięte** — dokładnie jak `MAP[key] || value`. Z natury idempotentne:
  `'radialna'` jest kluczem mapy, więc drugi przebieg trafia w to samo `'Radialna'`.
- **D4 — `kategoria`: unia dwóch map produkcji.** `KATEGORIA_CANONICAL_MAP`
  (`common.cjs:592-599`: rolnicze/przemysłowe/ciężarowe/leśne/dętki/akcesoria, warianty
  z polskimi znakami i bez) **plus** `'rolnicze małe'`/`'rolnicze male'` → `'Rolnicze małe'`
  z `apply_kategoria.cjs:12`. Powód unii: parser (13a) nie unifikuje `'rolnicze małe'`
  (znalezisko 13a, roadmapa 13c), a `apply_kategoria.cjs` nie zna `Dętki`/`Akcesoria` — obie
  mapy są cząstkowe i obie są produkcji. Wartości spoza unii nietknięte
  (`apply_kategoria.cjs` też je pomija i loguje jako `unmapped`).
- **D5 — CASE_ONLY regułą R3** („każdy segment `powod` jest case-only"), realizowaną
  rekurencyjnym CTE po separatorze `" • "`. Uzasadnienie i pomiar równoważności z R2 wyżej.
- **D6 — BEZ wierszy w `history`.** `apply_kategoria.cjs` i `uppercase_fields.cjs` dopisywały
  wiersz `history` na każde zmienione pole (`zrodlo='fix-kategoria'`, `kto='Anna'`). Migracja
  SQL nie ma zegara ani autora — wpisywałaby zmyśloną datę i cudze nazwisko do dziennika,
  który służy audytowi. Migracja jest zdarzeniem deployu, nie edycją użytkownika.
  Odnotowane jako świadome odstępstwo od skryptów Ani (nie od stanu danych — stan końcowy
  `products` jest identyczny).
- **D7 — `manual_overrides` migrowane WYŁĄCZNIE dla `field_name='nazwa'`.** Produkcja ruszyła
  tylko to jedno pole (CHANGELOG 09-01 12:30). Pomiar pokazuje dwa pola, które zostają
  nietknięte mimo że „wyglądają na do naprawy": `field_name='konstrukcja'` (3 rek., wartość
  `D`) i `field_name='kategoria'` (6944 rek. ogółem, z tego 14 małą literą — 9× `przemysłowe`,
  5× `rolnicze`). Ani jednego z nich Ania nie migrowała — ani 2026-08-18, ani 2026-09-01.
  Skutek uboczny jest realny i istnieje tak samo w produkcji: przy kolejnym imporcie override
  wstrzykuje surową wartość z powrotem, więc te konkretne produkty wracają do kodu `D` / małej
  litery. **Odtwarzamy 1:1 i zgłaszamy jako follow-up (kandydat na wpis backlogu), a nie
  naprawiamy po cichu** — to luka produkcji, nie regresja odbudowy.
- **D8 — `test/gate/dane.ts` (zasiew bramek) NIE ruszany.** Zasiew leci PO migracjach, więc
  jego `konstrukcja: "R"`/`"-"` i `kategoria: "Przyczepy"` przez migrację nie przechodzą.
  Zmiana zasiewu to zmiana wejścia kilkunastu testów spoza zakresu 13c. Dowodem działania
  migracji jest `db.migracje.test.ts`, który sam wstawia wiersze „przed" i sprawdza „po".
- **D9 — nagrywarka fixtures dostaje migracje produkcji, nie nasze pliki.**
  `przygotujBaze()` w `tools/record-write-fixtures.cjs` rozszerzone o krok 3: `apply_kategoria.cjs`
  Ani (podmieniona wyłącznie ścieżka do bazy) + SQL `konstrukcja`/CAPS przepisany z CHANGELOG-a.
  Inaczej fixture byłby dowodem na naszą własną migrację.

### Świadome odstępstwa od oryginału
- **D6** — pomijamy wpisy w `history`, które robiły skrypty Ani. Stan tabel `products`,
  `manual_overrides`, `staging_items` bez zmian; różni się wyłącznie dziennik.
- **D3/D4** — mapy szersze niż dosłowny SQL z CHANGELOG-a (`L`/`B` tak, ale też `-`,
  pełne słowa, warianty bez polskich znaków, `rolnicze małe`). Wszystkie dołożone klucze
  pochodzą z map produkcji (`common.cjs`, `apply_kategoria.cjs`) i wszystkie są no-opem
  na bazie cutoveru. Zysk: migracja jest idempotentna i odporna na stan bazy odbudowy,
  która nie jest bazą produkcji.

## Implementation plan

1. **`rebuild/schema/004_kategoria_wielka_litera.sql`** — `UPDATE products SET kategoria = <mapa>`
   `WHERE LOWER(TRIM(kategoria)) IN (<klucze>) AND kategoria <> <mapa>`. Nagłówek-komentarz
   w konwencji `003_szerokosc_text.sql`: skąd, dlaczego, co pomija, dlaczego idempotentne.
2. **`rebuild/schema/005_konstrukcja_slowa.sql`** — analogicznie, wg `KONSTRUKCJA_CANONICAL_MAP`.
3. **`rebuild/schema/006_nazwa_caps.sql`** — trzy operacje w kolejności produkcji:
   `UPDATE products SET nazwa=UPPER(nazwa)`, `UPDATE manual_overrides ... WHERE field_name='nazwa'`,
   `DELETE FROM staging_items ...` rekurencyjnym CTE (R3).
4. **`rebuild/schema/README.md`** — dopisać trzy pliki do tabeli.
5. **`rebuild/backend/test/db.migracje.test.ts`** — rozszerzyć `MIGRACJE` o trzy pliki
   (test jest celowo jawną listą) i dołożyć bloki:
   - migracja zmienia dane: wiersze „przed" → oczekiwane „po" (w tym `X`/`NULL`/`Przyczepy`
     nietknięte, `manual_overrides.konstrukcja` nietknięte);
   - **idempotencja treściowa**: ponowne WYKONANIE tego samego SQL-a (z pominięciem ewidencji
     `_migracje`) nie zmienia ani jednego wiersza — to jest realny test, bo runner i tak
     drugi raz pliku nie odpali;
   - CASE_ONLY: wiersz jednosegmentowy case-only kasowany, wielosegmentowy case-only kasowany,
     wiersz z realną różnicą w drugim segmencie ZOSTAJE, wiersz z `ostrzezenie` ZOSTAJE.
6. **`tools/record-write-fixtures.cjs`** — `przygotujBaze()` + krok „migracje konwencji 09-01".
7. **Przenagranie fixtures** — `node tools/record-write-fixtures.cjs`, przegląd diffu
   (potwierdzić: słowa konstrukcji, CAPS, Wielka litera kategorii, mniej wierszy stagingu).
8. **`node tools/generate-openapi-schemas.cjs --sprawdz`** — schematy są wnioskowane
   z fixtures; jeśli zgłosi nieaktualność, przebudować.
9. **Bramki** + ewentualne przenagranie wzorca charakteryzacji silnika, jeśli `UPPER(nazwa)`
   przesunie `powod` drugi raz (roadmapa 13c to zapowiada — policzyć diff, nie zgadywać).

## Testing strategy

- `test/db.migracje.test.ts` — jednostkowo, na bazie w katalogu tymczasowym stawianej przez
  `zastosujMigracje`: poprawność mapowań, nietykalność wartości spoza map, idempotencja
  treściowa (drugie wykonanie SQL = 0 zmian), cztery przypadki CASE_ONLY. Bez mocków —
  prawdziwe SQLite, prawdziwe pliki migracji.
- GATE: pełny `npm test` w `rebuild/backend/` — wszystkie bramki fixtures/kontraktu muszą
  zostać zielone po przenagraniu nagrań.
- Kontrakt: `node tools/generate-openapi-schemas.cjs --sprawdz`.
- Weryfikacja nagrania: diff `contract/fixtures/` przejrzany ręcznie pod kątem trzech konwencji.

## Out of scope

- Parsery (13a), silnik `tk`/`acceptStaging` (13b), frontend/kolumna konstrukcji (13e),
  Selly (13d).
- Backfille `tl_tt` / szerokości ułamkowych / JMK (13f — decyzja: nie odtwarzamy).
- `manual_overrides` dla pól innych niż `nazwa` (D7).
- Zasiew `test/gate/dane.ts` (D8).
- Wpisy `history` z migracji (D6).
- **`contract/fixtures/GET_atrybuty_liczniki.json`** — niesie nieaktualne klucze
  `kategoria::rolnicze` i `konstrukcja::B/D/L/R/X` (oraz generowane z niego enumy
  w `contract/openapi.yaml`). Przenagrać się go NIE DA nagrywarką pisząco-czytającą:
  moduł `atrybuty` oryginału ma zahardkodowane ścieżki produkcyjne i w piaskownicy się nie
  podnosi (`contract/README.md`, `CLAUDE.md` — „`/api/atrybuty*` w piaskownicy martwe").
  Gate tej trasy (`sprawdzZgodnoscZFixtureSlownika`) sprawdza wyłącznie KSZTAŁT słownika,
  więc nieaktualne wartości niczego nie blokują. Zgłoszone jako follow-up.

## Definition of done

- [ ] `004`/`005`/`006` w `rebuild/schema/`, każdy z nagłówkiem cytującym źródło produkcji
- [ ] `npm run migrate` stosuje je w transakcji; drugi przebieg = zero zmian (ewidencja `_migracje`)
- [ ] idempotencja TREŚCIOWA udowodniona testem (powtórne wykonanie SQL = 0 zmienionych wierszy)
- [ ] CASE_ONLY kasuje szum i NIE kasuje wierszy z realną zmianą — cztery przypadki w teście
- [ ] fixtures przenagrane z oryginału @08.09 na bazie doprowadzonej do stanu produkcji po 09-01
- [ ] `lint` + `typecheck` + `build` + `test` zielone w `rebuild/backend/`
- [ ] roadmapa: blok 13c oznaczony zrobionym (data + ID), ustalenia dla 13e wpisane DO 13e
- [ ] backlog: #57 / #58 / #59 → „zrobione w 13c"; #59 domknięte razem z częścią silnikową 13b
- [ ] PR do `develop`
