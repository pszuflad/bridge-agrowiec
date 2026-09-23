## Problem

Staging stał na wydaniu z 22.09, choć zbudowało się sześć nowszych. Każdy deploy przerywał się po
kopii bazy, bez śladu w logu: `npm run migrate` padał na

```
SqliteError: there is already another table or index with this name: selly_products_old
```

Winowajcą był `007_selly_products_warianty.sql` — plik z gałęzi cofniętej commitem `48d8d84`
(migracja wróciła później jako `013_…` z warunkiem pomijania). `tsc` nie czyści `dist/`, a skrypty
kopiujące tylko nadpisywały pliki, więc widmo przeżyło revert w katalogu roboczym deployu i jechało
do każdego wydania. Runner stosuje migracje **po nazwie**, więc widmo pod starą nazwą wyglądało na
niezastosowane i leciało drugi raz. Baza nietknięta — migracje idą w transakcji.

## Zmiana

- `scripts/copy-schema.mjs` i `scripts/copy-parsery.mjs` kasują katalog docelowy przed kopiowaniem.
  Dla `dist/import/legacy/` bezpieczne, bo `src/import/legacy/**` nie ma plików `.ts` (zastrzeżenie
  w komentarzu, gdyby kiedyś doszły).
- `docs/cutover.md`: nowy krok **4a** — przed migracją produkcji potwierdź, że `dist/schema` zgadza
  się z `rebuild/schema`; oraz wynik audytu środowiska stagingu z 2026-09-24 w §3a.
- `docs/tickets/147-…/raport.md` — pełna diagnoza.

## Dowód

```
$ touch dist/schema/007_widmo.sql && npm run build && ls dist/schema | grep -c widmo
0
```

Bramki backendu: lint ✅ typecheck ✅ build ✅ test ✅ (112 plików, 1837 testów).
Staging po naprawie: wydanie `c0ee7a5`, migracja `012_staging_polityka.sql` zastosowana, health 200.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
