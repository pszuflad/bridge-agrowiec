# Wpis do spec-backend od ticketu 168 (`168-DOCS-pamiec-nazw-i-demo`) · 2026-09-30

**Sekcja:** §5 (import / staging — skąd bierze się nazwa produktu w katalogu).

**Potwierdzone w 168** (`168-DOCS-pamiec-nazw-i-demo`, 2026-09-30, na podstawie czytania kodu
i istniejącego scenariusza charakteryzacji; **nie** na danych produkcyjnych): nazwa produktu w
katalogu (`products.nazwa`) nie jest zapisana „na stałe" — każdy import wylicza ją od nowa i
porównuje z katalogiem. Różnica wchodzi do stagingu jako „zmiana danych: nazwa".

## Kolejność nakładania nazwy przy imporcie (produkt już w katalogu)

`rebuild/backend/src/import/polityka/fabryka.ts`, gałąź `if (biezacy)`. Każda kolejna warstwa
może PODMIENIĆ nazwę z poprzedniej:

1. nazwa z pliku dostawcy (parser + `adapter.recordsToSurowe`),
2. `nazwa_pamiec` — jeśli jest wpis dla `kod_importu` produktu, nazwa jest zastępowana
   zapamiętaną, **bezwarunkowo** (`applyNazwaPamiec`, `legacy/bridge_ext.cjs:189`),
3. `manual_overrides` (poprawki Marty), pole `nazwa` dla `(dostawca, kod)` — zastępuje
   wszystko powyższe, **po cichu** (`legacy/staging_policy.cjs:158`, `protect`),
4. reguła DEMO (`polityka/nazwa-demo.ts`, od PR #210) — jeśli kod dostawcy zawiera „demo",
   nazwa kończy się słowem „DEMO"; nakładana jako ostatnia, idempotentna.

## Kolejność przy akceptacji wiersza stagingu

`rebuild/backend/src/import/akceptacja.ts`, `zatwierdzPozycjeStagingu`:

- rekord dostaje nazwę ze stagingu (`pozycja.nazwa` — wynik kroków 1–4 z importu),
- następnie **ponownie** `applyNazwaPamiec` (jeśli jest wpis dla `kod_importu`),
- `manual_overrides` **nie są tu nakładane ponownie** (akceptacja czyta je tylko po to, żeby
  zapisać `acknowledgedSourceValue` przy konflikcie),
- na końcu reguła DEMO.

Skutek: akceptacja może zapisać do katalogu INNĄ nazwę niż ta, którą operator widział w
stagingu — gdy produkt ma wpis w `nazwa_pamiec`. Dowód zachowania oryginału: scenariusz
`pamiec-nazwy-nadpisuje-nazwe-z-pliku`
(`rebuild/backend/test/charakteryzacja/akceptacja/scenariusze.mjs`).

## Skąd są wpisy w `nazwa_pamiec`

- w oryginale nie tworzy ich żaden kod obsługujący aplikację (`rememberNazwaPamiec` jest
  zdefiniowana w `bridge_ext.cjs`, ale nie ma wywołań w `mirror/backend/index.cjs`);
- powstały jednorazowo skryptem `mirror/backend/create_name_memory.cjs` (źródło
  `scalanie_2026-07-20`): dla każdej grupy `kod_importu` z więcej niż jednym produktem i JEDNĄ
  wspólną nazwą zapamiętano tę nazwę jako docelową;
- odbudowa tylko CZYTA tę tabelę (`applyNazwaPamiec`), nic jej nie zapisuje.

## Konsekwencje dla zmian dotyczących nazwy

Zmiana, która modyfikuje nazwę produktu (nowa reguła dopisku, ręczne poprawki masowe,
czyszczenie nazw), musi być sprawdzona wobec CAŁEGO łańcucha 1–4 oraz kroku akceptacji.
Sam import z „nową nazwą" nie wystarczy: produkt z wpisem w `nazwa_pamiec` albo poprawką
`nazwa` w `manual_overrides` zachowa dotychczasową nazwę, a zmiana nie wejdzie do stagingu
(albo wejdzie i po akceptacji zostanie cofnięta). Przykład: reguła DEMO z PR #210 ma
ostatni krok właśnie dlatego, że bez niego pamięć i poprawki zdejmowały „DEMO".

Ticket 164 (poprawione nazwy sklejonych opon) wgrywa poprawki przez `manual_overrides`;
otwarte ryzyko dla akceptacji opisuje `docs/rebuild-backlog/wpis-168.md` (#168.1).
