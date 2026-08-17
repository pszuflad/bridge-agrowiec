# Schemat bazy jako kod (Krok 2.5)

Kanoniczny, odtwarzalny schemat produkcyjnej bazy Bridge — źródło prawdy o strukturze
danych dla odbudowy backendu.

## Pliki

| Plik | Co |
|---|---|
| `001_schema.sql` | Kompletny schemat: 26 tabel + 13 indeksów, idempotentny (`IF NOT EXISTS`) |

## Skąd pochodzi

`sqlite3 data.db .schema` z produkcji (2026-08-17) → oczyszczony:
- dodane `IF NOT EXISTS` (idempotencja),
- usunięte `sqlite_sequence` (SQLite tworzy je sam przy `AUTOINCREMENT`),
- reszta **verbatim** z żywej bazy (łącznie z komentarzami w tabelach Selly).

## ⭐ Ten plik DOMYKA DRYF

W starym systemie część obiektów istniała tylko w produkcyjnej bazie, bo powstały
**ręcznie albo jednorazowymi skryptami**, a nie przez kod aplikacji (patrz
`docs/spec-backend.md §3`). Na czystej instalacji stary kod by się o nie wywrócił.
Tutaj **wszystko powstaje z kodu**:

- **Tabele wcześniej dryfujące:** `atrybuty_wartosci_pending`,
  `atrybuty_wartosci_odrzucone`, `selly_kategoria_norm_map`,
  `selly_zastosowanie_category_map`.
- **Kolumny `products` dopięte historycznie ALTER-em** (tu inline w `CREATE`):
  `link_zdjecia, oznaczenie_bieznika, sezon, ms, snow_3pmsf, wentyl, cfo,
  wysokosc_przesylki, zastosowanie, kod_importu, nieobecnosc_pod_rzad`.

## Weryfikacja (wykonana)

Świeża baza utworzona z `001_schema.sql` porównana ze snapshotem produkcji:

```
produkcja:  26 tabel, 13 indeksów, products 72 kolumny
z migracji: 26 tabel, 13 indeksów, products 72 kolumny
TABELE identyczne: True   KOLUMNY products: True   INDEKSY: 13=13
Tabele z różną definicją: BRAK — wszystkie identyczne ✅
```

Odtworzenie testu:
```bash
python3 - <<'EOF'
import sqlite3
c=sqlite3.connect(':memory:'); c.executescript(open('rebuild/schema/001_schema.sql').read())
print(len([r for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]),'tabel')
EOF
```

## Drizzle (do odbudowy backendu)

Nowy backend używa Drizzle ORM. **Nie pisz `schema.ts` ręcznie** (26 tabel = ryzyko
błędu). Gdy zescaffoldujemy `rebuild/backend`, wygeneruj go introspekcją z bazy:

```bash
npx drizzle-kit introspect   # (lub: drizzle-kit pull) — czyta strukturę z data.db
```

`001_schema.sql` jest źródłem prawdy; Drizzle `schema.ts` z niego wynika, nie odwrotnie.

## Uwaga o migracjach przyrostowych

Produkcja dokłada kolumny idempotentną funkcją `bw()` (w bundlu) — np. sierpniowa
`nieobecnosc_pod_rzad`. W odbudowie odpowiednikiem będą **numerowane migracje**
(`002_*.sql`, `003_*.sql`). `001_schema.sql` to punkt zerowy = stan produkcji na 2026-08-17.
