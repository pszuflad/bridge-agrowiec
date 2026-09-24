# Wpis do spec-backend od ticketu 154 (karta FIX.1) · 2026-09-24

**Sekcja:** §2 (model danych `products`, odczyt przez Drizzle).

**Potwierdzone w 154** (`154-BUG-csv-selly-flagi-tak`, 2026-09-24, karta `FIX.1`): dziesięć
kolumn flagowych `products` mają w produkcji **mieszane typy**, i to ma konsekwencje dla
każdego, kto je czyta.

## Fakt zmierzony

Kopia produkcji z 23.09, 5396 produktów `status='aktywny'`. Obok `integer 0/1` w tych kolumnach
siedzi **tekst `'Tak'`**: `snow_3pmsf` 750, `ms` 713, `cfo` 52, `nro` 12, `cho` 10,
`stubble_resistant` 1. SQLite na to pozwala mimo deklaracji `INTEGER`.

Dziesiątka kolumn (`boolCols` oryginału, `mirror/backend/generate_selly_export.cjs:76`):
`reinforced`, `extra_load`, `cut_resistant`, `heat_resistant`, `stubble_resistant`, `nro`, `cho`,
`ms`, `snow_3pmsf`, `cfo`.

## Skutek dla odczytu przez Drizzle

Model trzyma je jako `integer({ mode: "boolean" })` (`src/db/schema.ts:71-99`), mapper robi
`Number(v) === 1`, więc **tekst `'Tak'` daje `false`**. Kto odwzorowuje `SELECT *` oryginału
(a nie `GET /api/products`), musi czytać te kolumny surowo, mijając ten mapper.

## Jak czytać surowo w tym stosie

`sql<T>\`${products.<pole>}\`` w projekcji `select({...})`. Mechanizm: `mapResultRow`
(`node_modules/drizzle-orm/utils.cjs:40`, wybór dekodera `:45-52`, użycie `:63`) bierze dekoder
z TYPU pola — `is(field, Column)` daje `column.mapFromDriverValue`, a `is(field, SQL)` daje
`field.decoder`, którym bez `.mapWith()` jest `noopDecoder` = `{ mapFromDriverValue: (value) =>
value }` (`node_modules/drizzle-orm/sql/sql.cjs:296-298`).

⚠ **Mapper jest w KORZENIU paczki `drizzle-orm`, nie w `sqlite-core/`** — ta ścieżka została w
tym tickecie raz zacytowana błędnie (jako `sqlite-core/utils.cjs`) i wyłapał to code review.
Zweryfikowane bezpośrednio w `node_modules/drizzle-orm` 0.45.2.

## Powinowactwo typów SQLite ogranicza zbiór możliwych wartości

Niedoceniany fakt: kolumna z deklaracją `INTEGER` **konwertuje przy zapisie** napis dający się
przeczytać jako liczba. Zmierzone na tym samym silniku:

| Zapisywana wartość | `typeof` w kolumnie | Wynik w CSV (`v ? "Tak" : ""`) |
|---|---|---|
| `'0'` | `integer` (0) | pusto |
| `'1'` | `integer` (1) | `Tak` |
| `'Tak'` | `text` | `Tak` |
| `'Nie'` | `text` | `Tak` |
| `''` | `text` | pusto |

Czyli w tych kolumnach **tekstowe `'0'` NIE ISTNIEJE** — realny zbiór wartości to `NULL`,
`integer 0`, `integer 1`, oraz tekst nieliczbowy (w praktyce `'Tak'`).

## Reguła prawdziwości oryginału

`v ? 'Tak' : ''` na wartości surowej (`generate_selly_export.cjs:127-131`) — patrzy na
**pustość**, nie na treść. Nie wolno jej zawężać do `v === 1 || v === 'Tak'`, bo to zawężenie
odstąpiłoby od oryginału na brzegach `'0'`/`'Nie'` (dziś teoretycznych, niezmierzonych w bazie).

## Czego NIE zmieniać

Modelu Drizzle. Oryginał też trzyma te kolumny w trybie boolean
(`deminified/backend-index.cjs:43733-43752`), więc produkcyjne `GET /api/products` zwraca
`false` na `'Tak'` — i tak ma zostać, zgodnie z `contract/fixtures/GET_products.json`.
Rozróżnienie jest sedno: **API jest wierne, gdy mapuje; plik CSV jest wierny, gdy NIE mapuje.**

## Gdzie naprawione, gdzie nie

Naprawione w `src/selly/generator-csv.ts` (ticket 154, dziesięć kolumn czytanych przez
`FLAGI_SUROWE`). **Niezałatane w `src/selly/mapper.ts:197-203`** (tabela atrybutów do sync
REST) — ta funkcja czyta te same flagi z tego samego typu `ProduktWewnetrzny` (`p.ms ? "tak" :
null` itd.), więc dla tych samych produktów gubi `M+S`, `3PMSF`, `Reinforced`, `Extra Load` i
trzy odpornościowe. Zgłoszone jako wpis backlogu `#154.1`, poza zakresem karty `FIX.1`.

Szczegóły: `docs/tickets/154-BUG-csv-selly-flagi-tak/`.
