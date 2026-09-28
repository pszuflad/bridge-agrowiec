# Wpis do spec-backend od ticketu 126 (karta P10.5) · 2026-09-23

**Sekcja:** §2 (trasy analityki, `/api/analytics/*`) — świadome odstępstwo od oryginału.

**Odstępstwo w 126** (`126-FEATURE-pelne-pliki-csv-analityki`, 2026-09-23, karta P10.5, backlog #96,
decyzja Ani 2026-09-23 „chcę pełne pliki"): **osiem** tras analityki (`ean/unique`, `ean/comparison`,
`availability/products`, `availability/sell-through`, `suppliers/lifecycle`, `prices/last-import`,
`rotation/inactive`, `margins`) przyjmuje opcjonalny query param `?limit`. To **nie jest port
oryginału** — produkcja tego parametru nie ma.

**Semantyka.** Jedyna wartość ze znaczeniem to dosłowne `"0"` = BRAK klauzuli `LIMIT` w SQL-u.
Mapowanie w `czyBezLimitu()` (`rebuild/backend/src/repos/analityka.ts`) zwraca `boolean`, więc
dosłowne SQL-owe `LIMIT 0` (zero wierszy) nie jest osiągalne przez ten parametr. Każda inna wartość
— brak parametru, `""`, `"1"`, `"500"`, `"abc"`, `"00"`, tablica z powtórzonego parametru — trasa
używa swojego oryginalnego limitu, 1:1 jak przed ticketem.

**Wzorzec wierności.** Limit stał się domyślną wartością ostatniego parametru funkcji repo
(`bezLimitu = false`), więc „bez parametru = 1:1 z oryginałem" wynika z sygnatury funkcji, nie z
dyscypliny wywołującego (ten sam idiom co `listaWartosci`, sprzed ticketu).

**Dwie osobliwości warte zapamiętania:**
- `marze()` ma DWA limity — `LIMIT_GRUP_MARZY` (1000, pole `rows`, jedyne wchodzące do CSV) i
  `LIMIT_LISTY_MARZY` (200, pola `low`/`high`, poza CSV, poza zakresem). `?limit=0` zdejmuje
  wyłącznie pierwszy.
- `dostepnoscProduktow()` ma dwie gałęzie SQL (główna z `historia_cen`, fallback z katalogu) —
  obie respektują parametr.

**Znalezisko ticketu — luka w testach, nie w kodzie.** Przed tym ticketem żaden test nie bronił
liczbowych wartości stałych `LIMIT_*`: fixtures nagrane są na zbiorach, które w sufit nie uderzają,
a GATE porównuje kształt odpowiedzi, nie liczbę wierszy. Zmiana stałej np. z 1000 na 900
przechodziłaby całą bramkę bez śladu. Zamyka to nowy `rebuild/backend/test/analityka.limity.test.ts`
— dla każdej z ośmiu tras wstawia zbiór ponad sufitem i sprawdza obie strony (bez parametru =
dokładnie `LIMIT`, z `?limit=0` = wszystko). Morał ogólny: fixture nagrany poniżej limitu nie
dowodzi limitu.

**Pomiar na `db/snapshot.db` (2026-08-13)** — liczba wierszy w pliku CSV przed/po, czas zapytania
bez limitu i rozmiar JSON:

| Widok | Sufit | Plik PRZED | Plik PO | Czas bez limitu | JSON |
|---|---:|---:|---:|---:|---:|
| `unique` | 1000 | 1000 | 5109 | 31 ms | 597 KB |
| `availability-products` | 500 | 500 | 5184 | 47 ms | 825 KB |
| `sell-through` | 500 | 500 | 5184 | 77 ms | 513 KB |
| `suppliers-lifecycle` | 500 | 500 | 1716 | 5 ms | 307 KB |
| `prices-last` | 500 | 500 | 1644 | 8 ms | 292 KB |
| `rotation-inactive` (`days=60`) | 1000 | 1000 | 1100 | 7 ms | 225 KB |
| `ean-comparison` | 1000 | 769 | 769 | 16 ms | 139 KB |
| `margins` | 1000 | 335 | 335 | 12 ms | 37 KB |

Najcięższe zapytanie bez limitu to 77 ms / 825 KB JSON — zdjęcie sufitu nie zagraża czasowi
odpowiedzi przy obecnym wolumenie danych. Podstawa pomiaru: wyłącznie `db/snapshot.db`
(2026-08-13); na świeższej kopii liczby będą inne, mechanizm bez zmian. Szczegóły:
`docs/tickets/126-FEATURE-pelne-pliki-csv-analityki/`.
