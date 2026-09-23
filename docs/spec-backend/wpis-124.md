# Wpis do spec-backend od ticketu 124 (karta I15.4a) · 2026-09-23

**Sekcja:** §5 (silnik importu `tk()` — warstwa bazodanowa polityki stagingu).

**Potwierdzone w 124** (`124-FEATURE-fundament-stagingu`, 2026-09-23, karta I15.4a):

## Produkcja zakłada sześć tabel polityki stagingu RUNTIME'OWO, nie migracją

`mirror/backend/staging_policy.cjs:86-107` (`origin/main` @ `88fa31c`) w `install()` wykonuje przy
**każdym starcie procesu** sześć `CREATE TABLE IF NOT EXISTS` — `staging_matches` (#99),
`supplier_feed_state`, `supplier_feed_versions`, `product_absence_checks` (#103),
`product_auto_suspensions` (#104), `staging_absence_decisions` (#106) — plus warunkowy
`ALTER TABLE staging_absence_decisions ADD COLUMN selected_source_code TEXT` pod `PRAGMA table_info`
i `CREATE UNIQUE INDEX IF NOT EXISTS staging_absence_one_choice`.

To ten sam wzorzec co `payment_blocks.cjs` i `application_rules.cjs` opisane przy migracji `011`:
**produkcja nie ma tych obiektów w żadnej migracji.** Odbudowa nie ma kodu startowego zakładającego
tabele, więc wnosi je migracją `rebuild/schema/012_staging_polityka.sql` — z DDL **bajt w bajt**
z `git show 88fa31c:db/schema.sql:332-347` i jedyną zmianą `CREATE …` → `CREATE … IF NOT EXISTS`,
czyli dokładnie w formie, jakiej używa sam oryginał.

**Odbudowa robi tak samo, nie inaczej.** Świadomego odstępstwa tu nie ma.

## Zrzut `7d6cfc9:db/schema.sql` ma już Staging v2 — zmierzone, bo łatwo o pomyłkę

Zrzut `7d6cfc9` (22.09 **14:00**) **zawiera już** `staging_matches` i indeks unikalny
`staging_one_current_product`, bo #99 wdrożono tego samego dnia **rano**. Nie zawiera natomiast
czterech tabel z #103/#104 ani `staging_absence_decisions` z #106 — te powstały 22.09 wieczorem
i 23.09. Zrzut `88fa31c` ma komplet. Różnica między oboma zrzutami to dokładnie pięć tabel i jeden
indeks (zweryfikowane `diff`em listy obiektów). Konsekwencja praktyczna: migracja `012` jest na
zrzucie `7d6cfc9` **częściowym no-opem**, a na `88fa31c` — **całkowitym**.

## SQLite normalizuje `IF NOT EXISTS` przy zapisie do `sqlite_master`

Zmierzone: po `CREATE TABLE IF NOT EXISTS staging_matches(...)` w `sqlite_master.sql` siedzi
`CREATE TABLE staging_matches(...)` — bez `IF NOT EXISTS`. Dzięki temu DDL obiektów założonych przez
migrację jest **znak w znak** identyczny z zapisem produkcji i da się go porównać wprost.
`rebuild/backend/test/db.migracja-012.test.ts` z tego korzysta: porównuje `sqlite_master` z bazą
**zbudowaną ze zrzutu produkcji** (`test/schemat-produkcji/88fa31c-schema.sql`), a nie z tekstem
przepisanym do testu — przepisany tekst mógłby zawierać tę samą literówkę co migracja.

⚠ **Ryzyko resztkowe:** `CREATE TABLE IF NOT EXISTS` **nie waliduje kształtu** istniejącej tabeli.
Gdyby produkcja miała tabelę o tej nazwie w innym kształcie, migracja przeszłaby po cichu — to ta
sama klasa pułapki, co `safeAll()` zamieniające błąd SQL w pustą listę (CLAUDE.md). Zabezpieczeniem
jest wyłącznie powyższy fixture; po każdej zmianie tych tabel przez Anię trzeba go przenagrać.

## `UPPER()`/`LOWER()` nie jest tu jedyną pułapką porównań — `MAX(id)` też zależy od kolejności migracji

Sprzątanie duplikatów `staging_items` przed indeksem unikalnym zostawia `MAX(id)` per `(dostawca, kod)`
(decyzja D5 iteracji 15; produkcja doszła do tego stanu jednorazowym skryptem
`staging_reconcile_20260922.cjs`, którego nie przenosimy). **Zmierzone na kopii `db/snapshot.db`:**

| etap | wierszy `staging_items` | duplikatów `(dostawca, kod)` |
|---|---|---|
| surowy snapshot (13.08) | 3362 | 238 |
| po 001–011 — migracja 006 kasuje szum CASE_ONLY | 2639 | 137 |
| po 012 | 2502 | 0 |

**Migracja `012` usuwa 137 wierszy, nie 238.** Liczba 238 opisuje surowy snapshot, zanim 006 zabierze
723 wiersze — i bywa, że 006 kasuje właśnie ten wiersz, który miał `MAX(id)`, więc zwycięzcą zostaje
kolejny co do wielkości. Test liczy zwycięzców **po 006**, nie na surowym snapshocie; policzenie ich
za wcześnie daje fałszywy wynik (sprawdzone — pierwsza wersja testu na tym poległa).

## Trzy zapisy na `staging_absence_decisions` różnią się tylko traktowaniem `selected_source_code`

Oryginał ma trzy różne upserty i różnica jest merytoryczna, nie stylistyczna:
- `:261-263` („pozostaw starą wstrzymaną i zamknij sprawę") — kolumny **nie wymienia** ani wśród
  wstawianych, ani w `DO UPDATE`: wcześniejszy wybór karty **przetrwa** zamknięcie sprawy;
- `:308-311` (wskazanie karty z bieżącej oferty) — **ustawia** ją z `excluded`;
- `:322-325` (wybór karty bieżącej) — **jawnie zeruje** (`VALUES(…,NULL)` i `DO UPDATE SET … =NULL`),
  przez co kod źródłowy wraca do puli w indeksie częściowym `staging_absence_one_choice`.

Podobnie `product_auto_suspensions` (`:122-124`): `DO UPDATE` obejmuje `source_fingerprint` i `reason`,
ale **nie `suspended_at`** — data pierwszego wstrzymania się nie przesuwa, bo jest licznikiem tego, jak
długo produktu nie ma w ofercie. A `supplier_feed_state` (`:522-524`) podnosi `max_item_count` przez
`MAX(supplier_feed_state.max_item_count, excluded.max_item_count)` i **nigdy go nie obniża** — po tym
szczycie historycznym poznaje się ofertę „mniejszą o ponad 20%".

Odbudowa odtwarza każdą z tych klauzul osobno w `rebuild/backend/src/repos/staging-polityka.ts`.
Sklejenie ich w jeden generyczny zapis gubi różnicę i wyłącza po cichu dwa zabezpieczenia.

Szczegóły: `docs/tickets/124-FEATURE-fundament-stagingu/`.
