# 182 · Import: meta kompletności cennika ginęła w `zastosujDemoWNazwie` (2026-10-01)

Odkryte przy wdrażaniu 180 na produkcji: 31 kart Handlopexu wstrzymanych automatycznie nie wracało mimo towaru
w cenniku (np. `MO5_BFPR250G75000MBT0` — 4 szt., `MO4_TRRD040E41000T391` — 4 szt.), a `supplier_feed_state` stał od 30.09 11:45.
Eksperyment na kopii bazy prod: import pliku `MO5__20261001__16554` → `pominieteWycofania: "Niepotwierdzona kompletność źródła"`.

Przyczyna: `parsujPlik` wołał `zdejmijMeta()` na wyniku `zastosujDemoWNazwie()` (821940b, 2026-09-30), a ta robi `.map()` —
nowa tablica nie ma nieenumerowalnej właściwości `_bridgeFeedMeta`. `meta` = `undefined` → silnik uznawał KAŻDY cennik
za niekompletny: brak pewnych powrotów (`fabryka.ts`, „Pewny powrót”), brak liczenia nieobecności i aktualizacji stanu oferty.

Zmiana: meta zdejmowana z wyniku adaptera przed dopisaniem „DEMO”. Test: `charakteryzacja.test.ts` §5 (9 dostawców,
`meta.complete === true`; bez poprawki 9/9 czerwonych). Bramki zielone (2090 testów).
