# FIX.1 — CSV dla Selly ma czytać flagi surowo (wpis backlogu #153.1)

> **Stan:** ✅ 2026-09-24 · 154-BUG-csv-selly-flagi-tak
> **Iteracja:** poza iteracjami (naprawa przed przełączeniem) · **Wpisy backlogu:** #153.1 · **Zależy od:** —
> **Ticket:** `154-BUG-csv-selly-flagi-tak`

Założona przez koordynatora ticketem `153-DOCS-flagi-tak-w-csv`, 2026-09-24, po pomiarze na stagingu.

## Zakres

Generator CSV (`src/selly/generator-csv.ts`) gubił pięć flag zapisanych w bazie jako **tekst `'Tak'`**,
bo czytał produkty przez Drizzle, gdzie kolumny są w trybie boolean, a `Number('Tak') === 1` to `false`.
Produkcyjny skrypt czyta `SELECT *` przez `better-sqlite3` i dostaje surową wartość. Pomiar, liczby
i tabela typów: `docs/rebuild-backlog/wpis-153.md`.

**Naprawione** ticketem `154-BUG-csv-selly-flagi-tak`: CSV wypisuje teraz `Tak` wszędzie tam, gdzie
wypisuje je produkcja — dla wartości `1` ORAZ dla tekstu `'Tak'` (i dowolnej innej niepustej wartości,
bo oryginał robi zwykłe `v ? …`).

⚠ **Modelu Drizzle NIE zmieniamy.** Oryginał ma te kolumny w trybie boolean
(`deminified/backend-index.cjs:43733-43752`), więc produkcyjne `GET /api/products` zwraca na `'Tak'`
dokładnie to samo `false` co my — API jest wierne i ma takie zostać. Zmiana modelu naprawiłaby CSV
kosztem rozjazdu z `contract/fixtures/GET_products.json`. Poprawka siedzi w warstwie odczytu
generatora CSV, nie w schemacie.

Dziesięć kolumn objętych `KOLUMNY_BOOL`: `reinforced`, `extra_load`, `cut_resistant`,
`heat_resistant`, `stubble_resistant`, `nro`, `cho`, `ms`, `snow_3pmsf`, `cfo`. Pomiar pokazał tekst
`'Tak'` w sześciu z nich (także `stubble_resistant`, jeden wiersz, nieaktywny) — popraw wszystkie
dziesięć, bo kolejny import może wstawić tekst do każdej.

## Dowód wierności (wykonany)

Test jednostkowy nie wystarczał, więc ticket powtórzył pomiar z wpisu #153.1 **na stagingu** — lepiej,
niż zakładała ta sekcja: zamiast „ta sama baza, ten sam moment" (dwa przebiegi jeden po drugim, z
szumem schedulera importu) oba generatory dostały **mrożoną kopię** bazy stagingu
(`better-sqlite3 backup()` z połączenia `readonly`) — identyczne wejście, zero szumu, baza stagingu
bez ryzyka zapisu. Wynik: 5396 = 5396 produktów, nagłówek identyczny, **ten sam MD5**
`3f8bec0d9ba03a552910971d5cef79eb`, `diff` PUSTY. Kontrola czułości (ten sam pomiar na kodzie sprzed
naprawy) odtworzyła 899 różnic z wpisu `#153.1` co do wiersza. Pełne liczby: `raport.md` ticketu.
⚠ Skrypt produkcji ma zaszyte ścieżki produkcyjne (`DB_PATH`, katalog eksportu) — uruchomiona była
WYŁĄCZNIE kopia z podmienionymi trzema stałymi, nigdy oryginał (potwierdzone `grep`em przed startem).

⚠ Uwaga na źródło: w `develop` katalog `mirror/` jest cofnięty do stanu z 25.08 (commit `6594525`,
bramki wierności), więc żywy generator produkcji bierze się z `origin/main`, nie z gałęzi roboczej.

## Pliki (wyłączna własność)
`rebuild/backend/src/selly/generator-csv.ts`, `rebuild/backend/test/selly.generator-csv.test.ts`,
`docs/karty/FIX.1/karta.md`, `docs/tickets/<ID>/**`.
NIE: `src/db/schema.ts` (patrz wyżej), `mirror/**`.

## Decyzje

- **D1 — model Drizzle nietknięty.** Kolumny zostają `integer({ mode: "boolean" })` — oryginał trzyma
  je w tym samym trybie, więc zmiana modelu naprawiłaby CSV kosztem rozjazdu `GET /api/products` z
  `contract/fixtures/GET_products.json`. Poprawka wyłącznie w warstwie odczytu generatora.
- **D2 — technika odczytu: `sql<...>` w projekcji, nie osobny `SELECT *`.** Nadpisanie dziesięciu pól
  wyrażeniem `sql<WartoscSurowaFlagi>` omija `mapFromDriverValue` Drizzle (zweryfikowane w źródle
  `drizzle-orm/utils.cjs:40-77` i przez `.toSQL()`). Jedno zapytanie, `Baza` bez zmiany sygnatury,
  `KOLUMNY`/`csv-cli.ts`/`dostepnosc.ts` nietknięte.
- **D3 — reguła prawdziwości bez wyjątków.** `wartosc ? "Tak" : ""` na wartości surowej, bez zawężania
  do `v === 1 || v === 'Tak'`. Korekta faktu z raportu: tekstowe `'0'` NIE daje „Tak", bo kolumna ma
  powinowactwo typów `INTEGER` i SQLite konwertuje liczbowy napis na `integer 0` już przy zapisie —
  reguła jest mimo to odtworzona wiernie, bo to zachowanie samego SQLite, identyczne w produkcji i u nas.
- **D4 — `mapper.ts` zgłoszony, nie naprawiony.** Ten sam błąd w `src/selly/mapper.ts:197-203` (sync
  REST do Selly) jest poza wyłączną własnością tej karty (`generator-csv.ts` + jego test). Zapisane
  niżej i jako wpis backlogu `#154.1`.
- **D5 — brak odstępstwa od zachowania oryginału.** Ticket przywraca wierność, nie zmienia zachowania
  — stąd `#153.1` ma `Do nowej wersji? ✅ TAK`.

## Dowiezione

- `rebuild/backend/src/selly/generator-csv.ts`: nowe `FLAGI_SUROWE` (dziesięć pól,
  `sql<WartoscSurowaFlagi>` po jednym per kolumna) + `.select({ ...getTableColumns(products),
  ...FLAGI_SUROWE })` zamiast gołego `.select()`. `KOLUMNY_BOOL` wyprowadzone z
  `Object.keys(FLAGI_SUROWE)`, więc lista kolumn surowych i lista „Tak"/pusto nie mogą się rozjechać.
  Objęte wszystkie dziesięć kolumn, nie tylko sześć, w których pomiar zastał tekst. Model Drizzle i
  `contract/**` nietknięte. Usunięty nieprawdziwy komentarz nad `KOLUMNY_BOOL` („warunek działa tak
  samo dla obu").
- Testy: 6 nowych przypadków w `test/selly.generator-csv.test.ts`; bez poprawki pada ich pięć (czułość
  sprawdzona cofnięciem warstwy odczytu).
- **GATE / dowód wierności — rozliczony liczbami** (karta wymagała pustego diffa): oba generatory na
  MROŻONEJ kopii bazy stagingu (`better-sqlite3 backup()` z połączenia `readonly`), 5396 = 5396
  produktów, nagłówek 60 kolumn identyczny, 2 454 470 bajtów, **ta sama suma MD5**
  `3f8bec0d9ba03a552910971d5cef79eb`, `diff` PUSTY, brak różnic w jakiejkolwiek kolumnie. Kontrola
  czułości: ten sam pomiar na kodzie sprzed naprawy odtworzył wpis `#153.1` co do wiersza — 899 różnic
  w rozkładzie `Snieg-3PMSF` 750 / `Bloto+snieg` 713 / `CFO` 52 / `NRO` 12 / `CHO` 10.
- Ticket: `154-BUG-csv-selly-flagi-tak`, 2026-09-24. Bramki (`lint`, `typecheck`, `build`, `test`)
  zielone — `112/112` plików, `1849` testów.

## Do koordynatora

- **`src/selly/mapper.ts:197-203` ma dokładnie ten sam błąd i jest świadomie niezałatany** (decyzja
  użytkownika, poza własnością tej karty). Graf wywołań: `POST /api/selly/sync-product`
  (`routes/selly.ts:184`, `produktPoKodzie`) oraz `POST /api/selly/sync-supplier`
  (`routes/selly.ts:262`, `produktyDoSynchronizacji` → `routes/selly.ts:197,275` `naPayloadSelly` →
  `mapper.ts:269` `content_html: zbudujOpisOpony(produkt)` → `mapper.ts:197-203`
  `dodaj("M+S", p.ms ? "tak" : null)`). Dotknięte pola: `ms`, `snow3pmsf`, `reinforced`, `extraLoad`,
  `cutResistant`, `heatResistant`, `stubbleResistant` (mapper nie używa `nro`, `cho`, `cfo`). Szczegóły:
  wpis backlogu `#154.1` (`docs/rebuild-backlog/wpis-154.md`). Wymaga decyzji o przypisaniu zakresu do
  którejś karty Selly REST.
- **Wiersz roadmapy `⛔ przed cutoverem | FIX.1 | ⬜ BLOKADA` (`docs/rebuild-roadmap.md:3489`) do
  przestawienia na zrobione** — karta jest zamknięta (`154-BUG-csv-selly-flagi-tak`, 2026-09-24).
- **`db/snapshot.db` w repo (13.08) nie odtwarza tej klasy usterek** — w tych dziesięciu kolumnach ma
  tylko `integer 0/1` i `null`, zero tekstu. Kto będzie dowodził czegokolwiek o mieszanych typach, musi
  wziąć kopię produkcji, nie ten snapshot.
