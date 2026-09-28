# 9-FEATURE-acceptstaging-endpointy-mutacji — raport z implementacji

## Podsumowanie

Brzeg HTTP silnika importu jest kompletny. `acceptStaging` przenosi pozycję ze stagingu do
katalogu — z potwierdzaniem konfliktów z poprawkami Marty, rozszerzeniami `bridge_ext`
i propagacją `uwagaCena`. Dziewięć tras daje człowiekowi pełny cykl: import → edycja →
akceptacja albo odrzucenie. **Iteracja 3 jest tym samym domknięta po stronie backendu**;
zostaje 3e (widok `/staging`).

Plan A z planu **wypalił**: `acceptStaging` udało się wyciąć z produkcyjnego bundla i uruchomić
na prawdziwej bazie z naszego kanonu, więc dowód jest tej samej klasy co w 3c i 3d-1 —
porównanie zachowania z uruchomionym oryginałem, a nie „przeczytałem i przepisałem".

## Zmiany

**Silnik / logika**
- **Nowe:** `src/import/akceptacja.ts` — port `U.acceptStaging` (`:44827-44910`) plus
  `odrzucPozycjeStagingu`, `wyczyscStaging` i `idPozycjiZFiltrow` (wspólny filtr `allFiltered`).
- `src/repos/overrides.ts` — dopisane `listaPoprawek`, `zapiszPoprawke` (upsert, D5),
  `usunPoprawke`, zgodnie z notą zostawioną przez 3d-1.
- `src/repos/staging.ts` — `zaktualizujPozycjeStagingu`.
- `src/import/silnik/bridge-ext.ts` — most rozszerzony o `assignKodImportu`, `applyNazwaPamiec`,
  `applyWagaPamiec`, `rememberLink` + eksport `bridgeExt` (komplet jako jeden obiekt).

**Trasy**
- **Nowe:** `src/routes/staging-mutacje.ts` — sześć tras (`import`, `accept`, `reject`, `clear`,
  `PUT /{id}`, `DELETE /{id}`).
- **Nowe:** `src/routes/overrides.ts` — trzy trasy (`GET`, `POST`, `DELETE /{id}`).
- `src/app.ts` — rejestracja obu routerów.

**Testy**
- **Nowe:** `test/charakteryzacja/akceptacja/oryginal.mjs` — wycięcie oryginału z bundla,
  `scenariusze.mjs` — 16 scenariuszy, `+ .d.mts` do obu.
- **Nowe:** `test/akceptacja.charakteryzacja.test.ts` (19), `test/staging-mutacje.test.ts` (28),
  `test/overrides.gate.test.ts` (5).

## Odstępstwa od planu

Brak w zakresie. Plan przewidywał plan B na wypadek, gdyby wycięcie `acceptStaging` okazało się
niewykonalne — nie był potrzebny.

## Jak dowodzimy wierności — i czym to się różni od 3d-1

`tk()` dało się wyciąć jako samodzielną funkcję i nakarmić PAMIĘCIOWYMI atrapami warstwy danych.
`acceptStaging` jest metodą w środku obiektu `U = {…}` i rozmawia wprost z Drizzle, więc atrapy
nic by tu nie dały. Zamiast tego wstrzykujemy PRAWDZIWEGO Drizzle na PRAWDZIWEJ bazie z naszego
kanonu — a porównujemy KOŃCOWY STAN DWÓCH IDENTYCZNIE ZASIANYCH BAZ (products, staging_items,
manual_overrides, obie pamięci linków, nazwa_pamiec, waga_pamiec).

Okazało się to mocniejsze niż porównanie śladów wywołań: mierzy skutek, a nie drogę do niego.

**⭐ Charakteryzacja dowodzi przy okazji decyzji D3.** Pomocnicy narzutów
(`__bridgePickMarkup`/`__bridgePickPromo`) są wycięci NAPRAWDĘ, nie jako zaślepki. Oryginał
wykonuje więc pełną gałąź cenową na pustych tabelach `markups`/`promotions` i wychodzi z tym
samym wynikiem, co nasz port, który tej gałęzi nie ma. To nie jest argument z lektury — to
zmierzone. Gdy I4 pozwoli wpisać pierwszą regułę, obie strony natychmiast się rozjadą.

**Normalizacja przy porównaniu obejmuje dwie rzeczy i tylko dwie:** znaczniki czasu oraz
ŚWIEŻO WYLOSOWANY `kod_importu` (`_kiGenUnique` używa `Math.random()`). Numer ODZIEDZICZONY
po grupie normalizacji nie podlega — jest deterministyczny i to on jest w tym miejscu ciekawy.

## Wyniki testów

- **Gate odbudowy:** ✓ **`GET_overrides.json` zielony** — ostatni nieodhaczony fixture
  Iteracji 3. Sprawdzone: kształt 1:1, goła tablica (bez koperty), komplet 9 pól,
  sortowanie `createdAt` malejąco (nagrana próbka to potwierdza: od 06:22:26 do 06:22:00),
  filtr `?dostawca=&kod=`, obecność `acknowledgedSourceValue` w odpowiedzi.
- **Charakteryzacja `acceptStaging`:** ✓ 19 testów, 16 scenariuszy, porównanie stanu siedmiu
  tabel po obu stronach.
- **Endpointy przez HTTP:** ✓ 28 testów — `ids[]` i `allFiltered` z każdym filtrem, 404-ki,
  walidacja, audit log, pełny cykl import → edycja → akceptacja.
- **Regresja:** ✓ charakteryzacja 3a i silnika, GATE I2 (z zadeklarowanym wyjątkiem),
  `GET_staging*.json`, gate treści importu — zielone bez zmian w samych testach.
- **Razem 387 testów** (było 354 na `develop`), `lint` / `typecheck` / `build` czyste.

### Skuteczność bramki — 16 mutacji, wszystkie złapane

`acceptStaging` (9): domyślna kategoria · narzut 1,25 → 1,3 · wycofanie bez zerowania stanu ·
brak potwierdzenia konfliktu · `ean` z `eanRaw` zamiast ze snapshotu · pominięte
`assignKodImportu` · pominięty `rememberLink` · pominięta pamięć nazwy · brak propagacji
`uwagaCena`.

Endpointy (7): pusty import nierozróżniany · filtr overrides bez kompletu pary · `accept`
zachowujący się jak `reject` · D5 (upsert kasujący ack) · `PUT` jawnie zerujący ack ·
`PUT` przyjmujący pola spoza listy · lista overrides rosnąco zamiast malejąco.

**Trzy z nich początkowo NIE zostały złapane — i to była wina testów, nie kodu.** Mutacje
ujawniły, że nie sprawdzałem sortowania listy poprawek, nie sprawdzałem, czy pola spoza listy
edytowalnych nie przeciekają do snapshotu, oraz że mutacja D5 była pozorna (Drizzle ignoruje
`undefined` w `.set()`, więc „zawsze nadpisuj" nic nie zmieniało). Testy zostały wzmocnione,
mutacja poprawiona — dopiero wtedy komplet świeci.

## Napotkane pułapki

**1. `assignKodImportu` czyta `existing.kod_importu` w snake_case**, a `acceptStaging` podaje
tam wiersz z Drizzle (`kodImportu`). Pierwsza reguła („istniejący produkt ma już numer —
zachowaj") NIGDY nie wypala. W praktyce numer i tak się zachowuje, bo reguła druga szuka po
grupie surowym SQL-em. Odtworzone 1:1, opisane w moście.

**2. Drizzle rzuca na nieznane klucze, produkcyjne je ignorowało.** Snapshot z parsera niesie
pola pomocnicze (`_srcConflict`, `rozmiarWykryty`), a oryginał podaje całość Drizzle'owi.
Nasza wersja by się wywróciła, więc rekord przechodzi przez `tylkoKolumnyProduktu()` — most
między dwoma zachowaniami ORM-a, nie zmiana logiki: zapisujemy dokładnie te kolumny, które
zapisałaby produkcja. Charakteryzacja to potwierdza.

**3. Własne narzędzie zniszczyło mi kod.** Pętla testów mutacyjnych przywracała pliki przez
`git checkout -- src/`, co cofnęło zmiany w plikach ŚLEDZONYCH (`bridge-ext.ts`,
`repos/overrides.ts`), a zostawiło mutacje w NIEŚLEDZONYM `akceptacja.ts`. Wyszło to dopiero
przy czerwonych testach. Naprawione: mutacje jadą teraz na kopii katalogu (`cp -a`), a praca
jest commitowana przed testowaniem mutacyjnym.

## Breaking changes

Brak. Wszystkie trasy są nowe; istniejące zachowania nietknięte, migracji nie ma.

## Follow-up

- **I12 — `addProductsBulk` + `POST /api/products`** (decyzja D1). Trasa ma dowieźć też
  `assignKodImportu`, `applyDims`, `applyLinkMemory`, `applyNazwaPamiec`, `applyWagaPamiec` —
  port `bridge_ext` czeka gotowy w repo, most typuje już wszystkie potrzebne funkcje.
- **`__restoreZastosowanie()` — luka bez właściciela** (decyzja D2). `POST /api/staging/accept`
  woła ją w produkcji po każdej akceptacji: czyta CSV z zahardkodowanej ścieżki produkcyjnej
  i uzupełnia PUSTE `products.zastosowanie`. Zapisane w roadmapie z podejrzeniem, że to OBJAW
  — warto najpierw ustalić, co kasuje `zastosowanie`, zamiast odtwarzać naprawę.
- **I4 — narzuty i promocje w `acceptStaging`** (D3). W I3 nieszkodliwe (tabele puste, co
  charakteryzacja mierzy), od I4 przestaje takie być.
- **I12 — endpointy `uwaga_cena`** (D4): `GET /api/products/uwagi-cena` i `/hold-reasons`.
- **3e** — widok `/staging`. Backend Iteracji 3 jest kompletny.
