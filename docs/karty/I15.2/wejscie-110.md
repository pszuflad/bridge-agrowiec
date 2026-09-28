# Wejście dla I15.2 od ticketu 110 (koordynator, triaż 22.09 wieczór) · 2026-09-22

⚠ Produkcja dołożyła 22.09 dwie duże zmiany (backlog **#103** „braki w cenniku / bezpieczeństwo źródła”
i **#104** „dostępność: brak = wstrzymany/0”), commity `3f00533` i `abe5f14`. Źródło prawdy dla całego I15 to
teraz **`origin/main` na `abe5f14`**, nie `7d6cfc9`. Poniżej zakres, który dochodzi do tej karty.

**Dochodzi do zakresu (z #103):**
- `parsers/dispatcher.cjs` — **usunięty cichy fallback do starych parserów** przy imporcie z URL i ręcznym;
- `parsers/mo2_jmk.cjs` — JMK nie łączy i nie sumuje wierszy po samym EAN;
- `parsers/mo9_agrorami_api.cjs`, `parsers/mo9_agrorami.cjs`, `parsers/_agrorami_fetch_helper.cjs` — pełny zapis JSON
  przed zamknięciem procesu, kontrola liczby i unikalności produktów, kontrola postępu pobierania, import rdzenia bez
  pobierania nieużywanego starego CSV;
- `parsers/adapter.cjs` — przenoszenie informacji o kompletności i wierszach odfiltrowanych dalej (dispatcher → adapter → silnik);
- **`feed_safety.cjs` (NOWY moduł, ta karta go portuje do `legacy/`)** — `attach(supplier, result)` rzuca wyjątek przy
  pustym cenniku i przy błędach parsera, dokleja do tablicy rekordów niewyliczalne `_bridgeFeedMeta`
  (`complete`, `parserErrors`, `source`, `rawCount`, `excludedCodes`); `converted()` niesie meta do adaptera.
  Silnik (`tk.ts`) konsumuje te dane w karcie I15.4 — Ty dostarczasz moduł i wpięcie po stronie parserów.

**Test akceptacyjny bez zmian:** `porownaj-parsery.cjs` na 8 cennikach, zero różnic w polach — ale teraz wobec
potoku z `abe5f14`. ⚠ Nowy fallback usunięty: sprawdź, czy skrypt porównawczy nie polegał na starej ścieżce.
