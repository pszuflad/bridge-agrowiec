# 168-FEATURE-uzupelnianie-ean-999 — Code review

> Reviewed: 2026-09-30
> Branch: feature/168-uzupelnianie-ean-999
> Diff: 18 plików (+946/-6), 2 commity

## BLOCKER

- [ ] `rebuild/backend/src/import/bulk.ts:150` (+ `ean-pary/uzupelnianie.ts:135-151`) — `POST /api/products` (opt-in `uzupelnijEan: true`) nadpisuje PRAWDZIWY EAN istniejącego produktu wygenerowanym 999…, gdy payload nie zawiera klucza `ean` (albo ma `null`/`""`).
  - Reason: `rekord = {...pozycja}` nie ma `ean`, więc `pustyEan(rekord.ean)` jest prawdą; `uzupelnijEanRekordu` nie patrzy na `istniejacy.ean` i ustawia `rekord.ean`. Potem `db.update(products).set(doZapisu)` zapisuje 999… na miejsce prawdziwego EAN-u. Bez flagi (oryginał) brak klucza oznaczał „nie ruszaj kolumny". To cicha utrata danych, a zakres reguły („tylko puste pola EAN w katalogu") jest łamany.
  - Suggestion: w bulku (i dla spójności w `zatwierdzPozycjeStagingu`) przed wywołaniem reguły dziedziczyć/sprawdzać `istniejacy?.ean`: jeśli karta w katalogu ma niepusty EAN, nie generować (ewentualnie tylko `oznaczJakoZastapiona`). Dodać test: bulk na istniejącym produkcie z EAN i payloadem bez `ean`.

## SHOULD-FIX

- [ ] `rebuild/backend/src/routes/ean-pary.ts:116` — `dry_run` jest porównywane ściśle z `true`; `"true"`, `1` albo brak ciała dają ZAPIS całego katalogu zamiast próby.
  - Suggestion: walidować typ (`dry_run` musi być boolean lub nieobecne, inaczej 400) albo domyślnie traktować nieprawidłową wartość jako dry-run. Dodać test z `dry_run: "true"`.
- [ ] `rebuild/backend/src/import/polityka/fabryka.ts:483-493` — staging bierze EAN z pary bez sprawdzenia `status` i bez kontroli kolizji z `products.ean` (`przydzielEan` ją robi, ścieżka stagingu nie).
  - Reason: (a) para `zastapiony` daje w stagingu stary 999…, a akceptacja nie przywraca jej do `aktywny` (`oznaczJakoZastapiona` zwraca false, gdy EAN się zgadza) — tabela i katalog się rozjeżdżają (`po-kodzie` raportuje wtedy `maEan` niespójnie); (b) jeśli dostawca przyśle później prawdziwy EAN równy 999… z pary innego kodu, staging powiela duplikat.
  - Suggestion: w hooku używać wspólnej funkcji z `uzupelnianie.ts` (sprawdzenie zajętości + reaktywacja przy akceptacji) albo ograniczyć do `aktywny` i przywracać przy akceptacji.
- [ ] `rebuild/backend/src/ean-pary/uzupelnianie.ts:96-101` — przy zajętym EAN pary wiersz dostaje nowy numer i stary numer wraca do puli (UPDATE). Sprzeczne z zasadą „numer zarezerwowany, nigdy ponownie nie wydany" (plan, decyzja 2), a stary EAN mógł już pójść do Selly.
  - Suggestion: zostawić stary wiersz jako `zastapiony`, nowy wstawić osobno — wymaga jednak zmiany `UNIQUE(kod)`; albo świadomie udokumentować odstępstwo.
- [ ] `rebuild/backend/test/ean-pary.test.ts` — brakuje testów: bulk/akceptacja dla produktu istniejącego z EAN (patrz BLOCKER), pełnej ścieżki `zatwierdzPozycjeZPolityka` (zagnieżdżona transakcja `uchwytSqlite.transaction` → `db.transaction` → savepoint; dziś testowane tylko bulk, gdzie działa), `wycofana` bez reguły, `dry_run` z nie-boolean, `kod` z białymi znakami w URL.
- [ ] Plan krok 6 — brak `docs/spec-backend/wpis-168.md` i `docs/rebuild-backlog/wpis-168.md` (świadome odstępstwo od 1:1, nowe trasy spoza kontraktu). Do fazy docs.
- [ ] Gałąź — `git merge-base --is-ancestor origin/develop HEAD` zwraca nie (na lokalnej, niedociągniętej refie): przed PR uruchomić `tools/sync-z-develop.sh` i ponownie sprawdzić numer migracji 017 oraz bramki po scaleniu.

## NICE-TO-HAVE

- [ ] `ean-pary/uzupelnianie.ts:28-37,47-55` — `eanZajetyWKatalogu` to skan `products` bez indeksu na `ean`, wołany w `przydzielEan` dla każdego wiersza (`uzupelnijKatalog`) — O(N·M). Przy ~5,4 tys. produktów akceptowalne; rozważyć jednorazowy `Set` zajętych EAN-ów w `uzupelnijKatalog`.
- [ ] `routes/ean-pary.ts:55-60` — `zrodlo` dla pary `zastapiony` przy pustym katalogu zwraca `wygenerowany` z `maEan:false` (mylące); rozważyć `zrodlo:null`.
- [ ] `routes/ean-pary.ts:98-101` — `generuj`: `przydzielEan` i UPDATE `products` poza jedną transakcją (synchroniczny SQLite, więc bez wyścigu; przy błędzie zostaje para bez EAN w produkcie — idempotentne).
- [ ] `ean-pary/uzupelnianie.ts` `uzupelnijKatalog` — w `dryRun` liczba „uzupełniono" nie uwzględnia par, które byłyby regenerowane; tylko licznik informacyjny.

## Plan compliance

### Done ✓
- Migracja 017 + model `eanPary` zgodne (UNIQUE kod/ean/numer, CHECK status); testy migracji (36 tabel).
- Generator EAN-13 z cyfrą kontrolną i samokontrolą względem walidatora importu; licznik MAX+1 z pomijaniem zajętych w `products.ean`.
- Trasy `po-kodzie`, `po-ean`, `generuj`, `uzupelnij`, lista; `requireAuth`; 400/404; audyt; rejestracja w `app.ts`.
- Hook stagingu w `fabryka.ts` (po dopasowaniu `kod = biezacy.kod`, więc para jest szukana po właściwym kodzie; ostrzeżenie o pustym EAN nie powstaje, brak fałszywego diffu „EAN → pusty").
- Flaga `uzupelnijEan`: włączona w `zatwierdzPozycjeZPolityka` (druga ścieżka), wycofania bez flagi (pierwsze wywołanie), `POST /api/products` włączone; harness charakteryzacji domyślnie wyłączony. Zagnieżdżone transakcje działają (drizzle better-sqlite3 używa `client.transaction` → savepointy).
- Przywracanie pary `zastapiony` → `aktywny` w `przydzielEan` (z kontrolą zajętości).

### Missing or deviating ✗
- Plan krok 4 (hook po akceptacji) zastąpiony wpięciem przed zapisem — udokumentowane w raporcie, akceptowalne; ale zmienia semantykę (patrz BLOCKER dla bulka).
- Plan krok 6 (docs) — brak.
- Zakres „tylko puste EAN-y": naruszony w ścieżce bulk dla istniejących produktów (BLOCKER).

### Definition of done
- [x] Tabela `ean_pary` + migracja 017, unikalność w bazie
- [x] Generator poprawne EAN-13 z 999, bez kolizji
- [ ] Reguła uzupełnia wyłącznie puste EAN-y — bulk może nadpisać prawdziwy EAN
- [x] Kolejny import nie gubi wygenerowanego EAN (staging + akceptacja + po `clear`) — z zastrzeżeniem statusu `zastapiony`
- [x] Trasy przetestowane
- [ ] Gate/bramki po synchronizacji z `origin/develop`, docs, PR `MERGEABLE` — do zrobienia

## Parallel-test concerns

None — testy używają `stworzTestowaBaze` / bazy tymczasowej, bez stałych portów i ścieżek.

## Overall assessment

Kierunek i konstrukcja dobre: licznik + UNIQUE + pomijanie zajętych numerów, czytelna opt-in flaga chroniąca charakteryzację, poprawnie zagnieżdżone transakcje. Główna usterka to ścieżka `POST /api/products`, która potrafi nadpisać prawdziwy EAN istniejącego produktu wygenerowanym; do tego luźny `dry_run` (zapis zamiast próby), niespójność statusu pary w stagingu i brak testów dla tych przypadków oraz dokumentacji.
