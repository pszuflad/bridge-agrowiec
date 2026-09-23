# I15.4a — fundament stagingu: migracja 012 (6 tabel), model, repozytoria

> **Stan:** ✅ 2026-09-23 · 124-FEATURE-fundament-stagingu
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #99, #103, #104, #105, #106, #107 (wg zakresu) · **Zależy od:** —
> **Ticket:** `124-FEATURE-fundament-stagingu`

Założona przez koordynatora ticketem `123-DOCS-podzial-i15-4`, 2026-09-23 — **podział dawnej karty I15.4** (665 linii
`staging_policy.cjs`, 6 nowych tabel, podmiana rdzenia importu to za dużo na jeden przegląd; decyzja użytkownika 23.09).
Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”. Materiał wspólny: wejścia w katalogach kart.

## Zakres
Sam fundament, **bez zmiany zachowania importu** — dzięki temu można go zmergować i wdrożyć niezależnie od
reszty toru stagingu.

- **Migracja `012`** (numer zarezerwowany), definicje **bajt w bajt** z `git show 88fa31c:db/schema.sql`:
  - `staging_matches` (#99) — świadome dopasowania,
  - **indeks unikalny** `staging_one_current_product ON staging_items(dostawca, kod)` (#99) **poprzedzony
    sprzątaniem duplikatów** (zostaje `MAX(id)` per `dostawca, kod` — D5; na produkcji to no-op),
  - `supplier_feed_state`, `supplier_feed_versions`, `product_absence_checks` (#103 — bezpieczeństwo źródła,
    dowody nieobecności),
  - `product_auto_suspensions` (#104 — automatyczne wstrzymania odróżnione od ręcznych),
  - `staging_absence_decisions` + indeks unikalny `staging_absence_one_choice` (#106 — decyzje o nieobecnych
    kartach, tylko gdy `selected_source_code` niepuste).
  Migracja MUSI być idempotentna: na produkcji wszystkie te tabele już istnieją (por. wzorce z `011` i `013`).
- **Model Drizzle** (`db/schema.ts`) dla sześciu nowych tabel.
- **Repozytoria** — funkcje odczytu i zapisu tych tabel, bez logiki decyzyjnej (tę wnoszą I15.4b i I15.4c).
  Ustal nazwy i sygnatury tak, żeby obie karty mogły je wołać bez zmian w tym pliku, i opisz je w „Do koordynatora”.
- Testy migracji na trzech bazach: świeża, kopia `db/snapshot.db`, baza symulująca produkcję (tabele już są).

## Pliki (wyłączna własność)
`rebuild/backend/src/schema/…` → konkretnie: `rebuild/schema/012_*.sql`, `rebuild/backend/src/db/schema.ts`
(tylko nowe tabele stagingu), nowe repozytorium tych tabel, testy migracji.
NIE: `import/tk.ts` i logika importu (I15.4b), akceptacja i trasy (I15.4c), `legacy/**` (I15.2).

## Decyzje
**Decyzje użytkownika (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na istniejące obiekty ·
D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2 przenosimy ·
D4 błędny EAN = błąd blokujący akceptację (zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
⭐ **Produkcja zamrożona — Ania skończyła 23.09 i czeka na nową wersję do testów. Źródło prawdy: `origin/main`
na commicie `88fa31c` (23.09 13:00).** Nowy commit z kodem na `main` = ZATRZYMAJ SIĘ i zgłoś użytkownikowi.

Numer migracji `012` zarezerwowany przez koordynatora — nie bierz innego.


## Dowiezione

**Zakres dowieziony w całości, zgodnie z planem** (ticket `124-FEATURE-fundament-stagingu`, 2026-09-23).
Gate karty rozliczony: migracja udowodniona na trzech bazach, `lint`/`typecheck`/`build`/`test` zielone
(1666 testów w 102 plikach, `SNAPSHOT_DB` ustawione).

- `rebuild/schema/012_staging_polityka.sql` — sześć tabel i dwa indeksy, DDL **bajt w bajt**
  z `88fa31c:db/schema.sql:332-347` (zweryfikowane `diff`em po zdjęciu `IF NOT EXISTS`, osobno przez
  reviewera). Bez nowej dyrektywy runnera — `src/db/migrate.ts` **nietknięty**.
- `rebuild/backend/src/db/schema.ts` — model Drizzle sześciu tabel; `stagingItems` dostało deklarację
  indeksu `staging_one_current_product` (jedyna zmiana w istniejącej tabeli, kolumn nie rusza).
- `rebuild/backend/src/repos/staging-polityka.ts` — 16 funkcji, każda odtwarza dokładnie jedno
  zapytanie `staging_policy.cjs` wraz z klauzulą `ON CONFLICT`. Bez logiki decyzyjnej.
- Testy: `test/db.migracja-012.test.ts` (13), `test/repos.staging-polityka.test.ts` (18),
  fixture `test/schemat-produkcji/88fa31c-schema.sql`.

### ⚠ POMIAR sprzątania duplikatów `staging_items` (wymagany przez kartę)

Mierzone na KOPII `db/snapshot.db` (13.08), nigdy na oryginale. **W łańcuchu migracji liczą się dwie
różne liczby i łatwo je pomylić:**

| etap | wierszy | duplikatów `(dostawca, kod)` |
|---|---|---|
| surowy snapshot | 3362 | 238 |
| po 001–011 (006 kasuje szum CASE_ONLY) | 2639 | 137 |
| **po 012** | **2502** | **0** |

Czyli **migracja 012 usuwa 137 wierszy**, a nie 238. 238 to liczba duplikatów w SUROWYM snapshocie,
zanim migracja 006 zabierze 723 wiersze. Łącznie od surowego snapshotu ubywa 860.
**Na produkcji to no-op** — indeks unikalny stoi tam od 22.09.

### Ustalenia, które obalają wcześniejsze założenia karty

1. **Tytuł karty mówił „5 tabel" — jest ich SZEŚĆ** (`staging_matches`, `supplier_feed_state`,
   `supplier_feed_versions`, `product_absence_checks`, `product_auto_suspensions`,
   `staging_absence_decisions`). Policzone z `88fa31c:db/schema.sql:332-347`. Tytuł poprawiony wyżej.
2. **Fixture `7d6cfc9-schema.sql` JUŻ ZAWIERA `staging_matches` i indeks `staging_one_current_product`**
   — Staging v2 (#99) wdrożono 22.09 rano, a zrzut jest z 14:00. Migracja 012 jest na nim częściowym
   no-opem. To pierwszy, uzyskany mimochodem dowód jej idempotencji.
3. **SQLite normalizuje `IF NOT EXISTS`** przy zapisie do `sqlite_master`, więc DDL naszych obiektów
   jest znak w znak taki sam jak na produkcji. Test to wykorzystuje: porównuje `sqlite_master`
   z bazą ZBUDOWANĄ ZE ZRZUTU produkcji, a nie z tekstem przepisanym do testu.

## Do koordynatora

### 1. Sygnatury repozytoriów dla I15.4b i I15.4c — stabilne, do wołania BEZ zmian w moich plikach

Wszystkie w `rebuild/backend/src/repos/staging-polityka.ts`. Pierwszym parametrem zawsze `db: Baza`
(wzorzec `repos/staging.ts`). Przy każdej funkcji w kodzie jest numer linii `staging_policy.cjs` @ `88fa31c`.

```ts
// staging_matches (#99)
dopasowanieStagingu(db, dostawca, kluczZrodlowy): string | undefined            // :137
zapiszDopasowanieStagingu(db, dostawca, kluczZrodlowy, kodProduktu, utworzono): void  // :224, :305

// supplier_feed_state / supplier_feed_versions (#103)
stanOfertyDostawcy(db, dostawca): StanOfertyDostawcy | undefined                // :455
zapiszStanOfertyDostawcy(db, stan): void                                        // :522-524
czyZnanaWersjaOferty(db, dostawca, odcisk): boolean                             // :463
zapiszWersjeOferty(db, dostawca, odcisk, policzonoO): void                      // :526

// product_absence_checks (#103)
dowodyNieobecnosci(db, dostawca, kodProduktu): string | undefined               // :598
zapiszDowodyNieobecnosci(db, dostawca, kodProduktu, dowodyJson): void           // :602
usunDowodyNieobecnosci(db, dostawca, kodProduktu): void                         // :467

// product_auto_suspensions (#104)
czyAutomatycznieWstrzymany(db, dostawca, kodProduktu): boolean                  // :111, :468
zapiszAutomatyczneWstrzymanie(db, dostawca, kodProduktu, wstrzymanoO, odcisk, powod): void  // :122
usunAutomatyczneWstrzymanie(db, dostawca, kodProduktu): void                    // :116, :218, :302, :318, :469

// staging_absence_decisions (#106)
decyzjaONieobecnej(db, dostawca, kodProduktu): string | undefined               // :544, :567 (zwraca candidates_hash)
kodProduktuDlaWybranegoZrodla(db, dostawca, wybranyKodZrodlowy): string | undefined  // :358
zamknijSpraweNieobecnej(db, dostawca, kodProduktu, hashKandydatow, zdecydowanoO): void       // :261
zapiszWyborKartyZrodlowej(db, …, hashKandydatow, zdecydowanoO, wybranyKodZrodlowy): void     // :308
zapiszWyborBiezacejKarty(db, …, hashKandydatow, zdecydowanoO): void                          // :322
usunDecyzjeONieobecnej(db, dostawca, kodProduktu): void                         // :550
```

**Trzy pułapki, których nie wolno „uprościć" w I15.4b/c:**
- `zapiszAutomatyczneWstrzymanie` **NIE aktualizuje `suspended_at`** przy konflikcie (tylko odcisk
  i powód) — data pierwszego wstrzymania jest punktem odniesienia dla tego, jak długo produktu nie ma.
- `zapiszStanOfertyDostawcy` podnosi `maxItemCount` przez `MAX(…)` i **nigdy go nie obniża** — to po nim
  poznaje się ofertę „mniejszą o ponad 20%".
- Trzy zapisy na `staging_absence_decisions` różnią się WYŁĄCZNIE traktowaniem `selected_source_code`:
  `zamknijSpraweNieobecnej` go **zachowuje**, `zapiszWyborKartyZrodlowej` **ustawia**,
  `zapiszWyborBiezacejKarty` **zeruje**. Sklejenie ich w jedną funkcję gubi tę różnicę.

**Czego NIE MA i dlaczego:** `staging_matches` nie ma funkcji kasującej — oryginalny `install()` nie
ma żadnego `DELETE FROM staging_matches`; kasował je tylko skrypt jednorazowy
`zero_and_delete_agrorami_20260922.cjs` (D5: nie przenosimy). Jeśli I15.4b albo I15.4c jej potrzebuje,
to jest **nowe zachowanie** i wymaga decyzji użytkownika, a nie cichego dopisania.

### 2. Cutover — zachowanie migracji na bazie produkcji

- **Migracja `012` jest na produkcji NO-OPem.** Wszystkie sześć tabel i oba indeksy tam istnieją
  (Ania założyła je 22–23.09), a `CREATE … IF NOT EXISTS` ich nie dotyka. `DELETE` duplikatów też nie
  ma czego skasować, bo indeks unikalny stoi tam od 22.09. Udowodnione testem na zrzucie `88fa31c`:
  **żaden z ośmiu obiektów nie zmienia definicji, dane w sześciu tabelach zostają nietknięte.**
- **Nie trzeba żadnego kroku ręcznego w `docs/cutover.md`** dla tej migracji — inaczej niż przy 002/003/013.
- Ryzyko resztkowe: `CREATE TABLE IF NOT EXISTS` **nie waliduje** kształtu istniejącej tabeli. Gdyby
  produkcja miała tabelę o tej nazwie, ale innym kształcie, migracja przeszłaby po cichu. Dlatego test
  porównuje DDL z bazą zbudowaną ze zrzutu produkcji — gdyby Ania zmieniła którąkolwiek z tych tabel,
  trzeba **przenagrać `test/schemat-produkcji/88fa31c-schema.sql`** i test to wyłapie.

### 3. Statusy backlogu — do domknięcia przed I15.4b i I15.4c

W `docs/rebuild-backlog.md` tylko **#99** ma `Do nowej wersji? ✅ TAK`. Wpisy **#103 („Braki w cenniku"),
#104, #105, #106, #107** mają nadal `⬜ do decyzji`. Decyzją użytkownika (D-124.3, 23.09) ta karta
dowiozła **sam schemat**, bo te tabele fizycznie istnieją na produkcji od 22–23.09 i migracja tylko
doprowadza odbudowę do stanu produkcji, **nie wnosząc żadnego nowego zachowania**. Statusy zostawiłem
nietknięte. **LOGIKA z #103/#104/#106 — czyli karty I15.4b i I15.4c — wciąż czeka na formalne `✅`.**

### 4. Backlog #107 zgubił przypisanie przy podziale I15.4

Backlog zleca pomiar zatwierdzania zbiorczego karcie **I15.4** — sprzed podziału na a/b/c. Zatwierdzanie
zbiorcze jest zakresem **I15.4c**; I15.4a nie dotyka akceptacji. Decyzją użytkownika (D-124.4) zadanie
trafiło do `docs/karty/I15.4c/wejscie-124.md`. Do rozważenia poprawka odsyłacza w samym backlogu.

### 5. Drobiazg w teście zastanym

`test/alerty-katalogu.gate.test.ts` („paczka równa limitowi 20 000 id") bywa flaky na timeoucie 20 s
przy pełnym przebiegu na obciążonej maszynie; osobno przechodzi. Sprawdzone, że pęka tak samo **bez**
migracji 012, więc to nie skutek tej karty. Próg wart podniesienia osobnym ticketem.
