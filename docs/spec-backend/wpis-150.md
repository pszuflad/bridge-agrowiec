# Wpis do spec-backend od ticketu 150 (karta TEST.2) · 2026-09-24

**Sekcja:** §2 (panel Selly — eksport CSV; uzupełnia `wpis-122.md`, czytać razem z `wpis-153.md`
i wpisem backlogu `#153.1`).

## Potwierdzone w 150: zgodność FORMATU pliku CSV, przy zastrzeżeniu co do TREŚCI

Generator CSV nowego stosu (`rebuild/backend/src/selly/generator-csv.ts`, `npm run selly:csv`)
porównano z produkcyjnym `generate_selly_export.cjs` **uruchomionym na tej samej bazie**.

**Wynik zależy od zawartości bazy i trzeba podawać go razem z nią:**

| Baza | Wynik |
|---|---|
| `db/snapshot.db` (produkcja 13.08) + migracje 001–013 | **identyczne bajt w bajt** — ten sam sha256, 6899 linii, 3 177 786 B, 60 kolumn, 6898 pozycji |
| kopia produkcji z 23.09 (staging), pomiar ticketu 153 | **899 wierszy różnych** w pięciu kolumnach flagowych (`#153.1`) |

**Oba wyniki są prawdziwe.** Na snapshocie z 13.08 wszystkie dziesięć kolumn flagowych
(`reinforced`, `extra_load`, `cut_resistant`, `heat_resistant`, `stubble_resistant`, `nro`,
`cho`, `ms`, `snow_3pmsf`, `cfo`) ma **wyłącznie typ `integer`** — zmierzone. Wartości tekstowe
`'Tak'`, które wyzwalają błąd opisany w `#153.1` (Drizzle `integer({ mode: "boolean" })` mapuje
`'Tak'` na `false`), weszły do bazy **po 13.08**, więc na tym snapshocie defekt nie ma jak się
ujawnić.

**Co z tego wynika jako fakt o backendzie:**
- **format pliku jest odtworzony wiernie** — 60 kolumn w tej samej kolejności, separator `;`,
  BOM UTF-8, `\r\n`, kolumna `Blokowane-formy-platnosci` wypełniona; przy danych bez wartości
  tekstowych wyjście jest bajtowo nieodróżnialne od produkcyjnego;
- **rozjazd z `#153.1` leży w warstwie ODCZYTU, nie w formatowaniu.** Logika składania wiersza
  jest w obu generatorach identyczna; różni je to, że produkcja czyta `SELECT *` przez
  `better-sqlite3` (wartość surowa), a odbudowa przez model Drizzle (wartość zmapowana).
  To ten sam wzorzec, który `CLAUDE.md` opisuje pod hasłem „projekcja Drizzle".

## ⚠ Metoda pomiaru — dwie rzeczy, które trzeba wiedzieć, zanim się go powtórzy

**1. Oryginał bierze się z `origin/main`, nie z gałęzi roboczej.** W `develop` katalog `mirror/`
jest **świadomie cofnięty do stanu z 25.08** (commit `6594525`, bramki wierności), więc
`mirror/backend/generate_selly_export.cjs` ma tam 59 kolumn — o jedną mniej niż produkcja.
Porównanie z tą wersją pokazuje **nieistniejącą** różnicę „59 kontra 60 kolumn" (ticket 153
wszedł w to przy pierwszym podejściu). Sprawdzone: `88fa31c` i `origin/main` dają tu plik
identyczny.

**2. Zerowy `diff` podważa się tak samo jak niezerowy.** Ten ticket sprawdził nietrywialność
dowodu (60. kolumna wypełniona we wszystkich 6898 wierszach, 5469 linii z polskimi znakami,
BOM obecny) — ale **nie sprawdził rozkładu TYPÓW w kolumnach flagowych**, a to była właściwa
kontrola i jej brak dał wynik mylący. Reguła na przyszłość: **zanim uznasz porównanie za
zielone, upewnij się, że dane zawierają przypadek, który mógłby je zapalić na czerwono.**
Porównanie generatorów prowadzi się **na bazie stagingu**, nie na sierpniowym snapshocie —
snapshot nadaje się do orzekania o formacie, nie o wierności na dzisiejszych danych.

## Zasięg

Pomiar jednorazowy, wykonany poza repo, niczego nie zmienia w kodzie. Stałą strażą w CI pozostaje
wyłącznie wiersz nagłówkowy (`rebuild/backend/test/selly.generator-csv.test.ts`, `wpis-122.md`) —
i to jest powód, dla którego `#153.1` nie został złapany automatycznie. Zamiana pełnego
porównania w straż CI: follow-up, postawiony Ani jako pytanie w
`docs/instrukcja-testu-sciezki-krytycznej.md` („Do Twojej decyzji" p. 3).

Przebieg z komendami: `docs/tickets/150-DOCS-test-sciezki-krytycznej/dowod-csv.md`
(wariant na snapshocie) i `docs/tickets/153-DOCS-flagi-tak-w-csv/raport.md` (wariant na stagingu,
referencyjny).
