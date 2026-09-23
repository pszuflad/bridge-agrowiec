## Znalezione

Porównanie CSV wygenerowanego z **tej samej bazy** przez generator produkcji (`origin/main`) i przez
nowy stos: 5396 = 5396 produktów, nagłówek identyczny, ale **899 wierszy (17%) się różni** — wyłącznie
w pięciu flagach: `Snieg-3PMSF` (750), `Bloto+snieg` (713), `CFO` (52), `NRO` (12), `CHO` (10).

**Przyczyna:** w `products` te kolumny mają mieszane typy — obok `0`/`1` jest **tekst `'Tak'`**
(np. `snow_3pmsf`: 1337 wierszy tekstem, 221 liczbą). Nasz generator czyta przez Drizzle, gdzie
kolumny są `integer({ mode: "boolean" })`, a mapper robi `Number(value) === 1` → `'Tak'` daje `false`
→ pusta komórka. Produkcyjny generator CSV to osobny skrypt na `SELECT *` przez `better-sqlite3`,
więc dostaje surowe `'Tak'`. Logika formatowania w obu jest identyczna; różni się warstwa odczytu.

**Modelu nie ruszamy:** oryginał trzyma te kolumny w trybie boolean (`deminified/backend-index.cjs:43733-43752`),
więc produkcyjne `GET /api/products` zwraca na `'Tak'` to samo `false` co nasze — API jest wierne.
Poprawka należy wyłącznie do generatora CSV.

**Skutek, gdyby przeszło:** sklep dostaje 17% katalogu bez oznaczeń opon zimowych i specjalistycznych,
przy poprawnym nagłówku, poprawnej liczbie wierszy i poprawnych cenach. Nic nie zgłasza błędu.

## Zmiany (same dokumenty)

- `docs/rebuild-backlog/wpis-153.md` — wpis `#153.1` z pomiarem i tabelą typów w bazie.
- `docs/karty/FIX.1/karta.md` — karta poprawki, oznaczona jako **blokada cutoveru**.
- `docs/karty/TEST.2/wejscie-153.md` — metoda porównania CSV jest rozstrzygnięta (karta miała ją
  dopiero wybrać); plus dwie pułapki: `mirror/` na `develop` jest cofnięty do 25.08, a sam `diff`
  bez rozkładu na kolumny nie mówi nic.
- `docs/tickets/153-DOCS-flagi-tak-w-csv/raport.md` — procedura z komendami, odtwarzalna.
- `docs/rebuild-roadmap.md` — FIX.1 w tabeli faz jako blokada przed cutoverem.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
