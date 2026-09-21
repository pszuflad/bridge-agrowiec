# 78-FEATURE-seed-bieznikow-podobienstwo — seed bieżników z `products.bieznik`, kolejka bez self-matchy, podobieństwo bez względu na wielkość liter (P7.2)

> Status: Approved
> Branch: `feature/78-seed-bieznikow-podobienstwo`
> Worktree: `.worktrees/78-FEATURE-seed-bieznikow-podobienstwo`

## Ticket description

P7.2, Iteracja 7: seed słownika bieżników z `products.bieznik` (#40) i podobieństwo aliasów
bez względu na wielkość liter (#42). Oba punkty to świadome odstępstwa od produkcji,
zatwierdzone przez Anię 2026-09-21 (runda 2):
- 7.2 (#40): „tak, przeszkadza mi to”. Pozycje kolejki, które podpowiadają same siebie ze 100%,
  mają zniknąć.
- 7.3 (#42): „tak, bo mamy logikę, że katalog ma się zmieniać na drukowane litery, a w plikach
  przychodzi różnie”. Porównanie podobieństwa ma nie zależeć od wielkości liter.

Punkt startu to stan po P7.1 (ticket 74, `RODZAJ_KOLUMNA`, `ZAKRES_SKANU`, audyt kolejki)
i po P7.3 (ticket 75, `atrybuty.niezmiennik.test.ts`). Tego stanu nie zmieniamy.

## Context

- Oryginał: `mirror/backend/atrybuty_module.cjs:61-84` (`seed()`, `bieznik` z `SELECT DISTINCT
  model`, wołane przy każdym starcie, `:99`); `mirror/backend/pending_module.cjs:41-72`
  (`levenshtein`, `similarity`, `shouldSuggestAlias`, surowe napisy, próg 0,9, wyjątek na `+`),
  `:77-138` (skan nigdy nie usuwa z kolejki), `:218-250` (GET, top 5 sugestii).
- Port: `rebuild/backend/src/repos/atrybuty.ts` (`zasiejSlownikAtrybutow`, wołane w
  `src/app.ts:104` w `try/catch`) oraz `rebuild/backend/src/repos/atrybuty-pending.ts`
  (`podobienstwo`, `czySugerowacAlias`, `listaPending`, `skanujNoweWartosci`).
- **Mechanizm objawu jest szerszy niż seed bieżników.** Seed przy starcie wsypuje do słownika
  wszystkie marki z `products.marka` i (dziś) wszystkie modele. Pozycja kolejki dodana skanem
  przed restartem po restarcie jest już w słowniku, a skan jej nie usuwa. Tak samo działał
  historyczny zapis `origin='catalog'` w produkcji (`rozmiar`, `indeks_nosnosci`, `konstrukcja`),
  którego w rebuild nie ma. Sama zmiana źródła seedu objawu nie usuwa, bo seed z
  `products.bieznik` robi to samo co seed marek.

### Pomiar na kopii `db/snapshot.db` (2026-09-21)

**Słownik `bieznik` (pkt 1c):** 1665 wartości, z czego 1660 jest w obu kolumnach
(`products.model` i `products.bieznik`), 3 tylko w `products.bieznik`, 2 nie występują w żadnej
(`AGRIMAX RT 851`, `RM 500 STBT`, `origin='catalog'`, wsad z 2026-07-10). **Wyłącznie
z `products.model` nie pochodzi żadna.** 13 wartości, które są tylko w `model` (np.
`MAGLIFT LIP 8.00`, `'REM8 '`), w słowniku nie ma w ogóle. `model ≠ bieznik` występuje w 17
z 7405 produktów (MO3 4, MO4 2, MO5 1, MO9 10). `origin` nie odróżnia ręcznych dodań: `'user'` to
domyślna wartość kolumny, a seed i akceptacja jej nie nadpisują. `audit_log` nie ma ani jednego
`atrybut_wartosc_dodano`.

**Kolejka (pkt 1b):** 500 pozycji, z czego 437 ma wartość obecną dosłownie w słowniku tego
rodzaju. Po sprzątaniu zostaje 63.

| rodzaj | pozycji | w słowniku (znika) | zostaje |
|---|---:|---:|---:|
| bieznik | 296 | 242 | 54 |
| rozmiar | 99 | 99 | 0 |
| marka | 68 | 68 | 0 |
| indeks_nosnosci | 27 | 27 | 0 |
| kategoria | 7 | 0 | 7 |
| konstrukcja | 1 | 1 | 0 |

**Sugestie (#42):** dziś 443 pozycje mają co najmniej jedną sugestię, w większości same siebie.
Po zmianie 17 z 63 zostających pozycji ma sugestię. 13 par jest nowych, np.
`kategoria "rolnicze" → "Rolnicze"` (334 produkty), `"ciężarowe" → "Ciężarowe"` (106),
`"leśne" → "Leśne"`, `"przemyslowe" → "Przemysłowe"` (91%),
`bieznik "FARMAX R75" → "Farmax R75"`, `"Conti CrossTrac 3" → "CONTI CROSSTRAC 3"`,
`"MG638 NAPĘD" → "MG638  napęd"`. **ALLIANCE/Alliance (#92):** słownik `marka` ma obie formy,
a pozycja kolejki `ALLIANCE` jest dosłownie w słowniku, więc zniknie przy sprzątaniu i kolejka
tej pary nie zaproponuje. Gdyby została, nowa reguła zaproponowałaby `ALLIANCE → Alliance` ze 100%.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

- `GET /api/atrybuty/pending`: kształt bez zmian (`{ok, items[], count}`, `sugerowane_aliasy:
  [{wartosc, podobienstwo}]`, maks. 5). Wartości różnią się świadomie: mniej pozycji,
  brak self-matchy, więcej sugestii różniących się wielkością liter.
- `POST /api/atrybuty/scan-pending`: kształt odpowiedzi bez zmian
  (`skanowano_rodzajow`, `nowych_wartosci`, `zaktualizowano`). Liczba usuniętych pozycji trafia
  tylko do logu serwera (decyzja D4).
- `contract/fixtures/GET_atrybuty_pending.json`: **zostaje bez zmian** (decyzja D2). To nagranie
  produkcji sprzed odstępstwa i nie da się go przenagrać lokalnie (moduły `atrybuty`/`pending` mają
  zahardkodowane ścieżki produkcyjne). `atrybuty.gate.test.ts` porównuje go wyłącznie kształtem,
  więc gate przechodzi. Rozjazd wartości (5 self-matchy w nagraniu) jest świadomy i opisany
  w raporcie. Frontendu nie ruszamy: jego test używa fixture jako danych i zostaje zielony.

## Decisions

- **D1 (#40, pkt 1b): sprzątanie kolejki i brak podpowiadania samej siebie.** Pozycja kolejki,
  której wartość jest dosłownie (porównanie BINARY) w słowniku tego samego rodzaju, jest usuwana:
  (a) na końcu każdego skanu (`POST /api/staging/accept` → skan, `POST /api/atrybuty/scan-pending`),
  (b) przy starcie procesu, zaraz po seedzie. Skutek jest ten sam co „Akceptuj”, które produktów
  nie rusza. Dodatkowo reguła sugestii nigdy nie proponuje napisu identycznego z pozycją.
  To zabezpieczenie na okno między ręcznym dodaniem wartości w słowniku a najbliższym skanem.
  Świadoma konsekwencja: seed przy starcie wsypuje marki i bieżniki z `products`, więc pozycje
  tych rodzajów żyją w kolejce do najbliższego restartu. To semantyka seedu z produkcji, dziś
  zakryta self-matchem.
- **D2: fixture `GET_atrybuty_pending.json` zostaje bez zmian.** Uzasadnienie w sekcji kontraktu.
- **D3 (#40, pkt 1c): istniejących wartości słownika nie usuwamy, bez migracji.** Pomiar: żadna
  wartość nie pochodzi wyłącznie z `products.model`, więc nie ma czego sprzątać. Zmiana seedu
  działa tylko na przyszłość.
- **D4: sprzątanie bez wpisu w `audit_log`, liczba usuniętych trafia do `console.log`.** Audyt
  i `PRZEPISANIA_Z_KOLEJKI` z P7.1 zostają nietknięte.
- **D5 (#40, pkt 1a): seed `bieznik` z `SELECT DISTINCT bieznik FROM products`.** Seed marek,
  rodzajów i `CORE_WARTOSCI` bez zmian, dalej tylko `INSERT OR IGNORE` (tylko dosypuje),
  bez `origin`.
- **D6 (#42): normalizacja tylko do liczenia podobieństwa.** `trim()`, `toLowerCase()`
  (JS, obsługuje polskie znaki, w przeciwieństwie do `LOWER()` w SQLite), zwinięcie `\s+` do
  jednej spacji. Stosowana w `podobienstwo()` i w regule „różnica tylko w `+`” (na napisach
  znormalizowanych). Próg 0,9 i reguła `+` bez zmian. `podobienstwo` w odpowiedzi to procent
  po normalizacji. W słowniku, kolejce i `products` zostaje forma oryginalna.
  `levenshtein()` zostaje surowy.
- **D7: „nowość” w skanie zostaje porównaniem dokładnym.** `bkt` przy `BKT` w słowniku trafia
  do kolejki i dostaje sugestię `BKT` 100%. Sprzątanie D1 też porównuje dokładnie, więc `bkt`
  nie zniknie z powodu `BKT`.

**Świadome odstępstwa od oryginału:** D1 (sprzątanie + brak self-matchy), D5 (źródło seedu),
D6 (normalizacja podobieństwa). Wszystkie trzy zatwierdziła Ania 2026-09-21 (#40, #42).

## Implementation plan

1. `repos/atrybuty-pending.ts`:
   - `normalizujDoPorownania(s)`: trim, toLowerCase, zwinięcie spacji.
   - `podobienstwo(a, b)` liczy na znormalizowanych, a `czySugerowacAlias` najpierw sprawdza
     `nowa === kanoniczna → false` (self-match), potem próg i regułę `+` na znormalizowanych.
   - `usunZKolejkiObecneWSlowniku(db): number`:
     `DELETE FROM atrybuty_wartosci_pending AS p WHERE EXISTS (SELECT 1 FROM atrybuty_wartosci w
     WHERE w.rodzaj = p.rodzaj AND w.wartosc = p.wartosc)`. Zwraca liczbę usuniętych.
   - `skanujNoweWartosci` na końcu woła sprzątanie i loguje liczbę, statystyki bez zmian.
     Komentarze nagłówkowe przepisane: opisują odstępstwo, a nie quirk.
2. `repos/atrybuty.ts`: seed `bieznik` z `products.bieznik`, komentarz o odstępstwie #40.
3. `src/app.ts` (poza listą własności z promptu, zmiana minimalna): po `zasiejSlownikAtrybutow(db)`
   wywołanie `usunZKolejkiObecneWSlowniku(db)` z logiem. Seed nie może wołać sprzątania sam, bo
   `atrybuty-pending.ts` importuje `atrybuty.ts` (import cykliczny).
4. Testy (prawdziwa baza, bez mocków):
   - `atrybuty.podobienstwo.test.ts`: przypadki z różnicą wielkości liter odwrócone z komentarzem
     „świadome odstępstwo, #42, decyzja Ani 2026-09-21”, reszta zamrożona jak była. Nowe
     przypadki: `Ą`/`ą`, spacje (trim i wielokrotne), `+` po normalizacji (`bkt+` vs `BKT` →
     false), self-match identyczny → false, różnica wielkości liter → true 100.
   - `atrybuty.pending.test.ts`: test „najwyżej 5 sugestii” opiera się dziś na self-matchu
     wstawionym ręcznie. Przepisany tak, żeby sprawdzał sortowanie i limit bez self-matcha,
     a self-match był jawnie nieobecny. Nowe testy: skan usuwa pozycje obecne w słowniku
     (także innych rodzajów niż bieżnik), `bkt` przy `BKT` trafia do kolejki, zostaje po skanie
     i dostaje sugestię `BKT` 100, seed `bieznik` bierze `products.bieznik`, a nie `model`,
     start aplikacji (`stworzApp`) sprząta kolejkę.
   - `atrybuty.niezmiennik.test.ts`: nietknięty, musi zostać zielony (test „alias na samą
     siebie” dodaje wartość do słownika bez skanu, więc pozycja jeszcze istnieje).
5. Pomiar na kopii snapshotu skryptem w `docs/tickets/78-…/`: stan kolejki przed i po oraz
   sugestie przed i po, uruchamiany na kodzie rebuildu. Wynik trafia do raportu.

## Testing strategy

- Gate: `atrybuty.gate.test.ts` (kształt `GET_atrybuty_pending.json` i pozostałych 5 fixtures
  atrybutów) bez zmian i zielony. Walidacja openapi przez istniejący harness.
- Unit: czyste funkcje podobieństwa. Integracja: trasy i skan na prawdziwej bazie SQLite
  w katalogu tymczasowym.
- Bramki: lint, typecheck, build i test w `rebuild/backend/` (Node 20). Frontendu nie
  dotykamy, fixture bez zmian, więc bramki FE nie są wymagane.

## Out of scope

- Usuwanie istniejących wartości słownika (D3). `products.marka` i #92 (karta PR.5).
- Frontend, w tym nieaktualny komentarz w `rebuild/frontend/test/atrybuty.pending.test.tsx`
  („⬜ do decyzji”). Follow-up.
- `docs/instrukcja-testow-I7.md` §4 pkt 1 i 2 przestaną być prawdziwe. Sprostowanie należy do
  P7.4 (follow-up).
- Zakres skanu, `RODZAJ_KOLUMNA`, audyt, FK rodzajów na świeżej bazie.

## Definition of done

- [ ] Seed `bieznik` z `products.bieznik`, test to potwierdza.
- [ ] Pozycja kolejki obecna dosłownie w słowniku znika po skanie i po starcie; test na ≥ 2 rodzajach.
- [ ] Nigdy nie ma sugestii identycznej z pozycją; różnica tylko wielkości liter lub spacji daje sugestię 100.
- [ ] `Ą`/`ą` się zrównują (test).
- [ ] Skan nadal dokładny (`bkt` przy `BKT` w kolejce).
- [ ] `atrybuty.niezmiennik.test.ts` i `atrybuty.gate.test.ts` zielone bez zmian.
- [ ] Pomiar przed/po na snapshocie w raporcie, z odpowiedzią na ALLIANCE/Alliance.
- [ ] lint, typecheck, build, test zielone.
