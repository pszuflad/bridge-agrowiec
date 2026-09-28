# Wpisy backlogu od ticketu 153 · 2026-09-24

### #153.1 — CSV dla Selly gubi flagi zapisane jako tekst `'Tak'` (899 z 5396 wierszy)

**Status:** ✅ naprawione 2026-09-24 (`154-BUG-csv-selly-flagi-tak`) — dowód: pusty diff, identyczne MD5
**Do nowej wersji?** ✅ TAK (to nie jest zmiana zachowania, tylko przywrócenie wierności)
**Źródło:** pomiar na stagingu 2026-09-24 (baza = kopia produkcji z 23.09), ticket 153.

## Objaw

Porównanie plików CSV wygenerowanych **z tej samej bazy** przez generator produkcji
(`origin/main:mirror/backend/generate_selly_export.cjs`) i przez nowy stos
(`node dist/selly/csv-cli.js`):

- liczba produktów: **5396 = 5396**, nagłówek 60 kolumn **identyczny**,
- różni się **899 wierszy**, wyłącznie w pięciu kolumnach flagowych:

| Kolumna CSV | Wierszy z różnicą | Produkcja | Nowy stos |
|---|---|---|---|
| `Snieg-3PMSF` | 750 | `Tak` | pusto |
| `Bloto+snieg` | 713 | `Tak` | pusto |
| `CFO` | 52 | `Tak` | pusto |
| `NRO` | 12 | `Tak` | pusto |
| `CHO` | 10 | `Tak` | pusto |

(suma kolumn > 899, bo `ms` i `snow_3pmsf` zwykle idą parą w jednym wierszu)

## Przyczyna

W bazie te kolumny mają **mieszane typy** — SQLite na to pozwala mimo deklaracji `INTEGER`.
Zmierzone w `products` na kopii produkcji:

| Kolumna | `integer 0` | `integer 1` | `text 'Tak'` |
|---|---|---|---|
| `ms` | 103 | 224 | **1290** |
| `snow_3pmsf` | 105 | 221 | **1337** |
| `cfo` | 110 | 8 | **56** |
| `nro` | 115 | 13 | **16** |
| `cho` | 115 | 3 | **11** |
| `stubble_resistant` | 113 | — | 1 |

Nasz generator czyta produkty przez Drizzle, gdzie te kolumny są zadeklarowane jako
`integer({ mode: "boolean" })` (`src/db/schema.ts:71-77`). Drizzle mapuje wartość przez
`Number(value) === 1`, więc **tekst `'Tak'` daje `false`**, a `wartosc ? "Tak" : ""` zamienia to
w pustą komórkę. Produkcyjny generator CSV to osobny skrypt czytający `SELECT *` przez
`better-sqlite3` — dostaje surowe `'Tak'` i wypisuje `Tak`.

Logika formatowania jest w obu generatorach **identyczna** — różni się wyłącznie warstwa odczytu.

## ⚠ Czego NIE zmieniać

**Modelu Drizzle ruszać nie wolno.** Oryginał trzyma te same kolumny w trybie boolean
(`deminified/backend-index.cjs:43733-43752` — produkcja też stoi na Drizzle), więc produkcyjne
`GET /api/products` na wartości `'Tak'` zwraca `false` **tak samo jak nasze**. Zmiana modelu
naprawiłaby CSV, ale rozjechałaby API z produkcją i z `contract/fixtures/GET_products.json`.

Poprawka należy **wyłącznie do generatora CSV**: ma czytać te dziesięć kolumn surowo, tak jak
produkcyjny skrypt. To ten sam wniosek co w `CLAUDE.md` („projekcja Drizzle”): dla trasy/pliku,
który ma odwzorować `SELECT *` oryginału, projekcję wypisuje się jawnie.

## Skutek, gdyby przeszło niezauważone

Po cutoverze sklep dostałby 899 pozycji (17% katalogu) bez oznaczeń `Śnieg 3PMSF`, `M+S`, `CFO`,
`NRO`, `CHO` — czyli bez cech, po których klient filtruje opony zimowe i specjalistyczne.
Nic by nie zgłosiło błędu: plik ma poprawny nagłówek, poprawną liczbę wierszy i poprawne ceny.
