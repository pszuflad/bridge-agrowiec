# FIX.1 — CSV dla Selly ma czytać flagi surowo (wpis backlogu #153.1)

> **Stan:** ⬜ do zrobienia — **blokada cutoveru**
> **Iteracja:** poza iteracjami (naprawa przed przełączeniem) · **Wpisy backlogu:** #153.1 · **Zależy od:** —
> **Ticket:** —

Założona przez koordynatora ticketem `153-DOCS-flagi-tak-w-csv`, 2026-09-24, po pomiarze na stagingu.

## Zakres

Generator CSV (`src/selly/generator-csv.ts`) gubi pięć flag zapisanych w bazie jako **tekst `'Tak'`**,
bo czyta produkty przez Drizzle, gdzie kolumny są w trybie boolean, a `Number('Tak') === 1` to `false`.
Produkcyjny skrypt czyta `SELECT *` przez `better-sqlite3` i dostaje surową wartość. Pomiar, liczby
i tabela typów: `docs/rebuild-backlog/wpis-153.md`.

**Zadanie:** CSV ma wypisywać `Tak` wszędzie tam, gdzie wypisuje je produkcja — czyli dla wartości
`1` ORAZ dla tekstu `'Tak'` (i dowolnej innej niepustej wartości, bo oryginał robi zwykłe `v ? …`).

⚠ **Modelu Drizzle NIE zmieniamy.** Oryginał ma te kolumny w trybie boolean
(`deminified/backend-index.cjs:43733-43752`), więc produkcyjne `GET /api/products` zwraca na `'Tak'`
dokładnie to samo `false` co my — API jest wierne i ma takie zostać. Zmiana modelu naprawiłaby CSV
kosztem rozjazdu z `contract/fixtures/GET_products.json`. Poprawka siedzi w warstwie odczytu
generatora CSV, nie w schemacie.

Dziesięć kolumn objętych `KOLUMNY_BOOL`: `reinforced`, `extra_load`, `cut_resistant`,
`heat_resistant`, `stubble_resistant`, `nro`, `cho`, `ms`, `snow_3pmsf`, `cfo`. Pomiar pokazał tekst
`'Tak'` w sześciu z nich (także `stubble_resistant`, jeden wiersz, nieaktywny) — popraw wszystkie
dziesięć, bo kolejny import może wstawić tekst do każdej.

## Dowód wierności (obowiązkowy w tym tickecie)

Nie wystarczy test jednostkowy. Ticket ma powtórzyć pomiar z wpisu #153.1 **na stagingu**:
generator produkcji z `origin/main` i nowy generator, ta sama baza, ten sam moment, `diff` pustego
wyniku. Procedura z komendami jest w `docs/karty/TEST.2/karta.md` i w raporcie ticketu 153.
⚠ Skrypt produkcji ma zaszyte ścieżki produkcyjne (`DB_PATH`, katalog eksportu) — uruchamia się
WYŁĄCZNIE kopię z podmienionymi trzema stałymi, nigdy oryginał.

⚠ Uwaga na źródło: w `develop` katalog `mirror/` jest cofnięty do stanu z 25.08 (commit `6594525`,
bramki wierności), więc żywy generator produkcji bierze się z `origin/main`, nie z gałęzi roboczej.

## Pliki (wyłączna własność)
`rebuild/backend/src/selly/generator-csv.ts`, `rebuild/backend/test/selly.generator-csv.test.ts`,
`docs/karty/FIX.1/karta.md`, `docs/tickets/<ID>/**`.
NIE: `src/db/schema.ts` (patrz wyżej), `mirror/**`.

## Decyzje
—

## Dowiezione
—

## Do koordynatora
—
