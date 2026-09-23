# 147-CHORE — `copy-schema.mjs`/`copy-parsery.mjs` czyszczą katalog docelowy

Data: 2026-09-24. Znalezione przy audycie środowiska stagingu przed testami Ani.

## Objaw

Staging serwował wydanie `ca51238` z **22.09 13:59**, mimo że w `releases/` leżało sześć nowszych
buildów (`b0bccac`, `28fc876`, `ba4667d`, `78de6fe`, `18b0468`, …). Każdy wpis w `deploy.log` urywał się
w tym samym miejscu:

```
kopia bazy przed migracjami
kopia-bazy: do zastosowania 2 migracji (007_selly_products_warianty.sql, 012_staging_polityka.sql)
kopia-bazy: gotowe (52.3 MB)
<koniec wpisu>
```

Deploy nie zgłaszał błędu, bo `npm run migrate` w `tools/deploy-staging.sh:120` nie idzie przez `tee`
do logu — `set -e` ucinał skrypt, a przyczyna szła na stdout sesji SSH, której nikt nie czytał.

## Przyczyna

Ręczne uruchomienie migracji na wydaniu pokazało:

```
SqliteError: there is already another table or index with this name: selly_products_old
```

`007_selly_products_warianty.sql` **nie istnieje w repo** — to plik z gałęzi
`feature/45-selly-rest-sync-tor1`, cofniętej commitem `48d8d84`; migracja wróciła później jako
`013_selly_products_warianty.sql` z dyrektywą `@pomin-jesli-typ-kolumny` (karta I15.1, ticket 107).

Plik przeżył revert **w katalogu roboczym deployu**: `tsc` nie czyści `dist/`, a `copy-schema.mjs`
tylko nadpisywał pliki jednoimienne. Widmo było więc kopiowane do każdego nowego wydania. Runner
(`src/db/migrate.ts`) stosuje migracje **po nazwie pliku**, a `007_selly_products_warianty.sql`
w `_migracje` nie figuruje (jest tam `013_…`) — więc leciał drugi raz, w starej wersji bez warunku,
i padał na `ALTER TABLE selly_products RENAME TO selly_products_old`.

**Baza nie ucierpiała** — runner opakowuje każdą migrację w transakcję, więc każda z sześciu prób
wycofała się w całości.

## Poprawka

`copy-schema.mjs` i `copy-parsery.mjs` kasują katalog docelowy (`rmSync(dest, {recursive, force})`)
przed kopiowaniem. Dla `dist/import/legacy/` jest to bezpieczne, bo `src/import/legacy/**` nie ma
plików `.ts` — `tsc` nic tam nie emituje (20 `.cjs`, 1 `.js`, 2 `.json`); zastrzeżenie zapisane
w komentarzu przy `rmSync`.

Do `docs/cutover.md` doszedł krok **4a**: przed migracją produkcji potwierdź, że `dist/schema`
zgadza się z `rebuild/schema`. Widmowa migracja na żywej bazie wykonałaby DDL, którego nie ma w repo.

## Dowód

```
$ touch dist/schema/007_widmo.sql && npm run build && ls dist/schema | grep -c widmo
0
```

Bramki: `lint` ✅ · `typecheck` ✅ · `build` ✅ (13 `.sql`, 23 pliki parserów) · `test` ✅ 112 plików,
1837 testów, 7 pominiętych.

## Stan stagingu po naprawie

`rm -rf repo/rebuild/backend/dist` + `FORCE=1 deploy-staging.sh` → wydanie `c0ee7a5` (czubek
`develop`, z kartą I15.11), migracja `012_staging_polityka.sql` zastosowana jako jedyna brakująca,
`/api/health` 200. Przy okazji uzupełniono `.env` stagingu i dwa brakujące katalogi — wynik audytu
zapisany w `docs/cutover.md` §3a.
